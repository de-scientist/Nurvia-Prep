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
import {
  buildCoursesByIdMap,
  buildExamsBySubjectMap,
  buildProgramsByIdMap,
  consolidateRnAndLpnSubjects,
  detectCourseSeries,
  filterAuthorizedCourses,
  filterAuthorizedPrograms,
  identifySubjectDiscipline,
  isEligibleExamStatus,
  isPathwayMatch,
  isUnauthorizedExamFamilyName,
  lookupExamsForSourceSubject,
  LPN_PROGRAM_ID,
  normalizePathwayParam,
  parseStrictProgramId,
  partitionAuthorizedSubjects,
  programIdForPathway,
  resolveAuthoritativeSubjectPathway,
  RN_PROGRAM_ID,
  type AuthorizedProgramId,
  type AuthorizedSourceSubject,
  type RawRecord,
} from './study-library/curriculum-consolidation';
import {
  isProhibitedTestimonialText,
  parseApprovedTestimonialPathway,
  resolveTestimonialsCollection,
  type ApprovedTestimonialPathway,
  type TestimonialsCollectionResult,
} from './testimonials/testimonial-service';

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
    controller.abort(new Error('Request timeout connecting to QuizNurse API'));
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
          message: 'Network error connecting to QuizNurse API',
          statusCode: 0,
          errors: ['Failed to connect to the server. Please check your internet connection.'],
        };
      }

      const message = error instanceof Error ? error.message : 'Unknown network error';
      return {
        success: false,
        message: message || 'Network error connecting to QuizNurse API',
        errors: [message],
      };
    } finally {
      cleanup();
    }
  }

  return {
    success: false,
    message: 'Network error connecting to QuizNurse API',
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
  const hasDirectProg = item.programId !== undefined && item.programId !== null && item.programId !== '';
  const progId = Number(item.programId ?? 0);
  const progName = String(item.programName ?? item.program ?? '').trim();
  const courseName = String(item.courseName ?? item.course ?? '').trim();
  const subjectName = String(item.subjectName ?? item.subject ?? '').trim();
  const rawTitle = String(item.title ?? item.name ?? '').trim();
  const rawDesc = String(item.description ?? '').trim();
  const rawResources = String(item.resources ?? '').trim();
  const haystack = [assName, progName, courseName, subjectName, rawTitle, rawDesc, rawResources]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0 && !isWebsiteTargetList(v))
    .join(' ')
    .toLowerCase();

  // Authoritative program allowlist path when programId is present on the record
  if (hasDirectProg) {
    const strictProgId = parseStrictProgramId(item.programId);
    if (strictProgId === null) {
      return {
        eligible: false,
        reason: `Program ID ${String(item.programId)} is outside the authorized RN (9) / LPN (6) allowlist`,
      };
    }

    if (
      isUnauthorizedExamFamilyName(rawTitle) ||
      isUnauthorizedExamFamilyName(subjectName) ||
      isUnauthorizedExamFamilyName(courseName) ||
      isUnauthorizedExamFamilyName(progName)
    ) {
      return { eligible: false, reason: 'Excluded exam family content' };
    }

    const explicitPathway =
      typeof item.pathway === 'string' && item.pathway.trim() && !isWebsiteTargetList(item.pathway)
        ? item.pathway.trim()
        : '';

    const inferred = resolveAuthoritativeSubjectPathway(
      strictProgId,
      courseName || null,
      subjectName || rawTitle
    );
    const titleExit = /\b(exit|predictor|capstone)\b/i.test(rawTitle);

    let finalPathway = inferred.pathway;
    if (explicitPathway && ['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'].includes(explicitPathway)) {
      const impliedProg = programIdForPathway(explicitPathway);
      if (impliedProg !== null && impliedProg !== strictProgId) {
        return {
          eligible: false,
          reason: `Pathway ${explicitPathway} conflicts with authoritative programId ${strictProgId}`,
        };
      }
      finalPathway = explicitPathway as import('./api-types').NursingPathway;
    } else if (titleExit && !inferred.isExit) {
      finalPathway = strictProgId === RN_PROGRAM_ID ? 'RN_Exit' : 'PN_Exit';
    }

    const cat =
      finalPathway === 'RN_Exit' || finalPathway === 'PN_Exit'
        ? 'ExitPredictor'
        : inferred.category !== 'RegularCourse'
          ? inferred.category
          : inferExamCategory({ ...item, assessmentName: '' });

    return {
      eligible: true,
      pathway: finalPathway,
      category: cat,
    };
  }

  // Legacy / un-linked exam record classification (without explicit programId):
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
  if (assId === 3 || /\bged\b/i.test(assName) || /\bged\b/i.test(rawTitle)) {
    return { eligible: false, reason: 'GED (High School Equivalency)' };
  }
  if (
    assId === 2 ||
    assId === 4 ||
    progId === 3 ||
    progId === 5 ||
    progId === 2 ||
    progId === 4 ||
    /hesi\s*a2|ati\s*teas|accuplacer/i.test(assName) ||
    /hesi\s*a2|ati\s*teas|accuplacer/i.test(progName) ||
    /\b(teas|hesi\s*a2|accuplacer)\b/i.test(rawTitle)
  ) {
    return { eligible: false, reason: 'Pre-nursing admissions (ATI TEAS / HESI A2 / ACCUPLACER)' };
  }
  if (assId === 1 || assId === 11 || /\bcna\b/i.test(assName) || /accuplacer/i.test(assName)) {
    return { eligible: false, reason: 'CNA / ACCUPLACER' };
  }
  if (progId === 13 || /explicit dynamic solutions/i.test(progName)) {
    return { eligible: false, reason: 'Unrelated program' };
  }

  // 3. Explicit 4-way pathway attribute
  if (typeof item.pathway === 'string' && item.pathway.trim() && !isWebsiteTargetList(item.pathway)) {
    const p = item.pathway.trim();
    if (['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'].includes(p)) {
      return { eligible: true, pathway: p as import('./api-types').NursingPathway, category: inferExamCategory(item) };
    }
  }

  // 4. Exit Examinations (RN Exit vs LPN Exit)
  const nonDescHaystack = [assName, progName, courseName, subjectName, rawTitle]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0 && !isWebsiteTargetList(v))
    .join(' ')
    .toLowerCase();

  const isExit = /exit|predictor|capstone/i.test(`${courseName} ${subjectName} ${rawTitle}`) || assId === 9;
  const isPN =
    /\b(pn|lpn|practical)\b/i.test(nonDescHaystack) ||
    assId === 5 ||
    /lpn\b/i.test(progName) ||
    /lpn\b/i.test(courseName);
  const isRN =
    /\brn\b|registered\s*nurse/i.test(nonDescHaystack) ||
    assId === 8 ||
    /rn\b/i.test(progName) ||
    /rn\b/i.test(courseName);

  if (isExit) {
    if (isPN && !isRN) {
      return { eligible: true, pathway: 'PN_Exit', category: 'ExitPredictor' };
    }
    if (isRN) {
      return { eligible: true, pathway: 'RN_Exit', category: 'ExitPredictor' };
    }
    return { eligible: false, reason: 'Unverified exit pathway ownership' };
  }

  if (isPN && !isRN) {
    return {
      eligible: true,
      pathway: 'PN_LPN',
      category: inferExamCategory(item),
    };
  }

  if (isRN) {
    return {
      eligible: true,
      pathway: 'RN',
      category: inferExamCategory(item),
    };
  }

  // Fail closed when neither programId nor verifiable RN/LPN/Exit ownership exists
  return {
    eligible: false,
    reason: 'Missing authoritative RN (9) / LPN (6) program or pathway ownership',
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
  const courseSeries = detectCourseSeries(typeof item.courseName === 'string' ? item.courseName : typeof item.course === 'string' ? item.course : '');
  if (courseSeries === 'ATI_EXIT' || courseSeries === 'HESI_EXIT') return 'ExitPredictor';
  if (courseSeries === 'ATI') return 'ATI';
  if (courseSeries === 'HESI') return 'HESI';

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
  if (!classification.eligible || !classification.pathway) return false;
  return isPathwayMatch(classification.pathway, requestedPathway);
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

  candidateTitle = candidateTitle.replace(/[.,]+$/, '').trim() || 'QuizNurse Examination';

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

export interface ClientCurriculumIndexData {
  complete: boolean;
  fetchedAt: string | number;
  programs: Record<string, any>[];
  courses: Record<string, any>[];
  subjects: Record<string, any>[];
  examsBySubjectGuid: Record<string, Record<string, any>[]>;
  failedSubjectIds?: string[];
}

// Scoped caches for authoritative Study Library retrieval (5-minute TTL)
const CACHE_TTL_MS = 5 * 60 * 1000;
const cachedStrataExamsByScope = new Map<'raw' | 'learner', { items: Record<string, any>[]; timestamp: number }>();
const inFlightStrataExamsByScope = new Map<'raw' | 'learner', Promise<Record<string, any>[]>>();
let cachedCurriculumIndex: { data: ClientCurriculumIndexData; timestamp: number } | null = null;
let inFlightCurriculumIndex: Promise<ClientCurriculumIndexData | null> | null = null;
const cachedNominalExamsByKey = new Map<string, { items: Record<string, any>[]; complete: boolean; timestamp: number }>();
const inFlightNominalExamsByKey = new Map<string, Promise<{ items: Record<string, any>[]; complete: boolean }>>();

export function clearStudyLibraryCaches(): void {
  cachedStrataExamsByScope.clear();
  inFlightStrataExamsByScope.clear();
  cachedCurriculumIndex = null;
  inFlightCurriculumIndex = null;
  cachedNominalExamsByKey.clear();
  inFlightNominalExamsByKey.clear();
}

function emptyPagedResult<T>(pageNumber: number, pageSize: number): ApiResponse<PagedResult<T>> {
  return {
    success: true,
    message: 'OK',
    data: {
      items: [],
      totalCount: 0,
      pageNumber,
      pageSize,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

interface RequestedFilterConstraints {
  valid: boolean;
  reqPathwayNorm: import('./api-types').NursingPathway | 'All' | null;
  programIdFilter: AuthorizedProgramId | null;
  reqProgramRaw: string | null;
}

function resolveRequestedFilterConstraints(
  params?: Record<string, string | number | boolean | undefined>
): RequestedFilterConstraints {
  let reqPathwayNorm: import('./api-types').NursingPathway | 'All' | null = null;
  if (params?.pathway !== undefined && params?.pathway !== null && String(params.pathway).trim() !== '') {
    reqPathwayNorm = normalizePathwayParam(String(params.pathway));
    if (reqPathwayNorm === null) {
      return { valid: false, reqPathwayNorm: null, programIdFilter: null, reqProgramRaw: null };
    }
  }

  let explicitProgramId: AuthorizedProgramId | null = null;
  if (
    params?.programId !== undefined &&
    params?.programId !== null &&
    String(params.programId).trim() !== '' &&
    String(params.programId).trim().toLowerCase() !== 'all'
  ) {
    explicitProgramId = parseStrictProgramId(params.programId);
    if (explicitProgramId === null) {
      return { valid: false, reqPathwayNorm, programIdFilter: null, reqProgramRaw: null };
    }
  }

  let reqProgramRaw: string | null = null;
  let textProgramId: AuthorizedProgramId | null = null;
  if (typeof params?.program === 'string' && params.program.trim()) {
    const trimmed = params.program.trim();
    if (trimmed.toLowerCase() !== 'all') {
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        const parsed = parseStrictProgramId(trimmed);
        if (parsed === null) {
          return { valid: false, reqPathwayNorm, programIdFilter: explicitProgramId, reqProgramRaw: trimmed };
        }
        textProgramId = parsed;
      } else if (isUnauthorizedExamFamilyName(trimmed)) {
        return { valid: false, reqPathwayNorm, programIdFilter: explicitProgramId, reqProgramRaw: trimmed };
      } else {
        reqProgramRaw = trimmed.toLowerCase();
        if (/\blpn\b|\bpn\b|practical\s*nurs/i.test(trimmed)) {
          textProgramId = LPN_PROGRAM_ID;
        } else if (/\brn\b|registered\s*nurs/i.test(trimmed)) {
          textProgramId = RN_PROGRAM_ID;
        }
      }
    }
  }

  if (explicitProgramId !== null && textProgramId !== null && explicitProgramId !== textProgramId) {
    return { valid: false, reqPathwayNorm, programIdFilter: explicitProgramId, reqProgramRaw };
  }

  const combinedProgramId = explicitProgramId ?? textProgramId;
  if (reqPathwayNorm && reqPathwayNorm !== 'All' && combinedProgramId !== null) {
    const expectedProgForPathway = programIdForPathway(reqPathwayNorm);
    if (expectedProgForPathway !== combinedProgramId) {
      return { valid: false, reqPathwayNorm, programIdFilter: combinedProgramId, reqProgramRaw };
    }
  }

  return {
    valid: true,
    reqPathwayNorm,
    programIdFilter: combinedProgramId,
    reqProgramRaw,
  };
}

function buildExamsBySubjectMapFromIndex(indexData: ClientCurriculumIndexData): Map<string, Record<string, any>[]> {
  const map = new Map<string, Record<string, any>[]>();
  const appendUnique = (key: string, exam: Record<string, any>) => {
    const normKey = key.trim().toLowerCase();
    if (!normKey) return;
    let bucket = map.get(normKey);
    if (!bucket) {
      bucket = [];
      map.set(normKey, bucket);
    }
    const exId = String(exam.guidId ?? exam.id ?? '').trim();
    if (!exId || !bucket.some((existing) => String(existing.guidId ?? existing.id ?? '').trim() === exId)) {
      bucket.push(exam);
    }
  };

  for (const [key, list] of Object.entries(indexData.examsBySubjectGuid || {})) {
    if (!Array.isArray(list)) continue;
    for (const exam of list) {
      if (!exam || typeof exam !== 'object') continue;
      appendUnique(key, exam);
      if (typeof exam.subjectGuidId === 'string' && exam.subjectGuidId.trim()) {
        appendUnique(exam.subjectGuidId, exam);
      }
      if (exam.subjectId !== undefined && exam.subjectId !== null && String(exam.subjectId).trim()) {
        appendUnique(String(exam.subjectId), exam);
      }
    }
  }

  return map;
}

function collectUniqueIndexExams(indexData: ClientCurriculumIndexData): Record<string, any>[] {
  const seen = new Set<string>();
  const exams: Record<string, any>[] = [];
  for (const list of Object.values(indexData.examsBySubjectGuid || {})) {
    if (!Array.isArray(list)) continue;
    for (const ex of list) {
      if (!ex || typeof ex !== 'object') continue;
      const id = String(ex.guidId ?? ex.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      exams.push(ex);
    }
  }
  return exams;
}

function enrichExamFromVerifiedSource(
  exam: Record<string, any>,
  src: AuthorizedSourceSubject
): Record<string, any> {
  return {
    ...exam,
    programId: parseStrictProgramId(exam.programId) ?? src.programId,
    programName:
      typeof exam.programName === 'string' && exam.programName.trim()
        ? exam.programName
        : src.programName,
    courseId: exam.courseId ?? src.courseId,
    courseGuidId: exam.courseGuidId ?? src.courseGuidId,
    courseName:
      typeof exam.courseName === 'string' && exam.courseName.trim()
        ? exam.courseName
        : src.courseName,
    subjectId: exam.subjectId ?? src.subjectId,
    subjectGuidId: exam.subjectGuidId ?? src.subjectGuidId,
    subjectName:
      typeof exam.subjectName === 'string' && exam.subjectName.trim()
        ? exam.subjectName
        : src.rawName,
  };
}

function mapStudySetCardItem(item: Record<string, any>): import('./api-types').StudySetCardDto {
  const resolved = resolveAuthoritativeExamTitleAndDifficulty(item);
  const classification = classifyAuthoritativePathway(item);
  const parsedProgramId = parseStrictProgramId(item.programId);
  return {
    id: String(item.guidId ?? item.id ?? ''),
    code: String(item.code ?? item.guidId ?? item.id ?? ''),
    title: resolved.title,
    description: String(item.description ?? ''),
    pathway: classification.pathway ?? inferExamPathway(item),
    category: classification.category ?? inferExamCategory(item),
    programId: parsedProgramId,
    programName:
      typeof item.programName === 'string' && item.programName.trim()
        ? item.programName.trim()
        : typeof item.program === 'string' && item.program.trim()
          ? item.program.trim()
          : null,
    courseId:
      typeof item.courseId === 'number' || typeof item.courseId === 'string'
        ? item.courseId
        : null,
    courseName:
      typeof item.courseName === 'string' && item.courseName.trim()
        ? item.courseName.trim()
        : typeof item.course === 'string' && item.course.trim()
          ? item.course.trim()
          : null,
    subjectId:
      typeof item.subjectId === 'number' || typeof item.subjectId === 'string'
        ? item.subjectId
        : null,
    subjectGuidId:
      typeof item.subjectGuidId === 'string' && item.subjectGuidId.trim()
        ? item.subjectGuidId.trim()
        : null,
    totalQuestions: Number(item.totalQuestions ?? item.questionsCount ?? 0) || 0,
    timeLimitMinutes: Number(item.timeLimitMinutes ?? item.duration ?? 60) || 60,
    modeAllowed: inferExamDeliveryMode(item),
    passingScorePercentage: Number(item.passingScorePercentage ?? item.passMark ?? 75) || 75,
    allowedLayouts: (typeof item.allowedLayouts === 'string' && item.allowedLayouts && item.allowedLayouts !== 'Any'
      ? item.allowedLayouts
      : 'Both') as import('./api-types').ExamLayoutPolicy,
    defaultLayout: (typeof item.defaultLayout === 'string' && item.defaultLayout && item.defaultLayout !== 'Classic'
      ? item.defaultLayout
      : 'Sequential') as ExamLayout,
    school: typeof item.school === 'string' ? item.school : typeof item.schoolName === 'string' ? item.schoolName : null,
    academicYear: typeof item.academicYear === 'number' ? item.academicYear : typeof item.year === 'number' ? item.year : null,
    season: typeof item.season === 'string' ? item.season : null,
    subject: typeof item.subjectName === 'string' ? item.subjectName : typeof item.subject === 'string' ? item.subject : null,
    topic: typeof item.topicName === 'string' ? item.topicName : typeof item.topic === 'string' ? item.topic : null,
    difficulty: resolved.difficulty ?? ((typeof item.difficulty === 'string' ? item.difficulty : null) as import('./api-types').DifficultyLevel | null),
    averageRating: typeof item.averageRating === 'number' ? item.averageRating : typeof item.rating === 'number' ? item.rating : null,
    reviewCount: Number(item.reviewCount ?? 0),
    featuredTestimonial:
      typeof item.featuredTestimonial === 'string' &&
      item.featuredTestimonial.trim() &&
      !isProhibitedTestimonialText(item.featuredTestimonial)
        ? item.featuredTestimonial.trim()
        : null,
    isSaved: false,
  };
}

interface AuthorizedCurriculumState {
  fromIndex: boolean;
  indexData: ClientCurriculumIndexData | null;
  complete: boolean;
  failedSubjectIds: Set<string>;
  catalogLoaded: boolean;
  authorizedPrograms: Record<string, any>[];
  authorizedCourses: Record<string, any>[];
  rnSubjects: AuthorizedSourceSubject[];
  lpnSubjects: AuthorizedSourceSubject[];
  allSources: AuthorizedSourceSubject[];
  examsBySubjectKey: Map<string, Record<string, any>[]>;
}

async function loadAuthorizedCurriculumSources(): Promise<AuthorizedCurriculumState> {
  const indexData = await nurviaApi.fetchCurriculumIndex();
  let rawPrograms: Record<string, any>[] = [];
  let rawCourses: Record<string, any>[] = [];
  let rawSubjects: Record<string, any>[] = [];
  let examsBySubjectKey = new Map<string, Record<string, any>[]>();
  let complete = false;
  let catalogLoaded = false;
  const failedSubjectIds = new Set<string>();

  if (indexData && indexData.subjects.length > 0) {
    rawPrograms = indexData.programs;
    rawCourses = indexData.courses;
    rawSubjects = indexData.subjects;
    examsBySubjectKey = buildExamsBySubjectMapFromIndex(indexData);
    complete = Boolean(indexData.complete);
    catalogLoaded = true;
    for (const id of indexData.failedSubjectIds ?? []) {
      if (id) failedSubjectIds.add(String(id).trim().toLowerCase());
    }
  } else {
    const [subsRes, coursesRes, programsRes, rawExams] = await Promise.all([
      nurviaApi.fetchAllPagedStrataResource('subjects', 250),
      nurviaApi.fetchAllPagedStrataResource('courses', 100),
      nurviaApi.fetchAllPagedStrataResource('programs', 100),
      nurviaApi.fetchAllStrataExams({ scope: 'learner' }),
    ]);

    rawPrograms = programsRes.items;
    rawCourses = coursesRes.items;
    rawSubjects = subsRes.items;
    catalogLoaded = subsRes.success && subsRes.items.length > 0;
    const rawMap = buildExamsBySubjectMap(rawExams as RawRecord[]);
    examsBySubjectKey = rawMap as unknown as Map<string, Record<string, any>[]>;
    complete = subsRes.complete && coursesRes.complete && programsRes.complete && rawMap.size > 0;
  }

  const authorizedPrograms = filterAuthorizedPrograms(rawPrograms as RawRecord[]) as Record<string, any>[];
  const authorizedCourses = filterAuthorizedCourses(rawCourses as RawRecord[]) as Record<string, any>[];
  const programsById = buildProgramsByIdMap(authorizedPrograms as RawRecord[]);
  // Pass all raw courses so subjects belonging to unauthorized courses fail closed.
  const allCoursesById = buildCoursesByIdMap(rawCourses as RawRecord[]);

  const { rnSubjects, lpnSubjects } = partitionAuthorizedSubjects(
    rawSubjects as RawRecord[],
    allCoursesById,
    programsById
  );

  return {
    fromIndex: Boolean(indexData && indexData.subjects.length > 0),
    indexData,
    complete,
    failedSubjectIds,
    catalogLoaded,
    authorizedPrograms,
    authorizedCourses,
    rnSubjects,
    lpnSubjects,
    allSources: [...rnSubjects, ...lpnSubjects],
    examsBySubjectKey,
  };
}

export const nurviaApi = {
  async fetchAllStrataExams(options?: { scope?: 'raw' | 'learner' }): Promise<Record<string, any>[]> {
    const scope: 'raw' | 'learner' = options?.scope === 'learner' ? 'learner' : 'raw';
    const now = Date.now();
    const cached = cachedStrataExamsByScope.get(scope);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.items;
    }

    const existingPromise = inFlightStrataExamsByScope.get(scope);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const firstPageRes = await this.getStrata<Record<string, any>>('exams', {
          fetchtype: 'absolute',
          page: 1,
          perPage: 250,
          dynamicPage: 1,
          dynamicPerPage: 250,
          ...(scope === 'learner' ? { scope: 'learner' } : {}),
        });

        if (!firstPageRes.success || !firstPageRes.data) {
          return cached?.items || [];
        }

        const items: Record<string, any>[] = [...(firstPageRes.data.items || [])];
        const totalPages = Math.max(1, Number(firstPageRes.data.skewTotalPages ?? 1));
        let allPagesSucceeded = true;

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
                ...(scope === 'learner' ? { scope: 'learner' } : {}),
              })
            );
          }
          const restResults = await Promise.all(pagePromises);
          for (const res of restResults) {
            if (res.success && res.data?.items) {
              items.push(...res.data.items);
            } else {
              allPagesSucceeded = false;
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

        // Only cache non-empty complete responses so transient failures never poison cache.
        if (allPagesSucceeded && deduplicated.length > 0) {
          cachedStrataExamsByScope.set(scope, { items: deduplicated, timestamp: Date.now() });
        }

        return deduplicated;
      } finally {
        inFlightStrataExamsByScope.delete(scope);
      }
    })();

    inFlightStrataExamsByScope.set(scope, promise);
    return promise;
  },

  async fetchAllPagedStrataResource(
    resource: import('./lexmacasto/contracts').StrataResourceKey,
    perPage = 250
  ): Promise<{ items: Record<string, any>[]; success: boolean; complete: boolean }> {
    const firstRes = await this.getStrata<Record<string, any>>(resource, {
      fetchtype: 'absolute',
      page: 1,
      perPage,
      dynamicPage: 1,
      dynamicPerPage: perPage,
    });

    if (!firstRes.success || !firstRes.data) {
      return { items: [], success: false, complete: false };
    }

    const items: Record<string, any>[] = [...(firstRes.data.items || [])];
    const totalPages = Math.max(1, Number(firstRes.data.skewTotalPages ?? 1));
    let complete = true;

    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => {
          const page = idx + 2;
          return this.getStrata<Record<string, any>>(resource, {
            fetchtype: 'absolute',
            page,
            perPage,
            dynamicPage: page,
            dynamicPerPage: perPage,
          });
        })
      );
      for (const r of rest) {
        if (r.success && r.data?.items) {
          items.push(...r.data.items);
        } else {
          complete = false;
        }
      }
    }

    const seen = new Set<string>();
    const deduplicated: Record<string, any>[] = [];
    for (const item of items) {
      const key = String(item.guidId ?? item.id ?? item.code ?? '').trim();
      if (!key) {
        deduplicated.push(item);
        continue;
      }
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    return { items: deduplicated, success: true, complete };
  },

  async fetchCurriculumIndex(): Promise<ClientCurriculumIndexData | null> {
    const now = Date.now();
    if (
      cachedCurriculumIndex &&
      cachedCurriculumIndex.data.complete &&
      now - cachedCurriculumIndex.timestamp < CACHE_TTL_MS
    ) {
      return cachedCurriculumIndex.data;
    }

    if (inFlightCurriculumIndex) {
      return inFlightCurriculumIndex;
    }

    inFlightCurriculumIndex = (async () => {
      try {
        const res = await request<ClientCurriculumIndexData>('/api/strata/curriculum-index');
        if (
          !res.success ||
          !res.data ||
          !Array.isArray(res.data.subjects) ||
          !Array.isArray(res.data.courses) ||
          !Array.isArray(res.data.programs) ||
          typeof res.data.examsBySubjectGuid !== 'object' ||
          res.data.examsBySubjectGuid === null
        ) {
          return null;
        }

        if (
          res.data.complete &&
          (res.data.subjects.length > 0 || Object.keys(res.data.examsBySubjectGuid).length > 0)
        ) {
          cachedCurriculumIndex = { data: res.data, timestamp: Date.now() };
        }
        return res.data;
      } finally {
        inFlightCurriculumIndex = null;
      }
    })();

    return inFlightCurriculumIndex;
  },

  async fetchNominalSubjectExams(
    subjectIdentifier: string,
    expectedProgramId: AuthorizedProgramId
  ): Promise<{ items: Record<string, any>[]; complete: boolean }> {
    const trimmedId = String(subjectIdentifier ?? '').trim();
    if (!trimmedId || parseStrictProgramId(expectedProgramId) !== expectedProgramId) {
      return { items: [], complete: false };
    }

    const normId = trimmedId.toLowerCase();
    const now = Date.now();

    if (
      cachedCurriculumIndex &&
      cachedCurriculumIndex.data.complete &&
      now - cachedCurriculumIndex.timestamp < CACHE_TTL_MS
    ) {
      const indexList = cachedCurriculumIndex.data.examsBySubjectGuid[normId];
      if (Array.isArray(indexList)) {
        const verifiedFromIndex = indexList.filter(
          (item) =>
            isEligibleExamStatus(item.status) &&
            parseStrictProgramId(item.programId) === expectedProgramId
        );
        return { items: verifiedFromIndex, complete: true };
      }
    }

    const cacheKey = `${expectedProgramId}:${normId}`;
    const cached = cachedNominalExamsByKey.get(cacheKey);
    if (cached && cached.complete && now - cached.timestamp < CACHE_TTL_MS) {
      return { items: cached.items, complete: true };
    }

    const existingPromise = inFlightNominalExamsByKey.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const firstRes = await this.getStrata<Record<string, any>>('exams', {
          fetchtype: 'nominal',
          identifier: trimmedId,
          dynamicLearningStrataName: 'subject',
          page: 1,
          perPage: 250,
          dynamicPage: 1,
          dynamicPerPage: 250,
          scope: 'learner',
        });

        if (!firstRes.success || !firstRes.data) {
          return { items: cached?.items || [], complete: false };
        }

        const rawItems: Record<string, any>[] = [...(firstRes.data.items || [])];
        const totalPages = Math.max(1, Number(firstRes.data.skewTotalPages ?? 1));
        let complete = true;

        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, idx) => {
              const page = idx + 2;
              return this.getStrata<Record<string, any>>('exams', {
                fetchtype: 'nominal',
                identifier: trimmedId,
                dynamicLearningStrataName: 'subject',
                page,
                perPage: 250,
                dynamicPage: page,
                dynamicPerPage: 250,
                scope: 'learner',
              });
            })
          );
          for (const res of rest) {
            if (res.success && res.data?.items) {
              rawItems.push(...res.data.items);
            } else {
              complete = false;
            }
          }
        }

        const looksLikeGuid = trimmedId.includes('-') && trimmedId.length >= 16;
        const looksLikeNumeric = /^\d+$/.test(trimmedId);
        const seen = new Set<string>();
        const verified: Record<string, any>[] = [];

        for (const item of rawItems) {
          if (!isEligibleExamStatus(item.status)) continue;
          if (parseStrictProgramId(item.programId) !== expectedProgramId) continue;

          const itemSubGuid =
            typeof item.subjectGuidId === 'string' ? item.subjectGuidId.trim().toLowerCase() : '';
          const itemSubId =
            item.subjectId !== undefined && item.subjectId !== null ? String(item.subjectId).trim() : '';

          if (looksLikeGuid && itemSubGuid && itemSubGuid !== normId) continue;
          if (looksLikeNumeric && itemSubId && itemSubId !== trimmedId) continue;

          const exId = String(item.guidId ?? item.id ?? '').trim();
          if (!exId || seen.has(exId)) continue;
          seen.add(exId);
          verified.push(item);
        }

        if (complete) {
          cachedNominalExamsByKey.set(cacheKey, {
            items: verified,
            complete: true,
            timestamp: Date.now(),
          });
        }

        return { items: verified, complete };
      } finally {
        inFlightNominalExamsByKey.delete(cacheKey);
      }
    })();

    inFlightNominalExamsByKey.set(cacheKey, promise);
    return promise;
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
      ? params.searchTerm.trim().toLowerCase()
      : typeof params?.search === 'string' && params.search.trim()
        ? params.search.trim().toLowerCase()
        : undefined;

    // Fail closed immediately on invalid, unauthorized, or conflicting program/pathway filters
    const constraints = resolveRequestedFilterConstraints(params);
    if (!constraints.valid) {
      return emptyPagedResult(pageNumber, pageSize);
    }

    const reqCategory = typeof params?.category === 'string' && params.category.trim() ? params.category.trim().toLowerCase() : null;
    const reqCourse = typeof params?.course === 'string' && params.course.trim() ? params.course.trim().toLowerCase() : null;
    const reqSchool = typeof params?.school === 'string' && params.school.trim() ? params.school.trim().toLowerCase() : null;
    const reqSubject = typeof params?.subject === 'string' && params.subject.trim() ? params.subject.trim() : null;
    const reqTopic = typeof params?.topic === 'string' && params.topic.trim() ? params.topic.trim().toLowerCase() : null;
    const reqDifficulty = typeof params?.difficulty === 'string' && params.difficulty.trim() ? params.difficulty.trim().toLowerCase() : null;
    const reqSeason = typeof params?.season === 'string' && params.season.trim() ? params.season.trim().toLowerCase() : null;
    const reqYear = params?.academicYear ? Number(params.academicYear) : null;
    const reqExamId = typeof params?.examId === 'string' && params.examId.trim() ? params.examId.trim() : null;

    const rawSubjectIdsParam = Array.isArray(params?.subjectIds)
      ? params.subjectIds.join(',')
      : typeof params?.subjectIds === 'string'
        ? params.subjectIds
        : '';
    const requestedSubjectIds = Array.from(
      new Set(
        [
          ...rawSubjectIdsParam.split(','),
          typeof params?.subjectGuidId === 'string' ? params.subjectGuidId : '',
          params?.subjectId !== undefined && params?.subjectId !== null ? String(params.subjectId) : '',
        ]
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );

    if (reqCourse && isUnauthorizedExamFamilyName(reqCourse)) {
      return emptyPagedResult(pageNumber, pageSize);
    }
    if (reqSubject && isUnauthorizedExamFamilyName(reqSubject)) {
      return emptyPagedResult(pageNumber, pageSize);
    }

    let rawItems: Record<string, any>[] = [];
    let usedVerifiedSourceLookup = false;

    const collectNominalForSources = async (
      matchedSources: AuthorizedSourceSubject[],
      curriculum: AuthorizedCurriculumState
    ): Promise<Record<string, any>[]> => {
      const seen = new Set<string>();
      const collected: Record<string, any>[] = [];
      const fetchedLists = await Promise.all(
        matchedSources.map(async (src) => {
          const sourceExams = curriculum.complete
            ? (lookupExamsForSourceSubject(src, curriculum.examsBySubjectKey as unknown as Map<string, RawRecord[]>) as Record<string, any>[])
            : (await this.fetchNominalSubjectExams(src.subjectGuidId ?? src.subjectId, src.programId)).items;
          return { src, sourceExams };
        })
      );

      for (const { src, sourceExams } of fetchedLists) {
        for (const ex of sourceExams) {
          const exProg = parseStrictProgramId(ex.programId);
          if (exProg !== null && exProg !== src.programId) continue;
          const id = String(ex.guidId ?? ex.id ?? '').trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          collected.push(enrichExamFromVerifiedSource(ex, src));
        }
      }
      return collected;
    };

    if (requestedSubjectIds.length > 0) {
      // Path A: Exact source-subject identity nominal retrieval
      const requestedLowerSet = new Set(requestedSubjectIds.map((id) => id.toLowerCase()));
      const curriculum = await loadAuthorizedCurriculumSources();

      if (curriculum.allSources.length > 0) {
        const matchedSources = curriculum.allSources.filter((src) => {
          const matchesId =
            (src.subjectGuidId && requestedLowerSet.has(src.subjectGuidId.toLowerCase())) ||
            requestedLowerSet.has(src.subjectId.toLowerCase());
          if (!matchesId) return false;
          if (constraints.programIdFilter !== null && src.programId !== constraints.programIdFilter) {
            return false;
          }
          if (constraints.reqPathwayNorm && constraints.reqPathwayNorm !== 'All') {
            if (!isPathwayMatch(src.pathway, constraints.reqPathwayNorm)) return false;
          }
          return true;
        });

        if (matchedSources.length === 0) {
          return emptyPagedResult(pageNumber, pageSize);
        }

        usedVerifiedSourceLookup = true;
        rawItems = await collectNominalForSources(matchedSources, curriculum);
      } else if (curriculum.catalogLoaded) {
        return emptyPagedResult(pageNumber, pageSize);
      } else if (constraints.programIdFilter !== null) {
        usedVerifiedSourceLookup = true;
        const results = await Promise.all(
          requestedSubjectIds.map((id) => this.fetchNominalSubjectExams(id, constraints.programIdFilter!))
        );
        const seen = new Set<string>();
        for (const r of results) {
          for (const ex of r.items) {
            const id = String(ex.guidId ?? ex.id ?? '').trim();
            if (id && !seen.has(id)) {
              seen.add(id);
              rawItems.push(ex);
            }
          }
        }
      } else {
        return emptyPagedResult(pageNumber, pageSize);
      }
    } else if (reqSubject) {
      // Path B: Resolve subject name against authorized {6, 9} source subjects & nominal endpoints
      const curriculum = await loadAuthorizedCurriculumSources();
      if (curriculum.allSources.length > 0) {
        const reqSubLower = reqSubject.trim().toLowerCase();
        const reqSubClean = cleanSubjectDisplayName(reqSubject).toLowerCase();
        const reqDiscipline = identifySubjectDiscipline(reqSubject);

        const matchedSources = curriculum.allSources.filter((src) => {
          if (constraints.programIdFilter !== null && src.programId !== constraints.programIdFilter) {
            return false;
          }
          if (constraints.reqPathwayNorm && constraints.reqPathwayNorm !== 'All') {
            if (!isPathwayMatch(src.pathway, constraints.reqPathwayNorm)) return false;
          }
          if (reqCourse && reqCourse !== 'all') {
            const cName = String(src.courseName ?? '').toLowerCase();
            const cId = src.courseId !== null && src.courseId !== undefined ? String(src.courseId).toLowerCase() : '';
            if (cName !== reqCourse && !cName.includes(reqCourse) && cId !== reqCourse) return false;
          }
          if (reqDiscipline.key && src.disciplineKey) {
            return src.disciplineKey === reqDiscipline.key;
          }
          const sGuid = src.subjectGuidId?.toLowerCase() ?? '';
          const sId = src.subjectId.toLowerCase();
          const sRaw = src.rawName.toLowerCase();
          const sDisp = src.displayName.toLowerCase();
          const sClean = cleanSubjectDisplayName(src.rawName).toLowerCase();
          return (
            sGuid === reqSubLower ||
            sId === reqSubLower ||
            sRaw === reqSubLower ||
            sDisp === reqSubLower ||
            sClean === reqSubClean
          );
        });

        if (matchedSources.length === 0) {
          return emptyPagedResult(pageNumber, pageSize);
        }

        usedVerifiedSourceLookup = true;
        rawItems = await collectNominalForSources(matchedSources, curriculum);
      } else if (curriculum.catalogLoaded) {
        return emptyPagedResult(pageNumber, pageSize);
      } else {
        rawItems = await this.fetchAllStrataExams({ scope: 'learner' });
      }
    } else {
      // Path C: General catalog browse via absolute learner-scoped Strata exams
      rawItems = await this.fetchAllStrataExams({ scope: 'learner' });
      if (!rawItems || rawItems.length === 0) {
        const strataRes = await this.getStrata<Record<string, any>>('exams', {
          fetchtype: 'absolute',
          scope: 'learner',
          page: 1,
          perPage: 250,
          dynamicPage: 1,
          dynamicPerPage: 250,
        });
        if (strataRes.success && strataRes.data?.items) {
          rawItems = strataRes.data.items;
        }
      }
    }

    const reqSubjectLower = reqSubject ? reqSubject.trim().toLowerCase() : null;

    const mappedItems: import('./api-types').StudySetCardDto[] = (rawItems || [])
      .filter((item) => {
        const classification = classifyAuthoritativePathway(item);
        if (!classification.eligible || !classification.pathway) {
          return false;
        }
        if (!isEligibleExamStatus(item.status)) {
          return false;
        }

        const itemProgramId =
          parseStrictProgramId(item.programId) ?? programIdForPathway(classification.pathway);
        if (constraints.programIdFilter !== null && itemProgramId !== constraints.programIdFilter) {
          return false;
        }

        if (reqExamId) {
          const itemGuid = String(item.guidId ?? item.id ?? '').trim();
          const itemNumId = String(item.id ?? '').trim();
          if (itemGuid !== reqExamId && itemNumId !== reqExamId) return false;
        }

        if (constraints.reqPathwayNorm && constraints.reqPathwayNorm !== 'All') {
          if (!isPathwayMatch(classification.pathway, constraints.reqPathwayNorm)) {
            return false;
          }
        }

        if (reqCategory && reqCategory !== 'all') {
          const inferredCat = (classification.category ?? inferExamCategory(item)).toLowerCase();
          const itemCat = String(item.category ?? item.type ?? item.assessmentName ?? '').trim().toLowerCase();
          if (inferredCat !== reqCategory && !itemCat.includes(reqCategory)) return false;
        }

        if (constraints.reqProgramRaw) {
          const itemProg = String(item.programName ?? item.program ?? item.programId ?? '').trim().toLowerCase();
          if (itemProg !== constraints.reqProgramRaw && !itemProg.includes(constraints.reqProgramRaw)) {
            return false;
          }
        }

        if (reqCourse && reqCourse !== 'all') {
          const itemCourseName = String(item.courseName ?? item.course ?? '').trim().toLowerCase();
          const itemCourseId = String(item.courseId ?? item.courseGuidId ?? '').trim().toLowerCase();
          if (
            itemCourseName !== reqCourse &&
            !itemCourseName.includes(reqCourse) &&
            itemCourseId !== reqCourse
          ) {
            return false;
          }
        }

        if (reqSchool) {
          const itemSchool = String(item.school ?? item.schoolName ?? '').trim().toLowerCase();
          const itemTitle = String(item.title ?? '').toLowerCase();
          const itemDesc = String(item.description ?? '').toLowerCase();
          if (itemSchool !== reqSchool && !itemTitle.includes(reqSchool) && !itemDesc.includes(reqSchool)) {
            return false;
          }
        }

        if (reqSubjectLower && !usedVerifiedSourceLookup) {
          const itemSubject = String(item.subjectName ?? item.subject ?? '').trim().toLowerCase();
          const itemTitle = String(item.title ?? '').toLowerCase();
          const itemDesc = String(item.description ?? '').toLowerCase();
          const text = `${itemSubject} ${itemTitle} ${itemDesc}`;
          const cleanSubject = reqSubjectLower.replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').trim();
          const subjectTokens = cleanSubject.split(/\s+/).filter((t) => t.length > 2);
          const directMatch =
            itemSubject.length > 0 && (itemSubject === reqSubjectLower || itemSubject.includes(cleanSubject));
          const textMatch =
            text.includes(cleanSubject) ||
            (subjectTokens.length > 0 && subjectTokens.every((tok) => text.includes(tok)));
          if (!directMatch && !textMatch) return false;
        }

        if (reqTopic) {
          const itemTopic = String(item.topicName ?? item.topic ?? '').trim().toLowerCase();
          if (itemTopic !== reqTopic) return false;
        }

        if (reqDifficulty) {
          const rawDiff = String(item.difficulty ?? '').trim().toLowerCase();
          const resolvedDiff = String(resolveAuthoritativeExamTitleAndDifficulty(item).difficulty ?? '').trim().toLowerCase();
          if (rawDiff !== reqDifficulty && resolvedDiff !== reqDifficulty) return false;
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
          const itemSubject = String(item.subjectName ?? item.subject ?? '').toLowerCase();
          const itemSchool = String(item.schoolName ?? item.school ?? '').toLowerCase();
          const itemCourse = String(item.courseName ?? item.course ?? '').toLowerCase();
          const text = `${itemTitle} ${itemDesc} ${itemSubject} ${itemSchool} ${itemCourse}`;
          if (!text.includes(search)) return false;
        }

        return true;
      })
      .map(mapStudySetCardItem)
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

    const constraints = resolveRequestedFilterConstraints(params);
    if (!constraints.valid) {
      return emptyPagedResult(pageNumber, pageSize);
    }

    const reqCategory = typeof params?.category === 'string' && params.category.trim() ? params.category.trim().toLowerCase() : null;
    const reqCourse = typeof params?.course === 'string' && params.course.trim() ? params.course.trim().toLowerCase() : null;
    const reqSchool = typeof params?.school === 'string' && params.school.trim() ? params.school.trim().toLowerCase() : null;
    const reqYear = params?.academicYear ? Number(params.academicYear) : null;
    const reqSeason = typeof params?.season === 'string' && params.season.trim() ? params.season.trim().toLowerCase() : null;
    const reqDifficulty = typeof params?.difficulty === 'string' && params.difficulty.trim() ? params.difficulty.trim().toLowerCase() : null;

    if (reqCourse && isUnauthorizedExamFamilyName(reqCourse)) {
      return emptyPagedResult(pageNumber, pageSize);
    }

    const curriculum = await loadAuthorizedCurriculumSources();
    if (curriculum.rnSubjects.length === 0 && curriculum.lpnSubjects.length === 0) {
      return emptyPagedResult(pageNumber, pageSize);
    }

    const consolidatedCards = consolidateRnAndLpnSubjects(
      curriculum.rnSubjects,
      curriculum.lpnSubjects,
      curriculum.examsBySubjectKey as unknown as Map<string, RawRecord[]>,
      {
        examIndexComplete: curriculum.complete,
        failedSubjectIds: curriculum.failedSubjectIds,
        inferTitleAndDifficulty: (ex) => resolveAuthoritativeExamTitleAndDifficulty(ex as Record<string, any>),
        inferDeliveryMode: (ex) => inferExamDeliveryMode(ex as Record<string, any>),
      }
    );

    const filteredSubjects = consolidatedCards.filter((item) => {
      const cardSources = [
        ...(item.sourceSubjects?.rn ?? []),
        ...(item.sourceSubjects?.lpn ?? []),
      ];

      const matchingSources = cardSources.filter((src) => {
        if (constraints.programIdFilter !== null && src.programId !== constraints.programIdFilter) {
          return false;
        }
        if (constraints.reqPathwayNorm && constraints.reqPathwayNorm !== 'All') {
          if (!isPathwayMatch(src.pathway, constraints.reqPathwayNorm)) return false;
        }
        if (constraints.reqProgramRaw) {
          const pName = src.programName.toLowerCase();
          const pIdStr = String(src.programId);
          if (
            pName !== constraints.reqProgramRaw &&
            !pName.includes(constraints.reqProgramRaw) &&
            pIdStr !== constraints.reqProgramRaw
          ) {
            return false;
          }
        }
        if (reqCourse && reqCourse !== 'all') {
          const cName = String(src.courseName ?? '').toLowerCase();
          const cId = src.courseId !== null && src.courseId !== undefined ? String(src.courseId).toLowerCase() : '';
          const cGuid = String(src.courseGuidId ?? '').toLowerCase();
          if (cName !== reqCourse && !cName.includes(reqCourse) && cId !== reqCourse && cGuid !== reqCourse) {
            return false;
          }
        }
        return true;
      });

      if (matchingSources.length === 0) {
        return false;
      }

      if (reqCategory && reqCategory !== 'all') {
        const c = item.category.toLowerCase();
        const t = item.title.toLowerCase();
        const rawCat = String(reqCategory).toLowerCase();
        const matchesCategory =
          c === rawCat ||
          c.includes(rawCat) ||
          t === rawCat ||
          t.includes(rawCat) ||
          (rawCat === 'med-surg' && (t.includes('med-surg') || t.includes('medical-surgical') || t.includes('med surg') || t.includes('medical surgical'))) ||
          (rawCat === 'pediatrics' && (t.includes('pediatric') || t.includes('peds') || t.includes('child'))) ||
          (rawCat === 'mental health' && (t.includes('mental health') || t.includes('psych'))) ||
          (rawCat === 'fundamentals' && t.includes('fundamental')) ||
          (rawCat === 'pharmacology' && (t.includes('pharmacol') || t.includes('dosage') || t.includes('drug'))) ||
          (rawCat === 'leadership' && (t.includes('leadership') || t.includes('management') || t.includes('professional'))) ||
          (rawCat === 'adult health' && t.includes('adult health')) ||
          (rawCat === 'health assessment' && (t.includes('health assessment') || t.includes('physical assessment') || t.includes('assessment'))) ||
          (rawCat === 'maternal & newborn' && (t.includes('maternal') || t.includes('newborn') || t.includes('obstetric') || t.includes('maternity') || t.includes('women')));
        if (!matchesCategory) return false;
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
        const sourceText = cardSources.map((s) => `${s.rawName} ${s.courseName ?? ''} ${s.programName}`).join(' ');
        const hay = `${item.title} ${item.description} ${item.courseName ?? ''} ${item.programName ?? ''} ${sourceText}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const getCanonicalSortRank = (title: string): number => {
      const lower = title.toLowerCase();
      if (lower.includes('med-surg') || lower.includes('medical-surgical') || lower.includes('med surg') || lower.includes('medical surgical')) return 1;
      if (lower.includes('pediatric') || lower.includes('peds') || lower.includes('child')) return 2;
      if (lower.includes('mental health') || lower.includes('psych')) return 3;
      if (lower.includes('fundamental')) return 4;
      if (lower.includes('pharmacol') || lower.includes('dosage') || lower.includes('drug')) return 5;
      if (lower.includes('leadership') || lower.includes('management') || lower.includes('professional')) return 6;
      if (lower.includes('adult health')) return 7;
      if (lower.includes('health assessment') || lower.includes('assessment') || lower.includes('physical assessment')) return 8;
      if (lower.includes('maternal') || lower.includes('newborn') || lower.includes('obstetric') || lower.includes('maternity') || lower.includes('women')) return 9;
      return 10;
    };

    filteredSubjects.sort((a, b) => {
      const rankA = getCanonicalSortRank(a.title);
      const rankB = getCanonicalSortRank(b.title);
      if (rankA !== rankB) return rankA - rankB;
      return a.title.localeCompare(b.title);
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
    const [curriculum, schoolsRes, topicsRes, sectionsRes] = await Promise.all([
      loadAuthorizedCurriculumSources(),
      this.getStrata<Record<string, any>>('schools', { fetchtype: 'absolute', page: 1, perPage: 250 }),
      this.getStrata<Record<string, any>>('topics', { fetchtype: 'absolute', page: 1, perPage: 100 }),
      this.getStrata<Record<string, any>>('sections', { fetchtype: 'absolute', page: 1, perPage: 100 }),
    ]);

    if (!curriculum.catalogLoaded && !schoolsRes.success && !topicsRes.success && !sectionsRes.success) {
      return {
        success: false,
        message: 'Unable to load study library filters.',
        errorCode: 'BACKEND_ERROR',
      };
    }

    const pickName = (r: Record<string, any>) =>
      String(r.name ?? r.title ?? r.slug ?? r.code ?? r.id ?? '').trim();
    const pickId = (r: Record<string, any>) =>
      String(r.guidId ?? r.id ?? r._id ?? r.slug ?? '').trim();

    const examItems: Record<string, any>[] = curriculum.fromIndex && curriculum.indexData
      ? collectUniqueIndexExams(curriculum.indexData).filter(
          (ex) => classifyAuthoritativePathway(ex).eligible && isEligibleExamStatus(ex.status)
        )
      : (await this.fetchAllStrataExams({ scope: 'learner' })).filter(
          (ex) => classifyAuthoritativePathway(ex).eligible && isEligibleExamStatus(ex.status)
        );

    const programs = curriculum.authorizedPrograms
      .map((p) => ({
        id: pickId(p),
        name: pickName(p),
        code: typeof p.code === 'string' && p.code.trim() ? p.code.trim() : undefined,
      }))
      .filter((p, idx, arr) => p.id && p.name && arr.findIndex((x) => x.id === p.id) === idx);

    const courses = curriculum.authorizedCourses
      .map((c) => {
        const pid = parseStrictProgramId(c.programId ?? c.program_id);
        return {
          id: pickId(c),
          name: pickName(c),
          code: typeof c.code === 'string' && c.code.trim() ? c.code.trim() : undefined,
          programId: pid !== null ? String(pid) : undefined,
        };
      })
      .filter((c, idx, arr) => c.id && c.name && arr.findIndex((x) => x.id === c.id) === idx);

    const categorySet = new Set<import('./api-types').ExamCategory>();
    for (const src of curriculum.allSources) {
      categorySet.add(src.category);
    }
    for (const ex of examItems) {
      const classification = classifyAuthoritativePathway(ex);
      if (classification.eligible && classification.category && classification.category !== 'Certification') {
        categorySet.add(classification.category);
      }
    }
    if (categorySet.size === 0 && (curriculum.allSources.length > 0 || examItems.length > 0)) {
      (['ATI', 'HESI', 'RegularCourse', 'ExitPredictor'] as const).forEach((c) => categorySet.add(c));
    }

    const schoolSet = new Set<string>();
    const yearSet = new Set<number>();
    const seasonSet = new Set<string>();
    const difficultySet = new Set<import('./api-types').DifficultyLevel>();

    for (const s of (schoolsRes.data?.items ?? []).map(pickName).filter(Boolean)) {
      if (!isUnauthorizedExamFamilyName(s)) {
        schoolSet.add(s);
      }
    }

    const sectionItems = sectionsRes.success && sectionsRes.data ? sectionsRes.data.items : [];
    for (const rec of [...examItems, ...sectionItems]) {
      if (typeof rec.school === 'string' && rec.school.trim() && !isUnauthorizedExamFamilyName(rec.school)) {
        schoolSet.add(rec.school.trim());
      }
      if (typeof rec.schoolName === 'string' && rec.schoolName.trim() && !isUnauthorizedExamFamilyName(rec.schoolName)) {
        schoolSet.add(rec.schoolName.trim());
      }
      const y = rec.academicYear ?? rec.year;
      if (typeof y === 'number' && Number.isFinite(y)) yearSet.add(y);
      else if (typeof y === 'string' && /^\d{4}$/.test(y.trim())) yearSet.add(Number(y.trim()));

      const s = rec.season ?? rec.term;
      if (typeof s === 'string' && s.trim()) seasonSet.add(s.trim());

      const resolvedDiff = resolveAuthoritativeExamTitleAndDifficulty(rec).difficulty;
      if (resolvedDiff) {
        difficultySet.add(resolvedDiff);
      }
    }

    for (const src of curriculum.allSources) {
      if (src.year !== null) yearSet.add(src.year);
      if (src.season) seasonSet.add(src.season);
      if (src.difficulty) difficultySet.add(src.difficulty);
      if (src.school && !isUnauthorizedExamFamilyName(src.school)) schoolSet.add(src.school);
    }

    const sortSubjectNames = (names: string[]): string[] => {
      const getCanonicalSortRank = (title: string): number => {
        const lower = title.toLowerCase();
        if (lower.includes('med-surg') || lower.includes('medical-surgical') || lower.includes('med surg') || lower.includes('medical surgical')) return 1;
        if (lower.includes('pediatric') || lower.includes('peds') || lower.includes('child')) return 2;
        if (lower.includes('mental health') || lower.includes('psych')) return 3;
        if (lower.includes('fundamental')) return 4;
        if (lower.includes('pharmacol') || lower.includes('dosage') || lower.includes('drug')) return 5;
        if (lower.includes('leadership') || lower.includes('management') || lower.includes('professional')) return 6;
        if (lower.includes('adult health')) return 7;
        if (lower.includes('health assessment') || lower.includes('assessment') || lower.includes('physical assessment')) return 8;
        if (lower.includes('maternal') || lower.includes('newborn') || lower.includes('obstetric') || lower.includes('maternity') || lower.includes('women')) return 9;
        return 10;
      };

      return Array.from(
        new Set(names.filter((n) => Boolean(n) && !isUnauthorizedExamFamilyName(n)))
      ).sort((a, b) => {
        const rankA = getCanonicalSortRank(a);
        const rankB = getCanonicalSortRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });
    };

    const resolvedSubjects = sortSubjectNames(curriculum.allSources.map((s) => s.displayName));
    const rnSubjects = sortSubjectNames(curriculum.rnSubjects.map((s) => s.displayName));
    const lpnSubjects = sortSubjectNames(curriculum.lpnSubjects.map((s) => s.displayName));

    const pathways: import('./api-types').NursingPathway[] = ['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit'];

    const mappedExams = examItems
      .map((ex) => {
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
      .filter((ex, idx, arr) => ex.id && ex.title && arr.findIndex((x) => x.id === ex.id) === idx);

    return {
      success: true,
      message: 'OK',
      data: {
        pathways,
        categories: Array.from(categorySet),
        schools: Array.from(schoolSet).sort((a, b) => a.localeCompare(b)),
        academicYears: Array.from(yearSet).sort((a, b) => b - a),
        subjects: resolvedSubjects,
        rnSubjects,
        lpnSubjects,
        seasons: Array.from(seasonSet),
        exams: mappedExams,
        topics: Array.from(
          new Set((topicsRes.data?.items ?? []).map(pickName).filter((t) => Boolean(t) && !isUnauthorizedExamFamilyName(t)))
        ),
        difficulties: Array.from(difficultySet),
        questionTypes: [],
        programs,
        courses,
      },
    };
  },

  async getStudyLibrarySummary(): Promise<ApiResponse<import('./api-types').StudyLibrarySummaryDto>> {
    const curriculum = await loadAuthorizedCurriculumSources();
    let eligibleExams: Record<string, any>[] = [];

    if (curriculum.fromIndex && curriculum.allSources.length > 0) {
      const seen = new Set<string>();
      for (const src of curriculum.allSources) {
        const sourceExams = lookupExamsForSourceSubject(
          src,
          curriculum.examsBySubjectKey as unknown as Map<string, RawRecord[]>
        ) as Record<string, any>[];
        for (const ex of sourceExams) {
          const exId = String(ex.guidId ?? ex.id ?? '').trim();
          if (exId && !seen.has(exId)) {
            seen.add(exId);
            eligibleExams.push(enrichExamFromVerifiedSource(ex, src));
          }
        }
      }
    } else {
      const allExams = await this.fetchAllStrataExams({ scope: 'learner' });
      eligibleExams = (allExams || []).filter(
        (ex) => classifyAuthoritativePathway(ex).eligible && isEligibleExamStatus(ex.status)
      );
    }

    const totalPublishedStudySets = eligibleExams.length;
    const totalAvailableQuestions = eligibleExams.reduce(
      (sum, e) => sum + (Number(e.totalQuestions ?? e.questionsCount ?? 0) || 0),
      0
    );

    const discoveredCategories = new Set<import('./api-types').ExamCategory>();
    for (const src of curriculum.allSources) {
      discoveredCategories.add(src.category);
    }
    for (const ex of eligibleExams) {
      const classification = classifyAuthoritativePathway(ex);
      if (classification.eligible && classification.category && classification.category !== 'Certification') {
        discoveredCategories.add(classification.category);
      }
    }

    const discoveredPathways = new Set<import('./api-types').NursingPathway>();
    for (const src of curriculum.allSources) {
      discoveredPathways.add(src.pathway);
    }
    if (discoveredPathways.size === 0) {
      for (const ex of eligibleExams) {
        const classification = classifyAuthoritativePathway(ex);
        if (classification.eligible && classification.pathway) {
          discoveredPathways.add(classification.pathway);
        }
      }
    }

    return {
      success: true,
      message: 'OK',
      data: {
        totalPublishedStudySets,
        totalAvailableQuestions,
        totalCategories: discoveredCategories.size,
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

  async requestTutorAssist(
    attemptId: string,
    payload: import('./api-types').TutorAssistRequestDto
  ): Promise<ApiResponse<import('./api-types').TutorAssistResponseDto>> {
    return request(`/api/attempts/${encodeURIComponent(attemptId)}/tutor/assist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTutorConversations(
    attemptId: string,
    questionId: string
  ): Promise<
    ApiResponse<{
      attemptId: string;
      questionId: string;
      conversation: import('./api-types').TutorConversationMessageDto[];
      aiProviderConfigured: boolean;
      disclosureNotice: string;
      remainingTurns: number;
    }>
  > {
    return request(
      `/api/attempts/${encodeURIComponent(attemptId)}/tutor/conversations?questionId=${encodeURIComponent(questionId)}`,
      { method: 'GET' }
    );
  },

  async checkTutorPractice(
    attemptId: string,
    payload: import('./api-types').TutorPracticeCheckRequestDto
  ): Promise<ApiResponse<import('./api-types').TutorPracticeCheckResponseDto>> {
    return request(`/api/attempts/${encodeURIComponent(attemptId)}/tutor/practice-check`, {
      method: 'POST',
      body: JSON.stringify(payload),
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
    if (!params) {
      return unprovisionedResponse('Study Guides');
    }
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

  async getTestimonials(options?: {
    pathway?: ApprovedTestimonialPathway;
  }): Promise<ApiResponse<TestimonialsCollectionResult>> {
    const rawPathway = options?.pathway;
    const validPathway =
      rawPathway !== undefined ? parseApprovedTestimonialPathway(rawPathway) : undefined;

    if (rawPathway !== undefined && validPathway === null) {
      return {
        success: false,
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Only RN and PN_LPN testimonials are supported.',
      };
    }

    const endpoint = validPathway
      ? `/api/testimonials?pathway=${encodeURIComponent(validPathway)}`
      : '/api/testimonials';

    const res = await request<unknown>(endpoint);
    if (!res.success || res.data === undefined || res.data === null) {
      return {
        success: true,
        statusCode: 200,
        message: 'OK',
        data: resolveTestimonialsCollection({
          backendAttempted: true,
          backendOk: false,
          backendStatusOverride: 'upstream_error',
          pathwayFilter: validPathway ?? undefined,
        }),
      };
    }

    const payloadObj =
      typeof res.data === 'object' && !Array.isArray(res.data)
        ? (res.data as Record<string, unknown>)
        : null;

    const backendStatusOverride =
      payloadObj &&
      (payloadObj.backendStatus === 'endpoint_not_provisioned' ||
        payloadObj.backendStatus === 'upstream_error' ||
        payloadObj.backendStatus === 'empty')
        ? (payloadObj.backendStatus as import('./testimonials/testimonial-service').TestimonialBackendStatus)
        : undefined;

    return {
      success: true,
      statusCode: 200,
      message: 'OK',
      data: resolveTestimonialsCollection({
        backendAttempted: payloadObj ? Boolean(payloadObj.endpointChecked ?? true) : true,
        backendOk: backendStatusOverride !== 'upstream_error',
        backendStatusOverride,
        backendPayload: res.data,
        pathwayFilter: validPathway ?? undefined,
      }),
    };
  },
};

export const quizNurseApi = nurviaApi;
