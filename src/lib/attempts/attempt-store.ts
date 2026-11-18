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
  QuestionType,
  CognitiveSkill,
  ClientNeedCategory,
  QuestionExhibitDto,
  TutorStage,
  TutorHintResponseDto,
  TutorEvaluateResponseDto,
  TutorSessionStateDto,
} from '../api-types';

export interface StoredAttemptQuestion {
  id: string;
  orderIndex: number;
  stem: string;
  questionType: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  options: Array<{
    id: string;
    optionIndex: number;
    optionText: string;
    displayOrder: number;
    isCorrect: boolean;
    specificRationale?: string;
  }>;
  exhibits: QuestionExhibitDto[];
  generalRationale: string;
  hint?: string;
  contentJsonData?: string;
}

export interface StoredAttempt {
  attemptId: string;
  examId: string;
  examTitle: string;
  userId: string;
  deliveryMode: 'Exam' | 'Tutor';
  layoutMode: ExamLayout;
  allowedLayouts: 'AllInOneOnly' | 'SequentialOnly' | 'Both';
  timeLimitMinutes: number;
  remainingSeconds: number;
  startedAtUtc: string;
  submittedAtUtc?: string;
  status: 'InProgress' | 'Submitted' | 'Graded';
  allowReview?: boolean;
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
    }
  >;
}

class AttemptStore {
  private attempts = new Map<string, StoredAttempt>();

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

