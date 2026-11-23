"use client";

import * as React from "react";
import { AlertTriangle, Bookmark, CheckCircle2, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitConfirmationModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  examTitle: string;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
  failedSaveCount?: number;
  isSubmitting?: boolean;
  isLoading?: boolean;
  submissionError?: string | null;
  isTutorPractice?: boolean;
}

export function SubmitConfirmationModal({
  open,
  onCancel,
  onConfirm,
  examTitle,
  totalQuestions,
  answeredCount,
  flaggedCount,
  failedSaveCount = 0,
  isSubmitting = false,
  isLoading = false,
  submissionError = null,
  isTutorPractice = false,
}: SubmitConfirmationModalProps) {
  const busy = Boolean(isSubmitting || isLoading);
  React.useEffect(() => {
    if (!open || busy) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-exam-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5"
      >
        <div className="space-y-1.5">
          <h2 id="submit-exam-modal-title" className="font-brand text-lg font-bold text-foreground">
            {isTutorPractice ? "Finish Practice & View Score Summary?" : "Submit Final Examination?"}
          </h2>
          <p className="text-xs text-foreground-secondary leading-relaxed">
            You are about to submit <strong>{examTitle}</strong> for official grading. Once submitted,
            your answers become read-only.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 p-3">
            <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold text-base">
              <CheckCircle2 className="w-4 h-4" />
              {answeredCount}
            </div>
            <div className="text-[11px] text-foreground-secondary">Answered</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/60 p-3">
            <div className="font-bold text-base text-foreground">{unansweredCount}</div>
            <div className="text-[11px] text-foreground-secondary">Unanswered</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-3">
            <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-300 font-bold text-base">
              <Bookmark className="w-4 h-4" />
              {flaggedCount}
            </div>
            <div className="text-[11px] text-foreground-secondary">Flagged</div>
          </div>
        </div>

        {unansweredCount > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              You still have <strong>{unansweredCount}</strong> unanswered item
              {unansweredCount === 1 ? "" : "s"}. Unanswered questions receive 0 points.
            </span>
          </div>
        )}

        {failedSaveCount > 0 && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-3 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-100">
            <FileWarning className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              {failedSaveCount} item save{failedSaveCount === 1 ? "" : "s"} had pending network retries.
              Confirming will attempt a final flush before submission.
            </span>
          </div>
        )}

        {submissionError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Submission could not be completed</p>
              <p>{submissionError}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Return to Assessment
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Grading Submission...
              </>
            ) : (
              "Confirm & Submit Examination"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
