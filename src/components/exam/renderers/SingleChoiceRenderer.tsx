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

  return (
    <div className="space-y-3">
      {question.options.map((opt, idx) => {
        const isSelected = selectedId === opt.id || opt.wasSelected === true;
        let borderClass = "border-border bg-background hover:bg-surface-muted text-foreground";

        if (isSelected) {
          borderClass = "border-brand-teal bg-brand-teal/10 text-foreground ring-1 ring-brand-teal font-medium";
        }

        if (isReview) {
          if (opt.isCorrect) {
            borderClass =
              "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500 font-medium";
          } else if (isSelected && !opt.isCorrect) {
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
                <span className="shrink-0 pt-0.5 flex items-center gap-1.5">
                  {opt.isCorrect && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      {isSelected ? "Your Answer · Correct" : "Correct Answer"}
                    </span>
                  )}
                  {isSelected && !opt.isCorrect && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      <XCircle className="w-4 h-4" />
                      Your Answer · Incorrect
                    </span>
                  )}
                </span>
              )}
            </button>

            {isReview && opt.specificRationale && (
              <div className="text-xs text-foreground-secondary ml-10 p-2.5 rounded-lg bg-surface-muted border border-border/50">
                <span className="font-semibold text-foreground">Rationale: </span>
                <RichQuestionContent content={opt.specificRationale} as="span" />
              </div>
            )}
          </div>
        );
      })}

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
