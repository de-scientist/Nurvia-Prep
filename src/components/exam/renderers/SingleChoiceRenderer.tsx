"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function SingleChoiceRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const selectedId = React.useMemo(() => {
    if (!value) return null;
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return String(parsed.SelectedOptionId || parsed.selectedOptionId || parsed.value || "") || null;
      }
      return value.replace(/^"(.*)"$/, "$1");
    } catch {
      return value;
    }
  }, [value]);

  const handleSelect = (optId: string) => {
    if (disabled) return;
    onChange?.(JSON.stringify({ SelectedOptionId: optId }));
  };

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

  const correctIds = question.correctAnswerMeta?.correctOptionIds ?? [];
  const hasAnySelection = question.options.some(
    (opt) =>
      selectedId === opt.id ||
      (opt.numericId !== undefined && selectedId === String(opt.numericId)) ||
      opt.wasSelected === true
  );

  return (
    <div className="space-y-3">
      {isReview && !hasAnySelection && (
        <div className="rounded-xl border border-border bg-surface-muted/70 px-3.5 py-2.5 text-xs font-medium text-foreground-secondary">
          Your Submitted Answer: <span className="font-semibold italic">Unanswered</span> — Authoritative Correct Answer is highlighted in green below.
        </div>
      )}
      {question.options.map((opt, idx) => {
        const isSelected =
          selectedId === opt.id ||
          (opt.numericId !== undefined && selectedId === String(opt.numericId)) ||
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
          } else if (isSelected) {
            borderClass =
              "border-rose-500/80 bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/60 font-medium";
          }
        }

        return (
          <div key={opt.id} className="space-y-1.5">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                "w-full text-left p-4 rounded-xl border text-sm transition-all flex items-start gap-3.5",
                disabled && "cursor-default",
                borderClass
              )}
            >
              <span className="w-6 h-6 rounded-full border border-border bg-surface text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {String.fromCharCode(65 + idx)}
              </span>
              <RichQuestionContent content={opt.optionText} as="span" className="flex-1 leading-relaxed" />
              {isReview && (
                <span className="shrink-0 pt-0.5 flex items-center gap-1.5 font-semibold text-[11px]">
                  {isOptCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSelected ? "Your Answer · Correct ✓" : "Correct Answer ✓"}</span>
                    </span>
                  ) : isSelected ? (
                    <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                      <XCircle className="w-4 h-4" />
                      <span>Your Answer · Incorrect ✕</span>
                    </span>
                  ) : null}
                </span>
              )}
            </button>
          </div>
        );
      })}

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
