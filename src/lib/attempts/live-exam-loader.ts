/**
 * NURVIA-PREP — Authoritative Strata Live Exam Loader & Attempt Rehydrator
 *
 * Fetches full examination metadata, sections, questions, options, media, matrices,
 * answer keys, rationales, and saved learner responses from LexmaCasto/Strata
 * (`exams/list/live`) across all required pages, performs content-integrity
 * validation (without fabricating options), enforces mode permissions, and
 * supports cold-cache attempt rehydration from `strata~{examGuidId}~{attemptNumber}`.
 */

import type {
  ClientNeedCategory,
  CognitiveSkill,
  ExamCategory,
  ExamLayout,
  ExamLayoutPolicy,
  ExamModePermissionsDto,
  NursingPathway,
  QuestionCorrectAnswerMetaDto,
  QuestionExhibitDto,
  QuestionMatrixCellDto,
  QuestionMatrixDto,
  QuestionMediaDto,
  QuestionType,
} from '@/lib/api-types';
import {
  inferExamCategory,
  inferExamDeliveryMode,
  inferExamPathway,
  resolveAuthoritativeExamTitleAndDifficulty,
} from '@/lib/api-client';
import {
  cleanWordHtml,
  extractQuestionOptions,
  normalizeMediaUrl,
} from '@/lib/content/html-normalizer';
import {
  lexmaCastoRequest,
  type LexmaCastoRequestOptions,
} from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';
import type { CastoSessionCredentials } from '@/lib/lexmacasto/headers';
import type {
  StrataExamSessionResponse,
  StrataSessionCorrectAnswer,
  StrataSessionExam,
  StrataSessionExamAction,
  StrataSessionExamDesign,
  StrataSessionExamMode,
  StrataSessionQuestionFull,
  StrataSessionQuestionMatrix,
  StrataSessionSection,
  StrataSessionUserAnswer,
} from '@/lib/hooks/nexus/strata/assessment/learning/exams/live/useLiveStrataExamsHook';
import {
  attemptStore,
  type StoredAttempt,
  type StoredAttemptQuestion,
} from './attempt-store';
import {
  fromStrataSavedUserAnswer,
  resolveNormalizedQuestionType,
} from './strata-answer-adapter';

export interface LiveExamLoadOptions {
  examId: string;
  session: CastoSessionCredentials;
  siteMeta?: LexmaCastoRequestOptions['siteMeta'];
  layoutMode?: ExamLayout | null;
  deliveryMode?: 'Exam' | 'Tutor' | 'Review' | null;
  attemptNumber?: number | null;
  requestFn?: typeof lexmaCastoRequest;
}

export interface LiveExamLoadSuccess {
  ok: true;
  exam: StrataSessionExam;
  examId: string;
  examNumericId?: number;
  examTitle: string;
  pathway: NursingPathway;
  examCategory: ExamCategory;
  subjectName?: string;
  topicName?: string;
  learningObjectives: string[];
  instructions: string;
  isTimed: boolean;
  timeLimitMinutes: number;
  passingScorePercentage: number | null;
  configuredQuestionCount: number;
  loadedQuestionCount: number;
  pagesFetched: number;
  attemptNumber: number;
  allowedLayouts: ExamLayoutPolicy;
  design?: StrataSessionExamDesign;
  modes: StrataSessionExamMode[];
  examActions: StrataSessionExamAction[];
  modePermissions: ExamModePermissionsDto;
  questions: StoredAttemptQuestion[];
  savedResponses: Record<
    string,
    {
      responseJson: string | null;
      isFlagged: boolean;
      savedAtUtc: string;
    }
  >;
  integrityWarnings: string[];
  rawSession: StrataExamSessionResponse;
}

export interface LiveExamLoadFailure {
  ok: false;
  status: number;
  message: string;
  errorCode: string;
}

export type LiveExamLoadResult = LiveExamLoadSuccess | LiveExamLoadFailure;

const CHOICE_REQUIRED_BASE_TYPES = new Set([
  'singlechoice',
  'multiplechoice',
  'multipleselect',
  'multipleresponse',
  'selectallthatapply',
  'sata',
  'matching',
  'orderingitem',
  'orderingdragdrop',
  'orderingnumber',
  'orderedresponse',
  'draganddrop',
  'blankselect',
  'dynamicimage',
  'imagebased',
]);

export function buildDurableAttemptId(examGuidId: string, attemptNumber = 1): string {
  const safeNum = Number.isInteger(attemptNumber) && attemptNumber > 0 ? attemptNumber : 1;
  return `strata~${examGuidId}~${safeNum}`;
}

export function parseDurableAttemptId(
  attemptId: string
): { examGuidId: string; attemptNumber: number } | null {
  const trimmed = String(attemptId || '').trim();
  const match = /^strata~(.+)~(\d+)$/.exec(trimmed);
  if (!match) return null;
  const examGuidId = match[1].trim();
  const attemptNumber = Number(match[2]);
  if (!examGuidId || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
    return null;
  }
  return { examGuidId, attemptNumber };
}

/**
 * Computes strict server-authoritative Exam / Review / Tutor mode permissions
 * directly from the backend exam record, design rules, and mode configurations.
 * Distinguishes standalone non-graded study Review (`canReview`) from completed-attempt
 * post-submission review (`reviewReleased`), because Strata defaults `exam.allowReview`
 * to `false` on standard published examinations.
 */
