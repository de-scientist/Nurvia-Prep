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
        const msg = validation.message || (validation.requiredCount ? `Please select exactly ${validation.requiredCount} answers before submitting.` : "Please select the required number of answers before submitting.");
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
      <div className="space-y-3.5">
        {/* SECTION 1: HINT */}
        <div className="rounded-lg border border-border bg-surface p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span>1. Hint</span>
          </div>

          {!isCurrentAnswerEvaluated ? (
            /* Protected State: Content selectively blurred; section heading remains readable and unblurred */
            <div
              role="button"
              tabIndex={0}
              aria-label="Hint locked. Select and submit your answer to unlock."
              onClick={handleLockedGuidanceClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLockedGuidanceClick();
                }
              }}
              className="relative cursor-pointer select-none rounded-lg border border-dashed border-border/80 bg-surface-muted/30 p-3 transition-colors hover:bg-surface-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <div className="filter blur-[5px] select-none pointer-events-none opacity-50 space-y-1">
                <p className="font-semibold text-foreground">Clinical Guidance &amp; Diagnostic Hint</p>
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  Focus on airway, breathing, circulation (ABCs) and differentiating acute physiological compromise from expected clinical findings.
                </p>
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Protected Pedagogical Hint</span>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-[2px]">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
                  <Lock className="h-3.5 w-3.5 text-brand-teal" />
                  <span>Hint Locked</span>
                </div>
              </div>
            </div>
          ) : (
            /* Revealed State: Render actual hint content normally */
            <div className="space-y-2 animate-in fade-in duration-300">
              {hints.length > 0 ? (
                hints.map((hint) => (
                  <div key={hint.stage} className="rounded-md bg-amber-500/10 p-2.5 text-xs text-foreground-secondary space-y-1">
                    <p className="font-semibold text-foreground">{hint.title}</p>
                    <RichQuestionContent content={hint.content} className="leading-relaxed" />
                  </div>
                ))
              ) : (
                <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-foreground-secondary">
                  <p className="font-semibold text-foreground">Clinical Guidance</p>
                  <p className="leading-relaxed mt-0.5">
                    Focus on airway, breathing, circulation (ABCs) and differentiating acute physiological compromise from expected clinical findings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: CORRECT ANSWERS */}
        <div
          id={`correct-answers-${questionId}`}
          className="rounded-lg border border-border bg-surface p-3.5 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>2. Correct Answers</span>
            </div>
            {isCurrentAnswerEvaluated && evaluation && (
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
            )}
          </div>

          {!isCurrentAnswerEvaluated ? (
            /* Protected State: Content selectively blurred; section heading remains readable and unblurred */
            <div
              role="button"
              tabIndex={0}
              aria-label="Correct answers locked. Select and submit your answer to unlock."
              onClick={handleLockedGuidanceClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLockedGuidanceClick();
                }
              }}
              className="relative cursor-pointer select-none rounded-lg border border-dashed border-border/80 bg-surface-muted/30 p-3 transition-colors hover:bg-surface-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <div className="filter blur-[5px] select-none pointer-events-none opacity-50 space-y-1">
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  Official answer key verification, correct option badges, and distractor comparison.
                </p>
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Protected Answer Option</span>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-[2px]">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
                  <Lock className="h-3.5 w-3.5 text-brand-teal" />
                  <span>Correct Answers Locked</span>
                </div>
              </div>
            </div>
          ) : (
            /* Revealed State: Display ALL correct answers without truncation */
            <div className="space-y-1.5 animate-in fade-in duration-300">
              {(() => {
                const evaluatedOptions = evaluation?.optionRationales ?? [];
                let correctOpts = evaluatedOptions.filter((opt) => opt.isCorrect);

                // Fallback to question.options if evaluation didn't specify optionRationales
                if (correctOpts.length === 0 && question?.options) {
                  const correctIds = question.correctAnswerMeta?.correctOptionIds ?? [];
                  const rawCorrect = question.options.filter(
                    (o) => o.isCorrect === true || correctIds.includes(o.id)
                  );
                  correctOpts = rawCorrect.map((o) => ({
                    optionId: o.id,
                    optionIndex: String(o.optionIndex ?? ""),
                    optionText: o.optionText,
                    isCorrect: true,
                    specificRationale: "",
                  }));
                }

                if (correctOpts.length === 0) {
                  return (
                    <div className="rounded-md border border-border/60 bg-surface-muted/50 p-2.5 text-xs text-foreground-secondary">
                      No correct answers specified for this item.
                    </div>
                  );
                }

                return correctOpts.map((opt) => {
                  const wasPicked = wasCanonicalOptionSelected(
                    opt.optionId,
                    lastEvaluatedAnswer ?? serializedAnswer ?? undefined
                  );

                  return (
                    <div
                      key={opt.optionId}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-foreground"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold inline-flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <RichQuestionContent content={opt.optionText} as="span" />
                        </span>

                        {wasPicked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Your Answer · Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Correct Answer
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* SECTION 3: RATIONALE */}
        <div className="rounded-lg border border-border bg-surface p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-brand-teal" />
              <span>3. Rationale</span>
            </div>
            {isCurrentAnswerEvaluated && evaluation?.nursingPrinciple && (
              <span className="text-[11px] text-foreground-muted">{evaluation.nursingPrinciple}</span>
            )}
          </div>

          {!isCurrentAnswerEvaluated ? (
            /* Protected State: Content selectively blurred; section heading remains readable and unblurred */
            <div
              role="button"
              tabIndex={0}
              aria-label="Rationale locked. Select and submit your answer to unlock."
              onClick={handleLockedGuidanceClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleLockedGuidanceClick();
                }
              }}
              className="relative cursor-pointer select-none rounded-lg border border-dashed border-border/80 bg-surface-muted/30 p-3 transition-colors hover:bg-surface-muted/50 focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <div className="filter blur-[5px] select-none pointer-events-none opacity-50 space-y-2">
                <p className="font-semibold text-foreground">Official Examination Bank Rationale</p>
                <p className="text-foreground-secondary leading-relaxed">
                  Authoritative clinical rationale, pathophysiological principles, and evidence-based practice explanations.
                </p>
                <div className="rounded-md border border-border/60 p-2 text-[11px] text-foreground-muted">
                  Option-by-option distractor analysis and clinical takeaway.
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-[2px]">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs">
                  <Lock className="h-3.5 w-3.5 text-brand-teal" />
                  <span>Rationale Locked</span>
                </div>
              </div>
            </div>
          ) : (
            /* Revealed State: Display complete rationale */
            evaluation && (
              <div className="space-y-3 animate-in fade-in duration-300">
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
            )
          )}
        </div>
      </div>
    </div>
  );
}
