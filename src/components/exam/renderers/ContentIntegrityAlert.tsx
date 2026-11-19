"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

interface ContentIntegrityAlertProps {
  questionId: string;
  questionType?: string | number;
  message?: string;
}

/**
 * Surfaces an honest, non-fabricated content-integrity error when an authoritative
 * backend item lacks required selectable options, media, or matrix cells.
 */
export function ContentIntegrityAlert({
  questionId,
  questionType,
  message,
}: ContentIntegrityAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 p-4 text-xs text-amber-950 dark:text-amber-100 space-y-1.5"
    >
      <div className="flex items-center gap-2 font-bold">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Content Integrity Warning — Missing Interactive Data</span>
      </div>
      <p className="leading-relaxed text-amber-900/90 dark:text-amber-200/90">
        {message ||
          `Question ${questionId} (${String(questionType || "Unknown")}) did not include required selectable options or interactive data from the examination bank.`}
      </p>
      <p className="text-[11px] font-mono text-amber-800/80 dark:text-amber-300/80">
        Question ID: {questionId} · Type: {String(questionType || "Unknown")}
      </p>
    </div>
  );
}
