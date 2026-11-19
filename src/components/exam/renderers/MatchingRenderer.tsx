"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function MatchingRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const pairs = React.useMemo<Record<string, string>>(() => {
    if (!value) return {};
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return (parsed.Pairs || parsed.pairs || {}) as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }, [value]);

  const handlePair = (premiseId: string, selectedValue: string) => {
    if (disabled) return;
    const updated = { ...pairs, [premiseId]: selectedValue };
    onChange?.(JSON.stringify({ Pairs: updated }));
  };

  // Strata stores match target in `opt.description`. Fall back to alternating even/odd pairs only if descriptions are absent.
  const descriptionTargets = React.useMemo(() => {
    const raw = question.options
      .map((o) => (o.description || "").trim())
      .filter(Boolean);
    return Array.from(new Set(raw));
  }, [question.options]);

  const hasDescriptions = descriptionTargets.length > 0;
  const premises = hasDescriptions
    ? question.options
    : question.options.filter((_, idx) => idx % 2 === 0);
  const legacyResponses = hasDescriptions
    ? []
    : question.options.filter((_, idx) => idx % 2 === 1);

  if (question.contentIntegrityError || premises.length === 0) {
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
      <div className="text-xs text-foreground-secondary">
        Match each clinical prompt on the left with its corresponding response on the right:
      </div>

      <div className="space-y-3">
        {premises.map((p, idx) => {
          const currentVal = pairs[p.id] || "";
          const expectedText =
            question.correctAnswerMeta?.correctMatches?.[p.id] ||
            (p.description || "").trim();

          const matchedText = hasDescriptions
            ? currentVal
            : legacyResponses.find((r) => r.id === currentVal)?.optionText ?? currentVal;

          const isMatchCorrect = Boolean(
            isReview &&
              expectedText &&
              matchedText.trim().toLowerCase() === expectedText.trim().toLowerCase()
          );
          const isMatchWrong = Boolean(
            isReview && expectedText && currentVal && !isMatchCorrect
          );

          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-colors",
                isReview
                  ? isMatchCorrect
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30"
                    : isMatchWrong
                      ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/30"
                      : "border-border bg-background"
                  : "border-border bg-background"
              )}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="w-6 h-6 rounded-md bg-brand-teal/10 text-brand-teal font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="space-y-1">
                  <RichQuestionContent content={p.optionText} className="text-sm font-medium text-foreground" />
                  {isReview && expectedText && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Correct match: {expectedText}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-foreground-muted hidden sm:block shrink-0" />
                <select
                  disabled={disabled}
                  value={currentVal}
                  onChange={(e) => handlePair(p.id, e.target.value)}
                  className={cn(
                    "h-10 px-3 rounded-lg border bg-surface text-xs font-medium text-foreground focus:outline-brand-teal min-w-[200px]",
                    isReview
                      ? isMatchCorrect
                        ? "border-emerald-500"
                        : isMatchWrong
                          ? "border-rose-500"
                          : "border-border"
                      : "border-border"
                  )}
                >
                  <option value="">-- Select Match --</option>
                  {hasDescriptions
                    ? descriptionTargets.map((target) => (
                        <option key={target} value={target}>
                          {target}
                        </option>
                      ))
                    : legacyResponses.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.optionText}
                        </option>
                      ))}
                </select>
                {isReview && isMatchCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                {isReview && isMatchWrong && (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
              </div>
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
