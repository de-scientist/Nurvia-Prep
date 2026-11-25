"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyLibrarySummaryDto } from "@/lib/api-types";
import { formatPathwayLabel } from "@/lib/study-library/curriculum-consolidation";

interface StudyLibraryHeaderProps {
  isPublic?: boolean;
  summary: StudyLibrarySummaryDto | null;
  selectedPathway?: string;
  selectedSubject?: string;
  searchSlot?: React.ReactNode;
  onBackToCatalogue?: () => void;
}

export function StudyLibraryHeader({
  isPublic = false,
  selectedPathway,
  selectedSubject,
  searchSlot,
  onBackToCatalogue,
}: StudyLibraryHeaderProps) {
  const isExamView = Boolean(selectedSubject);

  if (isExamView) {
    const pathwayDisplay =
      selectedPathway && selectedPathway !== "All"
        ? selectedPathway === "PN_LPN"
          ? "LPN"
          : selectedPathway === "PN_Exit"
            ? "LPN Exit"
            : selectedPathway === "RN_Exit"
              ? "RN Exit"
              : formatPathwayLabel(selectedPathway)
        : "All Pathways";

    return (
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-1 min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <button
              type="button"
              onClick={onBackToCatalogue}
              className="font-medium hover:text-brand-teal hover:underline flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-teal rounded-sm"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-brand-teal" />
              <span>Subject Catalogue</span>
            </button>
            <span>/</span>
            <span className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
              {selectedSubject}
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-brand text-xl sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
              {selectedSubject}
            </h1>
            {selectedPathway && selectedPathway !== "All" && (
              <span className="inline-flex items-center rounded-full bg-brand-teal/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-tealDark dark:text-teal-200">
                {pathwayDisplay}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-72 lg:w-80 shrink-0">
          {searchSlot && <div className="w-full">{searchSlot}</div>}
          {onBackToCatalogue && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToCatalogue}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg self-end hover:border-brand-teal/60 hover:text-brand-teal"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5 text-brand-teal" />
              Back to Subject Catalogue
            </Button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border pb-3">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">
          {isPublic ? "QuizNurse Study Catalogue" : "Learner Workspace"}
        </p>
        <h1 className="font-brand text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          Subject Library
        </h1>
        <p className="max-w-xl text-xs sm:text-sm text-foreground-secondary">
          Explore comprehensive subject sets, high-yield nursing practice, and clinical decision rationales.
        </p>
      </div>
      {searchSlot && (
        <div className="w-full md:w-72 lg:w-80 shrink-0">
          {searchSlot}
        </div>
      )}
    </header>
  );
}