export function resolveExamModePermissions(
  exam?: Partial<StrataSessionExam> | null,
  design?: Partial<StrataSessionExamDesign> | null,
  modes?: StrataSessionExamMode[] | null
): ExamModePermissionsDto {
  const examRecord = (exam ?? {}) as Record<string, unknown>;
  const enabledModes = Array.isArray(modes) ? modes.filter((m) => m && m.isEnabled !== false) : [];
  const hasExplicitReviewMode = enabledModes.some((m) => /review/i.test(String(m.mode ?? '')));
  const hasExplicitTutorMode = enabledModes.some((m) =>
    /tutor|practice|study|learning|guid/i.test(String(m.mode ?? ''))
  );
  const inferredDelivery = inferExamDeliveryMode(examRecord);

  const selectedMode = String(examRecord.selectedMode ?? '').toLowerCase();
  const hasModeRestrictions = Array.isArray(modes) && modes.length > 0;

  const explicitModeRestrictedToNonReview =
    typeof examRecord.modeAllowed === 'string' &&
    examRecord.modeAllowed.trim().length > 0 &&
    !/^(all|both|review)$/i.test(examRecord.modeAllowed.trim());

  const hasExplicitDisabledReviewMode =
    Array.isArray(modes) &&
    modes.some(
      (m) =>
        m &&
        /review/i.test(String(m.mode ?? '')) &&
        m.isEnabled === false
    ) &&
    !hasExplicitReviewMode;

  const isExplicitWithheld =
    design?.reviewable === false ||
    hasExplicitDisabledReviewMode ||
    examRecord.withholdReview === true ||
    examRecord.reviewReleased === false;

  const isStandardPublishedOrReview =
    selectedMode === 'review' ||
    (Array.isArray(modes) && typeof examRecord.title === 'string' && examRecord.title.trim().length > 0) ||
    design?.reviewable === true;

  const postSubmissionReviewWithheld =
    isExplicitWithheld || (exam?.allowReview === false && !isStandardPublishedOrReview);

  const explicitReviewDisabled =
    (postSubmissionReviewWithheld && selectedMode !== 'review') ||
    explicitModeRestrictedToNonReview ||
    (hasModeRestrictions &&
      !hasExplicitReviewMode &&
      exam?.allowReview !== true &&
      design?.reviewable !== true &&
      selectedMode !== 'review');

  const canExam = hasModeRestrictions
    ? enabledModes.some((m) => /exam/i.test(String(m.mode ?? '')))
    : (inferredDelivery === 'All' || inferredDelivery === 'Both' || inferredDelivery === 'Exam');

  const canReview = !explicitReviewDisabled && (
    hasExplicitReviewMode ||
    selectedMode === 'review' ||
    inferredDelivery === 'All' ||
    inferredDelivery === 'Both' ||
    inferredDelivery === 'Review' ||
    exam?.allowReview === true ||
    design?.reviewable === true
  );

  const canTutor = hasModeRestrictions
    ? (hasExplicitTutorMode || inferredDelivery === 'Tutor' || inferredDelivery === 'All')
    : (selectedMode === 'tutor' || inferredDelivery === 'All' || inferredDelivery === 'Tutor');

  const allowLayoutSwitching = design?.allowLayoutSwitching !== false;
  const allowModeSwitching = design?.allowModeSwitching !== false && (canReview || canTutor);
  const reviewReleased = !postSubmissionReviewWithheld;

  return {
    canExam,
    canReview,
    canTutor,
    examReason: canExam ? undefined : 'This item is configured strictly as a Review-only resource.',
    reviewReason: canReview
      ? undefined
      : 'Review mode is disabled by this examination’s backend configuration.',
    tutorReason: canTutor
      ? undefined
      : 'Tutor mode is not enabled for this examination by backend policy.',
    allowLayoutSwitching,
    allowModeSwitching,
    reviewReleased,
  };
}

function resolveAllowedLayouts(design?: Partial<StrataSessionExamDesign> | null): ExamLayoutPolicy {
  if (!design || design.allowLayoutSwitching !== false) {
    return 'Both';
  }
  const def = String(design.defaultLayout ?? '').toLowerCase();
  if (def.includes('all')) return 'AllInOneOnly';
  if (def.includes('seq')) return 'SequentialOnly';
  return 'Both';
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim());
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? '').trim());
      }
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function hydrateMatrix(rawMatrix?: StrataSessionQuestionMatrix): QuestionMatrixDto | undefined {
  if (!rawMatrix) return undefined;
  const rowHeaders = parseJsonStringArray(rawMatrix.rowHeaders);
  const columnHeaders = parseJsonStringArray(rawMatrix.columnHeaders);
  const cells: QuestionMatrixCellDto[] = Array.isArray(rawMatrix.cells)
    ? rawMatrix.cells.map((cell) => ({
        id: String(cell.id),
        numericId: cell.id,
        rowIndex: Number(cell.rowIndex ?? 0),
        columnIndex: Number(cell.columnIndex ?? 0),
        cellValue: cell.cellValue ? cleanWordHtml(cell.cellValue) : undefined,
        isLocked: Boolean(cell.isLocked),
        isCorrect: Boolean(cell.isCorrect),
        explanation: cell.explanation ? cleanWordHtml(cell.explanation) : undefined,
      }))
    : [];

  return {
    id: String(rawMatrix.guidId || rawMatrix.id),
    title: rawMatrix.title ? cleanWordHtml(rawMatrix.title) : undefined,
    description: rawMatrix.description ? cleanWordHtml(rawMatrix.description) : undefined,
    topLeftCell: rawMatrix.topLeftCell ? cleanWordHtml(rawMatrix.topLeftCell) : undefined,
    rowCount: Number(rawMatrix.rowCount ?? rowHeaders.length),
    columnCount: Number(rawMatrix.columnCount ?? columnHeaders.length),
    rowHeaders,
    columnHeaders,
    responseType: rawMatrix.responseType || 'singleChoice',
    instructions: rawMatrix.instructions ? cleanWordHtml(rawMatrix.instructions) : undefined,
    allowPartialCredit: Boolean(rawMatrix.allowPartialCredit),
    cells,
  };
}

