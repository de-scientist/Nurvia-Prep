"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Image as ImageIcon, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function MultipleImageSelectionRenderer({
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
        const list =
          parsed.SelectedMediaIds ??
          parsed.SelectedOptionIds ??
          parsed.selectedOptionIds;
        if (Array.isArray(list)) {
          return list.map(String);
        }
        if (typeof parsed.SelectedOptionId === "string") return [parsed.SelectedOptionId];
        if (typeof parsed.selectedOptionId === "string") return [parsed.selectedOptionId];
        return [];
      }
      if (value.startsWith("[")) {
        return (JSON.parse(value) as unknown[]).map(String);
      }
      const bare = value.replace(/^"(.*)"$/, "$1");
      return bare ? [bare] : [];
    } catch {
      return [];
    }
  }, [value]);

  const mediaItems = question.media ?? [];
  const hasMediaCards = mediaItems.length > 0 && question.options.length === 0;

  const handleToggle = (id: string) => {
    if (disabled) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id];
    if (hasMediaCards) {
      onChange?.(JSON.stringify({ SelectedMediaIds: next }));
    } else {
      onChange?.(JSON.stringify({ SelectedOptionIds: next }));
    }
  };

  if (question.contentIntegrityError || (question.options.length === 0 && mediaItems.length === 0)) {
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
        Examine each clinical image panel below and select all that apply:
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {hasMediaCards
          ? mediaItems.map((media, idx) => {
              const mediaId = String(media.numericId ?? media.id);
              const isSelected =
                selectedIds.includes(media.id) || selectedIds.includes(mediaId);
              const isCorrect =
                question.correctAnswerMeta?.correctMediaIds?.includes(mediaId) ||
                question.correctAnswerMeta?.correctMediaIds?.includes(media.id) ||
                false;
              const imgUrl = normalizeMediaUrl(media.thumbnailUrl || media.url) || media.url;

              let cardClass = "border-border bg-background hover:bg-surface-muted";
              if (isSelected) cardClass = "border-brand-teal bg-brand-teal/10 ring-2 ring-brand-teal";
              if (isReview) {
                if (isCorrect) {
                  cardClass =
                    "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 ring-2 ring-emerald-500";
                } else if (isSelected && !isCorrect) {
                  cardClass =
                    "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 ring-2 ring-rose-500";
                }
              }

              return (
                <button
                  key={media.id || idx}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => handleToggle(mediaId)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all space-y-3 flex flex-col justify-between",
                    disabled && "cursor-default",
                    cardClass
                  )}
                >
                  <div className="w-full h-44 rounded-lg bg-surface-muted border border-border flex items-center justify-center relative overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={media.description || `Panel ${String.fromCharCode(65 + idx)}`}
                        className="h-full w-full object-contain bg-white"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-brand-teal/40" />
                    )}
                    <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-surface">
                      Panel {String.fromCharCode(65 + idx)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs w-full gap-2">
                    <span className="font-medium text-foreground">
                      {media.description || `Exhibit Panel ${String.fromCharCode(65 + idx)}`}
                    </span>
                    {isReview && (
                      <span className="shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isSelected ? (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        ) : null}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          : question.options.map((opt, idx) => {
              const isSelected = selectedIds.includes(opt.id) || opt.wasSelected === true;
              const linkedMedia = mediaItems[idx];
              const optImg = normalizeMediaUrl(
                linkedMedia?.thumbnailUrl || linkedMedia?.url || opt.link
              );

              let cardClass = "border-border bg-background hover:bg-surface-muted";
              if (isSelected) cardClass = "border-brand-teal bg-brand-teal/10 ring-2 ring-brand-teal";
              if (isReview) {
                if (opt.isCorrect) {
                  cardClass =
                    "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 ring-2 ring-emerald-500";
                } else if (isSelected && !opt.isCorrect) {
                  cardClass =
                    "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 ring-2 ring-rose-500";
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => handleToggle(opt.id)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all space-y-3 flex flex-col justify-between",
                    disabled && "cursor-default",
                    cardClass
                  )}
                >
                  <div className="w-full h-36 rounded-lg bg-surface-muted border border-border flex items-center justify-center relative overflow-hidden">
                    {optImg ? (
                      <img
                        src={optImg}
                        alt={`Panel ${String.fromCharCode(65 + idx)}`}
                        className="h-full w-full object-contain bg-white"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-brand-teal/40" />
                    )}
                    <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-surface">
                      Panel {String.fromCharCode(65 + idx)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs w-full gap-2">
                    <RichQuestionContent content={opt.optionText} as="span" className="font-medium text-foreground flex-1" />
                    {isReview && (
                      <span className="shrink-0">
                        {opt.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isSelected ? (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        ) : null}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
