"use client";

import * as React from "react";
import { QuestionRendererProps, RendererOption } from "./types";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, CheckCircle2, GripVertical, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { isResponseAnswered, resolveNormalizedQuestionType } from "@/lib/attempts/strata-answer-adapter";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

function buildOrderedItems(options: RendererOption[], value?: string | null): RendererOption[] {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      const orderIds: string[] = Array.isArray(parsed)
        ? parsed.map(String)
        : Array.isArray(parsed?.OrderedOptionIds || parsed?.orderedOptionIds)
          ? (parsed.OrderedOptionIds || parsed.orderedOptionIds).map(String)
          : [];
      if (orderIds.length > 0) {
        const map = new Map(options.map((o) => [o.id, o]));
        const sorted = orderIds.map((id) => map.get(id)).filter(Boolean) as RendererOption[];
        const remaining = options.filter((o) => !orderIds.includes(o.id));
        if (sorted.length > 0) return [...sorted, ...remaining];
      }
    } catch {
      // Ignore malformed value
    }
  }
  return [...options];
}

export function OrderedResponseRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const { baseType } = resolveNormalizedQuestionType(question.questionType);
  const isNumberRanking = baseType === "orderingnumber";

  const [items, setItems] = React.useState<RendererOption[]>(() =>
    buildOrderedItems(question.options, value)
  );
  const dragIdxRef = React.useRef<number | null>(null);

  // Reset ordered items cleanly whenever question changes or persisted value updates
  React.useEffect(() => {
    setItems(buildOrderedItems(question.options, value));
  }, [question.id, question.options, value]);

  const orderingNumbers = React.useMemo<Record<string, string>>(() => {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && parsed.OrderingNumbers) {
        return parsed.OrderingNumbers as Record<string, string>;
      }
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.OrderedOptionIds)) {
        return Object.fromEntries(
          (parsed.OrderedOptionIds as string[]).map((id, i) => [id, String(i + 1)])
        );
      }
    } catch {
      // ignore
    }
    return {};
  }, [value]);

  const move = (fromIndex: number, toIndex: number) => {
    if (disabled || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setItems(updated);
    onChange?.(JSON.stringify({ OrderedOptionIds: updated.map((i) => i.id) }));
  };

  const setRank = (optionId: string, rank: string) => {
    if (disabled) return;
    const next = { ...orderingNumbers, [optionId]: rank };
    onChange?.(JSON.stringify({ OrderingNumbers: next }));
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

  const expectedOrderIds =
    question.correctAnswerMeta?.correctOrderIds && question.correctAnswerMeta.correctOrderIds.length > 0
      ? question.correctAnswerMeta.correctOrderIds
      : question.options.map((o) => o.id);

  if (isNumberRanking) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-foreground-secondary">
          Assign each clinical step its numerical sequence rank (1 = first step):
        </div>

        <div className="space-y-2.5">
          {question.options.map((opt) => {
            const selectedRank = orderingNumbers[opt.id] || "";
            const expectedIdx = expectedOrderIds.indexOf(opt.id);
            const expectedRank = expectedIdx >= 0 ? String(expectedIdx + 1) : "";
            const isCorrectPos = isReview && expectedRank !== "" && selectedRank === expectedRank;
            const isWrongPos = isReview && expectedRank !== "" && selectedRank !== "" && !isCorrectPos;

            return (
              <div
                key={opt.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3.5 rounded-xl border bg-background transition-all",
                  isReview
                    ? isCorrectPos
                      ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30"
                      : isWrongPos
                        ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/30"
                        : "border-border"
                    : "border-border"
                )}
              >
                <div className="flex-1 text-sm text-foreground">
                  <RichQuestionContent content={opt.optionText} />
                  {isReview && expectedRank && (
                    <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Expected Position: #{expectedRank}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    disabled={disabled}
                    value={selectedRank}
                    onChange={(e) => setRank(opt.id, e.target.value)}
                    aria-label={`Rank for ${opt.optionText}`}
                    className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-foreground focus:outline-brand-teal"
                  >
                    <option value="">Rank...</option>
                    {question.options.map((_, rIdx) => (
                      <option key={rIdx + 1} value={String(rIdx + 1)}>
                        #{rIdx + 1}
                      </option>
                    ))}
                  </select>
                  {isReview && isCorrectPos && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Correct
                    </span>
                  )}
                  {isReview && isWrongPos && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      Incorrect
                    </span>
                  )}
                  {isReview && !selectedRank && (
                    <span className="text-[11px] font-medium text-foreground-muted italic">
                      Unanswered
                    </span>
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

  const hasSubmittedOrder = isResponseAnswered(value);

  return (
    <div className="space-y-4">
      <div className="text-xs text-foreground-secondary">
        Drag items or use the Up / Down controls to arrange steps in the correct priority sequence (1 = first):
      </div>

      {isReview && !hasSubmittedOrder && (
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Your Submitted Answer: Unanswered
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((item, index) => {
          const expectedIndex = expectedOrderIds.indexOf(item.id);
          const isPositionCorrect = isReview && hasSubmittedOrder && expectedIndex === index;
          const isPositionWrong = isReview && hasSubmittedOrder && expectedIndex >= 0 && expectedIndex !== index;

          return (
            <div
              key={item.id}
              draggable={!disabled}
              onDragStart={() => {
                dragIdxRef.current = index;
              }}
              onDragOver={(e) => {
                if (!disabled) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdxRef.current !== null) {
                  move(dragIdxRef.current, index);
                  dragIdxRef.current = null;
                }
              }}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border bg-background transition-all",
                !disabled && "cursor-grab active:cursor-grabbing hover:border-brand-teal/50",
                isReview
                  ? isPositionCorrect
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30"
                    : isPositionWrong
                      ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/30"
                      : "border-border"
                  : "border-border shadow-2xs"
              )}
            >
              {!disabled && (
                <GripVertical className="w-4 h-4 text-foreground-muted shrink-0" aria-hidden="true" />
              )}
              <span className="w-8 h-8 rounded-lg bg-brand-teal/10 text-brand-teal font-brand font-bold text-sm flex items-center justify-center shrink-0">
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                <RichQuestionContent
                  content={item.optionText}
                  className="text-sm text-foreground leading-relaxed"
                />
                {isReview && expectedIndex >= 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Correct position: #{expectedIndex + 1}
                  </p>
                )}
              </div>

              {isReview && (
                <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold">
                  {isPositionCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Correct Position
                    </span>
                  ) : isPositionWrong ? (
                    <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      Incorrect Position
                    </span>
                  ) : null}
                </span>
              )}

              {!disabled && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
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