    const sanitizedQuestions: ActiveExamQuestionDto[] = attempt.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      stem: q.stem,
      questionType: q.questionType,
      cognitiveSkill: q.cognitiveSkill,
      clientNeedCategory: q.clientNeedCategory,
      contentJsonData: q.contentJsonData,
      // Rationales are strictly withheld in active Exam mode
      generalRationale: isTutor ? q.generalRationale : undefined,
      options: q.options.map((o) => ({
        id: o.id,
        optionIndex: o.optionIndex,
        optionText: o.optionText,
        displayOrder: o.displayOrder,
        // isCorrect and specificRationale are withheld in Exam mode
        isCorrect: isTutor ? o.isCorrect : undefined,
        specificRationale: isTutor ? o.specificRationale : undefined,
      })),
      exhibits: q.exhibits,
    }));

    const mappedSavedResponses: Record<string, import('../api-types').LearnerAnswerStateDto> = {};
    for (const [qid, state] of Object.entries(attempt.savedResponses)) {
      mappedSavedResponses[qid] = {
        responseJson: state.responseJson ?? undefined,
        isAnswered: Boolean(state.responseJson),
        isFlagged: state.isFlagged,
        savedAtUtc: state.savedAtUtc,
        tutorStageReached: attempt.tutorProgression[qid]?.stage ?? 0,
      };
    }

    return {
      attemptId: attempt.attemptId,
      examId: attempt.examId,
      examTitle: attempt.examTitle,
      timeLimitMinutes: attempt.timeLimitMinutes,
      remainingSeconds: attempt.remainingSeconds,
      startedAtUtc: attempt.startedAtUtc,
      deadlineUtc: new Date(
        new Date(attempt.startedAtUtc).getTime() + (attempt.timeLimitMinutes || 90) * 60 * 1000
      ).toISOString(),
      totalQuestions: sanitizedQuestions.length,
      deliveryMode: attempt.deliveryMode,
      layoutMode: attempt.layoutMode,
      allowedLayouts: attempt.allowedLayouts,
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

    const reviewQuestions: ReviewQuestionDto[] = raw.questions.map((q) => {
      const saved = raw.savedResponses[q.id];
      const learnerResponse = saved?.responseJson ?? undefined;
      const isCorrect = this.evaluateQuestionCorrectness(q, learnerResponse);

      if (isCorrect) correctQuestions++;

      // Map options with wasSelected flags
      const mappedOptions = q.options.map((opt) => {
        const wasSelected = this.wasOptionSelected(opt.id, learnerResponse);
        return {
          id: opt.id,
          optionIndex: opt.optionIndex,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          specificRationale: opt.specificRationale,
          wasSelected,
        };
      });

      return {
        questionId: q.id,
        orderIndex: q.orderIndex,
        stem: q.stem,
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
      };
    });

    const totalQuestions = raw.questions.length;
    const scorePercentage =
      totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
    const passingScorePercentage = 75;
    const passed = scorePercentage >= passingScorePercentage;
    const timeSpentSeconds = Math.max(
      15,
      Math.floor((new Date(submittedAtUtc).getTime() - new Date(raw.startedAtUtc).getTime()) / 1000)
    );

    const result: SubmittedExamResultDto = {
      attemptId: raw.attemptId,
      examId: raw.examId,
      examTitle: raw.examTitle,
      status: 'Graded',
      scorePercentage,
      passingScorePercentage,
      passed,
      totalQuestions,
      correctQuestions,
      timeSpentSeconds,
      timeLimitMinutes: raw.timeLimitMinutes,
      startedAtUtc: raw.startedAtUtc,
      submittedAtUtc,
      reviewReleased: raw.allowReview !== false,
      reviewQuestions: raw.allowReview !== false ? reviewQuestions : [],
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
   * Retrieves the graded review for an attempt.
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
      return { success: true, status: 200, data: raw.result };
    }

    // If attempt has not yet been submitted, score it now to return review
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

    const isCorrect = this.evaluateQuestionCorrectness(q, responseJson);
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
      raw.tutorProgression[questionId] = { stage: 4, hintsRequested: [] };
    }
    raw.tutorProgression[questionId].stage = 4;
    raw.tutorProgression[questionId].evaluated = result;

    // Also persist the answer in savedResponses
    raw.savedResponses[questionId] = {
      responseJson,
      isFlagged: false,
      savedAtUtc: new Date().toISOString(),
    };

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
          status: a.status,
          startedAtUtc: a.startedAtUtc,
          submittedAtUtc: a.submittedAtUtc,
          scorePercentage: a.result?.scorePercentage,
          passed: a.result?.passed,
          totalQuestions: a.questions.length,
        });
      }
    }
    return list.sort((x, y) => new Date(y.startedAtUtc).getTime() - new Date(x.startedAtUtc).getTime());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL EVALUATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private evaluateQuestionCorrectness(q: StoredAttemptQuestion, responseJson?: string): boolean {
    if (!responseJson || ['null', '""', '[]', '{}', ''].includes(responseJson.trim())) {
      return false;
    }

    try {
      // 1. SingleChoice / TrueFalse (either { SelectedOptionId: "opt-1" } or scalar "opt-1")
      if (responseJson.startsWith('{')) {
        const parsed = JSON.parse(responseJson);
        if (parsed.SelectedOptionId || parsed.selectedOptionId) {
          const selectedId = String(parsed.SelectedOptionId || parsed.selectedOptionId);
          const opt = q.options.find((o) => o.id === selectedId);
          return Boolean(opt?.isCorrect);
        }
        if (Array.isArray(parsed.SelectedOptionIds || parsed.selectedOptionIds)) {
          const selectedIds = new Set(
            (parsed.SelectedOptionIds || parsed.selectedOptionIds).map(String)
          );
          const correctIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
          if (selectedIds.size !== correctIds.size) return false;
          for (const id of correctIds) {
            if (!selectedIds.has(id)) return false;
          }
          return true;
        }
      }

      // 2. Direct string or JSON array
      const trimmed = responseJson.replace(/^"(.*)"$/, '$1').trim();
      const directOpt = q.options.find((o) => o.id === trimmed);
      if (directOpt) return Boolean(directOpt.isCorrect);

      // Multiple choice JSON array [ "opt-1", "opt-2" ]
      if (responseJson.startsWith('[')) {
        const parsedArr: string[] = JSON.parse(responseJson).map(String);
        const selectedIds = new Set(parsedArr);
        const correctIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
        if (selectedIds.size !== correctIds.size) return false;
        for (const id of correctIds) {
          if (!selectedIds.has(id)) return false;
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private wasOptionSelected(optionId: string, responseJson?: string): boolean {
    if (!responseJson) return false;
    try {
      if (responseJson.startsWith('{')) {
        const parsed = JSON.parse(responseJson);
        if (parsed.SelectedOptionId || parsed.selectedOptionId) {
          return String(parsed.SelectedOptionId || parsed.selectedOptionId) === optionId;
        }
        if (Array.isArray(parsed.SelectedOptionIds || parsed.selectedOptionIds)) {
          return (parsed.SelectedOptionIds || parsed.selectedOptionIds).map(String).includes(optionId);
        }
      }
      if (responseJson.startsWith('[')) {
        return (JSON.parse(responseJson) as string[]).map(String).includes(optionId);
      }
      return responseJson.replace(/^"(.*)"$/, '$1').trim() === optionId;
    } catch {
      return false;
    }
  }
}

// Global singleton instance
export const attemptStore = new AttemptStore();
