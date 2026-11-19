"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { Badge } from "@/components/ui/badge";
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
        <textarea
          rows={6}
          disabled={disabled}
          value={essayText}
          onChange={handleChange}
          placeholder="Document your clinical assessment, prioritization, and rationale..."
          className="w-full p-4 rounded-xl border border-border bg-background text-sm leading-relaxed focus:outline-brand-teal focus:ring-1 focus:ring-brand-teal text-foreground"
        />
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} />
      )}
    </div>
  );
}
