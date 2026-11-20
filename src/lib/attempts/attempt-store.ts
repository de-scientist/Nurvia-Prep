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
} from '../api-types';
import {
  evaluateCanonicalQuestion,
  wasCanonicalOptionSelected,
} from './strata-answer-core.mjs';

export interface StoredAttemptQuestion {
  id: string;
  numericId?: number;
  guidId?: string;
  examGuidId?: string;
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
  userId: string;
  deliveryMode: 'Exam' | 'Tutor';
  layoutMode: ExamLayout;
  allowedLayouts: ExamLayoutPolicy;
  timeLimitMinutes: number;
  remainingSeconds: number;
  startedAtUtc: string;
  submittedAtUtc?: string;
  status: 'InProgress' | 'Submitted' | 'Graded';
  allowReview?: boolean;
  configuredQuestionCount?: number;
  passingScorePercentage?: number;
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
      evaluated?: TutorEvaluateResponseDto;
      responseJson?: string;
    }
  >;
}

const globalAttemptCache = globalThis as typeof globalThis & {
  __nurviaAttemptCache?: Map<string, StoredAttempt>;
};

function getHotAttemptCache(): Map<string, StoredAttempt> {
  if (!globalAttemptCache.__nurviaAttemptCache) {
    globalAttemptCache.__nurviaAttemptCache = new Map<string, StoredAttempt>();
  }
  return globalAttemptCache.__nurviaAttemptCache;
}

