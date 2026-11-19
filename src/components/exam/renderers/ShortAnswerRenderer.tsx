"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function ShortAnswerRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const currentText = React.useMemo(() => {
    if (!value) return "";
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return String(
          parsed.TextResponse ??
            parsed.textResponse ??
            parsed.value ??
            parsed.ShortAnswer ??
            parsed.shortAnswer ??
            ""
        );
      }
      return value.replace(/^"(.*)"$/, "$1");
    } catch {
      return "";
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(JSON.stringify({ TextResponse: e.target.value }));
  };

  const correctOption = question.options.find((o) => o.isCorrect);
  const expectedText =
    question.correctAnswerMeta?.modelAnswerHtml || correctOption?.optionText || "";

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-2">
        <label className="text-xs font-semibold text-foreground-secondary">
          Clinical Answer (Term, Dose, or Specific Finding):
        </label>
        <Input
          type="text"
          value={currentText}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Enter clinical answer..."
          className="h-12 text-sm font-semibold"
        />
      </div>

      {isReview && expectedText && (
        <div className="max-w-xl p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>Target Response:</span>
            <span className="font-mono text-sm text-foreground bg-surface px-2 py-0.5 rounded border border-border">
              <RichQuestionContent content={expectedText} as="span" />
            </span>
          </div>
          {correctOption?.specificRationale && (
            <RichQuestionContent content={correctOption.specificRationale} className="text-foreground-secondary mt-1" />
          )}
        </div>
      )}

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
