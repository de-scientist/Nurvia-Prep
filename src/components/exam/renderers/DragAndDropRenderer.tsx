"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function DragAndDropRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const classifications = React.useMemo<Record<string, string>>(() => {
    if (!value) return {};
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return (parsed.Buckets || parsed.buckets || {}) as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }, [value]);

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

  const bucketA = "Category A (Indicated / Expected)";
  const bucketB = "Category B (Contraindicated / Unexpected)";

  const handleAssign = (itemId: string, bucket: string) => {
    if (disabled) return;
    const current = classifications[itemId];
    const updated = { ...classifications, [itemId]: current === bucket ? "" : bucket };
    onChange?.(JSON.stringify({ Buckets: updated }));
  };

  return (
    <div className="space-y-6">
      <div className="text-xs text-foreground-secondary">
        Classify each clinical finding or nursing action into the appropriate category bucket:
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { code: "A", title: bucketA, accent: "brand-teal" },
          { code: "B", title: bucketB, accent: "amber" },
        ].map((bucket) => (
          <div
            key={bucket.code}
            className={cn(
              "rounded-xl border p-4 space-y-3",
              bucket.code === "A"
                ? "border-brand-teal/30 bg-brand-teal/5"
                : "border-amber-500/30 bg-amber-500/5"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between pb-2 border-b",
                bucket.code === "A" ? "border-brand-teal/20" : "border-amber-500/20"
              )}
            >
              <span
                className={cn(
                  "font-brand font-bold text-xs uppercase tracking-wide",
                  bucket.code === "A"
                    ? "text-brand-teal"
                    : "text-amber-700 dark:text-amber-400"
                )}
              >
                {bucket.title}
              </span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {question.options.map((opt) => {
                const inBucket = classifications[opt.id] === bucket.code;
                const expectedBucket = opt.data || (opt.isCorrect ? "A" : undefined);
                const reviewCorrect = isReview && expectedBucket === bucket.code;
                const reviewWrong = isReview && inBucket && expectedBucket && expectedBucket !== bucket.code;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleAssign(opt.id, bucket.code)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                      reviewCorrect
                        ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold"
                        : reviewWrong
                          ? "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-semibold"
                          : inBucket
                            ? bucket.code === "A"
                              ? "border-brand-teal bg-brand-teal text-white font-semibold shadow-xs"
                              : "border-amber-500 bg-amber-600 text-white font-semibold shadow-xs"
                            : "border-border bg-background hover:bg-surface-muted text-foreground-secondary"
                    )}
                  >
                    <RichQuestionContent content={opt.optionText} as="span" className="flex-1" />
                    <span className="text-[10px] shrink-0 flex items-center gap-1">
                      {reviewCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {reviewWrong && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {!isReview && (inBucket ? "Added" : "+ Add")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
