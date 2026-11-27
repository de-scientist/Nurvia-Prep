/**
 * NURVIA-PREP — Authoritative Examination Attempt Store & Scoring Engine
 * 
 * Manages attempt lifecycle, server-authoritative question delivery (sanitizing
 * answer keys in Exam mode to prevent client leakage), debounced response persistence,
 * deterministic scoring, idempotent submission, graded review generation, and
 * 6-stage progressive Tutor Mode hints and evaluation.
 */

import type {
  StartAttemptResultDto,
  ActiveExamQuestionDto,
  AutosaveResponseRequest,
  AutosaveResultDto,
  SubmittedExamResultDto,
  ReviewQuestionDto,
  AttemptCategoryPerformanceDto,
  ExamAttemptSummaryDto,
  ExamLayout,
  ExamLayoutPolicy,
  QuestionType,
  CognitiveSkill,
  ClientNeedCategory,
  QuestionExhibitDto,
  QuestionMediaDto,
  QuestionMatrixDto,
  QuestionCorrectAnswerMetaDto,
  ExamModePermissionsDto,
  TutorStage,
  TutorHintResponseDto,
  TutorEvaluateResponseDto,
  TutorSessionStateDto,
  TutorConversationMessageDto,
  TutorPracticeCheckResponseDto,
} from '../api-types';
import { normalizeExhibits } from '../content/case-study-normalizer-core.mjs';
import {
  evaluateCanonicalQuestion,
  isResponseAnswered,
  scoreCanonicalQuestion,
  wasCanonicalOptionSelected,
} from './strata-answer-core.mjs';

export interface StoredAttemptQuestion {
  id: string;
  numericId?: number;
  guidId?: string;
  examGuidId?: string;
  caseStudyId?: string;
  caseStudyTitle?: string;
  sectionId?: number;
  sectionGuidId?: string;
  sectionName?: string;
  orderIndex: number;
  stem: string;
  metaStem?: string;
  instructions?: string;
  questionType: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  difficulty?: string;
  learningObjectives?: string[];
  resources?: string;
  prerequisites?: string;
  options: Array<{
    id: string;
    numericId?: number;
    optionIndex: number;
    optionText: string;
    displayOrder: number;
    isCorrect: boolean;
    specificRationale?: string;
    description?: string;
    data?: string;
    label?: string;
    order?: string;
    link?: string;
  }>;
  exhibits: QuestionExhibitDto[];
  media?: QuestionMediaDto[];
  matrix?: QuestionMatrixDto;
  blankSelectPassage?: string;
  highlightPassage?: string;
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  contentIntegrityError?: string;
  generalRationale: string;
  hint?: string;
  contentJsonData?: string;
}

export interface StoredAttempt {
  attemptId: string;
  examId: string;
  examNumericId?: number;
  examTitle: string;
  pathway?: string;
  examCategory?: string;
  subjectName?: string;
  topicName?: string;
  learningObjectives?: string[];
  userId: string;
  deliveryMode: 'Exam' | 'Tutor';
  layoutMode: ExamLayout;
  allowedLayouts: ExamLayoutPolicy;
  isTimed?: boolean;
  timeLimitMinutes: number;
  remainingSeconds: number;
  startedAtUtc: string;
  submittedAtUtc?: string;
  status: 'Created' | 'InProgress' | 'Submitted' | 'Graded' | 'Expired';
  allowReview?: boolean;
  configuredQuestionCount?: number;
  passingScorePercentage?: number | null;
  attemptNumber?: number;
  modePermissions?: ExamModePermissionsDto;
  isDurableBackendSynced?: boolean;
  integrityWarnings?: string[];
  questions: StoredAttemptQuestion[];
  savedResponses: Record<
    string,
    {
      responseJson: string | null;
      isFlagged: boolean;
      savedAtUtc: string;
    }
  >;
  result?: SubmittedExamResultDto;
  tutorProgression: Record<
    string,
    {
      stage: number;
      hintsRequested: TutorStage[];
      hints?: TutorHintResponseDto[];
      evaluated?: TutorEvaluateResponseDto;
      responseJson?: string;
    }
  >;
  tutorConversations?: Record<string, TutorConversationMessageDto[]>;
  tutorPracticeChecks?: Record<string, TutorPracticeCheckResponseDto[]>;
}

export interface PersistedTutorAttemptState {
  tutorProgression: StoredAttempt['tutorProgression'];
  tutorConversations: Record<string, TutorConversationMessageDto[]>;
  tutorPracticeChecks: Record<string, TutorPracticeCheckResponseDto[]>;
}