function hydrateCorrectAnswerMeta(
  answers: StrataSessionCorrectAnswer[],
  options: StoredAttemptQuestion['options'],
  matrix?: QuestionMatrixDto
): QuestionCorrectAnswerMetaDto | undefined {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);

  const optionIdLookup = new Map<number, string>();
  for (const o of options) {
    if (o.numericId !== undefined) optionIdLookup.set(o.numericId, o.id);
  }

  for (const ans of safeAnswers) {
    if (ans.isCorrect && ans.questionOptionId !== undefined && ans.questionOptionId !== null) {
      const mapped = optionIdLookup.get(ans.questionOptionId) ?? String(ans.questionOptionId);
      if (!correctOptionIds.includes(mapped)) {
        correctOptionIds.push(mapped);
      }
    }
  }

  const correctMediaIds = Array.from(
    new Set(
      safeAnswers
        .filter((a) => a.isCorrect && a.questionMediaId !== undefined && a.questionMediaId !== null)
        .map((a) => String(a.questionMediaId))
    )
  );

  const correctCellIds = Array.from(
    new Set([
      ...(matrix?.cells.filter((c) => c.isCorrect).map((c) => c.id) ?? []),
      ...safeAnswers
        .filter(
          (a) => a.isCorrect && a.questionMatrixCellId !== undefined && a.questionMatrixCellId !== null
        )
        .map((a) => String(a.questionMatrixCellId)),
    ])
  );

  // Ordering sequence
  let correctOrderIds: string[] | undefined;
  const orderAns = safeAnswers.find((a) => a.correctOrder && a.correctOrder.trim());
  if (orderAns?.correctOrder) {
    const rawOrder = parseJsonStringArray(orderAns.correctOrder);
    if (rawOrder.length > 0) {
      correctOrderIds = rawOrder.map((token) => {
        const num = Number(token);
        if (Number.isFinite(num) && optionIdLookup.has(num)) {
          return optionIdLookup.get(num)!;
        }
        return token;
      });
    }
  } else if (options.some((o) => o.order !== undefined && o.order !== '' && !Number.isNaN(Number(o.order)))) {
    correctOrderIds = [...options]
      .sort((a, b) => Number(a.order ?? a.displayOrder) - Number(b.order ?? b.displayOrder))
      .map((o) => o.id);
  }

  // Matching pairs: option.id -> option.description
  const correctMatches: Record<string, string> = {};
  for (const o of options) {
    if (o.description && o.description.trim()) {
      correctMatches[o.id] = o.description.trim();
    }
  }

  // Blank fills / selects & expected numeric
  const correctBlanks: Record<string, string> = {};
  for (const o of options) {
    if (o.isCorrect && o.label) {
      correctBlanks[o.label] = o.optionText;
    } else if (o.isCorrect && o.order && !Number.isNaN(Number(o.order))) {
      correctBlanks[`blank${o.order}`] = o.id;
    }
  }

  const firstOpenEnded = safeAnswers.find((a) => a.openEndedAnswer?.trim())?.openEndedAnswer?.trim();
  const firstDesc = safeAnswers.find((a) => a.isCorrect && a.description?.trim())?.description?.trim();
  const expectedNumeric =
    firstOpenEnded ||
    options.find((o) => o.isCorrect && /^\s*[-+]?\d+(\.\d+)?\s*$/.test(o.optionText))?.optionText.trim() ||
    undefined;

  const explanationImages = Array.from(
    new Set(
      safeAnswers
        .map((a) => normalizeMediaUrl(a.explanationImage))
        .filter(Boolean)
    )
  );

  const allowPartialCredit = safeAnswers.some((a) => a.allowPartialCredit);

  return {
    ...(correctOptionIds.length > 0 ? { correctOptionIds } : {}),
    ...(correctMediaIds.length > 0 ? { correctMediaIds } : {}),
    ...(correctCellIds.length > 0 ? { correctCellIds } : {}),
    ...(correctOrderIds && correctOrderIds.length > 0 ? { correctOrderIds } : {}),
    ...(Object.keys(correctMatches).length > 0 ? { correctMatches } : {}),
    ...(Object.keys(correctBlanks).length > 0 ? { correctBlanks } : {}),
    ...(expectedNumeric ? { expectedNumeric } : {}),
    ...(firstOpenEnded || firstDesc ? { modelAnswerHtml: firstOpenEnded || firstDesc } : {}),
    ...(explanationImages.length > 0 ? { explanationImages } : {}),
    ...(allowPartialCredit ? { allowPartialCredit: true } : {}),
  };
}

