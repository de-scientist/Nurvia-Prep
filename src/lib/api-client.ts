import {
  ApiResponse,
  PagedResult,
  QuestionDto,
  ExamDto,
  StartAttemptResultDto,
  ExamReviewContentDto,
  AutosaveResponseRequest,
  AutosaveResultDto,
  SubmittedExamResultDto,
  ExamAttemptSummaryDto,
  AuthUserDto,
  UserProfileDto,
  ExamLayout,
  LectureCatalogueItemDto,
  LectureContentDto,
  LectureManagementDto,
  CreateLectureRequest,
  UpdateLectureRequest,
  ReviewLectureRequest,
} from './api-types';
import { classifyError, isRetryableError, ErrorType } from './utils/error-utils';
import { parseApiResponse } from './api-response';
import { buildApiUrl, DEDICATED_AUTH_ROUTES } from './api-url.mjs';

function unprovisionedResponse<T>(featureName: string, context?: unknown): ApiResponse<T> {
  const detail =
    context !== undefined && context !== null
      ? typeof context === 'string'
        ? context
        : typeof context === 'object' && context !== null
          ? ('id' in context && typeof (context as { id?: unknown }).id === 'string'
              ? (context as { id: string }).id
              : 'title' in context && typeof (context as { title?: unknown }).title === 'string'
                ? (context as { title: string }).title
                : 'name' in context && typeof (context as { name?: unknown }).name === 'string'
                  ? (context as { name: string }).name
                  : JSON.stringify(context).slice(0, 80))
          : String(context)
      : undefined;

  return {
    success: false,
    statusCode: 501,
    errorCode: 'NOT_PROVISIONED',
    message: detail
      ? `${featureName} (${detail}) is not yet provisioned on the LexmaCasto backend for NURVIA.`
      : `${featureName} is not yet provisioned on the LexmaCasto backend for NURVIA.`,
  };
}

export { parseApiResponse, buildApiUrl, DEDICATED_AUTH_ROUTES };

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_IDEMPOTENT_RETRIES = 2;

function buildQuery(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  return query.toString();
}

function createRequestSignal(callerSignal?: AbortSignal | null, timeoutMs = DEFAULT_TIMEOUT_MS): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error('Request timeout connecting to NURVIA API'));
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);

  if (options.body instanceof FormData) {
    // Let the browser generate multipart/form-data and its boundary.
    headers.delete('Content-Type');
  } else if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = isIdempotent ? MAX_IDEMPOTENT_RETRIES + 1 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { signal, cleanup } = createRequestSignal(options.signal);
    try {
      const res = await fetch(buildApiUrl(endpoint), {
        ...options,
        headers,
        signal,
        credentials: 'include',
        cache: 'no-store',
      });

      // Retry idempotent requests only on transient 502/503/504 responses.
      if (isIdempotent && attempt < maxAttempts && [502, 503, 504].includes(res.status)) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }

      return await parseApiResponse<T>(res);
    } catch (error: unknown) {
      const callerAborted = Boolean(options.signal?.aborted);
      if (!callerAborted && isIdempotent && attempt < maxAttempts && isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }

      const errorType = classifyError(error);

      if (errorType === ErrorType.NETWORK_ERROR) {
        return {
          success: false,
          message: 'Network error connecting to NURVIA API',
          statusCode: 0,
          errors: ['Failed to connect to the server. Please check your internet connection.'],
        };
      }

      const message = error instanceof Error ? error.message : 'Unknown network error';
      return {
        success: false,
        message: message || 'Network error connecting to NURVIA API',
        errors: [message],
      };
    } finally {
      cleanup();
    }
  }

  return {
    success: false,
    message: 'Network error connecting to NURVIA API',
    statusCode: 0,
  };
}

function isWebsiteTargetList(value: unknown): boolean {
  return typeof value === 'string' && /WEBSITE_\d+/i.test(value);
}

function parseExamTag(rawTag: unknown): string {
  if (typeof rawTag !== 'string') return '';
  const trimmed = rawTag.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { tagValue?: unknown; tagName?: unknown };
      return String(parsed.tagValue || parsed.tagName || '').trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function inferExamPathway(item: Record<string, any>): import('./api-types').NursingPathway {
  if (typeof item.pathway === 'string' && item.pathway.trim() && !isWebsiteTargetList(item.pathway)) {
    const p = item.pathway.trim();
    if (['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'].includes(p)) {
      return p as import('./api-types').NursingPathway;
    }
  }
  if (typeof item.target === 'string' && item.target.trim() && !isWebsiteTargetList(item.target)) {
    const t = item.target.trim();
    if (['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'].includes(t)) {
      return t as import('./api-types').NursingPathway;
    }
  }
  const haystack = [item.pathway, item.assessmentName, item.programName, item.title, item.code]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0 && !isWebsiteTargetList(v))
    .join(' ')
    .toLowerCase();
  if (/\b(pn|lpn)\s*exit\b|pn_exit/.test(haystack)) return 'PN_Exit';
  if (/\brn\s*exit\b|rn_exit/.test(haystack)) return 'RN_Exit';
  if (/\b(pn|lpn|practical)\b|pn_lpn/.test(haystack)) return 'PN_LPN';
  return 'RN';
}

export function inferExamCategory(item: Record<string, any>): import('./api-types').ExamCategory {
  const direct = typeof item.category === 'string' ? item.category.trim() : '';
  if (['ATI', 'HESI', 'RegularCourse', 'Certification', 'ExitPredictor'].includes(direct)) {
    return direct as import('./api-types').ExamCategory;
  }
  const haystack = [item.category, item.type, item.assessmentName, item.title]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();
  if (/\bati\b|teas/.test(haystack)) return 'ATI';
  if (/\bhesi\b/.test(haystack)) return 'HESI';
  if (/exit|predictor/.test(haystack)) return 'ExitPredictor';
  if (/nclex|certif/.test(haystack)) return 'Certification';
  return 'RegularCourse';
}

function matchesRequestedPathway(item: Record<string, any>, requestedPathway: string): boolean {
  const req = requestedPathway.trim().toLowerCase();
  const normalizedReq = req.replace(/[\s_-]+/g, '');
  const inferred = inferExamPathway(item).toLowerCase();
  const normalizedInferred = inferred.replace(/[\s_-]+/g, '');
  if (normalizedInferred === normalizedReq || normalizedInferred.includes(normalizedReq)) {
    return true;
  }
  const metaText = [item.pathway, item.assessmentName, item.programName, item.title]
    .filter((v): v is string => typeof v === 'string' && !isWebsiteTargetList(v))
    .join(' ')
    .toLowerCase();
  if (metaText.includes(req)) return true;
  if (normalizedReq === 'pnlpn' && /\b(pn|lpn|practical)\b/.test(metaText)) return true;
  return false;
}

export function isModeEnabled(
  modeAllowed: import('./api-types').ExamDeliveryMode | string | undefined | null,
  target: 'Exam' | 'Review' | 'Tutor'
): boolean {
  if (!modeAllowed) return false;
  const normalized = String(modeAllowed).trim().toLowerCase();
  if (normalized === 'all') return true;
  if (normalized === 'both') {
    return target === 'Exam' || target === 'Review';
  }
  return normalized === target.toLowerCase();
}

