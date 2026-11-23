"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

/**
 * Interactive BlankSelect (Cloze Dropdown) renderer.
 * Supports grouped dropdown blanks (by `option.label` or `[blankN]` placeholders)
 * and single-blank option selection serialized as `{ BlankSelections: Record<string, string> }`.
 */
export function BlankSelectRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const selections = React.useMemo<Record<string, string>>(() => {
    if (!value) return {};
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return (parsed.BlankSelections || parsed.blankSelections || {}) as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }, [value]);

  // Group options by blank number/label if provided, otherwise treat as single Blank 1 dropdown
  const blankGroups = React.useMemo(() => {
    const groups = new Map<string, typeof question.options>();
    for (const opt of question.options) {
      const rawKey = (opt.label || "1").replace(/^blank/i, "").trim() || "1";
      const list = groups.get(rawKey) ?? [];
      list.push(opt);
      groups.set(rawKey, list);
    }
    return Array.from(groups.entries()).sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]));
  }, [question.options]);

  const handleSelect = (blankKey: string, optionId: string) => {
    if (disabled) return;
    const updated = { ...selections, [blankKey]: optionId };
    onChange?.(JSON.stringify({ BlankSelections: updated }));
  };

  if (question.contentIntegrityError || question.options.length === 0) {
    return (
      <ContentIntegrityAlert
        questionId={question.id}
        questionType={question.questionType}
        message={question.contentIntegrityError}
      />
    );
  }

  return (
    <div className="space-y-4">
      {question.blankSelectPassage && question.blankSelectPassage !== question.stem && (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4 text-sm text-foreground leading-relaxed">
          <RichQuestionContent content={question.blankSelectPassage} />
        </div>
      )}

      <div className="space-y-3">
        {blankGroups.map(([blankKey, opts]) => {
          const selectedOptId = selections[blankKey] || "";
          const selectedOpt = opts.find((o) => o.id === selectedOptId || o.wasSelected);
          const correctOpt = opts.find((o) => o.isCorrect);
          const isBlankCorrect = Boolean(selectedOpt && correctOpt && selectedOpt.id === correctOpt.id);

          return (
            <div
              key={blankKey}
              className={cn(
                "rounded-xl border p-4 transition-colors space-y-2",
                isReview
                  ? isBlankCorrect
                    ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                    : selectedOpt
                      ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                      : "border-border bg-background"
                  : "border-border bg-background"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label
                  htmlFor={`blank-${question.id}-${blankKey}`}
                  className="text-xs font-semibold text-foreground-secondary"
                >
                  Blank {blankKey} — Select the most accurate clinical completion:
                </label>

                <select
                  id={`blank-${question.id}-${blankKey}`}
                  aria-label={`Blank ${blankKey} completion choice`}
                  disabled={disabled}
                  value={selectedOptId || (selectedOpt?.id ?? "")}
                  onChange={(e) => handleSelect(blankKey, e.target.value)}
                  className={cn(
                    "h-10 min-w-[220px] rounded-lg border px-3 text-sm font-medium bg-surface text-foreground focus:outline-brand-teal",
                    isReview
                      ? isBlankCorrect
                        ? "border-emerald-500 text-emerald-900 dark:text-emerald-100"
                        : selectedOpt
                          ? "border-rose-500 text-rose-900 dark:text-rose-100"
                          : "border-border"
                      : "border-border"
                  )}
                >
                  <option value="">-- Select Option --</option>
                  {opts.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.optionText}
                    </option>
                  ))}
                </select>
              </div>

              {isReview && (
                <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                  {selectedOpt && isBlankCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Your Answer ({selectedOpt.optionText}) · Correct
                    </span>
                  ) : selectedOpt && !isBlankCorrect ? (
                    <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 font-semibold">
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Your Answer ({selectedOpt.optionText}) · Incorrect
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                      Your Answer: Unanswered
                    </span>
                  )}
                  {correctOpt && !isBlankCorrect && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Correct Answer: {correctOpt.optionText}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