function hydrateGeneralRationale(q: StrataSessionQuestionFull): string {
  const candidates: string[] = [];
  if (typeof (q as unknown as Record<string, unknown>).explanation === 'string') {
    candidates.push((q as unknown as Record<string, unknown>).explanation as string);
  }
  if (Array.isArray(q.questionCorrectAnswers)) {
    for (const ans of q.questionCorrectAnswers) {
      if (ans.description && ans.description.trim()) {
        candidates.push(ans.description.trim());
      } else if (ans.openEndedAnswer && ans.openEndedAnswer.trim()) {
        candidates.push(ans.openEndedAnswer.trim());
      }
    }
  }
  if (Array.isArray(q.questionOptions)) {
    for (const opt of q.questionOptions) {
      if (opt.explanation && opt.explanation.trim()) {
        candidates.push(opt.explanation.trim());
      }
    }
  }
  const unique = Array.from(
    new Set(candidates.map((c) => cleanWordHtml(c).trim()).filter(Boolean))
  );
  return unique.join('\n\n');
}

function mapStrataQuestion(
  q: StrataSessionQuestionFull,
  index: number,
  examGuidId: string,
  section: StrataSessionSection
): {
  question: StoredAttemptQuestion;
  savedResponse?: { responseJson: string | null; isFlagged: boolean; savedAtUtc: string };
} {
  const questionId = String(q.guidId || q.id || `q-${index + 1}`);
  const stem = cleanWordHtml(String(q.questionText || q.metaQuestionText || q.description || '').trim());
  const metaStem = q.metaQuestionText && q.metaQuestionText !== q.questionText
    ? cleanWordHtml(q.metaQuestionText)
    : undefined;
  const instructions = q.instructions ? cleanWordHtml(q.instructions) : undefined;
  const questionType = (typeof q.type === 'string' && q.type.trim() ? q.type.trim() : 'SingleChoice') as QuestionType;
  const { baseType } = resolveNormalizedQuestionType(questionType);

  const extractedOptions = extractQuestionOptions(q as unknown as Record<string, unknown>);
  const options: StoredAttemptQuestion['options'] = extractedOptions.map((opt, oIdx) => ({
    id: opt.id,
    numericId: opt.numericId,
    optionIndex: opt.optionIndex ?? oIdx + 1,
    optionText: opt.optionText,
    displayOrder: opt.displayOrder ?? oIdx + 1,
    isCorrect: Boolean(opt.isCorrect),
    specificRationale: opt.specificRationale,
    description: opt.description,
    data: opt.data,
    label: opt.label,
    order: opt.order,
    link: opt.link,
  }));

  const exhibits: QuestionExhibitDto[] = Array.isArray(q.questionContents)
    ? q.questionContents.map((c, cIdx) => {
        const parts = [cleanWordHtml(c.description || '')];
        if (c.instructions) parts.push(cleanWordHtml(c.instructions));
        if (c.prerequisites) parts.push(cleanWordHtml(c.prerequisites));
        return {
          id: String(c.guidId || c.id || `exh-${cIdx + 1}`),
          type: 'ClinicalScenario' as QuestionExhibitDto['type'],
          title: cleanWordHtml(c.title || `Clinical Exhibit ${cIdx + 1}`),
          content: parts.filter(Boolean).join('\n'),
          displayOrder: cIdx + 1,
        };
      })
    : [];

  const media: QuestionMediaDto[] | undefined =
    Array.isArray(q.questionMedias) && q.questionMedias.length > 0
      ? q.questionMedias
          .map((m) => ({
            id: String(m.guidId || m.id),
            numericId: m.id,
            type: m.type || 'image',
            url: normalizeMediaUrl(m.mediaPath),
            thumbnailUrl: normalizeMediaUrl(m.thumbnailPath) || undefined,
            description: m.description ? cleanWordHtml(m.description) : undefined,
            instructions: m.instructions ? cleanWordHtml(m.instructions) : undefined,
            mimeType: m.mimeType,
            width: m.width,
            height: m.height,
            duration: m.duration,
            isPrimary: Boolean(m.isPrimary),
          }))
          .filter((m) => Boolean(m.url))
      : undefined;

  const matrix = Array.isArray(q.questionMatrices) && q.questionMatrices.length > 0
    ? hydrateMatrix(q.questionMatrices[0])
    : undefined;

  const correctAnswerMeta = hydrateCorrectAnswerMeta(
    q.questionCorrectAnswers ?? [],
    options,
    matrix
  );

  const blankSelectPassage =
    baseType === 'blankselect'
      ? cleanWordHtml(String(q.metaQuestionText || q.questionText || q.description || ''))
      : undefined;

  const highlightPassage =
    baseType === 'highlight'
      ? cleanWordHtml(String(q.metaQuestionText || q.description || q.questionText || ''))
      : undefined;

  // Content integrity validation — never fabricate options when backend delivers empty choices
  let contentIntegrityError: string | undefined;
  if (CHOICE_REQUIRED_BASE_TYPES.has(baseType) && options.length === 0) {
    contentIntegrityError = `Authoritative backend returned 0 selectable answer options for question ${questionId} (${questionType}).`;
  } else if ((baseType === 'matrixsinglechoice' || baseType === 'matrixmultipleselect') && (!matrix || matrix.cells.length === 0)) {
    contentIntegrityError = `Authoritative backend returned no matrix cells for matrix question ${questionId} (${questionType}).`;
  } else if ((baseType === 'multipleimage' || baseType === 'multipleimageselection') && (!media || media.length === 0) && options.length === 0) {
    contentIntegrityError = `Authoritative backend returned no selectable media items for image question ${questionId} (${questionType}).`;
  }

  const hint =
    (q.questionCorrectAnswers ?? []).find((a) => a.hint && a.hint.trim())?.hint?.trim() ||
    undefined;

  const difficulty =
    (typeof q.difficulty === 'string' && q.difficulty.trim()) ||
    (typeof q.level === 'string' && q.level.trim()) ||
    undefined;
  const resources = q.resources && q.resources.trim() ? cleanWordHtml(q.resources) : undefined;
  const prerequisites =
    q.prerequisites && q.prerequisites.trim() ? cleanWordHtml(q.prerequisites) : undefined;
  const learningObjectives = [q.segment, q.fragment, prerequisites]
    .map((item) => (typeof item === 'string' ? cleanWordHtml(item).trim() : ''))
    .filter(Boolean);

  const storedQuestion: StoredAttemptQuestion = {
    id: questionId,
    numericId: typeof q.id === 'number' ? q.id : undefined,
    guidId: q.guidId || undefined,
    examGuidId,
    sectionId: section.id,
    sectionGuidId: section.guidId,
    sectionName: section.name,
    orderIndex: index + 1,
    stem: stem || `Question ${index + 1}`,
    metaStem,
    instructions,
    questionType,
    cognitiveSkill: 'ClinicalJudgment' as CognitiveSkill,
    clientNeedCategory: 'PhysiologicalAdaptation' as ClientNeedCategory,
    difficulty,
    resources,
    prerequisites,
    ...(learningObjectives.length > 0 ? { learningObjectives } : {}),
    options,
    exhibits,
    media,
    matrix,
    blankSelectPassage,
    highlightPassage,
    correctAnswerMeta,
    contentIntegrityError,
    generalRationale: hydrateGeneralRationale(q),
    hint,
  };

  // Restore saved learner response & flag action from backend
  const savedAnswerObj: StrataSessionUserAnswer | undefined = q.savedUserAnswer;
  const serializedSaved = fromStrataSavedUserAnswer(storedQuestion, savedAnswerObj);
  const isFlagged = Array.isArray(q.questionActions)
    ? q.questionActions.some(
        (act) =>
          /flag/i.test(String(act.actionValue ?? '')) &&
          String(act.actionContent ?? '').toLowerCase() !== 'false' &&
          String(act.actionContent ?? '').toLowerCase() !== 'unflagged'
      )
    : false;

  const savedResponse =
    serializedSaved !== undefined || isFlagged
      ? {
          responseJson: serializedSaved ?? null,
          isFlagged,
          savedAtUtc:
            savedAnswerObj?.updatedAt ||
            savedAnswerObj?.createdAt ||
            new Date().toISOString(),
        }
      : undefined;

  return { question: storedQuestion, savedResponse };
}

