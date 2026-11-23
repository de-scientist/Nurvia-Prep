"use client";

import * as React from "react";
import { AlertTriangle, BookOpen, CheckCircle2, HelpCircle, Lightbulb, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { wasCanonicalOptionSelected } from "@/lib/attempts/strata-answer-core.mjs";
import type {
  TutorEvaluateResponseDto,
  TutorHintResponseDto,
  TutorStage,
} from "@/lib/api-types";

interface TutorModePanelProps {
  attemptId: string;
  questionId: string;
  hasSelectedAnswer: boolean;
  serializedAnswer: string | null;
  evaluation: TutorEvaluateResponseDto | null;
  responseJson: string | null;
  onEvaluated: (result: TutorEvaluateResponseDto) => void;
}

export function TutorModePanel({
  attemptId,
  questionId,
  hasSelectedAnswer,
  serializedAnswer,
  evaluation,
  responseJson,
  onEvaluated,
}: TutorModePanelProps) {
  const [hints, setHints] = React.useState<TutorHintResponseDto[]>([]);
  const [loadingStage, setLoadingStage] = React.useState<TutorStage | "evaluate" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingHintStage, setPendingHintStage] = React.useState<TutorStage | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState<boolean>(false);
  const [lastEvaluatedAnswer, setLastEvaluatedAnswer] = React.useState<string | null>(responseJson || null);

  // Reset per-question hint state and evaluation loading state whenever the active question changes
  React.useEffect(() => {
    setHints([]);
    setLoadingStage(null);
    setError(null);
    setPendingHintStage(null);
    setLastEvaluatedAnswer(responseJson || null);
  }, [questionId, responseJson]);

  const handleRequestHint = async (stage: TutorStage) => {
    // Prevent concurrent hint requests
    if (pendingHintStage !== null) return;
    setPendingHintStage(stage);
    setLoadingStage(stage);
    setError(null);
    try {
      const res = await nurviaApi.requestTutorHint(attemptId, { questionId, stage });
      if (res.success && res.data) {
        setHints((prev) => {
          const filtered = prev.filter((h) => h.stage !== stage);
          return [...filtered, res.data!];
        });
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

  const handleEvaluate = async () => {
    if (!serializedAnswer) return;
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

  const isCurrentAnswerEvaluated = Boolean(evaluation && lastEvaluatedAnswer && serializedAnswer === lastEvaluatedAnswer);

  return (
    <div className="space-y-3 rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            isLoading={loadingStage === "ExplainConcept"}
            onClick={() => void handleRequestHint("ExplainConcept")}
            className="h-8 text-xs"
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5 text-brand-teal" />
            Explain the Concept
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isCurrentAnswerEvaluated ? "outline" : "primary"}
            disabled={!hasSelectedAnswer || isCurrentAnswerEvaluated}
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

      {/* Progressive Hints */}
      {hints.length > 0 && (
        <div className="space-y-2">
          {hints.map((hint) => (
            <div
              key={hint.stage}
              className="rounded-lg border border-border bg-surface p-3 text-xs text-foreground-secondary space-y-1"
            >
              <p className="font-semibold text-foreground">{hint.title}</p>
              <RichQuestionContent content={hint.content} className="leading-relaxed" />
            </div>
          ))}
        </div>
      )}

      {/* Evaluation + Authoritative Rationale + Study Guidance */}
      {evaluation && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              {evaluation.isCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Correct ({evaluation.pointsAwarded} / {evaluation.maxPoints} pt)
                  </span>
                </>
              ) : evaluation.pointsAwarded > 0 && evaluation.pointsAwarded < evaluation.maxPoints ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Partially Correct ({evaluation.pointsAwarded} / {evaluation.maxPoints} pt)
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-rose-700 dark:text-rose-400">
                    Incorrect ({evaluation.pointsAwarded} / {evaluation.maxPoints} pt)
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-foreground-muted">{evaluation.nursingPrinciple}</span>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Official Bank Rationale</p>
            <RichQuestionContent
              content={evaluation.generalRationale}
              className="leading-relaxed text-foreground-secondary"
            />
          </div>

          {evaluation.optionRationales.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-2.5">
              <p className="font-semibold text-foreground">Option Breakdown</p>
              <ul className="space-y-1.5">
                {evaluation.optionRationales.map((opt) => {
                  const wasPicked = wasCanonicalOptionSelected(
                    opt.optionId,
                    lastEvaluatedAnswer ?? serializedAnswer ?? undefined
                  );
                  return (
                    <li
                      key={opt.optionId}
                      className={`rounded-md border p-2.5 ${
                        opt.isCorrect
                          ? "border-emerald-500/35 bg-emerald-500/10 text-foreground"
                          : wasPicked
                            ? "border-rose-500/35 bg-rose-500/10 text-foreground"
                            : "border-border/60 bg-background/60 text-foreground-secondary"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold inline-flex items-start gap-1.5">
                          {opt.isCorrect ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : wasPicked ? (
                            <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                          ) : (
                            <span>•</span>
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
                        ) : wasPicked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
                            <XCircle className="h-3 w-3" /> Your Answer · Incorrect
                          </span>
                        ) : null}
                      </div>
                      {opt.specificRationale && (
                        <div className="mt-1 text-[11px] leading-relaxed">
                          <RichQuestionContent content={opt.specificRationale} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-brand-teal/10 p-3 text-foreground space-y-1">
            <p className="font-semibold text-brand-teal">
              Supplementary Study Takeaway · {evaluation.clinicalConcept}
            </p>
            <RichQuestionContent
              content={evaluation.takeaway}
              className="leading-relaxed text-foreground-secondary"
            />
          </div>
        </div>
      )}
    </div>
  );
}