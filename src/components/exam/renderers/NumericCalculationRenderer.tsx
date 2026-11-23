"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function NumericCalculationRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const currentNum = React.useMemo(() => {
    if (!value) return "";
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return String(
          parsed.NumericResponse ?? parsed.numericResponse ?? parsed.NumericValue ?? parsed.value ?? ""
        );
      }
      return value.replace(/^"(.*)"$/, "$1");
    } catch {
      return value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(JSON.stringify({ NumericResponse: e.target.value }));
  };

  const correctOption = question.options.find((o) => o.isCorrect);
  const expectedTarget =
    question.correctAnswerMeta?.expectedNumeric || correctOption?.optionText || "";

  const isMatched = React.useMemo(() => {
    if (!currentNum.trim() || !expectedTarget.trim()) return false;
    const nUser = Number(currentNum.trim());
    const nExp = Number(expectedTarget.trim());
    if (Number.isFinite(nUser) && Number.isFinite(nExp)) {
      return Math.abs(nUser - nExp) <= 0.01;
    }
    return currentNum.trim().toLowerCase() === expectedTarget.trim().toLowerCase();
  }, [currentNum, expectedTarget]);

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-4">
        <div className="flex items-center gap-2 text-xs text-foreground-secondary bg-surface-muted border border-border p-3 rounded-xl">
          <Info className="w-4 h-4 text-brand-teal shrink-0" />
          <span>
            Enter numbers only. Do not include units in the input box unless prompted.
          </span>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`numeric-${question.id}`}
            className="text-xs font-semibold text-foreground-secondary flex items-center justify-between"
          >
            <span>Calculated Dosage / Value:</span>
            <Badge variant="outline" className="text-[10px] font-mono">Precision: ±0.01</Badge>
          </label>
          <div className="relative">
            <Input
              id={`numeric-${question.id}`}
              type="number"
              step="any"
              value={currentNum}
              onChange={handleChange}
              disabled={disabled}
              placeholder={isReview ? "No value submitted" : "e.g. 25.5"}
              className={cn(
                "h-12 text-lg font-mono font-bold pr-14",
                isReview &&
                  currentNum.trim() &&
                  (isMatched
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                    : "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30")
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted text-xs font-semibold">
              Value
            </div>
          </div>
          {isReview && (
            <div className="text-xs font-semibold">
              {!currentNum.trim() ? (
                <span className="text-foreground-secondary font-medium">
                  Your Submitted Answer: <span className="italic">Unanswered</span>
                </span>
              ) : isMatched || question.isCorrect === true ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  Your Answer ({currentNum.trim()}) · Correct
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <XCircle className="w-4 h-4" />
                  Your Answer ({currentNum.trim()}) · Incorrect
                </span>
              )}
            </div>
          )}
        </div>

        {isReview && expectedTarget && (
          <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Expected Calculation:</span>
              <span className="font-mono text-base font-bold text-foreground">
                {expectedTarget}
              </span>
            </div>
            {correctOption?.specificRationale && (
              <RichQuestionContent content={correctOption.specificRationale} className="text-foreground-secondary pt-1 leading-relaxed" />
            )}
          </div>
        )}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