/**
 * Fetches all pages of a live examination from `exams/list/live`.
 */
export async function fetchLiveExamFromBackend(
  opts: LiveExamLoadOptions
): Promise<LiveExamLoadResult> {
  const requester = opts.requestFn ?? lexmaCastoRequest;
  const trimmedExamId = String(opts.examId || '').trim();
  if (!trimmedExamId) {
    return {
      ok: false,
      status: 400,
      message: 'Exam identifier is required.',
      errorCode: 'VALIDATION_ERROR',
    };
  }

  const perPage = 250;
  let page = 1;
  let maxPages = 20;
  let firstPageLoaded = false;

  let firstSession: StrataExamSessionResponse | null = null;
  const seenQuestionIds = new Set<string>();
  const collectedQuestions: StoredAttemptQuestion[] = [];
  const collectedSavedResponses: LiveExamLoadSuccess['savedResponses'] = {};
  const integrityWarnings: string[] = [];

  while (page <= maxPages) {
    const query: Record<string, string | number | boolean | undefined | null> = {
      identifier: trimmedExamId,
      dynamicPage: page,
      dynamicPerPage: perPage,
      dynamicExamLayout: opts.layoutMode ?? undefined,
      dynamicExamMode: opts.deliveryMode ?? undefined,
    };
    if (opts.attemptNumber !== undefined && opts.attemptNumber !== null && opts.attemptNumber > 0) {
      query.dynamicAttemptNumber = opts.attemptNumber;
    }

    const endpoint = buildStrataEndpointPath('examsLive', query, 'live');
    const res = await requester<{
      data?: StrataExamSessionResponse;
    } & Partial<StrataExamSessionResponse>>(endpoint, {
      method: 'GET',
      session: opts.session,
      siteMeta: opts.siteMeta,
    });

    if (!res.ok) {
      if (!firstPageLoaded) {
        return {
          ok: false,
          status: res.status || 502,
          message: res.message || 'Unable to load live examination from backend.',
          errorCode: res.errorCode || 'BACKEND_ERROR',
        };
      }
      integrityWarnings.push(
        `Pagination stopped at page ${page} due to backend status ${res.status}: ${res.message}`
      );
      break;
    }

    const sessionData = (res.data?.data ?? res.data) as StrataExamSessionResponse | undefined;
    if (!sessionData || !sessionData.exam) {
      if (!firstPageLoaded) {
        return {
          ok: false,
          status: 404,
          message: `Examination "${trimmedExamId}" was not found or returned an empty session payload.`,
          errorCode: 'NOT_FOUND',
        };
      }
      break;
    }

    if (!firstPageLoaded) {
      firstPageLoaded = true;
      firstSession = sessionData;
    }

    const sections = Array.isArray(sessionData.sections) ? sessionData.sections : [];
    const examGuidId = String(sessionData.exam.guidId || trimmedExamId);
    let newInThisPage = 0;

    for (const section of sections) {
      const sectionQuestions = Array.isArray(section.questions) ? section.questions : [];
      for (const rawQ of sectionQuestions) {
        const dedupeKey = String(rawQ.guidId || rawQ.id || '').trim();
        if (!dedupeKey) continue;
        if (seenQuestionIds.has(dedupeKey)) {
          continue;
        }
        seenQuestionIds.add(dedupeKey);
        newInThisPage++;

        // Prefer per-question savedUserAnswer, fallback to resumeAnswers[q.id] map
        const fallbackSaved =
          !rawQ.savedUserAnswer && typeof rawQ.id === 'number'
            ? sessionData.resumeAnswers?.[rawQ.id]
            : undefined;
        const enrichedRawQ = fallbackSaved
          ? { ...rawQ, savedUserAnswer: fallbackSaved }
          : rawQ;

        const { question, savedResponse } = mapStrataQuestion(
          enrichedRawQ,
          collectedQuestions.length,
          examGuidId,
          section
        );
        collectedQuestions.push(question);
        if (savedResponse) {
          collectedSavedResponses[question.id] = savedResponse;
        }
        if (question.contentIntegrityError) {
          integrityWarnings.push(question.contentIntegrityError);
        }
      }
    }

    const configuredCount = Number(sessionData.exam.questionsCount ?? 0);
    if (page === 1 && configuredCount > 0 && newInThisPage > 0) {
      maxPages = Math.min(40, Math.ceil(configuredCount / newInThisPage) + 2);
    }

    if (
      newInThisPage === 0 ||
      (configuredCount > 0 && collectedQuestions.length >= configuredCount) ||
      (configuredCount <= 0 && newInThisPage < perPage)
    ) {
      break;
    }

    page++;
  }

  if (!firstSession || !firstSession.exam) {
    return {
      ok: false,
      status: 404,
      message: `Examination "${trimmedExamId}" could not be loaded.`,
      errorCode: 'NOT_FOUND',
    };
  }

  const exam = firstSession.exam;
  const examGuidId = String(exam.guidId || trimmedExamId);
  const configuredQuestionCount = Number(exam.questionsCount ?? 0) || collectedQuestions.length;

  if (configuredQuestionCount > 0 && collectedQuestions.length < configuredQuestionCount) {
    integrityWarnings.push(
      `Backend exam configuration declares ${configuredQuestionCount} questions, but live delivery returned ${collectedQuestions.length} unique question(s) across ${page} page(s).`
    );
  }

  const latestActionWithAttempt = Array.isArray(firstSession.examActions)
    ? firstSession.examActions.find(
        (a) => typeof a.attemptCount === 'number' && a.attemptCount > 0
      )
    : undefined;
  const attemptNumber =
    opts.attemptNumber && opts.attemptNumber > 0
      ? opts.attemptNumber
      : Math.max(1, Number(latestActionWithAttempt?.attemptCount ?? 1));

  const rawDuration = Number(exam.duration ?? 0);
  const timeLimitMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  const isTimed = exam.isTimed !== false && timeLimitMinutes > 0;
  const rawPassMark = Number(exam.passMark ?? 0);
  const passingScorePercentage =
    Number.isFinite(rawPassMark) && rawPassMark > 0 && rawPassMark <= 100
      ? rawPassMark
      : null;

  const subjectName =
    typeof exam.subjectName === 'string' && exam.subjectName.trim()
      ? exam.subjectName.trim()
      : undefined;
  const topicName =
    typeof exam.topicName === 'string' && exam.topicName.trim()
      ? exam.topicName.trim()
      : undefined;
  const learningObjectives =
    typeof exam.objectives === 'string' && exam.objectives.trim()
      ? exam.objectives
          .split(/\r?\n|;/)
          .map((s) => cleanWordHtml(s).trim())
          .filter(Boolean)
      : [];

  const examRecord = exam as unknown as Record<string, unknown>;
  const titleInfo = resolveAuthoritativeExamTitleAndDifficulty(examRecord);
  const modePermissions = resolveExamModePermissions(
    exam,
    firstSession.design,
    firstSession.modes
  );

  return {
    ok: true,
    exam,
    examId: examGuidId,
    examNumericId: typeof exam.id === 'number' ? exam.id : undefined,
    examTitle: cleanWordHtml(String(titleInfo.title || exam.title || 'QuizNurse Examination')),
    pathway: inferExamPathway(examRecord),
    examCategory: inferExamCategory(examRecord),
    subjectName,
    topicName,
    learningObjectives,
    instructions: cleanWordHtml(
      String(exam.instructions || firstSession.design?.instructions || '')
    ),
    isTimed,
    timeLimitMinutes,
    passingScorePercentage,
    configuredQuestionCount,
    loadedQuestionCount: collectedQuestions.length,
    pagesFetched: page,
    attemptNumber,
    allowedLayouts: resolveAllowedLayouts(firstSession.design),
    design: firstSession.design,
    modes: Array.isArray(firstSession.modes) ? firstSession.modes : [],
    examActions: Array.isArray(firstSession.examActions) ? firstSession.examActions : [],
    modePermissions,
    questions: collectedQuestions,
    savedResponses: collectedSavedResponses,
    integrityWarnings: Array.from(new Set(integrityWarnings)),
    rawSession: firstSession,
  };
}

