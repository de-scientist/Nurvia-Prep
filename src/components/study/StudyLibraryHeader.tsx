"use client";

import * as React from "react";
import { BookOpen, HelpCircle, Layers } from "lucide-react";
import type { StudyLibrarySummaryDto } from "@/lib/api-types";
import { formatPathwayLabel } from "@/lib/study-library/curriculum-consolidation";

interface StudyLibraryHeaderProps {
  isPublic?: boolean;
  summary: StudyLibrarySummaryDto | null;
  selectedPathway?: string;
  selectedSubject?: string;
}

export function StudyLibraryHeader({ isPublic = false, summary, selectedPathway, selectedSubject }: StudyLibraryHeaderProps) {
  const isExamView = Boolean(selectedSubject || (selectedPathway && selectedPathway !== "All"));

  if (isExamView) {
    const pathwayDisplay =
      selectedPathway && selectedPathway !== "All"
        ? (selectedPathway === "PN_LPN" ? "PN / LPN" : formatPathwayLabel(selectedPathway))
        : "All Pathways";

    return (
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-brand-teal/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-tealDark dark:text-teal-200">
            Pathway: {pathwayDisplay}
          </span>
          {selectedSubject && (
            <span className="inline-flex items-center rounded-full bg-surface-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground-secondary">
              Subject: {selectedSubject}
            </span>
          )}
        </div>
        <h1 className="font-brand text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {selectedSubject || "Practice Examinations"}
        </h1>
      </header>
    );
  }

  return (
    <header className="flex flex-col gap-2 border-b border-border pb-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">
          {isPublic ? "NURVIA Study Catalogue" : "Learner Workspace"}
        </p>
        <h1 className="font-brand text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Subject Library
        </h1>
        <p className="max-w-2xl text-sm text-foreground-secondary">
          Explore comprehensive subject sets, high-yield nursing practice, and clinical decision rationales.
        </p>
      </div>
    </header>
  );
}
