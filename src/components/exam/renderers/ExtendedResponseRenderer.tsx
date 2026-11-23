"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function ExtendedResponseRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const essayText = React.useMemo(() => {
    if (!value) return "";
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return String(
          parsed.EssayResponse || parsed.essayResponse || parsed.TextResponse || parsed.value || ""
        );
      }
      return value.replace(/^"(.*)"$/, "$1");
    } catch {
      return value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    onChange?.(JSON.stringify({ EssayResponse: e.target.value }));
  };

  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-foreground-secondary">
        <span>Provide your structured clinical response:</span>
        <Badge variant="outline" className="text-[10px] font-mono">
          {wordCount} words
        </Badge>
      </div>

      <div className="space-y-2">
        <label htmlFor={`extended-${question.id}`} className="sr-only">
          Structured clinical response
        </label>
        <textarea
          id={`extended-${question.id}`}
          rows={6}
          disabled={disabled}
          value={essayText}
          onChange={handleChange}
          placeholder={isReview ? "No written response submitted" : "Document your clinical assessment, prioritization, and rationale..."}
          className="w-full p-4 rounded-xl border border-border bg-background text-sm leading-relaxed focus:outline-brand-teal focus:ring-1 focus:ring-brand-teal text-foreground"
        />
        {isReview && !essayText.trim() && (
          <div className="text-xs font-medium text-foreground-secondary">
            Your Submitted Response: <span className="italic">Unanswered</span>
          </div>
        )}
        {isReview && essayText.trim() && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>Your Written Clinical Response Was Recorded ({wordCount} words)</span>
          </div>
        )}
      </div>

      {isReview &&
        (question.correctAnswerMeta?.modelAnswerHtml ||
          question.options.find((o) => o.isCorrect)?.optionText) && (
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-1.5">
            <div className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Model Clinical Response / Authoritative Key:</span>
            </div>
            <RichQuestionContent
              content={
                question.correctAnswerMeta?.modelAnswerHtml ||
                question.options.find((o) => o.isCorrect)?.optionText ||
                ""
              }
              className="text-foreground leading-relaxed"
            />
          </div>
        )}

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