/**
 * Ensures an attempt is present in the hot session cache with verified learner ownership.
 * On cache miss for durable IDs (`strata~{examGuidId}~{attemptNumber}`), rehydrates live
 * questions and saved responses directly from explicitbackend.com.
 */
export async function ensureAttemptLoaded(
  learner: { userId: string; session: CastoSessionCredentials; emailVerified?: boolean; role?: string },
  attemptId: string,
  siteMeta?: LexmaCastoRequestOptions['siteMeta'],
  preferredMode?: 'Exam' | 'Tutor' | 'Review'
): Promise<
  | { ok: true; attempt: StoredAttempt }
  | { ok: false; status: number; message: string; errorCode: string }
> {
  if (learner.emailVerified === false) {
    return {
      ok: false,
      status: 403,
      message: 'Email verification is required before accessing examination attempts.',
      errorCode: 'UNVERIFIED_EMAIL',
    };
  }
  if (attemptStore.hasAttempt(attemptId)) {
    const owned = attemptStore.getAttempt(learner.userId, attemptId);
    if (!owned) {
      return {
        ok: false,
        status: 403,
        message: 'Forbidden. You do not have access to this examination attempt.',
        errorCode: 'FORBIDDEN',
      };
    }
    return { ok: true, attempt: owned };
  }

  const parsed = parseDurableAttemptId(attemptId);
  if (!parsed) {
    return {
      ok: false,
      status: 404,
      message: 'Examination attempt not found.',
      errorCode: 'NOT_FOUND',
    };
  }

  const loaded = await fetchLiveExamFromBackend({
    examId: parsed.examGuidId,
    session: learner.session,
    siteMeta,
    attemptNumber: parsed.attemptNumber,
  });

  if (!loaded.ok) {
    return {
      ok: false,
      status: loaded.status,
      message: loaded.message,
      errorCode: loaded.errorCode,
    };
  }

  const matchesParsedAttemptNumber = (rawAttemptNum: unknown): boolean => {
    const num = Number(rawAttemptNum);
    if (!Number.isFinite(num)) return parsed.attemptNumber === 1;
    // Strata backend attemptNumber may be 1-based or 0-based (where 0 represents attempt 1)
    const normalizedOneBased = num > 0 ? num : 1;
    return normalizedOneBased === parsed.attemptNumber || num + 1 === parsed.attemptNumber;
  };

  // Check if backend distinct results already record this attempt as Completed/Graded
  let completedResultRecord: Record<string, unknown> | undefined;
  try {
    const distinctPath = buildStrataEndpointPath(
      'examResultsDistinct',
      { identifier: parsed.examGuidId, dynamicPage: 1, dynamicPerPage: 10 },
      'distinct'
    );
    const res = await lexmaCastoRequest<{
      data?: { items?: Record<string, unknown>[]; results?: Record<string, unknown>[] };
      items?: Record<string, unknown>[];
    }>(distinctPath, {
      method: 'GET',
      session: learner.session,
      siteMeta,
    });
    if (res.ok) {
      const items =
        res.data?.data?.items ??
        res.data?.data?.results ??
        res.data?.items ??
        [];
      if (Array.isArray(items) && items.length > 0) {
        completedResultRecord =
          items.find((item) => matchesParsedAttemptNumber(item.attemptNumber)) ??
          (items.length === 1 ? items[0] : undefined);
      }
    }
  } catch {
    // Non-blocking fallback
  }

  if (!completedResultRecord) {
    try {
      const relPath = buildStrataEndpointPath(
        'examResults',
        { dynamicPage: 1, dynamicPerPage: 50, page: 1, perPage: 50 },
        'relative'
      );
      const relRes = await lexmaCastoRequest<{
        data?: { items?: Record<string, unknown>[]; results?: Record<string, unknown>[] };
        items?: Record<string, unknown>[];
      }>(relPath, {
        method: 'GET',
        session: learner.session,
        siteMeta,
      });
      if (relRes.ok) {
        const relItems =
          relRes.data?.data?.items ??
          relRes.data?.data?.results ??
          relRes.data?.items ??
          [];
        if (Array.isArray(relItems)) {
          const matchingExamItems = relItems.filter((item) => {
            const detail = item.examDetail as Record<string, unknown> | undefined;
            const itemGuid = String(
              item.examGuidId ?? detail?.guidId ?? item.guidId ?? ''
            ).trim();
            return itemGuid.toLowerCase() === parsed.examGuidId.toLowerCase();
          });
          completedResultRecord =
            matchingExamItems.find((item) => matchesParsedAttemptNumber(item.attemptNumber)) ??
            (matchingExamItems.length === 1 ? matchingExamItems[0] : undefined);
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  const earliestActionStart = loaded.examActions
    .map((a) => a.createdAt)
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0 && !d.startsWith('0001'))
    .sort()[0];

  const startedAtUtc =
    typeof completedResultRecord?.attemptedAt === 'string' && completedResultRecord.attemptedAt
      ? completedResultRecord.attemptedAt
      : typeof completedResultRecord?.createdAt === 'string' && completedResultRecord.createdAt
        ? completedResultRecord.createdAt
        : earliestActionStart || new Date().toISOString();

  const totalSecondsAllocated = loaded.timeLimitMinutes * 60;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAtUtc).getTime()) / 1000)
  );
  const residualFromAction = loaded.examActions.find(
    (a) => typeof a.residualDuration === 'number' && a.residualDuration > 0
  )?.residualDuration;
  const remainingSeconds = loaded.isTimed
    ? typeof residualFromAction === 'number'
      ? residualFromAction
      : Number.isFinite(elapsedSeconds)
        ? Math.max(0, totalSecondsAllocated - elapsedSeconds)
        : totalSecondsAllocated
    : totalSecondsAllocated;

  const hasCompletedAction = loaded.examActions.some((a) => {
    const rec = a as unknown as Record<string, unknown>;
    return (
      /complet|grad|submit|finish|review|actionexamsubmit/i.test(
        String(
          rec.action ??
            rec.actionType ??
            rec.actionValue ??
            rec.status ??
            rec.state ??
            ''
        )
      ) ||
      Boolean(rec.submittedAt) ||
      Boolean(rec.completedAt)
    );
  });

  const isBackendCompleted =
    (completedResultRecord != null &&
      (Boolean(completedResultRecord.reviewedAt) ||
        Boolean(completedResultRecord.submittedAt) ||
        completedResultRecord.isAttempted === true ||
        typeof completedResultRecord.score === 'number' ||
        typeof completedResultRecord.percentageScore === 'number' ||
        typeof completedResultRecord.scorePercentage === 'number' ||
        typeof completedResultRecord.passed === 'boolean' ||
        /complet|grad|submit|finish|pass|attempt|done/i.test(
          String(completedResultRecord.status ?? '')
        ))) ||
    hasCompletedAction ||
    (preferredMode === 'Review' && Object.keys(loaded.savedResponses).length > 0);

  // Resolve persisted deliveryMode from backend examActions or exam.selectedMode before falling back
  const persistedModeAction = loaded.examActions.find((a) => {
    const rec = a as unknown as Record<string, unknown>;
    const typeStr = String(rec.actionType ?? rec.action ?? '');
    const valStr = String(rec.actionValue ?? rec.actionContent ?? '');
    return /mode/i.test(typeStr) || /^(tutor|exam)$/i.test(valStr.trim());
  });
  const persistedModeToken = String(
    (persistedModeAction as unknown as Record<string, unknown> | undefined)?.actionValue ??
      (persistedModeAction as unknown as Record<string, unknown> | undefined)?.actionContent ??
      loaded.exam.selectedMode ??
      ''
  )
    .trim()
    .toLowerCase();

  const inferredDelivery = inferExamDeliveryMode(loaded.exam as unknown as Record<string, unknown>);
  const canUseTutorMode = loaded.modePermissions.canTutor || isBackendCompleted;
  const deliveryMode: 'Exam' | 'Tutor' =
    persistedModeToken === 'tutor' ||
    inferredDelivery === 'Tutor' ||
    (preferredMode === 'Tutor' && canUseTutorMode)
      ? 'Tutor'
      : 'Exam';

  // Resolve persisted layoutMode from backend examActions or exam.selectedLayout
  const persistedLayoutAction = loaded.examActions.find((a) => {
    const rec = a as unknown as Record<string, unknown>;
    const typeStr = String(rec.actionType ?? rec.action ?? '');
    const valStr = String(rec.actionValue ?? rec.actionContent ?? '');
    return /layout/i.test(typeStr) || /^(allinone|sequential)$/i.test(valStr.trim());
  });
  const persistedLayoutToken = String(
    (persistedLayoutAction as unknown as Record<string, unknown> | undefined)?.actionValue ??
      (persistedLayoutAction as unknown as Record<string, unknown> | undefined)?.actionContent ??
      loaded.exam.selectedLayout ??
      ''
  )
    .trim()
    .toLowerCase();

  let layoutMode: ExamLayout =
    persistedLayoutToken === 'allinone' ? 'AllInOne' : 'Sequential';
  if (loaded.allowedLayouts === 'AllInOneOnly') {
    layoutMode = 'AllInOne';
  } else if (loaded.allowedLayouts === 'SequentialOnly') {
    layoutMode = 'Sequential';
  }

  const storedAttempt: StoredAttempt = {
    attemptId,
    examId: loaded.examId,
    examNumericId: loaded.examNumericId,
    examTitle: loaded.examTitle,
    pathway: loaded.pathway,
    examCategory: loaded.examCategory,
    subjectName: loaded.subjectName,
    topicName: loaded.topicName,
    learningObjectives: loaded.learningObjectives,
    userId: learner.userId,
    deliveryMode,
    layoutMode,
    allowedLayouts: loaded.allowedLayouts,
    isTimed: loaded.isTimed,
    timeLimitMinutes: loaded.timeLimitMinutes,
    remainingSeconds: isBackendCompleted ? 0 : remainingSeconds,
    startedAtUtc,
    status: isBackendCompleted ? 'Graded' : 'InProgress',
    allowReview: loaded.modePermissions.reviewReleased,
    configuredQuestionCount: loaded.configuredQuestionCount,
    passingScorePercentage: loaded.passingScorePercentage,
    attemptNumber: parsed.attemptNumber,
    modePermissions: loaded.modePermissions,
    isDurableBackendSynced: true,
    integrityWarnings: loaded.integrityWarnings,
    questions: loaded.questions,
    savedResponses: loaded.savedResponses,
    tutorProgression: {},
    tutorConversations: {},
    tutorPracticeChecks: {},
  };

  if (isBackendCompleted) {
    attemptStore.reconstructCompletedAttempt(storedAttempt, completedResultRecord);
  } else {
    attemptStore.setAttempt(storedAttempt);
  }

  return { ok: true, attempt: storedAttempt };
}
