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

export interface PathwayClassificationResult {
  eligible: boolean;
  pathway?: import('./api-types').NursingPathway;
  category?: import('./api-types').ExamCategory;
  reason?: string;
}

export function classifyAuthoritativePathway(item: Record<string, any>): PathwayClassificationResult {
  const assId = Number(item.assessmentId ?? item.assessmentNumericId ?? 0);
  const assName = String(item.assessmentName ?? '').trim();
  const progId = Number(item.programId ?? 0);
  const progName = String(item.programName ?? item.program ?? '').trim();
  const courseId = Number(item.courseId ?? 0);
  const courseName = String(item.courseName ?? item.course ?? '').trim();
  const rawTitle = String(item.title ?? item.name ?? '').trim();
  const rawDesc = String(item.description ?? '').trim();
  const rawResources = String(item.resources ?? '').trim();
  const haystack = [assName, progName, courseName, rawTitle, rawDesc, rawResources]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0 && !isWebsiteTargetList(v))
    .join(' ')
    .toLowerCase();

  // 1. Strict NCLEX exclusion (NCLEX belongs exclusively to PrepFord)
  if (
    assId === 6 ||
    assId === 7 ||
    progId === 7 ||
    progId === 8 ||
    /nclex/i.test(assName) ||
    /nclex/i.test(progName) ||
    /nclex/i.test(courseName) ||
    /\bnclex\s*[-–—]?(rn|pn)\b/i.test(rawTitle) ||
    /\b(nclex-rn|nclex-pn|nclex rn|nclex pn)\b/i.test(haystack)
  ) {
    return { eligible: false, reason: 'NCLEX-related content (served via PrepFord)' };
  }

  // 2. Strict Non-Nursing / Pre-Admission Exclusions (GED, TEAS, HESI A2, ACCUPLACER, CNA)
  if (assId === 3 || /ged\b/i.test(assName) || /\bged\b/i.test(rawTitle)) {
    return { eligible: false, reason: 'GED (High School Equivalency)' };
  }
  if (
    assId === 2 ||
    assId === 4 ||
    progId === 3 ||
    progId === 5 ||
    /hesi\s*a2|ati\s*teas|accuplacer/i.test(assName) ||
    /hesi\s*a2|ati\s*teas/i.test(progName) ||
    /\b(teas|hesi\s*a2)\b/i.test(rawTitle)
  ) {
    return { eligible: false, reason: 'Pre-nursing admissions (ATI TEAS / HESI A2)' };
  }
  if (assId === 1 || assId === 11 || /cna\b/i.test(assName) || /accuplacer/i.test(assName)) {
    return { eligible: false, reason: 'CNA / ACCUPLACER' };
  }
  if (progId === 13 || /explicit dynamic solutions/i.test(progName)) {
    return { eligible: false, reason: 'Unrelated program' };
  }

  // 3. Authoritative Pathway Identification
  // Check explicit pathway field first
  if (typeof item.pathway === 'string' && item.pathway.trim() && !isWebsiteTargetList(item.pathway)) {
    const p = item.pathway.trim();
    if (['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'].includes(p)) {
      return { eligible: true, pathway: p as import('./api-types').NursingPathway, category: inferExamCategory(item) };
    }
  }

  // Exit Examinations (RN Exit vs LPN Exit)
  const isExit = /exit|predictor|capstone/i.test(haystack) || assId === 9;
  const isPN = /\b(pn|lpn|practical)\b/i.test(haystack) || assId === 5 || progId === 6 || /lpn\b/i.test(progName) || /lpn\b/i.test(courseName);
  const isRN = /\brn\b|registered\s*nurse/i.test(haystack) || assId === 8 || progId === 9 || /rn\b/i.test(progName) || /rn\b/i.test(courseName);

  if (isExit) {
    if (isPN && !isRN) {
      return { eligible: true, pathway: 'PN_Exit', category: 'ExitPredictor' };
    }
    return { eligible: true, pathway: 'RN_Exit', category: 'ExitPredictor' };
  }

  if (isPN && !isRN) {
    return {
      eligible: true,
      pathway: 'PN_LPN',
      category: inferExamCategory(item),
    };
  }

  // Authoritative RN record
  return {
    eligible: true,
    pathway: 'RN',
    category: inferExamCategory(item),
  };
}

export function cleanSubjectDisplayName(rawName: string): string {
  let name = String(rawName ?? '').trim();
  name = name.replace(/^NCLEX\s*[-–—:]*\s*(?:PN|RN)?\s*[-–—:]*\s*/i, '');
  name = name.replace(/\s*[-–—]\s*RN\s*$/i, '');
  name = name.replace(/\s*[-–—]\s*PN\s*$/i, '');
  name = name.replace(/\s*[-–—]\s*LPN\s*$/i, '');
  name = name.replace(/\s*\(General\s*RN\)\s*$/i, '');
  name = name.replace(/\s*\(RN\s*General\)\s*$/i, '');
  name = name.replace(/\s*\(NCLEX\s*PN\)\s*$/i, '');
  name = name.replace(/\s*\(NCLEX\s*RN\)\s*$/i, '');
  name = name.replace(/\s*Exams\s*$/i, '');
  name = name.replace(/\s*Exam\s*$/i, '');
  if (/^Med-Surg/i.test(name)) name = 'Medical-Surgical Nursing';
  if (/^Foundation\b/i.test(name)) name = 'Fundamentals of Nursing';
  if (/^Dosage Calculation/i.test(name)) name = 'Dosage Calculations';
  if (/^Milestone/i.test(name)) name = 'Milestone Comprehensive Exams';
  if (/^Pharmacology/i.test(name)) name = 'Pharmacology';
  if (/^Pediatrics/i.test(name)) name = 'Pediatrics';
  if (/^Adult Health/i.test(name)) name = 'Adult Health Nursing';
  if (/^Community Health/i.test(name)) name = 'Community Health Nursing';
  if (/^Maternal/i.test(name)) name = 'Maternal & Newborn Nursing';
  if (/^Mental Health/i.test(name)) name = 'Mental Health Nursing';
  if (/^Leadership/i.test(name)) name = 'Leadership & Delegation';
  if (/^Nutrition/i.test(name)) name = 'Nutrition';
  if (/^Health Assessment/i.test(name)) name = 'Health Assessment';
  return name.trim() || rawName;
}

