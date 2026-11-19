"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function ImageBasedRenderer({
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
        if (Array.isArray(parsed.SelectedOptionIds)) return parsed.SelectedOptionIds.map(String);
        if (parsed.SelectedOptionId) return [String(parsed.SelectedOptionId)];
        if (parsed.value) return [String(parsed.value)];
        return [];
      }
      if (value.startsWith("[")) {
        return (JSON.parse(value) as unknown[]).map(String);
      }
      return value ? [value.replace(/^"(.*)"$/, "$1")] : [];
    } catch {
      return value ? [value] : [];
    }
  }, [value]);

  const correctCount = question.options.filter((o) => o.isCorrect).length;
  const allowMultiple = correctCount > 1;

  const handleSelect = (id: string) => {
    if (disabled) return;
    if (allowMultiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
      onChange?.(JSON.stringify({ SelectedOptionIds: next }));
    } else {
      onChange?.(JSON.stringify({ SelectedOptionId: id }));
    }
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

  const imageMedias = (question.media ?? []).filter((m) => Boolean(m.url));

  return (
    <div className="space-y-4">
      {imageMedias.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {imageMedias.map((m, idx) => {
            const safeUrl = normalizeMediaUrl(m.url) || m.url;
            return (
              <div
                key={m.id || idx}
                className="rounded-2xl border border-border bg-surface-muted/40 p-4 flex flex-col items-center justify-center gap-2"
              >
                <img
                  src={safeUrl}
                  alt={m.description || `Clinical exhibit ${idx + 1}`}
                  className="max-h-96 w-auto max-w-full rounded-xl object-contain bg-white shadow-xs"
                />
                {m.description && (
                  <p className="text-xs text-foreground-secondary text-center">{m.description}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 flex items-center gap-2 text-xs text-foreground-secondary">
          <ImageIcon className="w-4 h-4 text-brand-teal shrink-0" />
          <span>Examine any inline images in the clinical stem above and select your answer below.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id) || opt.wasSelected === true;
          let stateClass = "border-border bg-background hover:bg-surface-muted text-foreground";
          if (isSelected) {
            stateClass = "border-brand-teal bg-brand-teal/10 text-foreground font-semibold ring-1 ring-brand-teal";
          }
          if (isReview) {
            if (opt.isCorrect) {
              stateClass =
                "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500";
            } else if (isSelected && !opt.isCorrect) {
              stateClass =
                "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-semibold ring-1 ring-rose-500";
            }
          }

          return (
            <div key={opt.id} className="space-y-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  "w-full p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3",
                  disabled && "cursor-default",
                  stateClass
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-xs font-bold shrink-0">
                  <MapPin className={cn("w-4 h-4", isSelected ? "text-brand-teal" : "text-foreground-muted")} />
                </div>
                <RichQuestionContent content={opt.optionText} as="span" className="flex-1 leading-snug" />
                {isReview && (
                  <span className="shrink-0">
                    {opt.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isSelected ? (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    ) : null}
                  </span>
                )}
              </button>
              {isReview && opt.specificRationale && (
                <div className="text-[11px] text-foreground-secondary bg-surface-muted p-2 rounded-lg border border-border/50">
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
