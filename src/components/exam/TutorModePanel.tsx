"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Lock,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { wasCanonicalOptionSelected } from "@/lib/attempts/strata-answer-core.mjs";
import { isSataQuestion, validateSataSelection } from "@/lib/attempts/sata-validation";
import { feedback } from "@/lib/feedback/feedback-context";
import type {
  TutorEvaluateResponseDto,
  TutorHintResponseDto,
  TutorStage,
} from "@/lib/api-types";

interface TutorModePanelProps {
  attemptId: string;
  questionId: string;
  question?: {
    questionType?: string | number | null;
    stem?: string;
    instructions?: string;
    metaStem?: string;
    options?: Array<{ id: string; optionIndex?: number | string; optionText: string; isCorrect?: boolean }>;
    correctAnswerMeta?: { correctOptionIds?: string[]; correctCellIds?: string[] };
  };
  hasSelectedAnswer: boolean;
  serializedAnswer: string | null;
  evaluation: TutorEvaluateResponseDto | null;
  responseJson: string | null;
  initialHints?: TutorHintResponseDto[];
  onHintReceived?: (hint: TutorHintResponseDto, questionId?: string) => void;
  onEvaluated: (result: TutorEvaluateResponseDto) => void;
}

export function TutorModePanel({
  attemptId,
  questionId,
  question,
  hasSelectedAnswer,
  serializedAnswer,
  evaluation,
  responseJson,
  initialHints,
  onHintReceived,
  onEvaluated,
}: TutorModePanelProps) {
  const [hints, setHints] = React.useState<TutorHintResponseDto[]>(initialHints ?? []);
  const [loadingStage, setLoadingStage] = React.useState<TutorStage | "evaluate" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingHintStage, setPendingHintStage] = React.useState<TutorStage | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState<boolean>(false);
  const [lastEvaluatedAnswer, setLastEvaluatedAnswer] = React.useState<string | null>(responseJson || null);

  // Reset per-question hint state and evaluation loading state whenever active question changes
  React.useEffect(() => {
    setHints(initialHints ?? []);
    setLoadingStage(null);
    setError(null);
    setPendingHintStage(null);
    setLastEvaluatedAnswer(responseJson || null);
  }, [questionId, responseJson, initialHints]);

  const isCurrentAnswerEvaluated = Boolean(
    evaluation && lastEvaluatedAnswer && serializedAnswer === lastEvaluatedAnswer
  );

  const handleLockedGuidanceClick = () => {
    feedback.warn("Select your answer before viewing the learning guidance.");
  };

  const handleRequestHint = async (stage: TutorStage) => {
    if (!hasSelectedAnswer) {
      feedback.warn("Select your answer before viewing the learning guidance.");
      return;
    }
    // Prevent concurrent hint requests
    if (pendingHintStage !== null) return;
    setPendingHintStage(stage);
    setLoadingStage(stage);
    setError(null);
    try {
      const res = await nurviaApi.requestTutorHint(attemptId, { questionId, stage });
      if (res.success && res.data) {
        const nextHint = res.data;
        setHints((prev) => {
          const filtered = prev.filter((h) => h.stage !== stage);
          return [...filtered, nextHint];
        });
        onHintReceived?.(nextHint, questionId);
      } else {
        setError(res.message || "Unable to load tutor hint.");
      }
    } catch {
      setError("Unable to load tutor hint. Please try again.");
    } finally {
      setPendingHintStage(null);
      setLoadingStage(null);
    }
  };

  const handleShowCorrectAnswers = () => {
    if (!isCurrentAnswerEvaluated) {
      feedback.warn("Select your answer before viewing the learning guidance.");
      return;
    }
    const el = document.getElementById(`correct-answers-${questionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleEvaluate = async () => {
    if (!hasSelectedAnswer || !serializedAnswer) {
      feedback.warn("Select your answer before viewing the learning guidance.");
      return;
    }

    // Frontend SATA validation enforcement
    if (question && isSataQuestion(question.questionType)) {
      const validation = validateSataSelection(question, serializedAnswer);
      if (!validation.isValid) {
        const msg = validation.message || "Select the required number of answers to continue.";
        feedback.warn(msg);
        setError(msg);
        return;
      }
    }

    if (isEvaluating) return;
    setIsEvaluating(true);
    setLoadingStage("evaluate");
    setError(null);

    try {
      const res = await nurviaApi.evaluateTutorAnswer(attemptId, {
        questionId,
        responseJson: serializedAnswer,
      });
      if (res.success && res.data) {
        onEvaluated(res.data);
        setLastEvaluatedAnswer(serializedAnswer);
      } else {
        setError(res.message || "Unable to evaluate your answer.");
      }
    } catch {
      setError("Unable to evaluate your answer. Please try again.");
    } finally {
      setIsEvaluating(false);
      setLoadingStage(null);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-4">
      {/* Header and Pedagogical Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-teal/15 pb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-teal">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Guided Tutor Mode</span>
          {isCurrentAnswerEvaluated && (
            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-brand-teal/15 text-brand-teal">
              Evaluated
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            isLoading={loadingStage === "FirstHint"}
            onClick={() => void handleRequestHint("FirstHint")}
            className="h-8 text-xs"
          >
            <Lightbulb className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
            Ask for a Hint
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            isLoading={loadingStage === "GuidedReasoning"}
            onClick={() => void handleRequestHint("GuidedReasoning")}
            className="h-8 text-xs"
          >
            <HelpCircle className="mr-1.5 h-3.5 w-3.5 text-brand-teal" />
            Help Me Understand
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleShowCorrectAnswers}
            className="h-8 text-xs"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Show Correct Answers
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isCurrentAnswerEvaluated ? "outline" : "primary"}
            disabled={isCurrentAnswerEvaluated}
            isLoading={loadingStage === "evaluate"}
            onClick={() => void handleEvaluate()}
            className="h-8 text-xs"
          >
            {isCurrentAnswerEvaluated ? "Answer Evaluated" : "Submit My Answer"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* 3 Learning Guidance Sections in Exact Required Order:
          1. Hint
          2. Correct Answers
          3. Rationale */}
      {!isCurrentAnswerEvaluated ? (
        /* Initial State: Visible but blurred / visually obscured */
        <div
          role="button"
          tabIndex={0}
          aria-label="Learning guidance locked. Select and submit your answer to unlock."
          onClick={handleLockedGuidanceClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleLockedGuidanceClick();
            }
          }}
          className="relative cursor-pointer select-none space-y-3 rounded-xl border border-dashed border-brand-teal/30 bg-surface/40 p-3 transition-colors hover:bg-surface/60 focus:outline-none focus:ring-2 focus:ring-brand-teal"
        >
          {/* Section 1: Hint (Blurred) */}
          <div className="rounded-lg border border-border/70 bg-surface p-3 filter blur-[5px] opacity-50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>1. Hint</span>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Clinical priority cues, patient assessment principles, and physiological indicators guide reasoning.
            </p>
          </div>

          {/* Section 2: Correct Answers (Blurred) */}
          <div className="rounded-lg border border-border/70 bg-surface p-3 filter blur-[5px] opacity-50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>2. Correct Answers</span>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Official answer key verification, correct option badges, and distractor comparison.
            </p>
          </div>

          {/* Section 3: Rationale (Blurred) */}
          <div className="rounded-lg border border-border/70 bg-surface p-3 filter blur-[5px] opacity-50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand-teal" />
              <span>3. Rationale</span>
            </div>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Authoritative bank rationale, detailed option breakdown, and nursing practice takeaway.
            </p>
          </div>

          {/* Center Locked Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/50 backdrop-blur-[2px] p-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs">
              <Lock className="h-3.5 w-3.5 text-brand-teal" />
              <span>Learning Guidance Locked</span>
            </div>
            <p className="mt-1.5 text-[11px] text-foreground-secondary font-medium">
              Select and submit your answer to reveal Hint, Correct Answers, and Rationale.
            </p>
          </div>
        </div>
      ) : (
        /* Revealed State: All 3 sections automatically unblurred */
        <div className="space-y-3.5 animate-in fade-in duration-300">
          {/* SECTION 1: HINT */}
          <div className="rounded-lg border border-border bg-surface p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>1. Hint</span>
            </div>
            {hints.length > 0 ? (
              <div className="space-y-2">
                {hints.map((hint) => (
                  <div key={hint.stage} className="rounded-md bg-amber-500/10 p-2.5 text-xs text-foreground-secondary space-y-1">
                    <p className="font-semibold text-foreground">{hint.title}</p>
                    <RichQuestionContent content={hint.content} className="leading-relaxed" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-foreground-secondary">
                <p className="font-semibold text-foreground">Clinical Guidance</p>
                <p className="leading-relaxed mt-0.5">
                  Focus on airway, breathing, circulation (ABCs) and differentiating acute physiological compromise from expected clinical findings.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 2: CORRECT ANSWERS */}
          {evaluation && (
            <div
              id={`correct-answers-${questionId}`}
              className="rounded-lg border border-border bg-surface p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>2. Correct Answers</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {evaluation.isCorrect ? (
                    <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Correct ({evaluation.pointsAwarded}/{evaluation.maxPoints} pt)
                    </span>
                  ) : evaluation.pointsAwarded > 0 && evaluation.pointsAwarded < evaluation.maxPoints ? (
                    <span className="text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Partially Correct ({evaluation.pointsAwarded}/{evaluation.maxPoints} pt)
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Incorrect ({evaluation.pointsAwarded}/{evaluation.maxPoints} pt)
                    </span>
                  )}
                </div>
              </div>

              {/* Correct Option List */}
              <div className="space-y-1.5">
                {evaluation.optionRationales.map((opt) => {
                  const wasPicked = wasCanonicalOptionSelected(
                    opt.optionId,
                    lastEvaluatedAnswer ?? serializedAnswer ?? undefined
                  );
                  if (!opt.isCorrect && !wasPicked) return null;

                  return (
                    <div
                      key={opt.optionId}
                      className={`rounded-md border p-2.5 text-xs ${
                        opt.isCorrect
                          ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                          : "border-rose-500/40 bg-rose-500/10 text-foreground"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold inline-flex items-start gap-1.5">
                          {opt.isCorrect ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <RichQuestionContent content={opt.optionText} as="span" />
                        </span>

                        {opt.isCorrect && wasPicked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Your Answer · Correct
                          </span>
                        ) : opt.isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Correct Answer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                            <XCircle className="h-3 w-3" /> Your Answer · Incorrect
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: RATIONALE */}
          {evaluation && (
            <div className="rounded-lg border border-border bg-surface p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-brand-teal" />
                  <span>3. Rationale</span>
                </div>
                <span className="text-[11px] text-foreground-muted">{evaluation.nursingPrinciple}</span>
              </div>

              {/* Official Bank Rationale */}
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Official Examination Bank Rationale</p>
                <RichQuestionContent
                  content={evaluation.generalRationale}
                  className="leading-relaxed text-foreground-secondary"
                />
              </div>

              {/* Option Breakdown */}
              {evaluation.optionRationales.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-2.5">
                  <p className="font-semibold text-foreground">Detailed Option Breakdown</p>
                  <ul className="space-y-1.5">
                    {evaluation.optionRationales.map((opt) => (
                      <li
                        key={opt.optionId}
                        className={`rounded-md border p-2 text-[11px] ${
                          opt.isCorrect
                            ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                            : "border-border/60 bg-background/60 text-foreground-secondary"
                        }`}
                      >
                        <div className="font-semibold flex items-center gap-1">
                          {opt.isCorrect ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <span>•</span>
                          )}
                          <RichQuestionContent content={opt.optionText} as="span" />
                        </div>
                        {opt.specificRationale && (
                          <div className="mt-1 leading-relaxed text-foreground-secondary">
                            <RichQuestionContent content={opt.specificRationale} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supplementary Takeaway */}
              {evaluation.takeaway && (
                <div className="rounded-lg bg-brand-teal/10 p-3 text-foreground space-y-1">
                  <p className="font-semibold text-brand-teal">
                    Supplementary Study Takeaway · {evaluation.clinicalConcept}
                  </p>
                  <RichQuestionContent
                    content={evaluation.takeaway}
                    className="leading-relaxed text-foreground-secondary"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
