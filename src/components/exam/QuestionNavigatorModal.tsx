"use client";

import * as React from "react";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavigatorQuestionItem {
  id: string;
  orderIndex?: number;
  isAnswered: boolean;
  isFlagged: boolean;
}

interface QuestionNavigatorModalProps {
  open: boolean;
  onClose: () => void;
  questions: NavigatorQuestionItem[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export function QuestionNavigatorModal({
  open,
  onClose,
  questions,
  currentIndex,
  onSelectIndex,
}: QuestionNavigatorModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const answeredCount = questions.filter((q) => q.isAnswered).length;
  const flaggedCount = questions.filter((q) => q.isFlagged).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-navigator-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="question-navigator-title" className="font-brand text-lg font-bold text-foreground">
              Examination Navigator
            </h2>
            <p className="text-xs text-foreground-secondary mt-0.5">
              {answeredCount} answered · {unansweredCount} unanswered · {flaggedCount} flagged
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close question navigator">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-foreground-secondary pb-2 border-b border-border">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-teal inline-block" /> Current
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 inline-block" />{" "}
            Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-border bg-background inline-block" />{" "}
            Unanswered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" /> Flagged
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 overflow-y-auto py-1 pr-1">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const statusText = [
              isCurrent ? "Current" : null,
              q.isAnswered ? "Answered" : "Unanswered",
              q.isFlagged ? "Flagged" : null,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  onSelectIndex(idx);
                  onClose();
                }}
                aria-label={`Question ${idx + 1} (${statusText})`}
                className={cn(
                  "relative h-10 rounded-lg border text-xs font-bold transition-all flex items-center justify-center",
                  isCurrent
                    ? "bg-brand-teal text-white border-brand-teal ring-2 ring-brand-teal/30"
                    : q.isAnswered
                      ? "border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                      : "border-border bg-background text-foreground-secondary hover:bg-surface-muted"
                )}
              >
                {idx + 1}
                {q.isFlagged && (
                  <Bookmark
                    className="w-2.5 h-2.5 text-amber-500 fill-amber-500 absolute -top-1 -right-1"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
