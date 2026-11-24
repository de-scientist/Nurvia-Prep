import type { ExamLayout, ExamModePermissionsDto } from '../api-types';
import { isResponseAnswered } from './strata-answer-core.mjs';

export type ExamExperienceStage = 'assessment' | 'results' | 'review' | 'tutor';

export type AttemptLifecycleStatus =
  | 'Created'
  | 'InProgress'
  | 'Submitted'
  | 'Graded'
  | 'Expired';

export type ReviewFilterKey = 'All' | 'Correct' | 'Incorrect' | 'Unanswered' | 'Flagged';

export type QuestionReviewStatus = 'correct' | 'partial' | 'incorrect' | 'unanswered';

export interface StageContext {
  lifecycleStatus: AttemptLifecycleStatus;
  deliveryMode: 'Exam' | 'Tutor' | 'Review';
  reviewReleased: boolean;
  modePermissions?: ExamModePermissionsDto;
  isReviewStudyContent?: boolean;
  hasAttemptId?: boolean;
}

export interface StageAvailability {
  canEnter: boolean;
  reason?: string;
}

export interface PersistedExamViewState {
  stage: ExamExperienceStage;
  currentQuestionId?: string;
  reviewFilter?: ReviewFilterKey;
  reviewLayout?: ExamLayout;
  tutorQuestionId?: string;
  returnQuestionId?: string;
  returnFilter?: ReviewFilterKey;
  returnLayout?: ExamLayout;
  updatedAt?: number;
}

export function resolveAttemptLifecycleStatus(rawStatus?: string | null): AttemptLifecycleStatus {
  const normalized = String(rawStatus ?? '').trim().toLowerCase();
  if (normalized === 'created') return 'Created';
  if (normalized === 'inprogress' || normalized === 'active') return 'InProgress';
  if (normalized === 'submitted') return 'Submitted';
  if (normalized === 'graded' || normalized === 'completed') return 'Graded';
  if (normalized === 'expired') return 'Expired';
  return 'InProgress';
}

export function isAttemptTerminal(status: AttemptLifecycleStatus): boolean {
  return status === 'Submitted' || status === 'Graded' || status === 'Expired';
}

export function resolveQuestionReviewStatus(input: {
  learnerResponse?: string | null;
  isCorrect?: boolean;
  isPartiallyCorrect?: boolean;
  pointsAwarded?: number;
  maxPoints?: number;
  options?: Array<{ wasSelected?: boolean; isCorrect?: boolean }>;
}): QuestionReviewStatus {
  const isAnswered =
    isResponseAnswered(input.learnerResponse) ||
    Boolean(input.options?.some((o) => o.wasSelected));

  if (!isAnswered) {
    return 'unanswered';
  }

  if (
    input.isPartiallyCorrect ||
    (typeof input.pointsAwarded === 'number' &&
      typeof input.maxPoints === 'number' &&
      input.maxPoints > 1 &&
      input.pointsAwarded > 0 &&
      input.pointsAwarded < input.maxPoints)
  ) {
    return 'partial';
  }

  if (typeof input.isCorrect === 'boolean') {
    return input.isCorrect ? 'correct' : 'incorrect';
  }

  const anyCorrectSelected = Boolean(input.options?.some((o) => o.wasSelected && o.isCorrect));
  return anyCorrectSelected ? 'correct' : 'incorrect';
}