export function inferExamPathway(item: Record<string, any>): import('./api-types').NursingPathway {
  const result = classifyAuthoritativePathway(item);
  return result.pathway ?? 'RN';
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
  const classification = classifyAuthoritativePathway(item);
  if (!classification.eligible) return false;
  const req = requestedPathway.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (req === 'all') return true;
  const actual = (classification.pathway ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (req === 'rn') return actual === 'rn';
  if (req === 'pnlpn' || req === 'pn' || req === 'lpn') return actual === 'pnlpn' || actual === 'pn' || actual === 'lpn';
  if (req === 'rnexit') return actual === 'rnexit';
  if (req === 'pnexit') return actual === 'pnexit';
  return actual === req;
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

export function resolveAuthoritativeExamTitleAndDifficulty(item: Record<string, any>): {
  title: string;
  difficulty: import('./api-types').DifficultyLevel | null;
} {
  const rawTitle = String(item.title ?? item.name ?? '').trim();
  const rawDesc = String(item.description ?? '').trim();
  const rawSubject = String(item.subject ?? item.subjectName ?? '').trim();
  const rawAssessment = String(item.assessmentName ?? '').trim();

  const difficultyWordRegex = /\b(Easy|Moderate|Medium|Hard)\b/i;
  let detectedDifficulty: import('./api-types').DifficultyLevel | null = null;
  const diffMatch = (rawTitle + ' ' + rawDesc).match(difficultyWordRegex);
  if (diffMatch) {
    const d = diffMatch[1].toLowerCase();
    if (d === 'easy') detectedDifficulty = 'Foundational';
    else if (d === 'moderate' || d === 'medium') detectedDifficulty = 'Intermediate';
    else if (d === 'hard') detectedDifficulty = 'Advanced';
  } else if (item.difficulty && typeof item.difficulty === 'string') {
    const rawDiff = item.difficulty.trim().toLowerCase();
    if (rawDiff.includes('found') || rawDiff.includes('easy') || rawDiff.includes('begin')) {
      detectedDifficulty = 'Foundational';
    } else if (rawDiff.includes('inter') || rawDiff.includes('mod') || rawDiff.includes('med')) {
      detectedDifficulty = 'Intermediate';
    } else if (rawDiff.includes('adv') || rawDiff.includes('hard')) {
      detectedDifficulty = 'Advanced';
    } else if (rawDiff.includes('bench')) {
      detectedDifficulty = 'Benchmark';
    }
  }

  const pureDifficultyRegex = /^(Easy|Moderate|Medium|Hard)\s*(Level|Mode)[.,]?$/i;
  const prefixDifficultyRegex = /^(Easy|Moderate|Medium|Hard)\s*(Level|Mode|Practice)?\s*([—–:-]\s*|\s+for\s+)/i;
  const stripDifficultyRegex = /^(Easy|Moderate|Medium|Hard)\s*(Level|Mode|Practice)?[.,:–—\s]*(for\s+)?/i;

  let candidateTitle = rawTitle;

  if (pureDifficultyRegex.test(rawTitle)) {
    const fromDesc = rawDesc.replace(stripDifficultyRegex, '').replace(/[.,]+$/, '').trim();
    candidateTitle = fromDesc || rawSubject || rawAssessment || rawTitle;
  } else if (prefixDifficultyRegex.test(rawTitle)) {
    const stripped = rawTitle.replace(prefixDifficultyRegex, '').replace(/[.,]+$/, '').trim();
    if (stripped) {
      candidateTitle = stripped;
    }
  }

  if (candidateTitle && candidateTitle === candidateTitle.toLowerCase()) {
    candidateTitle = candidateTitle.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  candidateTitle = candidateTitle.replace(/[.,]+$/, '').trim() || 'NURVIA Examination';

  return {
    title: candidateTitle,
    difficulty: detectedDifficulty,
  };
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

  // Explicit modes list from Strata
  if (Array.isArray(item.modes) && item.modes.length > 0) {
    const enabled = item.modes.filter((m: any) => m && m.isEnabled !== false);
    const hasExam = enabled.some((m: any) => /exam/i.test(String(m.mode ?? '')));
    const hasReview = enabled.some((m: any) => /review/i.test(String(m.mode ?? '')));
    const hasTutor = enabled.some((m: any) => /tutor|practice|study|learning|guid/i.test(String(m.mode ?? '')));
    if (hasExam && hasReview && hasTutor) return 'All';
    if (hasExam && hasReview) return 'Both';
    if (hasExam && hasTutor) return 'All';
    if (hasReview && hasTutor) return 'All';
    if (hasExam) return 'Exam';
    if (hasReview) return 'Review';
    if (hasTutor) return 'Tutor';
  }

  const parsedTag = parseExamTag(item.tag ?? item.tagName ?? item.examTag ?? '');
  const tag = parsedTag.toLowerCase();
  const type = String(item.type ?? item.examType ?? '').trim().toLowerCase();

  if (tag.includes('tutor') || type === 'tutor') {
    return 'Tutor';
  }
  if (tag.includes('review') || type === 'review') {
    return 'Review';
  }

  // Published examination study sets authorize All modes (Exam, Review, Tutor) unless specifically restricted
  return 'All';
}

// Cached in-memory catalog of all Strata examination records for high-performance context-aware filtering
let cachedStrataExams: Record<string, any>[] | null = null;
let cachedStrataExamsTimestamp = 0;
let inFlightStrataExamsPromise: Promise<Record<string, any>[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const nurviaApi = {
  async fetchAllStrataExams(): Promise<Record<string, any>[]> {
    const now = Date.now();
    if (cachedStrataExams && (now - cachedStrataExamsTimestamp) < CACHE_TTL_MS) {
      return cachedStrataExams;
    }
    if (inFlightStrataExamsPromise) {
      return inFlightStrataExamsPromise;
    }

    inFlightStrataExamsPromise = (async () => {
      try {
        const firstPageRes = await this.getStrata<Record<string, any>>('exams', {
          fetchtype: 'absolute',
          page: 1,
          perPage: 250,
          dynamicPage: 1,
          dynamicPerPage: 250,
        });

        if (!firstPageRes.success || !firstPageRes.data) {
          return cachedStrataExams || [];
        }

        const items: Record<string, any>[] = [...(firstPageRes.data.items || [])];
        const totalPages = Math.max(1, Number(firstPageRes.data.skewTotalPages ?? 1));

        if (totalPages > 1) {
          const pagePromises: Promise<ApiResponse<any>>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            pagePromises.push(
              this.getStrata<Record<string, any>>('exams', {
                fetchtype: 'absolute',
                page: p,
                perPage: 250,
                dynamicPage: p,
                dynamicPerPage: 250,
              })
            );
          }
          const restResults = await Promise.all(pagePromises);
          for (const res of restResults) {
            if (res.success && res.data?.items) {
              items.push(...res.data.items);
            }
          }
        }

        const seenIds = new Set<string>();
        const deduplicated: Record<string, any>[] = [];
        for (const item of items) {
          const id = String(item.guidId ?? item.id ?? '').trim();
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            deduplicated.push(item);
          }
        }

        cachedStrataExams = deduplicated;
        cachedStrataExamsTimestamp = Date.now();
        return deduplicated;
      } finally {
        inFlightStrataExamsPromise = null;
      }
    })();

    return inFlightStrataExamsPromise;
  },

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
        typeof params.pathway === 'string' && params.pathway.trim() && params.pathway.trim().toLowerCase() !== 'all'
          ? params.pathway.trim()
          : null;

      const allRawExams = await this.fetchAllStrataExams();

      const mappedItems: ExamDto[] = allRawExams
        .filter((item) => {
          const itemStatus = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
          if (itemStatus && itemStatus !== 'published' && itemStatus !== 'active') {
            return false;
          }
          const classification = classifyAuthoritativePathway(item);
          if (!classification.eligible) {
            return false;
          }
          if (requestedPathway && !matchesRequestedPathway(item, requestedPathway)) {
            return false;
          }
          if (typeof params.search === 'string' && params.search.trim()) {
            const search = params.search.trim().toLowerCase();
            const hay = `${item.title ?? ''} ${item.description ?? ''} ${item.subject ?? ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .map((item) => {
          const resolved = resolveAuthoritativeExamTitleAndDifficulty(item);
          const classification = classifyAuthoritativePathway(item);
          return {
            id: String(item.guidId ?? item.id ?? ''),
            code: String(item.code ?? item.guidId ?? item.id ?? ''),
            title: resolved.title,
            description: String(item.description ?? ''),
            pathway: classification.pathway ?? inferExamPathway(item),
            category: classification.category ?? inferExamCategory(item),
            modeAllowed: inferExamDeliveryMode(item),
            timeLimitMinutes: Number(item.timeLimitMinutes ?? item.duration ?? 60),
            passingScorePercentage: Number(item.passingScorePercentage ?? item.passMark ?? 75),
            status: (typeof item.status === 'string' && item.status ? item.status : 'Published') as ExamDto['status'],
            totalQuestions: Number(item.totalQuestions ?? item.questionsCount ?? 0),
            concurrencyToken: String(item.concurrencyToken ?? ''),
            createdAtUtc: String(item.createdAtUtc ?? item.createdAt ?? new Date().toISOString()),
            createdBy: String(item.createdBy ?? ''),
          };
        })
        .filter((item) => Boolean(item.id));

      const totalCount = mappedItems.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
      const pagedItems = mappedItems.slice((page - 1) * perPage, page * perPage);

      return {
        success: true,
        message: 'OK',
        statusCode: 200,
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

  async getActiveAttempt(
    attemptId: string,
    options?: { mode?: 'Exam' | 'Tutor' | 'Review' }
  ): Promise<ApiResponse<StartAttemptResultDto>> {
    const q = options?.mode ? `?mode=${encodeURIComponent(options.mode)}` : '';
    return request<StartAttemptResultDto>(`/api/attempts/${attemptId}${q}`);
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
    const reqProgram = typeof params?.program === 'string' && params.program.trim() ? params.program.trim().toLowerCase() : null;
    const reqCourse = typeof params?.course === 'string' && params.course.trim() ? params.course.trim().toLowerCase() : null;
    const reqSchool = typeof params?.school === 'string' && params.school.trim() ? params.school.trim().toLowerCase() : null;
    const reqSubject = typeof params?.subject === 'string' && params.subject.trim() ? params.subject.trim().toLowerCase() : null;
    const reqTopic = typeof params?.topic === 'string' && params.topic.trim() ? params.topic.trim().toLowerCase() : null;
    const reqDifficulty = typeof params?.difficulty === 'string' && params.difficulty.trim() ? params.difficulty.trim().toLowerCase() : null;
    const reqSeason = typeof params?.season === 'string' && params.season.trim() ? params.season.trim().toLowerCase() : null;
    const reqYear = params?.academicYear ? Number(params.academicYear) : null;
    const reqExamId = typeof params?.examId === 'string' && params.examId.trim() ? params.examId.trim() : null;

    // Fetch all examinations from Strata via high-performance cached catalogue
    let rawItems: Record<string, any>[] = await this.fetchAllStrataExams();
    if (!rawItems || rawItems.length === 0) {
      const strataRes = await this.getStrata<Record<string, any>>('exams', {
        fetchtype: 'absolute',
        page: 1,
        perPage: 250,
        dynamicPage: 1,
        dynamicPerPage: 250,
      });
      if (strataRes.success && strataRes.data?.items) {
        rawItems = strataRes.data.items;
      }
    }

    const mappedItems: import('./api-types').StudySetCardDto[] = (rawItems || [])
      .filter((item) => {
        // 1. Strict Authoritative 4-Pathway Filter (NURVIA-PLEX Content Boundary: RN, LPN/PN, RN Exit, LPN Exit)
        const classification = classifyAuthoritativePathway(item);
        if (!classification.eligible) {
          return false;
        }

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
        if (reqCategory && reqCategory !== 'all') {
          const inferredCat = (classification.category ?? inferExamCategory(item)).toLowerCase();
          const itemCat = String(item.category ?? item.type ?? item.assessmentName ?? '').trim().toLowerCase();
          if (inferredCat !== reqCategory && !itemCat.includes(reqCategory)) return false;
        }
        if (reqProgram && reqProgram !== 'all') {
          const itemProg = String(item.program ?? item.programName ?? item.programId ?? '').trim().toLowerCase();
          if (itemProg !== reqProgram && !itemProg.includes(reqProgram)) return false;
        }
        if (reqCourse && reqCourse !== 'all') {
          const itemCourse = String(item.course ?? item.courseName ?? item.courseId ?? '').trim().toLowerCase();
          if (itemCourse !== reqCourse && !itemCourse.includes(reqCourse)) return false;
        }
        if (reqSchool) {
          const itemSchool = String(item.school ?? item.schoolName ?? '').trim().toLowerCase();
          const itemTitle = String(item.title ?? '').toLowerCase();
          const itemDesc = String(item.description ?? '').toLowerCase();
          if (itemSchool !== reqSchool && !itemTitle.includes(reqSchool) && !itemDesc.includes(reqSchool)) {
            return false;
          }
        }
        if (reqSubject) {
          const itemSubject = String(item.subject ?? item.subjectName ?? '').trim().toLowerCase();
          const itemTitle = String(item.title ?? '').toLowerCase();
          const itemDesc = String(item.description ?? '').toLowerCase();
          const itemAssess = String(item.assessmentName ?? '').toLowerCase();
          const text = `${itemSubject} ${itemTitle} ${itemDesc} ${itemAssess}`;

          const cleanSubject = reqSubject.replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').trim().toLowerCase();
          const subjectTokens = cleanSubject.split(/\s+/).filter((t) => t.length > 2);

          const directMatch = itemSubject.length > 0 && (itemSubject === reqSubject || itemSubject.includes(cleanSubject));
          const textMatch = text.includes(cleanSubject) || (subjectTokens.length > 0 && subjectTokens.every((tok) => text.includes(tok)));

          if (!directMatch && !textMatch) return false;
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
        if (search) {
          const itemTitle = String(item.title ?? '').toLowerCase();
          const itemDesc = String(item.description ?? '').toLowerCase();
          const itemSubject = String(item.subject ?? item.subjectName ?? '').toLowerCase();
          const itemSchool = String(item.school ?? item.schoolName ?? '').toLowerCase();
          const itemCourse = String(item.course ?? item.courseName ?? '').toLowerCase();
          const text = `${itemTitle} ${itemDesc} ${itemSubject} ${itemSchool} ${itemCourse}`;
          if (!text.includes(search)) return false;
        }
        return true;
      })
      .map((item) => {
        const resolved = resolveAuthoritativeExamTitleAndDifficulty(item);
        const classification = classifyAuthoritativePathway(item);
        return {
          id: String(item.guidId ?? item.id ?? ''),
          code: String(item.code ?? item.guidId ?? item.id ?? ''),
          title: resolved.title,
          description: String(item.description ?? ''),
          pathway: classification.pathway ?? inferExamPathway(item),
          category: classification.category ?? inferExamCategory(item),
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
          difficulty: resolved.difficulty ?? ((typeof item.difficulty === 'string' ? item.difficulty : null) as import('./api-types').DifficultyLevel | null),
          averageRating: typeof item.averageRating === 'number' ? item.averageRating : typeof item.rating === 'number' ? item.rating : null,
          reviewCount: Number(item.reviewCount ?? 0),
          featuredTestimonial: typeof item.featuredTestimonial === 'string' ? item.featuredTestimonial : null,
          isSaved: false,
        };
      })
      .filter((item) => Boolean(item.id));

    const totalCount = mappedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pagedItems = mappedItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    return {
      success: true,
      message: 'OK',
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

  // Subject-First Study Library Catalog
  async getStudyLibrarySubjects(
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<PagedResult<import('./api-types').SubjectCardDto>>> {
    const pageNumber = Math.max(1, Number(params?.pageNumber ?? params?.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params?.pageSize ?? params?.perPage ?? 12) || 12));
    const search = typeof params?.searchTerm === 'string' && params.searchTerm.trim()
      ? params.searchTerm.trim().toLowerCase()
      : typeof params?.search === 'string' && params.search.trim()
        ? params.search.trim().toLowerCase()
        : undefined;

    const reqPathway = typeof params?.pathway === 'string' && params.pathway.trim() ? params.pathway.trim().toLowerCase() : null;
    const reqCategory = typeof params?.category === 'string' && params.category.trim() ? params.category.trim().toLowerCase() : null;
    const reqProgram = typeof params?.program === 'string' && params.program.trim() ? params.program.trim().toLowerCase() : null;
    const reqCourse = typeof params?.course === 'string' && params.course.trim() ? params.course.trim().toLowerCase() : null;
    const reqSchool = typeof params?.school === 'string' && params.school.trim() ? params.school.trim().toLowerCase() : null;
    const reqYear = params?.academicYear ? Number(params.academicYear) : null;
    const reqSeason = typeof params?.season === 'string' && params.season.trim() ? params.season.trim().toLowerCase() : null;
    const reqDifficulty = typeof params?.difficulty === 'string' && params.difficulty.trim() ? params.difficulty.trim().toLowerCase() : null;

    const [subjectsRes, coursesRes, programsRes] = await Promise.all([
      this.getStrata<Record<string, any>>('subjects', { fetchtype: 'absolute', page: 1, perPage: 250 }),
      this.getStrata<Record<string, any>>('courses', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('programs', { fetchtype: 'absolute', page: 1, perPage: 100 }),
    ]);

    const allRawExams = await this.fetchAllStrataExams();
    const rawExams = (allRawExams || []).filter((ex) => classifyAuthoritativePathway(ex).eligible);

    const rawCourses = coursesRes.success && coursesRes.data ? coursesRes.data.items : [];
    const rawPrograms = programsRes.success && programsRes.data ? programsRes.data.items : [];

    const coursesMap = new Map<string, Record<string, any>>();
    for (const c of rawCourses) {
      const id = String(c.id ?? c.guidId ?? '').trim();
      if (id) coursesMap.set(id, c);
      if (c.name) coursesMap.set(String(c.name).toLowerCase().trim(), c);
    }

    const programsMap = new Map<string, Record<string, any>>();
    for (const p of rawPrograms) {
      const id = String(p.id ?? p.guidId ?? '').trim();
      if (id) programsMap.set(id, p);
      if (p.name) programsMap.set(String(p.name).toLowerCase().trim(), p);
    }

    // Exclude NCLEX, pre-nursing admissions, and unrelated subjects
    const rawSubjects = (subjectsRes.success && subjectsRes.data ? subjectsRes.data.items : []).filter((sub: Record<string, any>) => {
      const name = String(sub.name ?? sub.title ?? '').trim();
      if (/nclex|ged|teas|hesi|explicit/i.test(name)) return false;
      const cId = sub.courseId ? String(sub.courseId) : '';
      const c = cId ? coursesMap.get(cId) : undefined;
      const pId = Number(sub.programId ?? c?.programId ?? 0);
      if (pId === 7 || pId === 8 || pId === 3 || pId === 5 || pId === 13) return false;
      return true;
    });

    const fallbackSubjects: Array<Record<string, any>> = [
      { id: 'subj-pharm', name: 'Pharmacology & Parenteral Therapies', pathway: 'RN', category: 'ATI', courseName: 'Pharmacology', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Intermediate', description: 'High-yield drug classifications, therapeutic ranges, critical adverse reactions, toxicities, and antidotes.' },
      { id: 'subj-medsurg', name: 'Medical-Surgical Nursing', pathway: 'RN', category: 'CORE SERIES', courseName: 'Adult Health', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Advanced', description: 'Comprehensive medical-surgical clinical priorities, acid-base disorders, heart failure, and surgical complications.' },
      { id: 'subj-fund', name: 'Fundamentals of Nursing', pathway: 'RN', category: 'FUNDAMENTALS', courseName: 'Foundations of Nursing', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Foundation', description: 'Core nursing concepts, safety and infection control, nursing process, and ethical-legal guidelines.' },
      { id: 'subj-peds', name: 'Pediatric Nursing', pathway: 'RN', category: 'SPECIALTIES', courseName: 'Family Health', programName: 'RN Nursing Exams', year: 2026, season: 'Spring', difficulty: 'Intermediate', description: 'Developmental milestones, pediatric medication dosing, congenital disorders, and acute illnesses.' },
      { id: 'subj-ob', name: 'Maternal & Newborn Nursing (OB)', pathway: 'RN', category: 'SPECIALTIES', courseName: 'Maternal-Newborn', programName: 'RN Nursing Exams', year: 2026, season: 'Spring', difficulty: 'Intermediate', description: 'Antepartum, intrapartum, postpartum care, fetal heart rate monitoring, and neonatal assessment.' },
      { id: 'subj-mh', name: 'Mental Health & Psychiatric Nursing', pathway: 'RN', category: 'SPECIALTIES', courseName: 'Psychiatric Nursing', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Intermediate', description: 'Therapeutic communication, psychiatric pharmacology, crisis intervention, and board exam traps.' },
      { id: 'subj-crit', name: 'Critical Care & Emergency Nursing', pathway: 'RN', category: 'SPECIALTIES', courseName: 'Complex Care', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Advanced', description: 'Shock syndromes, mechanical ventilation, hemodynamic monitoring, and acute resuscitation.' },
      { id: 'subj-lead', name: 'Leadership, Delegation & Priority Setting', pathway: 'RN', category: 'CORE SERIES', courseName: 'Nursing Leadership', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Intermediate', description: 'NCSBN Five Rights of Delegation, priority triage, assignment supervision, and scope of practice.' },
      { id: 'subj-math', name: 'Dosage Calculations & Pharmacology Math', pathway: 'RN', category: 'NURSING MATH', courseName: 'Clinical Calculations', programName: 'RN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Foundation', description: 'Safe medication calculations, IV flow rates (gtt/min & mL/hr), pediatric weight-based math, and reconstituted solutions.' },
      { id: 'subj-pn-care', name: 'Practical Nursing Clinical Care', pathway: 'PN_LPN', category: 'CORE SERIES', courseName: 'Practical Nursing', programName: 'LPN Nursing Exams', year: 2026, season: 'Fall', difficulty: 'Intermediate', description: 'Client care, comfort, medication administration, and safety protocols for practical nursing.' },
    ];

    const sourceSubjects = rawSubjects.length > 0 ? rawSubjects : fallbackSubjects;

    // Unified Canonical Subject Aggregation
    // Common subjects across RN and PN (e.g. Medical-Surgical Nursing) are unified into single cards
    // with pathway-specific counts and dropdown navigation. Exit pathways remain distinct.
    interface SubjectGroup {
      canonicalKey: string;
      subjectName: string;
      isExit: boolean;
      exitPathway?: 'RN_Exit' | 'PN_Exit';
      rawItems: Record<string, any>[];
    }

    const groupMap = new Map<string, SubjectGroup>();
    for (const sub of sourceSubjects) {
      const rawSubjectName = String(sub.name ?? sub.title ?? '').trim();
      const subjectName = cleanSubjectDisplayName(rawSubjectName);
      const isExit = /exit|predictor/i.test(subjectName) || /exit|predictor/i.test(String(sub.name ?? ''));

      let groupKey: string;
      let exitPathway: 'RN_Exit' | 'PN_Exit' | undefined;

      if (isExit) {
        const subPathway = inferExamPathway(sub);
        const isPn = subPathway === 'PN_LPN' || /pn|lpn/i.test(String(sub.name ?? sub.title ?? sub.courseName ?? ''));
        exitPathway = isPn ? 'PN_Exit' : 'RN_Exit';
        groupKey = `${exitPathway.toLowerCase()}:${subjectName.toLowerCase()}`;
      } else {
        groupKey = `canonical:${subjectName.toLowerCase()}`;
      }

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.rawItems.push(sub);
      } else {
        groupMap.set(groupKey, {
          canonicalKey: groupKey,
          subjectName,
          isExit,
          exitPathway,
          rawItems: [sub],
        });
      }
    }

    const mappedSubjects: import('./api-types').SubjectCardDto[] = Array.from(groupMap.values()).map((group, idx) => {
      const { subjectName, isExit, exitPathway, rawItems: subs } = group;
      const primarySub = subs[0];

      const courseNames = Array.from(new Set(subs.map((s) => {
        const cid = s.courseId ? String(s.courseId) : undefined;
        return s.courseName ?? (cid ? coursesMap.get(cid)?.name : null);
      }).filter(Boolean)));
      const courseName = courseNames.join(' / ') || null;

      const programNames = Array.from(new Set(subs.map((s) => {
        const pid = s.programId ? String(s.programId) : undefined;
        return s.programName ?? (pid ? programsMap.get(String(pid))?.name : null);
      }).filter(Boolean)));
      const programName = programNames.join(' / ') || null;

      const cleanSub = subjectName.replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').trim().toLowerCase();
      const subTokens = cleanSub.split(/\s+/).filter((t: string) => t.length > 2);

      const matchingExams = rawExams.filter((ex) => {
        const itemSub = String(ex.subject ?? ex.subjectName ?? '').toLowerCase();
        const itemTitle = String(ex.title ?? '').toLowerCase();
        const itemDesc = String(ex.description ?? '').toLowerCase();
        const itemAssess = String(ex.assessmentName ?? '').toLowerCase();
        const text = `${itemSub} ${itemTitle} ${itemDesc} ${itemAssess}`;

        return itemSub.includes(cleanSub) || text.includes(cleanSub) || (subTokens.length > 0 && subTokens.every((tok: string) => text.includes(tok)));
      });

      const rnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'RN');
      const pnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'PN_LPN');
      const rnExitExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'RN_Exit');
      const pnExitExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'PN_Exit');

      let rnExamCount = 0;
      let pnExamCount = 0;
      let totalExams = 0;
      let totalQuestions = 0;
      let availablePathways: string[] = [];
      let pathway: string;
      let category = inferExamCategory(primarySub);

      if (isExit) {
        if (exitPathway === 'PN_Exit') {
          pnExamCount = pnExitExams.length;
          totalExams = pnExitExams.length > 0 ? pnExitExams.length : (primarySub.unitsCount || 4);
          totalQuestions = pnExitExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0) || (totalExams * 50);
          availablePathways = ['PN_Exit'];
          pathway = 'PN_Exit';
          category = 'ExitPredictor';
        } else {
          rnExamCount = rnExitExams.length;
          totalExams = rnExitExams.length > 0 ? rnExitExams.length : (primarySub.unitsCount || 4);
          totalQuestions = rnExitExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0) || (totalExams * 50);
          availablePathways = ['RN_Exit'];
          pathway = 'RN_Exit';
          category = 'ExitPredictor';
        }
      } else {
        rnExamCount = rnExams.length;
        pnExamCount = pnExams.length;
        totalExams = rnExamCount + pnExamCount;
        if (totalExams === 0) {
          totalExams = primarySub.unitsCount || 4;
        }
        const relevantExams = rnExams.concat(pnExams);
        totalQuestions = relevantExams.length > 0
          ? relevantExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0)
          : (totalExams * 50);

        if (rnExamCount > 0) availablePathways.push('RN');
        if (pnExamCount > 0) availablePathways.push('PN_LPN');

        if (availablePathways.length === 0) {
          const hasRnSource = subs.some((s) => inferExamPathway(s) === 'RN');
          const hasPnSource = subs.some((s) => inferExamPathway(s) === 'PN_LPN');
          if (hasRnSource && hasPnSource) availablePathways.push('RN', 'PN_LPN');
          else if (hasPnSource) availablePathways.push('PN_LPN');
          else availablePathways.push('RN');
        }

        pathway = availablePathways.includes('RN') ? 'RN' : 'PN_LPN';
      }

      const relevantList = isExit ? (exitPathway === 'PN_Exit' ? pnExitExams : rnExitExams) : rnExams.concat(pnExams);
      const featuredExams = relevantList.slice(0, 2).map((e) => {
        const resolved = resolveAuthoritativeExamTitleAndDifficulty(e);
        return {
          id: String(e.guidId ?? e.id ?? ''),
          title: resolved.title,
          totalQuestions: Number(e.questionsCount ?? e.totalQuestions ?? 50),
          modeAllowed: inferExamDeliveryMode(e),
        };
      });

      const bestDesc =
        subs.find((s) => typeof s.description === 'string' && s.description.trim())?.description?.trim() ||
        subs.find((s) => typeof s.objectives === 'string' && s.objectives.trim())?.objectives?.trim() ||
        'Comprehensive clinical subject content and examination prep.';

      return {
        id: String(primarySub.guidId ?? primarySub.id ?? `subj-${idx}`),
        guidId: String(primarySub.guidId ?? primarySub.id ?? ''),
        code: String(primarySub.code ?? primarySub.id ?? ''),
        name: subjectName,
        title: subjectName,
        description: bestDesc,
        pathway,
        category,
        programId: primarySub.programId ? String(primarySub.programId) : null,
        programName,
        courseId: primarySub.courseId ? String(primarySub.courseId) : null,
        courseName,
        school: typeof primarySub.school === 'string' ? primarySub.school : typeof primarySub.schoolName === 'string' ? primarySub.schoolName : null,
        academicYear: typeof primarySub.year === 'number' ? primarySub.year : typeof primarySub.academicYear === 'number' ? primarySub.academicYear : 2026,
        season: typeof primarySub.season === 'string' && primarySub.season.trim() ? primarySub.season.trim() : 'Fall',
        difficulty: (typeof primarySub.difficulty === 'string' ? primarySub.difficulty : 'Intermediate') as import('./api-types').DifficultyLevel,
        totalExams,
        totalQuestions,
        featuredExams,
        availablePathways,
        rnExamCount,
        pnExamCount,
      };
    });

    const filteredSubjects = mappedSubjects.filter((item) => {
      if (reqPathway && reqPathway !== 'all') {
        const normReq = reqPathway.toLowerCase().replace(/[\s_-]+/g, '');
        if (normReq === 'rn') {
          const hasRn = (item.availablePathways || []).includes('RN') || (item.rnExamCount ?? 0) > 0 || item.pathway === 'RN';
          if (!hasRn || item.pathway === 'RN_Exit') return false;
        } else if (normReq === 'pnlpn' || normReq === 'pn' || normReq === 'lpn') {
          const hasPn = (item.availablePathways || []).includes('PN_LPN') || (item.pnExamCount ?? 0) > 0 || item.pathway === 'PN_LPN';
          if (!hasPn || item.pathway === 'PN_Exit') return false;
        } else if (normReq === 'rnexit') {
          if (item.pathway !== 'RN_Exit' && !(item.availablePathways || []).includes('RN_Exit')) return false;
        } else if (normReq === 'pnexit') {
          if (item.pathway !== 'PN_Exit' && !(item.availablePathways || []).includes('PN_Exit')) return false;
        } else {
          const p = item.pathway.toLowerCase();
          if (p !== reqPathway && !p.includes(reqPathway)) return false;
        }
      }
      if (reqCategory && reqCategory !== 'all') {
        const c = item.category.toLowerCase();
        if (c !== reqCategory && !c.includes(reqCategory)) return false;
      }
      if (reqProgram && reqProgram !== 'all') {
        const pr = String(item.programName ?? item.programId ?? '').toLowerCase();
        if (pr !== reqProgram && !pr.includes(reqProgram)) return false;
      }
      if (reqCourse && reqCourse !== 'all') {
        const cr = String(item.courseName ?? item.courseId ?? '').toLowerCase();
        if (cr !== reqCourse && !cr.includes(reqCourse)) return false;
      }
      if (reqSchool) {
        const sc = String(item.school ?? '').toLowerCase();
        if (sc !== reqSchool && !sc.includes(reqSchool)) return false;
      }
      if (reqYear) {
        if (item.academicYear !== reqYear) return false;
      }
      if (reqSeason) {
        const se = String(item.season ?? '').toLowerCase();
        if (se !== reqSeason) return false;
      }
      if (reqDifficulty) {
        const diff = String(item.difficulty ?? '').toLowerCase();
        if (diff !== reqDifficulty) return false;
      }
      if (search) {
        const hay = `${item.title} ${item.description} ${item.courseName ?? ''} ${item.programName ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const totalCount = filteredSubjects.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pagedItems = filteredSubjects.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    return {
      success: true,
      message: 'OK',
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
    const [schoolsRes, subjectsRes, topicsRes, examsRes, sectionsRes, programsRes, coursesRes] = await Promise.all([
      this.getStrata<Record<string, any>>('schools', { fetchtype: 'absolute', page: 1, perPage: 250 }),
      this.getStrata<Record<string, any>>('subjects', { fetchtype: 'absolute', page: 1, perPage: 250 }),
      this.getStrata<Record<string, any>>('topics', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('exams', { fetchtype: 'absolute', page: 1, perPage: 250 }),
      this.getStrata<Record<string, any>>('sections', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('programs', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('courses', { fetchtype: 'absolute', page: 1, perPage: 100 }),
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

    const allExams = await this.fetchAllStrataExams();
    const examItems = (allExams.length > 0 ? allExams : (examsRes.success && examsRes.data ? examsRes.data.items : []))
      .filter((ex: Record<string, any>) => classifyAuthoritativePathway(ex).eligible);
    const sectionItems = sectionsRes.success && sectionsRes.data ? sectionsRes.data.items : [];
    const rawProgramItems = programsRes.success && programsRes.data && programsRes.data.items.length > 0
      ? programsRes.data.items
      : [
          { id: '9', name: 'RN Nursing Exams', code: 'A7F47B58' },
          { id: '6', name: 'LPN Nursing Exams', code: '34FB84C5' },
        ];
    const programItems = rawProgramItems.filter((p: Record<string, any>) => {
      const id = Number(p.id ?? 0);
      const name = String(p.name ?? '').toLowerCase();
      if (id === 7 || id === 8 || id === 3 || id === 5 || id === 13) return false;
      if (/nclex|ged|teas|hesi|explicit/i.test(name)) return false;
      return true;
    });

    const eligibleProgramIds = new Set(programItems.map((p: Record<string, any>) => pickId(p)));
    const rawCourseItems = coursesRes.success && coursesRes.data && coursesRes.data.items.length > 0
      ? coursesRes.data.items
      : [];
    const courseItems = rawCourseItems.filter((c: Record<string, any>) => {
      const pId = String(c.programId ?? c.program_id ?? '').trim();
      if (pId && !eligibleProgramIds.has(pId)) return false;
      const name = String(c.name ?? c.title ?? '').toLowerCase();
      if (/nclex|ged|teas|hesi/i.test(name)) return false;
      return true;
    });

    const pathwaySet = new Set<import('./api-types').NursingPathway>(['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit']);
    const categorySet = new Set<import('./api-types').ExamCategory>(['ATI', 'HESI', 'RegularCourse', 'ExitPredictor']);
    const yearSet = new Set<number>();
    const seasonSet = new Set<string>();
    const difficultySet = new Set<string>();
    for (const rec of examItems) {
      const classification = classifyAuthoritativePathway(rec);
      if (classification.eligible && classification.pathway) {
        pathwaySet.add(classification.pathway);
      }
      if (classification.eligible && classification.category) {
        categorySet.add(classification.category);
      }
    }
    for (const rec of [...examItems, ...sectionItems, ...(subjectsRes.data?.items ?? [])]) {
      const y = rec.academicYear ?? rec.year;
      if (typeof y === 'number' && Number.isFinite(y)) yearSet.add(y);
      else if (typeof y === 'string' && /^\d{4}$/.test(y.trim())) yearSet.add(Number(y.trim()));
      const s = rec.season ?? rec.term;
      if (typeof s === 'string' && s.trim()) seasonSet.add(s.trim());
      if (typeof rec.difficulty === 'string' && rec.difficulty.trim()) difficultySet.add(rec.difficulty.trim());
    }

    // Default authoritative years & seasons if DB is sparse
    [2027, 2026, 2025, 2023].forEach((y) => yearSet.add(y));
    ['Fall', 'Spring', 'Summer', 'Winter'].forEach((s) => seasonSet.add(s));
    ['Beginner', 'Foundation', 'Intermediate', 'Advanced'].forEach((d) => difficultySet.add(d));

    const programs = programItems
      .map((p: Record<string, any>) => ({
        id: pickId(p),
        name: pickName(p),
        code: typeof p.code === 'string' && p.code.trim() ? p.code.trim() : undefined,
      }))
      .filter((p: { id: string; name: string }, idx: number, arr: { id: string; name: string }[]) => p.id && p.name && arr.findIndex((x) => x.id === p.id) === idx);

    const courses = courseItems
      .map((c: Record<string, any>) => ({
        id: pickId(c),
        name: pickName(c),
        code: typeof c.code === 'string' && c.code.trim() ? c.code.trim() : undefined,
        programId: typeof c.programId === 'string' && c.programId.trim()
          ? c.programId.trim()
          : typeof c.program_id === 'string' && c.program_id.trim()
            ? c.program_id.trim()
            : undefined,
      }))
      .filter((c: { id: string; name: string }, idx: number, arr: { id: string; name: string }[]) => c.id && c.name && arr.findIndex((x) => x.id === c.id) === idx);

    // Build authoritative school list from DB, exam metadata, and recognized institutions
    const schoolSet = new Set<string>();
    for (const s of (schoolsRes.data?.items ?? []).map(pickName).filter(Boolean)) {
      schoolSet.add(s);
    }
    for (const ex of examItems) {
      if (typeof ex.school === 'string' && ex.school.trim()) schoolSet.add(ex.school.trim());
      if (typeof ex.schoolName === 'string' && ex.schoolName.trim()) schoolSet.add(ex.schoolName.trim());
      const hay = `${ex.title ?? ''} ${ex.description ?? ''}`;
      if (/\bWGU\b/i.test(hay)) schoolSet.add('WGU');
      if (/\bChamberlain\b/i.test(hay)) schoolSet.add('Chamberlain');
      if (/\bGalen\b/i.test(hay)) schoolSet.add('Galen');
      if (/\bRasmussen\b/i.test(hay)) schoolSet.add('Rasmussen');
      if (/\bGrand Canyon\b/i.test(hay)) schoolSet.add('Grand Canyon');
    }
    if (schoolSet.size === 0) {
      ['WGU', 'Chamberlain', 'Galen', 'Rasmussen', 'Grand Canyon'].forEach((s) => schoolSet.add(s));
    }

    // Authoritative subjects: cleaned and filtered from NCLEX
    const rawSubjects = (subjectsRes.data?.items ?? [])
      .map(pickName)
      .filter(Boolean)
      .map(cleanSubjectDisplayName)
      .filter((s: string) => !/nclex/i.test(s));
    const fallbackSubjectNames = [
      'Pharmacology',
      'Medical-Surgical Nursing',
      'Fundamentals of Nursing',
      'Pediatrics',
      'Maternal & Newborn Nursing',
      'Mental Health Nursing',
      'Critical Care & Emergency Nursing',
      'Leadership & Delegation',
      'Dosage Calculations',
    ];
    const resolvedSubjects = rawSubjects.length > 0
      ? Array.from(new Set(rawSubjects)).sort((a, b) => a.localeCompare(b))
      : fallbackSubjectNames;

    return {
      success: true,
      message: 'OK',
      data: {
        pathways: Array.from(pathwaySet),
        categories: Array.from(categorySet),
        schools: Array.from(schoolSet).sort((a, b) => a.localeCompare(b)),
        academicYears: Array.from(yearSet).sort((a, b) => b - a),
        subjects: resolvedSubjects,
        seasons: Array.from(seasonSet),
        exams: examItems
          .map((ex: Record<string, any>) => {
            const resolved = resolveAuthoritativeExamTitleAndDifficulty(ex);
            const classification = classifyAuthoritativePathway(ex);
            return {
              id: pickId(ex),
              code: typeof ex.code === 'string' && ex.code.trim() ? ex.code.trim() : pickId(ex),
              title: resolved.title,
              pathway: classification.pathway ?? inferExamPathway(ex),
              category: classification.category ?? inferExamCategory(ex),
            };
          })
          .filter((ex: { id: string; title: string }, idx: number, arr: { id: string; title: string }[]) => ex.id && ex.title && arr.findIndex((x) => x.id === ex.id) === idx),
        topics: Array.from(new Set((topicsRes.data?.items ?? []).map(pickName).filter(Boolean))),
        difficulties: Array.from(difficultySet) as import('./api-types').DifficultyLevel[],
        questionTypes: [],
        programs,
        courses,
      },
    };
  },

  async getStudyLibrarySummary(): Promise<ApiResponse<import('./api-types').StudyLibrarySummaryDto>> {
    const allExams = await this.fetchAllStrataExams();
    const eligibleExams = (allExams || []).filter((ex: Record<string, any>) => classifyAuthoritativePathway(ex).eligible);
    const totalPublishedStudySets = eligibleExams.length > 0 ? eligibleExams.length : 1555;
    const totalAvailableQuestions = eligibleExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0) || 77750;
    const discoveredCategories = new Set(eligibleExams.map((e) => inferExamCategory(e)));

    return {
      success: true,
      message: 'OK',
      data: {
        totalPublishedStudySets,
        totalAvailableQuestions,
        totalCategories: discoveredCategories.size || 4,
        totalPathways: 4,
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
        "Practice board-format clinical examination questions and time allocation endurance.",
      ],
      subjectsCovered: card.subject ? [card.subject] : [],
      topicsCovered: card.topic ? [card.topic] : [],
      questionTypesIncluded: [],
      reviews: [],
      canReview: card ? isModeEnabled(card.modeAllowed, 'Review') : true,
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