const globalAttemptCache = globalThis as typeof globalThis & {
  __nurviaAttemptCache?: Map<string, StoredAttempt>;
  __nurviaTutorSessionCache?: Map<string, PersistedTutorAttemptState>;
};

function getHotAttemptCache(): Map<string, StoredAttempt> {
  if (!globalAttemptCache.__nurviaAttemptCache) {
    globalAttemptCache.__nurviaAttemptCache = new Map<string, StoredAttempt>();
  }
  return globalAttemptCache.__nurviaAttemptCache;
}

function getDurableTutorCache(): Map<string, PersistedTutorAttemptState> {
  if (!globalAttemptCache.__nurviaTutorSessionCache) {
    globalAttemptCache.__nurviaTutorSessionCache = new Map<string, PersistedTutorAttemptState>();
  }
  return globalAttemptCache.__nurviaTutorSessionCache;
}

class AttemptStore {
  /**
   * Short-lived global hot session cache shared across Next.js route bundles.
   * Authoritative durable persistence resides on explicitbackend.com (Strata upserts & results).
   */
  private get attempts(): Map<string, StoredAttempt> {
    return getHotAttemptCache();
  }

  private get tutorCache(): Map<string, PersistedTutorAttemptState> {
    return getDurableTutorCache();
  }

  private tutorCacheKey(userId: string, attemptId: string): string {
    return `${userId}::${attemptId}`;
  }

  syncTutorState(attempt: StoredAttempt): void {
    if (!attempt.userId || !attempt.attemptId) return;
    this.tutorCache.set(this.tutorCacheKey(attempt.userId, attempt.attemptId), {
      tutorProgression: attempt.tutorProgression ?? {},
      tutorConversations: attempt.tutorConversations ?? {},
      tutorPracticeChecks: attempt.tutorPracticeChecks ?? {},
    });
  }

  restoreTutorState(attempt: StoredAttempt): void {
    if (!attempt.userId || !attempt.attemptId) return;
    const saved = this.tutorCache.get(this.tutorCacheKey(attempt.userId, attempt.attemptId));
    if (!saved) return;
    if (!attempt.tutorProgression || Object.keys(attempt.tutorProgression).length === 0) {
      attempt.tutorProgression = saved.tutorProgression;
    }
    if (!attempt.tutorConversations || Object.keys(attempt.tutorConversations).length === 0) {
      attempt.tutorConversations = saved.tutorConversations;
    }
    if (!attempt.tutorPracticeChecks || Object.keys(attempt.tutorPracticeChecks).length === 0) {
      attempt.tutorPracticeChecks = saved.tutorPracticeChecks;
    }
  }

  /**
   * Generates a stable canonical attempt ID.
   */
  createAttemptId(examId: string): string {
    return `att-${examId}-${Date.now()}`;
  }

  /**
   * Registers or restores an attempt in the store.
   */
  setAttempt(attempt: StoredAttempt): void {
    this.restoreTutorState(attempt);
    this.attempts.set(attempt.attemptId, attempt);
    this.syncTutorState(attempt);
  }