class AttemptStore {
  /**
   * Short-lived global hot session cache shared across Next.js route bundles.
   * Authoritative durable persistence resides on explicitbackend.com (Strata upserts & results).
   */
  private get attempts(): Map<string, StoredAttempt> {
    return getHotAttemptCache();
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
    this.attempts.set(attempt.attemptId, attempt);
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
        exhibits: q.exhibits,
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
        isAnswered: Boolean(
          state.responseJson &&
            state.responseJson !== 'null' &&
            state.responseJson !== '""'
        ),
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
    if (raw.status === 'Submitted' || raw.status === 'Graded') {
      return { success: false, error: 'Exam attempt has already been submitted.', status: 409 };
    }

    const savedAtUtc = new Date().toISOString();
    raw.savedResponses[payload.questionId] = {
      responseJson: payload.responseJson ?? null,
      isFlagged: Boolean(payload.isFlagged),
      savedAtUtc,
    };

    if (payload.layoutMode) {
      raw.layoutMode = payload.layoutMode;
    }

    return {
      success: true,
      status: 200,
      data: {
        questionId: payload.questionId,
        isAnswered: Boolean(payload.responseJson),
        isFlagged: Boolean(payload.isFlagged),
        savedAtUtc,
      },
    };
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

    // Idempotent: if already graded, return the cached authoritative result
    if (raw.status === 'Graded' && raw.result) {
      return { success: true, status: 200, data: raw.result };
    }

    const submittedAtUtc = new Date().toISOString();
    let correctQuestions = 0;
    let totalAnswered = 0;

    const reviewQuestions: ReviewQuestionDto[] = raw.questions.map((q) => {
      const saved = raw.savedResponses[q.id];
      const learnerResponse = saved?.responseJson ?? undefined;
      if (
        learnerResponse &&
        !['null', '""', '[]', '{}', ''].includes(learnerResponse.trim())
      ) {
        totalAnswered++;
      }
      const isCorrect = evaluateCanonicalQuestion(q, learnerResponse);

      if (isCorrect) correctQuestions++;

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
        generalRationale: q.generalRationale,
        learnerResponse,
        isCorrect,
        pointsAwarded: isCorrect ? 1 : 0,
        maxPoints: 1,
        options: mappedOptions,
        exhibits: q.exhibits,
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
      totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
    const passingScorePercentage = raw.passingScorePercentage ?? 75;
    const passed = scorePercentage >= passingScorePercentage;
    const timeSpentSeconds = Math.max(
      15,
      Math.floor((new Date(submittedAtUtc).getTime() - new Date(raw.startedAtUtc).getTime()) / 1000)
    );
    const reviewReleased = raw.allowReview !== false;

    const result: SubmittedExamResultDto = {
      attemptId: raw.attemptId,
      examId: raw.examId,
      examTitle: raw.examTitle,
      pathway: raw.pathway,
      examCategory: raw.examCategory,
      status: 'Graded',
      scorePercentage,
      passingScorePercentage,
      passed,
      totalQuestions,
      totalAnswered,
      correctQuestions,
      totalWrong: Math.max(0, totalQuestions - correctQuestions),
      timeSpentSeconds,
      timeLimitMinutes: raw.timeLimitMinutes,
      startedAtUtc: raw.startedAtUtc,
      submittedAtUtc,
      reviewReleased,
      modePermissions: raw.modePermissions,
      reviewQuestions: reviewReleased ? reviewQuestions : [],
    };

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

    if (raw.result) {
      // Guarantee answer keys and rationales remain stripped if review is disabled by backend
      if (raw.allowReview === false) {
        return {
          success: true,
          status: 200,
          data: {
            ...raw.result,
            reviewReleased: false,
            reviewQuestions: [],
          },
        };
      }
      return { success: true, status: 200, data: raw.result };
    }

    if (raw.status !== 'Submitted' && raw.status !== 'Graded') {
      return {
        success: false,
        error: 'Attempt has not been submitted yet. Submit the examination before requesting graded review.',
        status: 409,
      };
    }

    return this.submitAttempt(userId, attemptId);
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

    const q = raw.questions.find((item) => item.id === questionId);
    if (!q) return { success: false, error: 'Question not found.', status: 404 };

    let title = 'Clinical Hint';
    let content = 'Consider core physiological principles and patient safety priorities.';

    if (stage === 'FirstHint') {
      title = 'Clinical Decision Clue (Stage 2)';
      content =
        q.hint ||
        (q.options.find((o) => o.isCorrect)?.specificRationale
          ? `Pay close attention to key signs: ${q.options.find((o) => o.isCorrect)?.specificRationale?.slice(0, 100)}...`
          : 'Identify the priority nursing assessment or intervention according to the ABCs (Airway, Breathing, Circulation).');
    } else if (stage === 'GuidedReasoning') {
      title = 'Guided Clinical Reasoning (Stage 3)';
      content =
        'Evaluate each assessment finding against normal physiological parameters. Ask: which complication poses the most acute threat to patient stability?';
    } else if (stage === 'ExplainConcept') {
      title = 'Core Nursing Concept';
      content = q.generalRationale || 'Adheres to standard clinical judgment and evidence-based nursing protocols.';
    }

    if (!raw.tutorProgression[questionId]) {
      raw.tutorProgression[questionId] = { stage: 2, hintsRequested: [] };
    }
    raw.tutorProgression[questionId].hintsRequested.push(stage);

    return {
      success: true,
      status: 200,
      data: {
        questionId,
        stage,
        title,
        content,
        eliminatedOptionIds: [],
        isAiGenerated: false,
      },
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

    const q = raw.questions.find((item) => item.id === questionId);
    if (!q) return { success: false, error: 'Question not found.', status: 404 };

    const isCorrect = evaluateCanonicalQuestion(q, responseJson);
    const correctOpt = q.options.find((o) => o.isCorrect);

    const explanation = isCorrect
      ? (correctOpt?.specificRationale || q.generalRationale || 'Correct! Your critical reasoning aligns with clinical safety protocols.')
      : (correctOpt?.specificRationale
          ? `Incorrect. The correct option is supported by: ${correctOpt.specificRationale}`
          : q.generalRationale || 'Review physiological principles for this clinical scenario.');

    const result: TutorEvaluateResponseDto = {
      questionId,
      isCorrect,
      pointsAwarded: isCorrect ? 1 : 0,
      maxPoints: 1,
      generalRationale: q.generalRationale || explanation,
      optionRationales: q.options.map((o) => ({
        optionId: o.id,
        optionIndex: String(o.optionIndex),
        optionText: o.optionText,
        isCorrect: o.isCorrect,
        specificRationale: o.specificRationale,
      })),
      clinicalConcept: 'Clinical Judgment & Decision Making',
      nursingPrinciple: 'Client Safety & Immediate Priority Setting',
      takeaway: 'Key takeaway: Assess physiological stability before administering pharmacological interventions, and monitor for adverse indicators.',
      isAiGenerated: false,
    };

    if (!raw.tutorProgression[questionId]) {
      raw.tutorProgression[questionId] = { stage: 4, hintsRequested: [], responseJson: undefined };
    }
    raw.tutorProgression[questionId].stage = 4;
    raw.tutorProgression[questionId].evaluated = result;
    raw.tutorProgression[questionId].responseJson = responseJson;

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

    const questions = raw.questions.map((q) => {
      const prog = raw.tutorProgression[q.id];
      return {
        questionId: q.id,
        stageReached: prog?.stage || 1,
        evaluation: prog?.evaluated ?? null,
        responseJson: prog?.responseJson ?? null,
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
          passingScorePercentage: a.result?.passingScorePercentage ?? a.passingScorePercentage,
          passed: a.result?.passed,
          totalQuestions: a.questions?.length ?? 0,
          totalCorrect: a.result?.correctQuestions,
          totalWrong: a.result?.totalWrong,
          totalAnswered: a.result?.totalAnswered,
          timeSpentSeconds: a.result?.timeSpentSeconds,
          attemptNumber: a.attemptNumber,
          allowReview: a.allowReview,
          canReview: a.modePermissions?.canReview ?? a.allowReview !== false,
          canTutor: a.modePermissions?.canTutor ?? false,
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