export function inferExamDeliveryMode(item: Record<string, any>): import('./api-types').ExamDeliveryMode {
  if (typeof item.modeAllowed === 'string' && item.modeAllowed.trim()) {
    const raw = item.modeAllowed.trim().toLowerCase();
    if (raw === 'all') return 'All';
    if (raw === 'both') return 'Both';
    if (raw === 'exam') return 'Exam';
    if (raw === 'review') return 'Review';
    if (raw === 'tutor') return 'Tutor';
  }

  const parsedTag = parseExamTag(item.tag ?? item.tagName ?? item.examTag ?? '');
  const tag = parsedTag.toLowerCase();
  const type = String(item.type ?? item.examType ?? '').trim().toLowerCase();
  const allowReview = Boolean(item.allowReview);

  if (tag.includes('tutor') || type === 'tutor') {
    return 'Tutor';
  }
  if (tag.includes('review') || tag.includes('practice') || type === 'review') {
    return allowReview ? 'All' : 'Review';
  }
  if (tag.includes('exam') || item.type === 'Examination') {
    return allowReview ? 'All' : 'Exam';
  }
  return allowReview ? 'All' : 'Exam';
}

export const nurviaApi = {
  // Authentication and learner profile
  async register(payload: {
    name?: string;
    username?: string;
    email: string;
    phone?: string;
    password?: string;
    passwordConfirmation?: string;
    pin?: string;
    pinConfirmation?: string;
    loginMethod?: string;
    agree?: boolean;
    dashboardName?: string;
    provider?: string;
    providerPayload?: string | Record<string, unknown>;
  }): Promise<ApiResponse<string>> {
    return request<string>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: {
    email: string;
    password?: string;
    pin?: string;
    loginMethod?: string;
    LoginProvider?: string;
    fingerprint?: string;
    dashboardName?: string;
    role?: string;
    rememberMe?: boolean;
  }): Promise<ApiResponse<AuthUserDto>> {
    return request<AuthUserDto>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCurrentUser(init: Pick<RequestInit, 'signal'> = {}): Promise<ApiResponse<AuthUserDto>> {
    return request<AuthUserDto>('/api/auth/me', init);
  },

  async logout(options?: { scope?: 'distinct' | 'relative'; target_dashboard?: string }): Promise<ApiResponse<string>> {
    return request<string>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  // Verified LexmaCasto Academic Strata (with mandatory server-enforced fetchtype)
  async getStrata<T = import('./lexmacasto/contracts').StrataRecord>(
    resource: import('./lexmacasto/contracts').StrataResourceKey,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<import('./lexmacasto/contracts').StrataPagedData<T>>> {
    const query = buildQuery(params);
    return request(`/api/strata/${resource}${query ? `?${query}` : ''}`);
  },

  async updateProfile(payload: { name: string }): Promise<ApiResponse<AuthUserDto>> {
    return request<AuthUserDto>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getProfile(): Promise<ApiResponse<UserProfileDto>> {
    return request<UserProfileDto>('/api/profile');
  },

  async updateProfileDetails(payload: any): Promise<ApiResponse<{ profile: UserProfileDto; message: string }>> {
    return request<{ profile: UserProfileDto; message: string }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async uploadAvatar(file: File): Promise<ApiResponse<{ storageKey: string; message: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    return request<{ storageKey: string; message: string }>('/api/avatar', {
      method: 'POST',
      body: formData,
    });
  },

  async getAvatar(): Promise<ApiResponse<{ storageKey: string; url: string; uploadedAtUtc: string }>> {
    return request<{ storageKey: string; url: string; uploadedAtUtc: string }>('/api/avatar');
  },

  async removeAvatar(): Promise<ApiResponse<string>> {
    return request<string>('/api/avatar', {
      method: 'DELETE',
    });
  },

  async forgotPassword(payload: { email: string }): Promise<ApiResponse<string>> {
    return request<string>('/api/auth/recovery/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resetPassword(payload: { token: string; newPassword: string }): Promise<ApiResponse<string>> {
    return request<string>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getUsers(params?: { search?: string; pageNumber?: number; pageSize?: number }): Promise<
    ApiResponse<
      PagedResult<{
        id: string;
        name: string;
        email: string;
        role: string;
        isActive: boolean;
        createdAtUtc: string;
      }>
    >
  > {
    const query = buildQuery(params);
    return request(`/api/auth/users${query ? `?${query}` : ''}`);
  },

  async assignRole(payload: { targetUserId: string; role: string }): Promise<ApiResponse<string>> {
    return request<string>('/api/auth/assign-role', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Questions
  async getQuestions(params?: Record<string, any>): Promise<ApiResponse<PagedResult<QuestionDto>>> {
    const query = buildQuery(params);
    return request<PagedResult<QuestionDto>>(`/api/questions${query ? `?${query}` : ''}`);
  },

  async getQuestionById(id: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}`);
  },

  async createQuestion(payload: any): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateQuestion(id: string, payload: any): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async validateQuestion(id: string): Promise<ApiResponse<string[]>> {
    return request<string[]>(`/api/questions/${id}/validate`, {
      method: 'POST',
    });
  },

  async submitQuestion(id: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}/submit`, {
      method: 'POST',
    });
  },

  async reviewQuestion(id: string, decision: 'Approved' | 'Rejected' | 'ChangesRequested', comments: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comments }),
    });
  },

  async publishQuestion(id: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}/publish`, {
      method: 'POST',
    });
  },

  async archiveQuestion(id: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}/archive`, {
      method: 'POST',
    });
  },

  async createQuestionVersion(id: string): Promise<ApiResponse<QuestionDto>> {
    return request<QuestionDto>(`/api/questions/${id}/versions`, {
      method: 'POST',
    });
  },

  // Exams
  async getExams(params?: Record<string, any>): Promise<ApiResponse<PagedResult<ExamDto>>> {
    if (params?.status === 'Published') {
      const page = Number(params.pageNumber ?? params.page ?? 1) || 1;
      const rawPerPage = Number(params.pageSize ?? params.perPage ?? 20) || 20;
      const perPage = Math.max(1, Math.min(100, rawPerPage));
      const requestedPathway =
        typeof params.pathway === 'string' && params.pathway.trim()
          ? params.pathway.trim()
          : null;
      const fetchPage = requestedPathway ? 1 : page;
      const fetchPerPage = requestedPathway ? 100 : perPage;

      const strataRes = await this.getStrata<Record<string, any>>('exams', {
        fetchtype: 'absolute',
        page: fetchPage,
        perPage: fetchPerPage,
        dynamicPage: fetchPage,
        dynamicPerPage: fetchPerPage,
        ...(typeof params.search === 'string' && params.search.trim()
          ? { search: params.search.trim(), dynamicSearch: params.search.trim() }
          : {}),
      });

      if (!strataRes.success || !strataRes.data) {
        return {
          success: false,
          message: strataRes.message,
          errorCode: strataRes.errorCode,
          errors: strataRes.errors,
          statusCode: strataRes.statusCode,
        };
      }

      const mappedItems: ExamDto[] = strataRes.data.items
        .filter((item) => {
          const itemStatus = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
          if (itemStatus && itemStatus !== 'published' && itemStatus !== 'active') {
            return false;
          }
          if (requestedPathway && !matchesRequestedPathway(item, requestedPathway)) {
            return false;
          }
          return true;
        })
        .map((item) => ({
          id: String(item.guidId ?? item.id ?? ''),
          code: String(item.code ?? item.guidId ?? item.id ?? ''),
          title: String(item.title ?? item.name ?? 'Untitled Exam'),
          description: String(item.description ?? ''),
          pathway: inferExamPathway(item),
          category: inferExamCategory(item),
          modeAllowed: inferExamDeliveryMode(item),
          timeLimitMinutes: Number(item.timeLimitMinutes ?? item.duration ?? 60),
          passingScorePercentage: Number(item.passingScorePercentage ?? item.passMark ?? 75),
          status: (typeof item.status === 'string' && item.status ? item.status : 'Published') as ExamDto['status'],
          totalQuestions: Number(item.totalQuestions ?? item.questionsCount ?? 0),
          concurrencyToken: String(item.concurrencyToken ?? ''),
          createdAtUtc: String(item.createdAtUtc ?? item.createdAt ?? new Date().toISOString()),
          createdBy: String(item.createdBy ?? ''),
        }))
        .filter((item) => Boolean(item.id));

      const pagedItems = requestedPathway
        ? mappedItems.slice((page - 1) * perPage, page * perPage)
        : mappedItems;
      const totalCount = requestedPathway ? mappedItems.length : (strataRes.data.skewTotal ?? mappedItems.length);
      const totalPages = requestedPathway
        ? Math.max(1, Math.ceil(totalCount / perPage))
        : Math.max(1, strataRes.data.skewTotalPages ?? Math.ceil(totalCount / perPage));

      return {
        success: true,
        message: strataRes.message || 'OK',
        statusCode: strataRes.statusCode,
        data: {
          items: pagedItems,
          totalCount,
          pageNumber: page,
          pageSize: perPage,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    const query = buildQuery(params);
    return request<PagedResult<ExamDto>>(`/api/exams${query ? `?${query}` : ''}`);
  },

  async getExamById(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}`);
  },

  async createExam(payload: any): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>('/api/exams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async configureExam(id: string, payload: any): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async validateExam(id: string): Promise<ApiResponse<string[]>> {
    return request<string[]>(`/api/exams/${id}/validate`, {
      method: 'POST',
    });
  },

  async submitExam(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/submit`, {
      method: 'POST',
    });
  },

  async approveExam(id: string, comments: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  },

  async publishExam(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/publish`, {
      method: 'POST',
    });
  },

  async archiveExam(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/archive`, {
      method: 'POST',
    });
  },

  async releaseExamReview(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/release-review`, {
      method: 'POST',
    });
  },

  async createExamVersion(id: string): Promise<ApiResponse<ExamDto>> {
    return request<ExamDto>(`/api/exams/${id}/versions`, {
      method: 'POST',
    });
  },

  // Audit Logs
  async getAuditLogs(params?: Record<string, any>): Promise<ApiResponse<PagedResult<any>>> {
    const query = buildQuery(params);
    return request<PagedResult<any>>(`/api/audit-logs${query ? `?${query}` : ''}`);
  },

  // Exam Attempts (Learner Experience)
  async startAttempt(
    examId: string,
    options?: { deliveryMode?: 'Exam' | 'Tutor'; layoutMode?: ExamLayout | null }
  ): Promise<ApiResponse<StartAttemptResultDto>> {
    const body = options
      ? { deliveryMode: options.deliveryMode || 'Exam', layoutMode: options.layoutMode ?? null }
      : undefined;
    return request<StartAttemptResultDto>(`/api/attempts/start/${encodeURIComponent(examId)}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async getExamReviewContent(examId: string): Promise<ApiResponse<ExamReviewContentDto>> {
    const directRes = await request<ExamReviewContentDto>(
      `/api/exams/${encodeURIComponent(examId)}/review-content`
    );
    if (directRes.success && directRes.data) {
      return directRes;
    }

    if (directRes.errorCode === 'REVIEW_NOT_PERMITTED') {
      return directRes;
    }

    // Verify whether published exam configuration permits review when caller checks metadata
    const studySetRes = await this.getStudySetDetail(examId);
    const studySet = studySetRes.data;
    if (studySet && !isModeEnabled(studySet.modeAllowed, 'Review')) {
      return {
        success: false,
        statusCode: 403,
        errorCode: 'REVIEW_NOT_PERMITTED',
        message: "Review mode isn't currently enabled for this exam by its published configuration.",
      };
    }

    return directRes;
  },

  async getExamPreviewContent(examId: string): Promise<ApiResponse<ExamReviewContentDto>> {
    return request<ExamReviewContentDto>(`/api/exams/${examId}/preview`);
  },

  async getActiveAttempt(attemptId: string): Promise<ApiResponse<StartAttemptResultDto>> {
    return request<StartAttemptResultDto>(`/api/attempts/${attemptId}`);
  },

  async autosaveResponse(attemptId: string, payload: AutosaveResponseRequest): Promise<ApiResponse<AutosaveResultDto>> {
    return request<AutosaveResultDto>(`/api/attempts/${attemptId}/responses`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async submitAttempt(attemptId: string): Promise<ApiResponse<SubmittedExamResultDto>> {
    return request<SubmittedExamResultDto>(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
    });
  },

  async getAttemptReview(attemptId: string): Promise<ApiResponse<SubmittedExamResultDto>> {
    return request<SubmittedExamResultDto>(`/api/attempts/${attemptId}/review`);
  },

  async getAttemptHistory(params?: {
    page?: number;
    perPage?: number;
    fetchAll?: boolean;
    pathway?: string;
    status?: string;
  }): Promise<ApiResponse<ExamAttemptSummaryDto[]>> {
    const fetchAll = params?.fetchAll !== undefined ? params.fetchAll : !params?.page;
    const query = buildQuery({
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.perPage ? { perPage: params.perPage } : {}),
      ...(fetchAll ? { fetchAll: 'true' } : {}),
      ...(params?.pathway ? { pathway: params.pathway } : {}),
      ...(params?.status ? { status: params.status } : {}),
    });
    return request<ExamAttemptSummaryDto[]>(`/api/attempts/history${query ? `?${query}` : ''}`);
  },

  // Mark K. Lecture Notes
  async getLectureCatalogue(): Promise<ApiResponse<LectureCatalogueItemDto[]>> {
    return request<LectureCatalogueItemDto[]>('/api/lectures');
  },

  async getLectureBySlug(slug: string): Promise<ApiResponse<LectureContentDto>> {
    return request<LectureContentDto>(`/api/lectures/${encodeURIComponent(slug)}`);
  },

  async getManagementLectures(): Promise<ApiResponse<LectureManagementDto[]>> {
    return request<LectureManagementDto[]>('/api/lectures/management');
  },

  async getManagementLecture(id: string): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/management/${id}`);
  },

  async createLectureDraft(payload: CreateLectureRequest): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>('/api/lectures', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateLectureDraft(id: string, payload: UpdateLectureRequest): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async submitLectureForReview(id: string): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/${id}/submit-for-review`, {
      method: 'POST',
    });
  },

  async reviewLecture(id: string, payload: ReviewLectureRequest): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async publishLecture(id: string): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/${id}/publish`, {
      method: 'POST',
    });
  },

  async archiveLecture(id: string): Promise<ApiResponse<LectureManagementDto>> {
    return request<LectureManagementDto>(`/api/lectures/${id}/archive`, {
      method: 'POST',
    });
  },

  // Study Library & Personal Library (backed by verified LexmaCasto Strata endpoints)
  async getStudyLibrary(params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<PagedResult<import('./api-types').StudySetCardDto>>> {
    if (params?.savedOnly === true || params?.savedOnly === 'true') {
      return unprovisionedResponse('Personal Saved Study Library');
    }

    const pageNumber = Math.max(1, Number(params?.pageNumber ?? params?.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params?.pageSize ?? params?.perPage ?? 12) || 12));
    const search = typeof params?.searchTerm === 'string' && params.searchTerm.trim()
      ? params.searchTerm.trim()
      : typeof params?.search === 'string' && params.search.trim()
        ? params.search.trim()
        : undefined;

    const reqPathway = typeof params?.pathway === 'string' && params.pathway.trim() ? params.pathway.trim().toLowerCase() : null;
    const reqCategory = typeof params?.category === 'string' && params.category.trim() ? params.category.trim().toLowerCase() : null;
    const reqSchool = typeof params?.school === 'string' && params.school.trim() ? params.school.trim().toLowerCase() : null;
    const reqSubject = typeof params?.subject === 'string' && params.subject.trim() ? params.subject.trim().toLowerCase() : null;
    const reqTopic = typeof params?.topic === 'string' && params.topic.trim() ? params.topic.trim().toLowerCase() : null;
    const reqDifficulty = typeof params?.difficulty === 'string' && params.difficulty.trim() ? params.difficulty.trim().toLowerCase() : null;
    const reqSeason = typeof params?.season === 'string' && params.season.trim() ? params.season.trim().toLowerCase() : null;
    const reqYear = params?.academicYear ? Number(params.academicYear) : null;
    const reqExamId = typeof params?.examId === 'string' && params.examId.trim() ? params.examId.trim() : null;

    const hasLocalFilter = Boolean(
      reqPathway ||
      reqCategory ||
      reqSchool ||
      reqSubject ||
      reqTopic ||
      reqDifficulty ||
      reqSeason ||
      reqYear ||
      reqExamId
    );

    const fetchPage = hasLocalFilter ? 1 : pageNumber;
    const fetchPerPage = hasLocalFilter ? 100 : pageSize;

    const strataRes = await this.getStrata<Record<string, any>>('exams', {
      fetchtype: 'absolute',
      page: fetchPage,
      perPage: fetchPerPage,
      dynamicPage: fetchPage,
      dynamicPerPage: fetchPerPage,
      ...(search ? { search, dynamicSearch: search } : {}),
      ...(reqExamId ? { examId: reqExamId } : {}),
    });

    if (!strataRes.success || !strataRes.data) {
      return {
        success: false,
        message: strataRes.message || 'Unable to load published study sets.',
        errorCode: strataRes.errorCode,
        errors: strataRes.errors,
        statusCode: strataRes.statusCode,
      };
    }

    const mappedItems: import('./api-types').StudySetCardDto[] = strataRes.data.items
      .filter((item) => {
        const itemStatus = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
        if (itemStatus && itemStatus !== 'published' && itemStatus !== 'active') {
          return false;
        }
        if (reqExamId) {
          const itemGuid = String(item.guidId ?? item.id ?? '').trim();
          const itemNumId = String(item.id ?? '').trim();
          if (itemGuid !== reqExamId && itemNumId !== reqExamId) return false;
        }
        if (reqPathway && !matchesRequestedPathway(item, reqPathway)) {
          return false;
        }
        if (reqCategory) {
          const inferredCat = inferExamCategory(item).toLowerCase();
          const itemCat = String(item.category ?? item.type ?? item.assessmentName ?? '').trim().toLowerCase();
          if (inferredCat !== reqCategory && !itemCat.includes(reqCategory)) return false;
        }
        if (reqSchool) {
          const itemSchool = String(item.school ?? item.schoolName ?? '').trim().toLowerCase();
          if (itemSchool !== reqSchool) return false;
        }
        if (reqSubject) {
          const itemSubject = String(item.subject ?? item.subjectName ?? '').trim().toLowerCase();
          if (itemSubject !== reqSubject) return false;
        }
        if (reqTopic) {
          const itemTopic = String(item.topic ?? item.topicName ?? '').trim().toLowerCase();
          if (itemTopic !== reqTopic) return false;
        }
        if (reqDifficulty) {
          const itemDiff = String(item.difficulty ?? '').trim().toLowerCase();
          if (itemDiff !== reqDifficulty) return false;
        }
        if (reqSeason) {
          const itemSeason = String(item.season ?? item.term ?? '').trim().toLowerCase();
          if (itemSeason !== reqSeason) return false;
        }
        if (reqYear) {
          const itemYear = Number(item.academicYear ?? item.year ?? 0);
          if (itemYear !== reqYear) return false;
        }
        return true;
      })
      .map((item) => ({
        id: String(item.guidId ?? item.id ?? ''),
        code: String(item.code ?? item.guidId ?? item.id ?? ''),
        title: String(item.title ?? item.name ?? 'Untitled Study Set'),
        description: String(item.description ?? ''),
        pathway: inferExamPathway(item),
        category: inferExamCategory(item),
        totalQuestions: Number(item.totalQuestions ?? item.questionsCount ?? 0),
        timeLimitMinutes: Number(item.timeLimitMinutes ?? item.duration ?? 60),
        modeAllowed: inferExamDeliveryMode(item),
        passingScorePercentage: Number(item.passingScorePercentage ?? item.passMark ?? 75),
        allowedLayouts: (typeof item.allowedLayouts === 'string' && item.allowedLayouts && item.allowedLayouts !== 'Any'
          ? item.allowedLayouts
          : 'Both') as import('./api-types').ExamLayoutPolicy,
        defaultLayout: (typeof item.defaultLayout === 'string' && item.defaultLayout && item.defaultLayout !== 'Classic'
          ? item.defaultLayout
          : 'Sequential') as ExamLayout,
        school: typeof item.school === 'string' ? item.school : typeof item.schoolName === 'string' ? item.schoolName : null,
        academicYear: typeof item.academicYear === 'number' ? item.academicYear : typeof item.year === 'number' ? item.year : null,
        subject: typeof item.subject === 'string' ? item.subject : typeof item.subjectName === 'string' ? item.subjectName : null,
        season: typeof item.season === 'string' ? item.season : null,
        topic: typeof item.topic === 'string' ? item.topic : null,
        difficulty: (typeof item.difficulty === 'string' ? item.difficulty : null) as import('./api-types').DifficultyLevel | null,
        averageRating: typeof item.averageRating === 'number' ? item.averageRating : typeof item.rating === 'number' ? item.rating : null,
        reviewCount: Number(item.reviewCount ?? 0),
        featuredTestimonial: typeof item.featuredTestimonial === 'string' ? item.featuredTestimonial : null,
        isSaved: false,
      }))
      .filter((item) => Boolean(item.id));

    const pagedItems = hasLocalFilter
      ? mappedItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
      : mappedItems;

    const totalCount = hasLocalFilter
      ? mappedItems.length
      : (strataRes.data.skewTotal ?? mappedItems.length);
    const totalPages = hasLocalFilter
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : Math.max(1, strataRes.data.skewTotalPages ?? Math.ceil(totalCount / pageSize));

    return {
      success: true,
      message: strataRes.message || 'OK',
      statusCode: strataRes.statusCode,
      data: {
        items: pagedItems,
        totalCount,
        pageNumber,
        pageSize,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    };
  },

  async getStudyLibraryFilters(): Promise<ApiResponse<import('./api-types').StudyLibraryFiltersDto>> {
    const [schoolsRes, subjectsRes, topicsRes, examsRes, sectionsRes] = await Promise.all([
      this.getStrata<Record<string, any>>('schools', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('subjects', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('topics', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('exams', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('sections', { fetchtype: 'absolute', page: 1, perPage: 100 }),
    ]);

    if (!schoolsRes.success && !subjectsRes.success && !topicsRes.success && !examsRes.success && !sectionsRes.success) {
      return {
        success: false,
        message: examsRes.message || 'Unable to load study library filters.',
        errorCode: examsRes.errorCode,
      };
    }

    const pickName = (r: Record<string, any>) =>
      String(r.name ?? r.title ?? r.slug ?? r.code ?? r.id ?? '').trim();
    const pickId = (r: Record<string, any>) =>
      String(r.guidId ?? r.id ?? r._id ?? r.slug ?? '').trim();

    const examItems = examsRes.success && examsRes.data ? examsRes.data.items : [];
    const sectionItems = sectionsRes.success && sectionsRes.data ? sectionsRes.data.items : [];

    const pathwaySet = new Set<import('./api-types').NursingPathway>();
    const categorySet = new Set<import('./api-types').ExamCategory>();
    const yearSet = new Set<number>();
    const seasonSet = new Set<string>();
    const difficultySet = new Set<string>();
    for (const rec of examItems) {
      pathwaySet.add(inferExamPathway(rec));
      categorySet.add(inferExamCategory(rec));
    }
    for (const rec of [...examItems, ...sectionItems]) {
      const y = rec.academicYear ?? rec.year;
      if (typeof y === 'number' && Number.isFinite(y)) yearSet.add(y);
      else if (typeof y === 'string' && /^\d{4}$/.test(y.trim())) yearSet.add(Number(y.trim()));
      const s = rec.season ?? rec.term;
      if (typeof s === 'string' && s.trim()) seasonSet.add(s.trim());
      if (typeof rec.difficulty === 'string' && rec.difficulty.trim()) difficultySet.add(rec.difficulty.trim());
    }

    return {
      success: true,
      message: 'OK',
      data: {
        pathways: Array.from(pathwaySet),
        categories: Array.from(categorySet),
        schools: (schoolsRes.data?.items ?? []).map(pickName).filter(Boolean),
        academicYears: Array.from(yearSet).sort((a, b) => b - a),
        subjects: (subjectsRes.data?.items ?? []).map(pickName).filter(Boolean),
        seasons: Array.from(seasonSet),
        exams: examItems
          .map((ex) => ({
            id: pickId(ex),
            code: typeof ex.code === 'string' && ex.code.trim() ? ex.code.trim() : pickId(ex),
            title: pickName(ex),
            pathway: inferExamPathway(ex),
            category: inferExamCategory(ex),
          }))
          .filter((ex) => ex.id && ex.title),
        topics: (topicsRes.data?.items ?? []).map(pickName).filter(Boolean),
        difficulties: Array.from(difficultySet) as import('./api-types').DifficultyLevel[],
        questionTypes: [],
      },
    };
  },

  async getStudyLibrarySummary(): Promise<ApiResponse<import('./api-types').StudyLibrarySummaryDto>> {
    const [examsRes, categoriesRes, questionsRes] = await Promise.all([
      this.getStrata<Record<string, any>>('exams', { fetchtype: 'absolute', page: 1, perPage: 50 }),
      this.getStrata<Record<string, any>>('categories', { fetchtype: 'absolute', page: 1, perPage: 1 }),
      this.getStrata<Record<string, any>>('questions', { fetchtype: 'absolute', page: 1, perPage: 1 }),
    ]);

    if (!examsRes.success && !categoriesRes.success && !questionsRes.success) {
      return {
        success: false,
        message: examsRes.message || 'Unable to load study library summary.',
        errorCode: examsRes.errorCode,
      };
    }

    const discoveredPathways = new Set(
      (examsRes.data?.items ?? []).map((item) => inferExamPathway(item))
    );

    return {
      success: true,
      message: 'OK',
      data: {
        totalPublishedStudySets: examsRes.data?.skewTotal ?? examsRes.data?.items.length ?? 0,
        totalAvailableQuestions: questionsRes.data?.skewTotal ?? questionsRes.data?.items.length ?? 0,
        totalCategories: categoriesRes.data?.skewTotal ?? categoriesRes.data?.items.length ?? 0,
        totalPathways: discoveredPathways.size,
      },
    };
  },

  async getStudySetDetail(examId: string): Promise<ApiResponse<import('./api-types').StudySetDetailDto>> {
    const trimmedId = (examId || '').trim();
    if (!trimmedId) {
      return {
        success: false,
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Examination identifier is required.',
      };
    }

    // 1. Check if dedicated study library detail endpoint responds with structured DTO
    try {
      const direct = await request<import('./api-types').StudySetDetailDto>(`/api/study-library/${trimmedId}`);
      if (direct.success && direct.data && direct.data.id) {
        return direct;
      }
    } catch {
      // Continue to Strata discovery
    }

    // 2. Fetch the authoritative published study set from Strata
    const libraryRes = await this.getStudyLibrary({ examId: trimmedId, pageSize: 1 });
    let card: import('./api-types').StudySetCardDto | undefined = libraryRes.data?.items?.[0];

    if (!card) {
      // Fallback search by searchTerm if exact examId query did not match
      const searchRes = await this.getStudyLibrary({ searchTerm: trimmedId, pageSize: 1 });
      card = searchRes.data?.items?.find((i) => i.id === trimmedId || i.code === trimmedId) ?? searchRes.data?.items?.[0];
    }

    if (!card) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        message: 'This examination could not be found in the published study library.',
      };
    }

    // 3. Return authoritative published detail DTO
    const detailDto: import('./api-types').StudySetDetailDto = {
      ...card,
      instructions: "Answer all questions carefully and within the allocated time, using current best practices and critical thinking.",
      learningObjectives: [
        "Strengthen clinical judgment and diagnostic reasoning across core nursing competencies.",
        "Practice NCLEX-format question answering and time allocation endurance.",
      ],
      subjectsCovered: card.subject ? [card.subject] : [],
      topicsCovered: card.topic ? [card.topic] : [],
      questionTypesIncluded: [],
      reviews: [],
      canReview: false,
      learnerReview: null,
    };

    return {
      success: true,
      statusCode: 200,
      message: 'OK',
      data: detailDto,
    };
  },

  async getSavedStudySets(): Promise<ApiResponse<import('./api-types').StudySetCardDto[]>> {
    return unprovisionedResponse('Personal Saved Study Library');
  },

  async saveStudySet(examId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Personal Saved Study Library', examId);
  },

  async removeSavedStudySet(examId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Personal Saved Study Library', examId);
  },

  async getStudySetReviews(examId: string, pageNumber = 1, pageSize = 10): Promise<ApiResponse<PagedResult<import('./api-types').ExamReviewDto>>> {
    return unprovisionedResponse('Study Set Reviews', `exam: ${examId}, page: ${pageNumber}/${pageSize}`);
  },

  async submitStudySetReview(examId: string, payload: import('./api-types').SubmitExamReviewRequest): Promise<ApiResponse<import('./api-types').ExamReviewDto>> {
    return unprovisionedResponse('Study Set Reviews', `exam: ${examId}, rating: ${payload.rating}`);
  },

  // Tutor Mode Progressive Guidance
  async requestTutorHint(
    attemptId: string,
    payload: { questionId: string; stage: import('./api-types').TutorStage }
  ): Promise<ApiResponse<import('./api-types').TutorHintResponseDto>> {
    return request(`/api/attempts/${attemptId}/tutor/hint`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async evaluateTutorAnswer(
    attemptId: string,
    payload: { questionId: string; responseJson: string }
  ): Promise<ApiResponse<import('./api-types').TutorEvaluateResponseDto>> {
    return request(`/api/attempts/${attemptId}/tutor/evaluate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Tutor session recovery: server-authoritative stage progression with
  // already-authorized evaluation content (never answer-bearing for stages 1-3).
  async getTutorSessionState(
    attemptId: string
  ): Promise<ApiResponse<import('./api-types').TutorSessionStateDto>> {
    return request(`/api/attempts/${attemptId}/tutor/session`, {
      method: 'GET',
    });
  },

  // Admin Dashboard & Operations
  async getAdminOverview(): Promise<ApiResponse<{
    totalQuestions: number;
    publishedQuestions: number;
    totalExams: number;
    publishedExams: number;
    totalLearners: number;
    activeLearners: number;
    clinicalCaseStudies: number;
    pipeline: { stage: string; count: number }[];
    recentQuestions: {
      id: string;
      stemPreview: string;
      category: string;
      questionType: string;
      status: string;
      createdAtUtc: string;
    }[];
  }>> {
    return request('/api/admin/overview');
  },

  async getAdminLearners(params?: { search?: string; pageNumber?: number; pageSize?: number }): Promise<ApiResponse<PagedResult<{
    id: string;
    name: string;
    email: string;
    pathway: string;
    isActive: boolean;
    completedExams: number;
    averageScorePercentage: number | null;
    createdAtUtc: string;
  }>>> {
    const query = buildQuery(params);
    return request(`/api/admin/learners${query ? `?${query}` : ''}`);
  },

  async getAdminQuestionTypes(): Promise<ApiResponse<{
    codeValue: number;
    code: string;
    name: string;
    gradingMode: string;
    description: string;
    questionCount: number;
  }[]>> {
    return request('/api/admin/question-types');
  },

  async getAdminAnalytics(): Promise<ApiResponse<{
    totalAttempts: number;
    completedAttempts: number;
    inProgressAttempts: number;
    meanScorePercentage: number | null;
    passRatePercentage: number | null;
    trackBreakdown: {
      pathway: string;
      attemptCount: number;
      completedCount: number;
      meanScorePercentage: number | null;
    }[];
  }>> {
    return request('/api/admin/analytics');
  },

  async getAdminTaxonomy(): Promise<ApiResponse<{
    totalQuestions: number;
    clientNeedsCategories: {
      category: string;
      questionCount: number;
      subjects: string[];
    }[];
    pathways: string[];
    subjects: string[];
    topics: string[];
  }>> {
    return request('/api/admin/taxonomy');
  },

  async getAdminSystemStatus(): Promise<ApiResponse<{
    environment: string;
    databaseStatus: string;
    pendingMigrationsCount: number;
    aiTutorProvider: string;
    emailDeliveryMode: string;
    checkedAtUtc: string;
  }>> {
    return request('/api/admin/system-status');
  },

  // Learner Saved Questions (not yet provisioned on LexmaCasto)
  async getSavedQuestions(): Promise<ApiResponse<{
    id: string;
    questionId: string;
    examId: string | null;
    stem: string;
    subject: string;
    topic: string;
    questionType: string;
    notes: string | null;
    savedAtUtc: string;
  }[]>> {
    return unprovisionedResponse('Saved Questions');
  },

  async saveQuestion(questionId: string, payload?: { examId?: string | null; notes?: string | null }): Promise<ApiResponse<{
    id: string;
    questionId: string;
    examId: string | null;
    stem: string;
    subject: string;
    topic: string;
    questionType: string;
    notes: string | null;
    savedAtUtc: string;
  }>> {
    return unprovisionedResponse('Saved Questions', `question: ${questionId}${payload?.examId ? `, exam: ${payload.examId}` : ''}`);
  },

  async removeSavedQuestion(questionId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Saved Questions', questionId);
  },

  // Learner Study Planner (not yet provisioned on LexmaCasto)
  async getPlannerTasks(): Promise<ApiResponse<{
    id: string;
    title: string;
    scheduledForUtc: string;
    durationMinutes: number;
    examId: string | null;
    examTitle: string | null;
    isCompleted: boolean;
    completedAtUtc: string | null;
    createdAtUtc: string;
  }[]>> {
    return unprovisionedResponse('Study Planner');
  },

  async createPlannerTask(payload: {
    title: string;
    scheduledForUtc: string;
    durationMinutes: number;
    examId?: string | null;
  }): Promise<ApiResponse<{
    id: string;
    title: string;
    scheduledForUtc: string;
    durationMinutes: number;
    examId: string | null;
    examTitle: string | null;
    isCompleted: boolean;
    completedAtUtc: string | null;
    createdAtUtc: string;
  }>> {
    return unprovisionedResponse('Study Planner', payload.title);
  },

  async updatePlannerTask(taskId: string, payload: {
    title?: string;
    scheduledForUtc?: string;
    durationMinutes?: number;
    examId?: string | null;
    isCompleted?: boolean;
  }): Promise<ApiResponse<{
    id: string;
    title: string;
    scheduledForUtc: string;
    durationMinutes: number;
    examId: string | null;
    examTitle: string | null;
    isCompleted: boolean;
    completedAtUtc: string | null;
    createdAtUtc: string;
  }>> {
    return unprovisionedResponse('Study Planner', `task: ${taskId}${payload.title ? `, title: ${payload.title}` : ''}`);
  },

  async deletePlannerTask(taskId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Study Planner', taskId);
  },

  // Flashcards & Spaced Repetition (not yet provisioned on LexmaCasto)
  async getFlashcards(params?: { category?: string; dueOnly?: boolean }): Promise<ApiResponse<import('./api-types').FlashcardDto[]>> {
    return unprovisionedResponse('Spaced Repetition Flashcards', params?.category || (params?.dueOnly ? 'due-only' : undefined));
  },

  async createFlashcard(payload: {
    category: string;
    pathway: string;
    front: string;
    back: string;
    hint?: string;
  }): Promise<ApiResponse<import('./api-types').FlashcardDto>> {
    return unprovisionedResponse('Spaced Repetition Flashcards', payload.front.slice(0, 40));
  },

  async deleteFlashcard(id: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Spaced Repetition Flashcards', id);
  },

  async reviewFlashcard(id: string, rating: 'Again' | 'Hard' | 'Good' | 'Easy'): Promise<ApiResponse<import('./api-types').FlashcardDto>> {
    return unprovisionedResponse('Spaced Repetition Flashcards', `card: ${id}, rating: ${rating}`);
  },

  // Care Plans (not yet provisioned on LexmaCasto)
  async getCarePlans(params?: { specialty?: string; search?: string }): Promise<ApiResponse<import('./api-types').CarePlanDto[]>> {
    return unprovisionedResponse('Clinical Nursing Care Plans', params?.specialty || params?.search);
  },

  async createCarePlan(payload: {
    title: string;
    specialty: string;
    diagnosis: string;
    relatedTo: string;
    outcomes: string[];
    interventions: string[];
    rationale: string;
  }): Promise<ApiResponse<import('./api-types').CarePlanDto>> {
    return unprovisionedResponse('Clinical Nursing Care Plans', payload.title);
  },

  async deleteCarePlan(id: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Clinical Nursing Care Plans', id);
  },

  // Study Guides (not yet provisioned on LexmaCasto)
  async getStudyGuides(params?: { category?: string; pathway?: string; search?: string }): Promise<ApiResponse<import('./api-types').StudyGuideSummaryDto[]>> {
    return unprovisionedResponse('Study Guides', params?.category || params?.pathway || params?.search);
  },

  async getStudyGuideById(id: string): Promise<ApiResponse<import('./api-types').StudyGuideDetailDto>> {
    return unprovisionedResponse('Study Guides', id);
  },

  async createStudyGuide(payload: {
    title: string;
    category: string;
    pathway: string;
    summary: string;
    contentMarkdown: string;
    readingMinutes?: number;
    isPublished?: boolean;
  }): Promise<ApiResponse<import('./api-types').StudyGuideDetailDto>> {
    return unprovisionedResponse('Study Guides', payload.title);
  },

  // Community & Additive Ecosystem API Integrations
  async getCommunityCategoryGroups(): Promise<ApiResponse<import('./api-types').CommunityCategoryGroupDto[]>> {
    return request<import('./api-types').CommunityCategoryGroupDto[]>('/api/community/categories');
  },

  async getCommunityPosts(params?: {
    sort?: 'newest' | 'hot' | 'top' | 'comments' | 'unanswered';
    categorySlug?: string;
    channelId?: string;
    postType?: import('./api-types').CommunityPostType;
    search?: string;
    solvedOnly?: boolean;
    region?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<{ items: import('./api-types').CommunityPostDetailDto[]; totalCount: number; page: number; totalPages: number }>> {
    const qs = buildQuery(params);
    return request<{ items: import('./api-types').CommunityPostDetailDto[]; totalCount: number; page: number; totalPages: number }>(
      `/api/community/posts${qs ? `?${qs}` : ''}`
    );
  },

  async getCommunityPost(id: string): Promise<ApiResponse<import('./api-types').CommunityPostDetailDto>> {
    return request<import('./api-types').CommunityPostDetailDto>(`/api/community/posts/${encodeURIComponent(id)}`);
  },

  async createCommunityPost(payload: import('./api-types').CreateCommunityPostRequest): Promise<ApiResponse<import('./api-types').CommunityPostDetailDto>> {
    return request<import('./api-types').CommunityPostDetailDto>('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addCommunityReply(postId: string, content: string): Promise<ApiResponse<import('./api-types').CommunityReplyDto>> {
    return request<import('./api-types').CommunityReplyDto>(`/api/community/posts/${encodeURIComponent(postId)}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async toggleCommunityVote(postId: string, direction: 'up' | 'down'): Promise<ApiResponse<{ voteScore: number; userVote: 'up' | 'down' | null }>> {
    return request<{ voteScore: number; userVote: 'up' | 'down' | null }>(`/api/community/posts/${encodeURIComponent(postId)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },

  async toggleCommunityLike(postId: string): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> {
    const res = await this.toggleCommunityVote(postId, 'up');
    if (!res.success || !res.data) {
      return {
        success: false,
        statusCode: res.statusCode,
        errorCode: res.errorCode,
        message: res.message,
      };
    }
    return {
      success: true,
      statusCode: 200,
      message: 'Vote recorded',
      data: {
        liked: res.data.userVote === 'up',
        likeCount: res.data.voteScore,
      },
    };
  },

  async reportCommunityPost(postId: string, reason: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return request<{ success: boolean; message: string }>(`/api/community/posts/${encodeURIComponent(postId)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deleteCommunityPost(postId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Post Deletion', postId);
  },

  // Question of the Day
  async getQotdToday(): Promise<ApiResponse<import('./api-types').QotdQuestionDto>> {
    return request<import('./api-types').QotdQuestionDto>('/api/qotd/today');
  },

  async submitQotdAnswer(questionId: string, selectedOptionId: string): Promise<ApiResponse<import('./api-types').QotdSubmissionResultDto>> {
    return request<import('./api-types').QotdSubmissionResultDto>('/api/qotd/submit', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionId }),
    });
  },

  async getQotdHistory(): Promise<ApiResponse<{ streak: number; totalCompleted: number; pastQuestions: { id: string; dateStr: string; title: string; category: string }[] }>> {
    return request<{ streak: number; totalCompleted: number; pastQuestions: { id: string; dateStr: string; title: string; category: string }[] }>('/api/qotd/history');
  },

  // Study Groups
  async getStudyGroups(params?: { examTrack?: string; search?: string }): Promise<ApiResponse<import('./api-types').StudyGroupDto[]>> {
    const qs = buildQuery(params);
    return request<import('./api-types').StudyGroupDto[]>(`/api/groups${qs ? `?${qs}` : ''}`);
  },

  async getStudyGroup(id: string): Promise<ApiResponse<import('./api-types').StudyGroupDto>> {
    return request<import('./api-types').StudyGroupDto>(`/api/groups/${encodeURIComponent(id)}`);
  },

  async createStudyGroup(payload: import('./api-types').CreateStudyGroupRequest): Promise<ApiResponse<import('./api-types').StudyGroupDto>> {
    return request<import('./api-types').StudyGroupDto>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async joinStudyGroup(id: string): Promise<ApiResponse<{ success: boolean; message: string; group?: import('./api-types').StudyGroupDto }>> {
    return request<{ success: boolean; message: string; group?: import('./api-types').StudyGroupDto }>(`/api/groups/${encodeURIComponent(id)}/join`, {
      method: 'POST',
    });
  },

  async leaveStudyGroup(id: string): Promise<ApiResponse<{ success: boolean; message: string; group?: import('./api-types').StudyGroupDto }>> {
    return request<{ success: boolean; message: string; group?: import('./api-types').StudyGroupDto }>(`/api/groups/${encodeURIComponent(id)}/leave`, {
      method: 'POST',
    });
  },

  // Nurse Mentors
  async getMentors(params?: { specialty?: string; search?: string; examTrack?: string }): Promise<ApiResponse<import('./api-types').MentorProfileDto[]>> {
    const qs = buildQuery(params);
    return request<import('./api-types').MentorProfileDto[]>(`/api/mentors${qs ? `?${qs}` : ''}`);
  },

  async requestMentorSession(payload: import('./api-types').MentorSessionRequestDto): Promise<ApiResponse<{ success: boolean; message: string; requestId: string }>> {
    return request<{ success: boolean; message: string; requestId: string }>('/api/mentors/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Community Insights
  async getCommunityInsights(): Promise<ApiResponse<import('./api-types').CommunityInsightsSummaryDto>> {
    return request<import('./api-types').CommunityInsightsSummaryDto>('/api/insights/summary');
  },

  async shareExamResult(payload: {
    examType: string;
    outcome: 'Pass' | 'Fail' | 'Waiting';
    examDate?: string;
    questionCount?: number;
    weeksStudied?: number;
    prepResources: string[];
    story?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string; recordId: string }>> {
    return request<{ success: boolean; message: string; recordId: string }>('/api/insights/share', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Global Multi-Faceted Search
  async searchGlobal(query: string, type?: string): Promise<ApiResponse<import('./api-types').GlobalSearchResponseDto>> {
    const qs = buildQuery({ q: query, type });
    return request<import('./api-types').GlobalSearchResponseDto>(`/api/search/global${qs ? `?${qs}` : ''}`);
  },

  // AI Tutor Chat Sessions (not yet provisioned on LexmaCasto)
  async getTutorSessions(): Promise<ApiResponse<import('./api-types').TutorChatSessionDto[]>> {
    return unprovisionedResponse('AI Tutor Sessions');
  },

  async createTutorSession(payload: { title?: string; pathway?: string; topic?: string }): Promise<ApiResponse<import('./api-types').TutorChatSessionDto>> {
    return unprovisionedResponse('AI Tutor Sessions', payload.title || payload.topic || payload.pathway || 'new-session');
  },

  async getTutorSession(id: string): Promise<ApiResponse<import('./api-types').TutorChatSessionDto>> {
    return unprovisionedResponse('AI Tutor Sessions', id);
  },

  async sendTutorMessage(id: string, message: string): Promise<ApiResponse<import('./api-types').TutorChatSessionDto>> {
    return unprovisionedResponse('AI Tutor Sessions', `session: ${id}, message: ${message.slice(0, 30)}`);
  },

  async deleteTutorSession(id: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('AI Tutor Sessions', id);
  },

  // Subscriptions & Entitlements (not yet provisioned on LexmaCasto for NURVIA)
  async getSubscriptionPlans(): Promise<ApiResponse<import('./api-types').SubscriptionPlanDto[]>> {
    return unprovisionedResponse('Subscription Plans');
  },

  async getMySubscription(): Promise<ApiResponse<{
    activeSubscription: import('./api-types').UserSubscriptionDto | null;
    plans: import('./api-types').SubscriptionPlanDto[];
    paymentProviderConfigured: boolean;
  }>> {
    return unprovisionedResponse('Subscriptions');
  },

  async activateFreeTier(): Promise<ApiResponse<import('./api-types').UserSubscriptionDto>> {
    return unprovisionedResponse('Subscriptions');
  },

  async requestCheckout(planId: string): Promise<ApiResponse<string>> {
    return unprovisionedResponse('Subscriptions', planId);
  },

  async getAdminSubscriptions(): Promise<ApiResponse<import('./api-types').UserSubscriptionDto[]>> {
    return request('/api/admin/subscriptions');
  },

  async createSubscriptionPlan(payload: {
    code: string;
    name: string;
    description: string;
    monthlyPriceUsd: number;
    billingInterval: string;
    features: string[];
    isActive?: boolean;
  }): Promise<ApiResponse<import('./api-types').SubscriptionPlanDto>> {
    return request('/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async grantEntitlement(payload: {
    targetUserId: string;
    planId: string;
    durationDays: number;
    notes?: string;
  }): Promise<ApiResponse<import('./api-types').UserSubscriptionDto>> {
    return request('/api/admin/subscriptions/grant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeEntitlement(subscriptionId: string): Promise<ApiResponse<string>> {
    return request(`/api/admin/subscriptions/${subscriptionId}/revoke`, { method: 'POST' });
  },

  // Staff Invitations
  async getStaffInvitations(): Promise<ApiResponse<import('./api-types').StaffInvitationDto[]>> {
    return request('/api/auth/invitations');
  },

  async createStaffInvitation(payload: { email: string; role: string }): Promise<ApiResponse<{
    invitation: import('./api-types').StaffInvitationDto;
    devInviteToken?: string | null;
  }>> {
    return request('/api/auth/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeStaffInvitation(id: string): Promise<ApiResponse<string>> {
    return request(`/api/auth/invitations/${id}`, { method: 'DELETE' });
  },

  async acceptStaffInvitation(payload: { token: string; name: string; password: string }): Promise<ApiResponse<string>> {
    return request('/api/auth/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Qlex-Compatible Search (Seek)
  async seek(params: {
    query: string;
    fetchtype?: 'absolute' | 'distinct';
    scope?: string;
    mode?: string;
    sort?: string;
    page?: number;
    perPage?: number;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    const qs = new URLSearchParams();
    qs.set('fetchtype', params.fetchtype || 'absolute');
    qs.set('query', params.query);
    if (params.scope) qs.set('scope', params.scope);
    if (params.mode) qs.set('mode', params.mode);
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    return request(`/api/seek?${qs.toString()}`);
  },

  async seekSuggest(query: string): Promise<ApiResponse<unknown[]>> {
    const qs = new URLSearchParams({ fetchtype: 'suggest', query });
    return request(`/api/seek?${qs.toString()}`);
  },

  async getSeekHistory(): Promise<ApiResponse<unknown[]>> {
    return request('/api/seek?fetchtype=history');
  },

  async clearSeekHistory(): Promise<ApiResponse<string>> {
    return request('/api/seek?fetchtype=history', { method: 'DELETE' });
  },

  // DIY Custom Learning Exam
  async createDiyExam(payload: {
    title: string;
    totalQuestions: number;
    description?: string;
    courseId?: string;
    subjectId?: string;
    timeLimitMinutes?: number;
    [key: string]: unknown;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/exams/diy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Authenticated Account Deletion & Support Token Validation
  async destroyAccount(reason: string): Promise<ApiResponse<string>> {
    return request('/api/auth/account/destroy', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async validateSupportToken(token: string, context: string): Promise<ApiResponse<Record<string, unknown>>> {
    const qs = new URLSearchParams({ token, context });
    return request(`/api/auth/validate?${qs.toString()}`);
  },

  // Staff Academic Strata CRUD
  async createStrataRecord(resource: string, payload: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return request(`/api/strata/${resource}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStrataRecord(resource: string, payload: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return request(`/api/strata/${resource}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteStrataRecord(resource: string, payload: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return request(`/api/strata/${resource}`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  },

  // LexmaCasto Support, Security, Notifications (Heed) & Subscriptions
  async updateSupportAccount(payload: Record<string, unknown>): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/account', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async changeSupportPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/account', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTwoFactorStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/2fa?fetchtype=current');
  },

  async setupTwoFactor(): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/2fa', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async confirmTwoFactor(code: string): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/2fa', {
      method: 'PUT',
      body: JSON.stringify({ code }),
    });
  },

  async disableTwoFactor(code?: string): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/2fa', {
      method: 'DELETE',
      body: JSON.stringify(code ? { code } : {}),
    });
  },

  async sendEmailVerification(): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/email', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async confirmEmailVerification(code: string): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/email', {
      method: 'PUT',
      body: JSON.stringify({ code }),
    });
  },

  async getSupportMessages(params?: {
    fetchtype?: 'relative' | 'current';
    status?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    const qs = new URLSearchParams();
    qs.set('fetchtype', params?.fetchtype ?? 'relative');
    if (params?.status) qs.set('clientStatus', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.perPage) qs.set('perPage', String(params.perPage));
    return request(`/api/auth/support/message?${qs.toString()}`);
  },

  async sendSupportMessage(payload: {
    subject: string;
    message: string;
    category?: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSupportMessageStatus(payload: {
    id: string | number;
    clientReadStatus: 'Unread' | 'Read' | 'Later' | 'Bookmarked' | 'Flagged' | 'Pinned' | 'Starred';
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/auth/support/message', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getLexmaCastoSubscriptionPackages(): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/subscriptions/packages?fetchtype=discrete');
  },

  async getLexmaCastoSubscriptionItems(): Promise<ApiResponse<Record<string, unknown>>> {
    return request('/api/subscriptions/items?fetchtype=relative');
  },

  async getSystemDebugRoutes(params?: {
    target?: 'view' | 'routes';
    search?: string;
    method?: string;
    group?: string;
    page?: number;
    perPage?: number;
  }): Promise<ApiResponse<import('./lexmacasto/contracts').SystemDebugRoutesPayload>> {
    const qs = new URLSearchParams();
    if (params?.target) qs.set('target', params.target);
    if (params?.search) qs.set('search', params.search);
    if (params?.method) qs.set('method', params.method);
    if (params?.group) qs.set('group', params.group);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.perPage) qs.set('perPage', String(params.perPage));
    const query = qs.toString();
    return request(`/api/system/debug/routes${query ? `?${query}` : ''}`);
  },
};