  /**
   * Retrieves an attempt with strict learner ownership verification.
   */
  getAttempt(userId: string, attemptId: string): StoredAttempt | null {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) return null;
    // Ownership check: users can only access their own attempts
    if (attempt.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return null;
    }
    return attempt;
  }

  /**
   * Checks if an attempt exists (regardless of ownership, for 403 vs 404 distinction).
   */
  hasAttempt(attemptId: string): boolean {
    return this.attempts.has(attemptId);
  }

  /**
   * Gets raw attempt without ownership check (used only internally by BFF route handlers
   * after checking ownership to return 403 vs 404).
   */
  getRawAttempt(attemptId: string): StoredAttempt | undefined {
    return this.attempts.get(attemptId);
  }

  /**
   * Sanitizes questions for active Exam mode: strips answer keys and rationales
   * so learners cannot inspect client state to discover answers.
   */
  sanitizeForActiveSession(attempt: StoredAttempt): StartAttemptResultDto {
    const isTutor = attempt.deliveryMode === 'Tutor';

    const sanitizedQuestions: ActiveExamQuestionDto[] = attempt.questions.map((q) => {
      const sanitizedMatrix = q.matrix
        ? {
            ...q.matrix,
            cells: q.matrix.cells.map((cell) => ({
              id: cell.id,
              numericId: cell.numericId,
              rowIndex: cell.rowIndex,
              columnIndex: cell.columnIndex,
              cellValue: cell.cellValue,
              isLocked: cell.isLocked,
              // Answer keys and cell explanations are strictly withheld in Exam mode
              ...(isTutor
                ? { isCorrect: cell.isCorrect, explanation: cell.explanation }
                : {}),
            })),
          }
        : undefined;

      return {
        id: q.id,
        numericId: q.numericId,
        guidId: q.guidId,
        examGuidId: q.examGuidId ?? attempt.examId,
        caseStudyId: q.caseStudyId,
        caseStudyTitle: q.caseStudyTitle,
        sectionId: q.sectionId,
        sectionGuidId: q.sectionGuidId,
        sectionName: q.sectionName,
        orderIndex: q.orderIndex,
        stem: q.stem,
        metaStem: q.metaStem,
        instructions: q.instructions,
        questionType: q.questionType,
        cognitiveSkill: q.cognitiveSkill,
        clientNeedCategory: q.clientNeedCategory,
        difficulty: q.difficulty,
        learningObjectives: q.learningObjectives,
        resources: q.resources,
        prerequisites: q.prerequisites,
        contentJsonData: q.contentJsonData,
        // Rationales and answer metadata are strictly withheld in active Exam mode
        generalRationale: isTutor ? q.generalRationale : undefined,
        correctAnswerMeta: isTutor ? q.correctAnswerMeta : undefined,
        options: q.options.map((o) => ({
          id: o.id,
          numericId: o.numericId,
          optionIndex: o.optionIndex,
          optionText: o.optionText,
          displayOrder: o.displayOrder,
          description: o.description,
          data: o.data,
          label: o.label,
          order: o.order,
          link: o.link,
          // isCorrect and specificRationale are strictly withheld in Exam mode
          isCorrect: isTutor ? o.isCorrect : undefined,
          specificRationale: isTutor ? o.specificRationale : undefined,
        })),
        exhibits: normalizeExhibits(q.exhibits) as QuestionExhibitDto[],
        media: q.media,
        matrix: sanitizedMatrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        contentIntegrityError: q.contentIntegrityError,
      };
    });

    const mappedSavedResponses: Record<string, import('../api-types').LearnerAnswerStateDto> = {};
    for (const [qid, state] of Object.entries(attempt.savedResponses)) {
      mappedSavedResponses[qid] = {
        responseJson: state.responseJson ?? undefined,
        isAnswered: isResponseAnswered(state.responseJson),
        isFlagged: state.isFlagged,
        savedAtUtc: state.savedAtUtc,
        tutorStageReached: attempt.tutorProgression[qid]?.stage ?? 0,
      };
    }

    return {
      attemptId: attempt.attemptId,
      examId: attempt.examId,
      examNumericId: attempt.examNumericId,
      examTitle: attempt.examTitle,
      pathway: attempt.pathway,
      examCategory: attempt.examCategory,
      isTimed: attempt.isTimed,
      passingScorePercentage: attempt.passingScorePercentage ?? null,
      subjectName: attempt.subjectName,
      topicName: attempt.topicName,
      learningObjectives: attempt.learningObjectives,
      timeLimitMinutes: attempt.timeLimitMinutes,
      remainingSeconds: attempt.remainingSeconds,
      startedAtUtc: attempt.startedAtUtc,
      deadlineUtc: new Date(
        new Date(attempt.startedAtUtc).getTime() + (attempt.timeLimitMinutes || 90) * 60 * 1000
      ).toISOString(),
      totalQuestions: sanitizedQuestions.length,
      configuredQuestionCount: attempt.configuredQuestionCount ?? sanitizedQuestions.length,
      loadedQuestionCount: sanitizedQuestions.length,
      deliveryMode: attempt.deliveryMode,
      layoutMode: attempt.layoutMode,
      allowedLayouts: attempt.allowedLayouts,
      modePermissions: attempt.modePermissions,
      attemptNumber: attempt.attemptNumber,
      isDurableBackendSynced: attempt.isDurableBackendSynced,
      integrityWarnings: attempt.integrityWarnings,
      questions: sanitizedQuestions,
      savedResponses: mappedSavedResponses,
    };
  }

  /**
   * Persists an autosaved response for a specific question.
   */
  autosaveResponse(
    userId: string,
    attemptId: string,
    payload: AutosaveResponseRequest
  ): { success: boolean; data?: AutosaveResultDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) {
      return { success: false, error: 'Attempt not found.', status: 404 };
    }
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden. You do not own this attempt.', status: 403 };
    }
    if (raw.status === 'Submitted' || raw.status === 'Graded' || raw.status === 'Expired') {
      return { success: false, error: 'Exam attempt has already been submitted.', status: 409 };
    }

    const savedAtUtc = new Date().toISOString();
    raw.savedResponses[payload.questionId] = {
      responseJson: payload.responseJson ?? null,
      isFlagged: Boolean(payload.isFlagged),
      savedAtUtc,
    };

    if (payload.layoutMode && raw.allowedLayouts === 'Both') {
      raw.layoutMode = payload.layoutMode;
    } else if (raw.allowedLayouts === 'AllInOneOnly') {
      raw.layoutMode = 'AllInOne';
    } else if (raw.allowedLayouts === 'SequentialOnly') {
      raw.layoutMode = 'Sequential';
    }

    return {
      success: true,
      status: 200,
      data: {
        questionId: payload.questionId,
        isAnswered: isResponseAnswered(payload.responseJson),
        isFlagged: Boolean(payload.isFlagged),
        savedAtUtc,
      },
    };
  }

  /**
   * Computes a deterministic SubmittedExamResultDto for an attempt without
   * mutating submission state unless explicitly requested by the caller.
   */
  private computeGradedResultForAttempt(
    raw: StoredAttempt,
    submittedAtUtc: string
  ): SubmittedExamResultDto {
    let correctQuestions = 0;
    let partiallyCorrectQuestions = 0;
    let incorrectQuestions = 0;
    let unansweredQuestions = 0;
    let totalAnswered = 0;
    let rawScoreEarned = 0;
    let rawScoreMax = 0;
    const flaggedQuestionIds: string[] = [];

    const sectionBuckets = new Map<
      string,
      {
        total: number;
        answered: number;
        correct: number;
        partiallyCorrect: number;
        incorrect: number;
        unanswered: number;
        pointsAwarded: number;
        maxPoints: number;
        questionIds: string[];
      }
    >();

    const reviewQuestions: ReviewQuestionDto[] = raw.questions.map((q) => {
      const saved = raw.savedResponses[q.id];
      const learnerResponse = saved?.responseJson ?? undefined;
      const isFlagged = Boolean(saved?.isFlagged);
      if (isFlagged) flaggedQuestionIds.push(q.id);

      const scored = scoreCanonicalQuestion(q, learnerResponse);
      rawScoreEarned += scored.pointsAwarded;
      rawScoreMax += scored.maxPoints;

      if (scored.isAnswered) {
        totalAnswered += 1;
        if (scored.isCorrect) {
          correctQuestions += 1;
        } else if (scored.isPartiallyCorrect) {
          partiallyCorrectQuestions += 1;
        } else {
          incorrectQuestions += 1;
        }
      } else {
        unansweredQuestions += 1;
      }

      const sectionKey =
        (q.sectionName && q.sectionName.trim()) ||
        (raw.subjectName && raw.subjectName.trim()) ||
        'Examination Items';
      const bucket = sectionBuckets.get(sectionKey) ?? {
        total: 0,
        answered: 0,
        correct: 0,
        partiallyCorrect: 0,
        incorrect: 0,
        unanswered: 0,
        pointsAwarded: 0,
        maxPoints: 0,
        questionIds: [],
      };
      bucket.total += 1;
      bucket.pointsAwarded += scored.pointsAwarded;
      bucket.maxPoints += scored.maxPoints;
      bucket.questionIds.push(q.id);
      if (scored.isAnswered) {
        bucket.answered += 1;
        if (scored.isCorrect) bucket.correct += 1;
        else if (scored.isPartiallyCorrect) bucket.partiallyCorrect += 1;
        else bucket.incorrect += 1;
      } else {
        bucket.unanswered += 1;
      }
      sectionBuckets.set(sectionKey, bucket);

      // Map options with wasSelected flags
      const mappedOptions = q.options.map((opt) => {
        const wasSelected = wasCanonicalOptionSelected(opt.id, learnerResponse);
        return {
          id: opt.id,
          numericId: opt.numericId,
          optionIndex: opt.optionIndex,
          optionText: opt.optionText,
          description: opt.description,
          data: opt.data,
          label: opt.label,
          order: opt.order,
          link: opt.link,
          isCorrect: opt.isCorrect,
          specificRationale: opt.specificRationale,
          wasSelected,
        };
      });

      return {
        questionId: q.id,
        numericId: q.numericId,
        guidId: q.guidId,
        caseStudyId: q.caseStudyId,
        caseStudyTitle: q.caseStudyTitle,
        sectionId: q.sectionId,
        sectionGuidId: q.sectionGuidId,
        sectionName: q.sectionName,
        orderIndex: q.orderIndex,
        stem: q.stem,
        metaStem: q.metaStem,
        instructions: q.instructions,
        questionType: q.questionType,
        cognitiveSkill: q.cognitiveSkill,
        clientNeedCategory: q.clientNeedCategory,
        difficulty: q.difficulty,
        learningObjectives: q.learningObjectives,
        resources: q.resources,
        prerequisites: q.prerequisites,
        generalRationale: q.generalRationale,
        learnerResponse,
        isCorrect: scored.isCorrect,
        isPartiallyCorrect: scored.isPartiallyCorrect,
        isUnanswered: !scored.isAnswered,
        isFlagged,
        allowPartialCredit: scored.allowPartialCredit,
        scoringRule: scored.scoringRule,
        pointsAwarded: scored.pointsAwarded,
        maxPoints: scored.maxPoints,
        options: mappedOptions,
        exhibits: normalizeExhibits(q.exhibits) as QuestionExhibitDto[],
        media: q.media,
        matrix: q.matrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        correctAnswerMeta: q.correctAnswerMeta,
        contentIntegrityError: q.contentIntegrityError,
      };
    });

    const totalQuestions = raw.questions.length;
    const scorePercentage =
      rawScoreMax > 0 ? Math.round((rawScoreEarned / rawScoreMax) * 100) : 0;
    const validThreshold =
      typeof raw.passingScorePercentage === 'number' &&
      Number.isFinite(raw.passingScorePercentage) &&
      raw.passingScorePercentage > 0 &&
      raw.passingScorePercentage <= 100
        ? raw.passingScorePercentage
        : null;
    const passed = validThreshold !== null ? scorePercentage >= validThreshold : null;
    const timeSpentSeconds = Math.max(
      1,
      Math.floor((new Date(submittedAtUtc).getTime() - new Date(raw.startedAtUtc).getTime()) / 1000)
    );
    const reviewReleased = raw.allowReview !== false;

    const sectionBreakdown: AttemptCategoryPerformanceDto[] = Array.from(sectionBuckets.entries()).map(
      ([name, b]) => ({
        name,
        total: b.total,
        answered: b.answered,
        correct: b.correct,
        partiallyCorrect: b.partiallyCorrect,
        incorrect: b.incorrect,
        unanswered: b.unanswered,
        pointsAwarded: b.pointsAwarded,
        maxPoints: b.maxPoints,
        accuracyPercentage: b.maxPoints > 0 ? Math.round((b.pointsAwarded / b.maxPoints) * 100) : 0,
        questionIds: reviewReleased ? b.questionIds : [],
      })
    );

    return {
      attemptId: raw.attemptId,
      examId: raw.examId,
      examTitle: raw.examTitle,
      pathway: raw.pathway,
      examCategory: raw.examCategory,
      subjectName: raw.subjectName,
      topicName: raw.topicName,
      learningObjectives: raw.learningObjectives,
      status: 'Graded',
      scorePercentage,
      passingScorePercentage: validThreshold,
      passed,
      totalQuestions,
      totalAnswered,
      correctQuestions,
      partiallyCorrectQuestions,
      incorrectQuestions,
      unansweredQuestions,
      totalWrong: incorrectQuestions + unansweredQuestions,
      rawScoreEarned,
      rawScoreMax,
      timeSpentSeconds,
      timeLimitMinutes: raw.timeLimitMinutes,
      isTimed: raw.isTimed,
      startedAtUtc: raw.startedAtUtc,
      submittedAtUtc,
      reviewReleased,
      modePermissions: raw.modePermissions,
      sectionBreakdown,
      flaggedQuestionIds: reviewReleased ? flaggedQuestionIds : [],
      reviewQuestions: reviewReleased ? reviewQuestions : [],
    };
  }

  /**
   * Reconstructs an already-completed backend attempt directly in Graded state
   * without treating it as a new live submission or re-submitting it.
   */
  reconstructCompletedAttempt(
    attempt: StoredAttempt,
    completedResultRecord?: Record<string, unknown>
  ): SubmittedExamResultDto {
    const pickTimestamp = (val: unknown): string | undefined => {
      if (typeof val === 'string' && val.trim() && !val.trim().startsWith('0001')) {
        return val.trim();
      }
      return undefined;
    };

    const historicalSubmittedAt =
      pickTimestamp(completedResultRecord?.reviewedAt) ||
      pickTimestamp(completedResultRecord?.submittedAt) ||
      pickTimestamp(completedResultRecord?.updatedAt) ||
      pickTimestamp(completedResultRecord?.attemptedAt) ||
      attempt.submittedAtUtc ||
      attempt.startedAtUtc ||
      new Date().toISOString();

    const graded = this.computeGradedResultForAttempt(attempt, historicalSubmittedAt);

    if (completedResultRecord) {
      if (typeof completedResultRecord.percentageScore === 'number') {
        graded.scorePercentage = Math.round(completedResultRecord.percentageScore);
      } else if (typeof completedResultRecord.scorePercentage === 'number') {
        graded.scorePercentage = Math.round(completedResultRecord.scorePercentage);
      }
      if (
        typeof completedResultRecord.passMark === 'number' &&
        completedResultRecord.passMark > 0 &&
        completedResultRecord.passMark <= 100
      ) {
        graded.passingScorePercentage = completedResultRecord.passMark;
      }
      if (typeof completedResultRecord.passed === 'boolean') {
        graded.passed = completedResultRecord.passed;
      } else if (graded.passingScorePercentage !== null) {
        graded.passed = graded.scorePercentage >= graded.passingScorePercentage;
      }
      if (typeof completedResultRecord.totalCorrect === 'number') {
        graded.correctQuestions = completedResultRecord.totalCorrect;
      }
      if (typeof completedResultRecord.totalWrong === 'number') {
        graded.totalWrong = completedResultRecord.totalWrong;
      }
      if (typeof completedResultRecord.totalAnswered === 'number') {
        graded.totalAnswered = completedResultRecord.totalAnswered;
      }
      if (
        typeof completedResultRecord.timeTaken === 'number' &&
        completedResultRecord.timeTaken > 0
      ) {
        graded.timeSpentSeconds = completedResultRecord.timeTaken;
      }
      if (typeof completedResultRecord.grade === 'string' && completedResultRecord.grade) {
        graded.grade = completedResultRecord.grade;
      }
    }

    attempt.status = 'Graded';
    attempt.submittedAtUtc = historicalSubmittedAt;
    attempt.result = graded;
    this.setAttempt(attempt);
    return graded;
  }

  /**
   * Deterministically scores an attempt, marks it graded, and constructs the
   * canonical SubmittedExamResultDto with complete question rationales.
   */
  submitAttempt(
    userId: string,
    attemptId: string
  ): { success: boolean; data?: SubmittedExamResultDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) {
      return { success: false, error: 'Attempt not found.', status: 404 };
    }
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden. You do not own this attempt.', status: 403 };
    }

    // Idempotent: if already graded or submitted, return the cached authoritative result
    if ((raw.status === 'Graded' || raw.status === 'Submitted') && raw.result) {
      return { success: true, status: 200, data: raw.result };
    }

    const submittedAtUtc = raw.submittedAtUtc || new Date().toISOString();
    const result = this.computeGradedResultForAttempt(raw, submittedAtUtc);

    raw.status = 'Graded';
    raw.submittedAtUtc = submittedAtUtc;
    raw.result = result;

    return {
      success: true,
      status: 200,
      data: result,
    };
  }

  /**
   * Retrieves the graded review for a submitted attempt.
   * Never auto-submits an active InProgress attempt.
   */
  getAttemptReview(
    userId: string,
    attemptId: string
  ): { success: boolean; data?: SubmittedExamResultDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) {
      return { success: false, error: 'Attempt not found.', status: 404 };
    }
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden. You do not own this attempt.', status: 403 };
    }

    if (raw.status !== 'Submitted' && raw.status !== 'Graded' && !raw.result) {
      return {
        success: false,
        error: 'Attempt has not been submitted yet. Submit the examination before requesting graded review.',
        status: 409,
      };
    }

    const result = raw.result ?? this.reconstructCompletedAttempt(raw);

    // Guarantee answer keys and rationales remain stripped if review is disabled by policy
    if (raw.allowReview === false) {
      return {
        success: true,
        status: 200,
        data: {
          ...result,
          reviewReleased: false,
          reviewQuestions: [],
        },
      };
    }

    return { success: true, status: 200, data: result };
  }

  /**
   * Progressive Tutor Mode: returns structured hints based on question content.
   */
  getTutorHint(
    userId: string,
    attemptId: string,
    questionId: string,
    stage: TutorStage
  ): { success: boolean; data?: TutorHintResponseDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) return { success: false, error: 'Attempt not found.', status: 404 };
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden.', status: 403 };
    }

    const q = raw.questions.find(
      (item) =>
        item.id === questionId ||
        item.guidId === questionId ||
        String(item.numericId) === questionId
    );
    if (!q) return { success: false, error: 'Question not found.', status: 404 };

    if (raw.modePermissions?.canTutor && raw.deliveryMode !== 'Tutor') {
      raw.deliveryMode = 'Tutor';
    }

    let title = 'Clinical Hint';
    let content = 'Consider core physiological principles and patient safety priorities.';

    if (stage === 'FirstHint') {
      title = 'Clinical Decision Clue (Stage 2)';
      const sectionHint = q.sectionName ? ` within ${q.sectionName}` : '';
      content =
        q.hint ||
        (q.options.find((o) => o.isCorrect)?.specificRationale
          ? `Focus on the core safety cue${sectionHint}: ${q.options.find((o) => o.isCorrect)?.specificRationale?.slice(0, 140)}`
          : `Focus on the primary clinical priority asked in the stem${sectionHint} and eliminate choices that delay urgent assessment or safe care.`);
    } else if (stage === 'GuidedReasoning') {
      title = 'Guided Clinical Reasoning (Stage 3)';
      const firstDistractor = q.options.find((o) => !o.isCorrect && o.specificRationale);
      content = firstDistractor?.specificRationale
        ? `Compare each choice against the clinical cues in the stem. Watch for distractors like "${firstDistractor.optionText}": ${firstDistractor.specificRationale}`
        : `Evaluate each option against the cues in the question stem. Determine which option directly addresses the priority finding rather than a secondary detail.`;
    } else if (stage === 'ExplainConcept') {
      title = 'Core Nursing Concept';
      content =
        q.generalRationale ||
        'Review the underlying physiological principle and patient safety priority referenced in this question.';
    }

    const hintDto: TutorHintResponseDto = {
      questionId,
      stage,
      title,
      content,
      eliminatedOptionIds: [],
      isAiGenerated: false,
    };

    if (!raw.tutorProgression[questionId]) {
      raw.tutorProgression[questionId] = { stage: 2, hintsRequested: [], hints: [] };
    }
    if (!raw.tutorProgression[questionId].hintsRequested.includes(stage)) {
      raw.tutorProgression[questionId].hintsRequested.push(stage);
    }
    const existingHints = raw.tutorProgression[questionId].hints ?? [];
    raw.tutorProgression[questionId].hints = [
      ...existingHints.filter((h) => h.stage !== stage),
      hintDto,
    ];
    this.syncTutorState(raw);

    return {
      success: true,
      status: 200,
      data: hintDto,
    };
  }

  /**
   * Progressive Tutor Mode: evaluates an answer, reveals correctness, specific rationale,
   * and clinical takeaway.
   */
  evaluateTutorAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    responseJson: string
  ): { success: boolean; data?: TutorEvaluateResponseDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) return { success: false, error: 'Attempt not found.', status: 404 };
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden.', status: 403 };
    }

    const q = raw.questions.find(
      (item) =>
        item.id === questionId ||
        item.guidId === questionId ||
        String(item.numericId) === questionId
    );
    if (!q) return { success: false, error: 'Question not found.', status: 404 };

    if (raw.modePermissions?.canTutor && raw.deliveryMode !== 'Tutor') {
      raw.deliveryMode = 'Tutor';
    }

    const scored = scoreCanonicalQuestion(q, responseJson);
    const isCorrect = scored.isCorrect;
    const correctOpt = q.options.find((o) => o.isCorrect);

    const explanation = isCorrect
      ? (correctOpt?.specificRationale || q.generalRationale || 'Correct! Your reasoning matches the authoritative rationale for this item.')
      : (correctOpt?.specificRationale
          ? `Incorrect. The authoritative answer is supported by: ${correctOpt.specificRationale}`
          : q.generalRationale || 'Compare your selected answer against the official rationale and option breakdown below.');

    const clinicalConcept =
      (q.sectionName && q.sectionName.trim()) ||
      (raw.subjectName && raw.subjectName.trim()) ||
      String(q.cognitiveSkill || 'Clinical Judgment');
    const nursingPrinciple =
      (q.learningObjectives && q.learningObjectives[0]) ||
      String(q.clientNeedCategory || 'Evidence-Based Clinical Reasoning');
    const takeaway = q.generalRationale
      ? `Key takeaway (${clinicalConcept}): ${q.generalRationale.slice(0, 220)}${q.generalRationale.length > 220 ? '...' : ''}`
      : `Key takeaway (${clinicalConcept}): Review why the correct response best addresses the priority cues in this item.`;

    const result: TutorEvaluateResponseDto = {
      questionId,
      isCorrect,
      pointsAwarded: scored.pointsAwarded,
      maxPoints: scored.maxPoints,
      generalRationale: q.generalRationale || explanation,
      optionRationales: q.options.map((o) => ({
        optionId: o.id,
        optionIndex: String(o.optionIndex),
        optionText: o.optionText,
        isCorrect: o.isCorrect,
        specificRationale: o.specificRationale,
      })),
      clinicalConcept,
      nursingPrinciple,
      takeaway,
      isAiGenerated: false,
    };

    if (!raw.tutorProgression[questionId]) {
      raw.tutorProgression[questionId] = { stage: 4, hintsRequested: [], hints: [], responseJson: undefined };
    }
    raw.tutorProgression[questionId].stage = 4;
    raw.tutorProgression[questionId].evaluated = result;
    raw.tutorProgression[questionId].responseJson = responseJson;
    this.syncTutorState(raw);

    // Tutor answers are persisted exclusively in tutorProgression; they must never
    // be written to savedResponses (which is the examination response contract).
    // The evaluation result and submitted response are already captured in
    // raw.tutorProgression[questionId].

    return {
      success: true,
      status: 200,
      data: result,
    };
  }

  /**
   * Progressive Tutor Mode: returns full session state with already-evaluated answers.
   */
  getTutorSession(
    userId: string,
    attemptId: string
  ): { success: boolean; data?: TutorSessionStateDto; error?: string; status: number } {
    const raw = this.attempts.get(attemptId);
    if (!raw) return { success: false, error: 'Attempt not found.', status: 404 };
    if (raw.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
      return { success: false, error: 'Forbidden.', status: 403 };
    }

    this.restoreTutorState(raw);
    const questions = raw.questions.map((q) => {
      const prog = raw.tutorProgression[q.id];
      return {
        questionId: q.id,
        stageReached: prog?.stage || 1,
        evaluation: prog?.evaluated ?? null,
        responseJson: prog?.responseJson ?? null,
        hints: prog?.hints ?? [],
      };
    });

    return {
      success: true,
      status: 200,
      data: {
        attemptId,
        deliveryMode: raw.deliveryMode,
        questions,
      },
    };
  }

  /**
   * Retrieves summary history for a learner.
   */
  getHistory(userId: string): ExamAttemptSummaryDto[] {
    const list: ExamAttemptSummaryDto[] = [];
    for (const a of this.attempts.values()) {
      if (a.userId === userId) {
        const isCompleted = a.status === 'Submitted' || a.status === 'Graded';
        const reviewReleased = a.allowReview !== false;
        list.push({
          attemptId: a.attemptId,
          examId: a.examId,
          examTitle: a.examTitle,
          examCategory: a.examCategory,
          pathway: a.pathway,
          status: a.status,
          startedAtUtc: a.startedAtUtc,
          submittedAtUtc: a.submittedAtUtc,
          scorePercentage: a.result?.scorePercentage,
          passingScorePercentage: a.result?.passingScorePercentage ?? a.passingScorePercentage ?? null,
          passed: a.result?.passed ?? null,
          totalQuestions: a.questions?.length ?? 0,
          totalCorrect: a.result?.correctQuestions,
          totalWrong: a.result?.totalWrong,
          totalAnswered: a.result?.totalAnswered,
          timeSpentSeconds: a.result?.timeSpentSeconds,
          attemptNumber: a.attemptNumber,
          allowReview: a.allowReview,
          canReview: isCompleted ? reviewReleased : (a.modePermissions?.canReview ?? reviewReleased),
          canTutor: isCompleted ? reviewReleased : (a.modePermissions?.canTutor ?? false),
          subjectName: a.subjectName,
          topicName: a.topicName,
        });
      }
    }
    return list.sort((x, y) => {
      const timeY = y.startedAtUtc ? new Date(y.startedAtUtc).getTime() : 0;
      const timeX = x.startedAtUtc ? new Date(x.startedAtUtc).getTime() : 0;
      return (Number.isFinite(timeY) ? timeY : 0) - (Number.isFinite(timeX) ? timeX : 0);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL EVALUATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private evaluateQuestionCorrectness(q: StoredAttemptQuestion, responseJson?: string): boolean {
    return evaluateCanonicalQuestion(q, responseJson);
  }

  private wasOptionSelected(optionId: string, responseJson?: string): boolean {
    return wasCanonicalOptionSelected(optionId, responseJson);
  }
}

// Global singleton instance
export const attemptStore = new AttemptStore();