export function getStageAvailability(
  ctx: StageContext
): Record<ExamExperienceStage, StageAvailability> {
  const terminal = isAttemptTerminal(ctx.lifecycleStatus);

  const assessment: StageAvailability = ctx.isReviewStudyContent
    ? {
        canEnter: false,
        reason: 'This session is a read-only study review of published examination items.',
      }
    : terminal
      ? {
          canEnter: false,
          reason:
            'This examination attempt has already been submitted. Completed attempts cannot return to active assessment mode.',
        }
      : { canEnter: true };

  const results: StageAvailability = ctx.isReviewStudyContent
    ? {
        canEnter: false,
        reason: 'Standalone study review sessions do not produce a graded attempt scorecard.',
      }
    : !terminal
      ? {
          canEnter: false,
          reason: 'Complete and submit your examination to view scored results.',
        }
      : { canEnter: true };

  let review: StageAvailability;
  if (ctx.isReviewStudyContent) {
    const allowed = ctx.modePermissions ? ctx.modePermissions.canReview : true;
    review = allowed
      ? { canEnter: true }
      : {
          canEnter: false,
          reason:
            ctx.modePermissions?.reviewReason ||
            'Review mode is disabled by this examination’s published policy.',
        };
  } else if (!terminal) {
    review = {
      canEnter: false,
      reason:
        'Submit your examination first to unlock read-only Review with authoritative answers and rationales.',
    };
  } else if (ctx.modePermissions?.reviewReleased === false) {
    // Block review only when the backend explicitly withholds it via
    // modePermissions.reviewReleased = false. Do not block when
    // reviewReleased is falsy for other reasons (e.g. misconfigured
    // backend flag), since the requirement is that completed attempts
    // must support Review.
    review = {
      canEnter: false,
      reason:
        ctx.modePermissions?.reviewReason ||
        'Detailed answer review is withheld by this examination’s published policy.',
    };
  } else if (!ctx.reviewReleased) {
    // Review was explicitly withheld by backend policy — respect the prohibition.
    review = {
      canEnter: false,
      reason:
        ctx.modePermissions?.reviewReason ||
        'Detailed answer review is withheld by this examination’s published policy.',
    };
  } else {
    review = { canEnter: true };
  }

  let tutor: StageAvailability;
  if (!terminal && ctx.deliveryMode === 'Exam') {
    tutor = {
      canEnter: false,
      reason:
        'Tutor assistance is locked during an active graded Exam attempt to protect examination integrity.',
    };
  } else if (!terminal && ctx.modePermissions && !ctx.modePermissions.canTutor) {
    tutor = {
      canEnter: false,
      reason:
        ctx.modePermissions.tutorReason ||
        'Tutor mode is not enabled for this active examination by backend policy.',
    };
  } else if (terminal && ctx.modePermissions?.reviewReleased === false) {
    // Block tutor only when the backend explicitly withholds it via
    // modePermissions.reviewReleased = false. Do not block when
    // reviewReleased is falsy for other reasons, since the requirement is
    // that contextual Tutor should be available for completed attempts
    // where the examination and backend policy permit it.
    tutor = {
      canEnter: false,
      reason:
        ctx.modePermissions?.reviewReason ||
        'Tutor explanations are unavailable because answer review is withheld by this examination’s policy.',
    };
  } else if (terminal && !ctx.reviewReleased) {
    // Review was explicitly withheld by backend policy — respect the prohibition.
    tutor = {
      canEnter: false,
      reason:
        ctx.modePermissions?.reviewReason ||
        'Tutor explanations are unavailable because answer review is withheld by this examination’s policy.',
    };
  } else if (ctx.isReviewStudyContent && ctx.hasAttemptId === false) {
    tutor = {
      canEnter: false,
      reason:
        'Contextual Tutor requires a persisted examination attempt. Launch Tutor mode or submit an Exam attempt to open Tutor.',
    };
  } else {
    tutor = { canEnter: true };
  }

  return { assessment, results, review, tutor };
}

/**
 * Unified permission-resolution mechanism for the examination experience.
 * Distinguishes:
 * 1. Starting / continuing an active examination attempt.
 * 2. Reviewing a submitted / completed attempt.
 * 3. Accessing contextual Tutor (in active Tutor delivery or post-submission review).
 * 4. Accessing standalone non-graded review content (/api/exams/{examId}/review-content).
 */
