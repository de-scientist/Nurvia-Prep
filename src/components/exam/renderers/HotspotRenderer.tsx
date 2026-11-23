"use client";

import * as React from "react";
import { CheckCircle2, ImageOff, MapPin, XCircle } from "lucide-react";
import type { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

/**
 * Interactive Hotspot renderer.
 * Displays authoritative clinical diagram/image exhibits from `question.media`
 * and renders clickable hotspot option markers + accessible option buttons
 * serialized as `{ SelectedOptionIds: string[] }`.
 */
export function HotspotRenderer({
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
        const list = parsed.SelectedOptionIds ?? parsed.selectedOptionIds;
        if (Array.isArray(list)) return list.map(String);
        if (parsed.SelectedOptionId) return [String(parsed.SelectedOptionId)];
      } else if (value.startsWith("[")) {
        return (JSON.parse(value) as unknown[]).map(String);
      } else if (value.trim()) {
        return [value.replace(/^"(.*)"$/, "$1")];
      }
      return [];
    } catch {
      return [];
    }
  }, [value]);

  const primaryMedia = question.media?.find((m) => m.isPrimary) ?? question.media?.[0];
  const imageUrl = primaryMedia?.url ? normalizeMediaUrl(primaryMedia.url) || primaryMedia.url : "";

  const handleToggle = (optId: string) => {
    if (disabled) return;
    const exists = selectedIds.includes(optId);
    const updated = exists ? selectedIds.filter((id) => id !== optId) : [...selectedIds, optId];
    onChange?.(JSON.stringify({ SelectedOptionIds: updated }));
  };

  if (question.contentIntegrityError || (question.options.length === 0 && !imageUrl)) {
    return (
      <ContentIntegrityAlert
        questionId={question.id}
        questionType={question.questionType}
        message={question.contentIntegrityError}
      />
    );
  }

  const hasAnySelection =
    selectedIds.length > 0 || question.options.some((opt) => opt.wasSelected === true);

  return (
    <div className="space-y-4">
      <div className="text-xs text-foreground-secondary">
        Inspect the clinical visual exhibit and select the designated anatomical or diagnostic hotspot(s):
      </div>

      {isReview && !hasAnySelection && (
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Your Submitted Answer: Unanswered
        </div>
      )}

      {imageUrl ? (
        <div className="relative rounded-2xl border border-border bg-slate-950/5 dark:bg-slate-900 p-3 flex justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt={primaryMedia?.description || "Clinical Hotspot Exhibit"}
            className="max-h-96 w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4 flex items-center gap-2 text-xs text-foreground-secondary">
          <ImageOff className="h-4 w-4 text-foreground-muted shrink-0" />
          <span>No separate diagram URL provided; select the designated hotspot target below.</span>
        </div>
      )}

      {question.options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, idx) => {
            const isSelected = selectedIds.includes(opt.id) || opt.wasSelected === true;
            let stateClasses = "border-border bg-background hover:bg-surface-muted text-foreground";
            if (isSelected) {
              stateClasses = "border-brand-teal bg-brand-teal/10 ring-1 ring-brand-teal font-medium";
            }
            if (isReview) {
              if (opt.isCorrect) {
                stateClasses =
                  "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500 font-medium";
              } else if (isSelected && !opt.isCorrect) {
                stateClasses =
                  "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500 font-medium";
              }
            }

            return (
              <div key={opt.id} className="space-y-1">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => handleToggle(opt.id)}
                  className={cn(
                    "w-full p-3.5 rounded-xl border text-left text-xs transition-all flex items-center gap-3",
                    disabled && "cursor-default",
                    stateClasses
                  )}
                >
                  <span className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                    <MapPin
                      className={cn(
                        "w-4 h-4",
                        isReview && opt.isCorrect
                          ? "text-emerald-600"
                          : isReview && isSelected && !opt.isCorrect
                            ? "text-rose-600"
                            : isSelected
                              ? "text-brand-teal"
                              : "text-foreground-muted"
                      )}
                    />
                  </span>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-foreground-muted mr-1.5">
                      #{idx + 1}
                    </span>
                    <RichQuestionContent content={opt.optionText} as="span" />
                  </div>
                  {isReview && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold">
                      {opt.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {isSelected ? "Your Answer · Correct" : "Correct Hotspot"}
                        </span>
                      ) : isSelected ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                          <XCircle className="w-4 h-4 text-rose-500" />
                          Your Answer · Incorrect
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
                {isReview && opt.specificRationale && (
                  <div className="ml-4 text-[11px] text-foreground-secondary bg-surface-muted p-2 rounded-lg border border-border/50">
                    <RichQuestionContent content={opt.specificRationale} as="span" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ContentIntegrityAlert
          questionId={question.id}
          questionType={question.questionType}
          message="No hotspot target regions or options were supplied by the examination bank for this item."
        />
      )}

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
