"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export const HighlightTextRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}) => {
  const selectedIds = React.useMemo<string[]>(() => {
    if (!value) return [];
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        const list = parsed.SelectedOptionIds ?? parsed.selectedOptionIds;
        return Array.isArray(list) ? list.map(String) : [];
      }
      if (value.startsWith("[")) {
        return (JSON.parse(value) as unknown[]).map(String);
      }
      return [];
    } catch {
      return [];
    }
  }, [value]);

  const toggle = (id: string) => {
    if (disabled || !onChange) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(JSON.stringify({ SelectedOptionIds: next }));
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
    <div className="space-y-4">
      {question.highlightPassage && question.highlightPassage !== question.stem && (
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4 text-sm text-foreground leading-relaxed">
          <RichQuestionContent content={question.highlightPassage} />
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
        Click to highlight the relevant clinical findings or text spans:
      </p>

      <div className="flex flex-wrap gap-2.5 rounded-xl border border-border bg-background p-4">
        {question.options.map((opt) => {
          const active = selectedIds.includes(opt.id) || opt.wasSelected === true;
          let cls = "border-border bg-surface-muted text-foreground-secondary hover:bg-surface";
          if (active) {
            cls = "border-brand-teal bg-amber-200/80 dark:bg-amber-900/50 text-foreground ring-2 ring-brand-teal";
          }
          if (isReview) {
            if (opt.isCorrect) {
              cls = "border-emerald-500 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500";
            } else if (active && !opt.isCorrect) {
              cls = "border-rose-500 bg-rose-100 dark:bg-rose-950/60 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500";
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(opt.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                disabled && "cursor-default",
                cls
              )}
            >
              <RichQuestionContent content={opt.optionText} as="span" />
              {isReview && opt.isCorrect && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {isReview && active && !opt.isCorrect && (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
};