export function resolveExamExperiencePermissions(
  ctx: StageContext
): ExamModePermissionsDto {
  const availability = getStageAvailability(ctx);
  const terminal = isAttemptTerminal(ctx.lifecycleStatus);
  const allowLayoutSwitching = ctx.modePermissions?.allowLayoutSwitching !== false;

  if (ctx.isReviewStudyContent) {
    return {
      canExam: false,
      canReview: availability.review.canEnter,
      canTutor: availability.tutor.canEnter,
      examReason: availability.assessment.reason,
      reviewReason: availability.review.reason,
      tutorReason: availability.tutor.reason,
      allowLayoutSwitching,
      allowModeSwitching: availability.review.canEnter && availability.tutor.canEnter,
      reviewReleased: availability.review.canEnter,
    };
  }

  if (terminal) {
    return {
      canExam: false,
      canReview: availability.review.canEnter,
      canTutor: availability.tutor.canEnter,
      examReason: availability.assessment.reason,
      reviewReason: availability.review.reason,
      tutorReason: availability.tutor.reason,
      allowLayoutSwitching,
      allowModeSwitching: availability.review.canEnter || availability.tutor.canEnter,
      reviewReleased: Boolean(ctx.reviewReleased),
    };
  }

  const canExam = ctx.modePermissions ? ctx.modePermissions.canExam : true;
  const canTutor = availability.tutor.canEnter;

  return {
    canExam,
    canReview: false,
    canTutor,
    examReason: canExam ? undefined : ctx.modePermissions?.examReason,
    reviewReason: availability.review.reason,
    tutorReason: availability.tutor.reason,
    allowLayoutSwitching,
    allowModeSwitching:
      ctx.modePermissions?.allowModeSwitching !== false && canExam && canTutor,
    reviewReleased: Boolean(ctx.modePermissions?.reviewReleased ?? true),
  };
}

export function canTransitionStage(
  _current: ExamExperienceStage,
  target: ExamExperienceStage,
  ctx: StageContext
): { allowed: boolean; reason?: string } {
  const availability = getStageAvailability(ctx)[target];
  return availability.canEnter
    ? { allowed: true }
    : { allowed: false, reason: availability.reason };
}

export interface ReviewFilterableItem {
  id: string;
  learnerResponse?: string | null;
  isCorrect?: boolean;
  isPartiallyCorrect?: boolean;
  pointsAwarded?: number;
  maxPoints?: number;
  isFlagged?: boolean;
  options?: Array<{ wasSelected?: boolean; isCorrect?: boolean }>;
}

export function matchesReviewFilter(
  item: ReviewFilterableItem,
  filter: ReviewFilterKey,
  flags?: Record<string, boolean>,
  answers?: Record<string, string>
): boolean {
  if (filter === 'All') return true;
  const isFlagged = Boolean(flags?.[item.id] ?? item.isFlagged);
  if (filter === 'Flagged') return isFlagged;

  const status = resolveQuestionReviewStatus({
    learnerResponse: answers?.[item.id] ?? item.learnerResponse,
    isCorrect: item.isCorrect,
    isPartiallyCorrect: item.isPartiallyCorrect,
    pointsAwarded: item.pointsAwarded,
    maxPoints: item.maxPoints,
    options: item.options,
  });

  if (filter === 'Correct') return status === 'correct';
  if (filter === 'Incorrect') return status === 'incorrect' || status === 'partial';
  if (filter === 'Unanswered') return status === 'unanswered';
  return true;
}

export function filterReviewQuestions<T extends ReviewFilterableItem>(
  items: T[],
  filter: ReviewFilterKey,
  flags?: Record<string, boolean>,
  answers?: Record<string, string>
): T[] {
  return items.filter((item) => matchesReviewFilter(item, filter, flags, answers));
}

export function computeReviewCounts(
  items: ReviewFilterableItem[],
  flags?: Record<string, boolean>,
  answers?: Record<string, string>
): {
  total: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  flagged: number;
} {
  let correct = 0;
  let partial = 0;
  let incorrect = 0;
  let unanswered = 0;
  let flagged = 0;

  for (const item of items) {
    if (flags?.[item.id] ?? item.isFlagged) flagged += 1;
    const status = resolveQuestionReviewStatus({
      learnerResponse: answers?.[item.id] ?? item.learnerResponse,
      isCorrect: item.isCorrect,
      isPartiallyCorrect: item.isPartiallyCorrect,
      pointsAwarded: item.pointsAwarded,
      maxPoints: item.maxPoints,
      options: item.options,
    });
    if (status === 'correct') correct += 1;
    else if (status === 'partial') partial += 1;
    else if (status === 'incorrect') incorrect += 1;
    else unanswered += 1;
  }

  return {
    total: items.length,
    correct,
    partial,
    incorrect: incorrect + partial,
    unanswered,
    flagged,
  };
}

