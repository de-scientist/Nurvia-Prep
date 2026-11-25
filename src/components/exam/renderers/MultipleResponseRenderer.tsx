"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { CheckSquare, Square, CheckCircle2, XCircle, Info } from "lucide-react";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";
import { validateSataSelection } from "@/lib/attempts/sata-validation";

export function MultipleResponseRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const selectedIds = React.useMemo<string[]>(() => {
    if (!value) return [];
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        const list = parsed.SelectedOptionIds || parsed.selectedOptionIds;
        return Array.isArray(list) ? list.map(String) : [];
      }
      if (value.startsWith("[")) {
        return (JSON.parse(value) as unknown[]).map(String);
      }
      return [value];
    } catch {
      return [];
    }
  }, [value]);

  const handleToggle = (optId: string) => {
    if (disabled) return;
    const exists = selectedIds.includes(optId);
    const updated = exists ? selectedIds.filter((id) => id !== optId) : [...selectedIds, optId];
    onChange?.(JSON.stringify({ SelectedOptionIds: updated }));
  };

  const validation = React.useMemo(() => {
    return validateSataSelection(question, value);
  }, [question, value]);

  if (question.contentIntegrityError || question.options.length === 0) {
    return (
      <div className="space-y-4">
        <ContentIntegrityAlert
          questionId={question.id}
          questionType={question.questionType}
          message={question.contentIntegrityError}
        />
        {isReview && !hideRationaleBox && (
          <ReviewRationaleBox question={question} value={value} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors",
          validation.requiredCount !== null
            ? validation.isValid
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : validation.selectedCount > validation.requiredCount
                ? "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
            : "border-brand-teal/20 bg-brand-teal/10 text-brand-teal"
        )}
      >
        <div className="flex items-center gap-2">
          {validation.requiredCount !== null ? (
            validation.isValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )
          ) : (
            <Info className="w-4 h-4 text-brand-teal shrink-0" />
          )}
          <span>
            {validation.requiredCount !== null
              ? `Select exactly ${validation.requiredCount} answers.`
              : "Select All That Apply (SATA). One, multiple, or all options may be correct."}
          </span>
        </div>

        <div className="font-semibold text-[11px]">
          {validation.requiredCount !== null ? (
            <span>
              {validation.selectedCount} of {validation.requiredCount} selected
              {validation.isValid && " · Complete"}
            </span>
          ) : (
            <span>{validation.selectedCount} selected</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isReview &&
          !question.options.some(
            (opt) =>
              selectedIds.includes(opt.id) ||
              (opt.numericId !== undefined && selectedIds.includes(String(opt.numericId))) ||
              opt.wasSelected === true
          ) && (
            <div className="rounded-xl border border-border bg-surface-muted/70 px-3.5 py-2.5 text-xs font-medium text-foreground-secondary">
              Your Submitted Answer: <span className="font-semibold italic">Unanswered</span> — Authoritative Correct Answers are highlighted in green below.
            </div>
          )}
        {question.options.map((opt) => {
          const correctIds = question.correctAnswerMeta?.correctOptionIds ?? [];
          const isSelected =
            selectedIds.includes(opt.id) ||
            (opt.numericId !== undefined && selectedIds.includes(String(opt.numericId))) ||
            opt.wasSelected === true;
          const isOptCorrect =
            opt.isCorrect === true ||
            correctIds.includes(opt.id) ||
            (opt.numericId !== undefined && correctIds.includes(String(opt.numericId)));
          let borderClass = "border-border bg-background hover:bg-surface-muted text-foreground";

          if (isSelected) {
            borderClass = "border-brand-teal bg-brand-teal/10 text-foreground ring-1 ring-brand-teal font-medium";
          }

          if (isReview) {
            if (isOptCorrect) {
              borderClass =
                "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500 font-medium";
            } else if (isSelected && !isOptCorrect) {
              borderClass =
                "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500 font-medium";
            }
          }

          return (
            <div key={opt.id} className="space-y-1.5">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => handleToggle(opt.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border text-sm transition-all flex items-start gap-3.5",
                  disabled && "cursor-default",
                  borderClass
                )}
              >
                <span className="shrink-0 pt-0.5 text-foreground-secondary">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-brand-teal" />
                  ) : (
                    <Square className="w-5 h-5 text-foreground-muted" />
                  )}
                </span>
                <RichQuestionContent content={opt.optionText} as="span" className="flex-1 leading-relaxed" />
                {isReview && (
                  <span className="shrink-0 pt-0.5 flex items-center gap-1.5">
                    {isOptCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        {isSelected ? "Your Answer · Correct" : "Correct Answer (Not Selected)"}
                      </span>
                    ) : isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        <XCircle className="w-4 h-4" />
                        Your Answer · Incorrect
                      </span>
                    ) : null}
                  </span>
                )}
              </button>

              {isReview && opt.specificRationale && (
                <div className="text-xs text-foreground-secondary ml-8 p-2.5 rounded-lg bg-surface-muted border border-border/50">
                  <span className="font-semibold text-foreground">Rationale: </span>
                  <RichQuestionContent content={opt.specificRationale} as="span" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
