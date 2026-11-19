"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function MultipleTrueFalseRenderer({
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
        return (parsed.TrueFalseMap || parsed.trueFalseMap || {}) as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }, [value]);

  const handleSelect = (optId: string, choice: "True" | "False") => {
    if (disabled) return;
    const updated = { ...selections, [optId]: choice };
    onChange?.(JSON.stringify({ TrueFalseMap: updated }));
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
      <div className="text-xs text-foreground-secondary">
        Evaluate each clinical statement below and determine whether it is True or False:
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-background">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-muted border-b border-border text-foreground font-semibold">
              <th className="p-3 text-left w-3/4">Clinical Statement / Assessment Finding</th>
              <th className="p-3 text-center w-24">True</th>
              <th className="p-3 text-center w-24">False</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {question.options.map((opt) => {
              const selectedVal = selections[opt.id] || "";
              const expected = opt.isCorrect ? "True" : "False";
              const isRowCorrect = isReview && selectedVal === expected;
              const isRowWrong = isReview && selectedVal !== "" && selectedVal !== expected;

              return (
                <tr
                  key={opt.id}
                  className={cn(
                    "transition-colors",
                    isReview
                      ? isRowCorrect
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                        : isRowWrong
                          ? "bg-rose-50/70 dark:bg-rose-950/30"
                          : ""
                      : "hover:bg-surface-muted/50"
                  )}
                >
                  <td className="p-3 text-foreground font-medium">
                    <RichQuestionContent content={opt.optionText} />
                    {isReview && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold">
                        {isRowWrong ? (
                          <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Correct answer: {expected}
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct: {expected}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="radio"
                      name={`mtf-${opt.id}`}
                      aria-label={`${opt.optionText} — True`}
                      disabled={disabled}
                      checked={selectedVal === "True"}
                      onChange={() => handleSelect(opt.id, "True")}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="radio"
                      name={`mtf-${opt.id}`}
                      aria-label={`${opt.optionText} — False`}
                      disabled={disabled}
                      checked={selectedVal === "False"}
                      onChange={() => handleSelect(opt.id, "False")}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