const VIEW_STORAGE_PREFIX = 'nurvia_exam_view_state_v1:';
const VALID_STAGES = new Set<ExamExperienceStage>(['assessment', 'results', 'review', 'tutor']);
const VALID_FILTERS = new Set<ReviewFilterKey>([
  'All',
  'Correct',
  'Incorrect',
  'Unanswered',
  'Flagged',
]);

export function saveExamViewState(attemptId: string, state: PersistedExamViewState): void {
  if (typeof window === 'undefined' || !attemptId) return;
  try {
    const safe: PersistedExamViewState = {
      stage: VALID_STAGES.has(state.stage) ? state.stage : 'assessment',
      ...(state.currentQuestionId ? { currentQuestionId: state.currentQuestionId } : {}),
      ...(state.reviewFilter && VALID_FILTERS.has(state.reviewFilter)
        ? { reviewFilter: state.reviewFilter }
        : {}),
      ...(state.reviewLayout === 'Sequential' || state.reviewLayout === 'AllInOne'
        ? { reviewLayout: state.reviewLayout }
        : {}),
      ...(state.tutorQuestionId ? { tutorQuestionId: state.tutorQuestionId } : {}),
      ...(state.returnQuestionId ? { returnQuestionId: state.returnQuestionId } : {}),
      ...(state.returnFilter && VALID_FILTERS.has(state.returnFilter)
        ? { returnFilter: state.returnFilter }
        : {}),
      ...(state.returnLayout === 'Sequential' || state.returnLayout === 'AllInOne'
        ? { returnLayout: state.returnLayout }
        : {}),
      updatedAt: Date.now(),
    };
    window.sessionStorage.setItem(`${VIEW_STORAGE_PREFIX}${attemptId}`, JSON.stringify(safe));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function loadExamViewState(attemptId: string): PersistedExamViewState | null {
  if (typeof window === 'undefined' || !attemptId) return null;
  try {
    const raw = window.sessionStorage.getItem(`${VIEW_STORAGE_PREFIX}${attemptId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedExamViewState> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.stage || !VALID_STAGES.has(parsed.stage)) {
      return null;
    }
    return {
      stage: parsed.stage,
      currentQuestionId:
        typeof parsed.currentQuestionId === 'string' ? parsed.currentQuestionId : undefined,
      reviewFilter:
        parsed.reviewFilter && VALID_FILTERS.has(parsed.reviewFilter)
          ? parsed.reviewFilter
          : undefined,
      reviewLayout:
        parsed.reviewLayout === 'Sequential' || parsed.reviewLayout === 'AllInOne'
          ? parsed.reviewLayout
          : undefined,
      tutorQuestionId:
        typeof parsed.tutorQuestionId === 'string' ? parsed.tutorQuestionId : undefined,
      returnQuestionId:
        typeof parsed.returnQuestionId === 'string' ? parsed.returnQuestionId : undefined,
      returnFilter:
        parsed.returnFilter && VALID_FILTERS.has(parsed.returnFilter)
          ? parsed.returnFilter
          : undefined,
      returnLayout:
        parsed.returnLayout === 'Sequential' || parsed.returnLayout === 'AllInOne'
          ? parsed.returnLayout
          : undefined,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function clearExamViewState(attemptId: string): void {
  if (typeof window === 'undefined' || !attemptId) return;
  try {
    window.sessionStorage.removeItem(`${VIEW_STORAGE_PREFIX}${attemptId}`);
  } catch {
    // Ignore
  }
}
