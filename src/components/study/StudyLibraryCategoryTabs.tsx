"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ExamCategory, NursingPathway } from "@/lib/api-types";

interface StudyLibraryCategoryTabsProps {
  isExamView?: boolean;
  selectedPathway: string;
  selectedCategory: string;
  availablePathways?: NursingPathway[];
  availableCategories?: ExamCategory[];
  onSelectPathway: (pathway: string) => void;
  onSelectCategory: (category: string) => void;
}

const PATHWAY_LABELS: Record<string, string> = {
  All: "All Pathways",
  RN: "RN",
  PN_LPN: "LPN / PN",
  RN_Exit: "RN Exit",
  PN_Exit: "LPN Exit",
};

export const NURSING_SUBJECT_FILTERS = [
  { id: "All", label: "All Subjects" },
  { id: "med-surg", label: "Med-Surg" },
  { id: "pediatrics", label: "Pediatrics" },
  { id: "mental health", label: "Mental Health" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "pharmacology", label: "Pharmacology" },
  { id: "leadership", label: "Leadership" },
  { id: "adult health", label: "Adult Health" },
  { id: "health assessment", label: "Health Assessment" },
  { id: "maternal & newborn", label: "Maternal & Newborn" },
  { id: "other", label: "Other" },
] as const;

const EXAM_BODIES = [
  { id: "All", label: "All Exam Bodies" },
  { id: "ATI", label: "ATI" },
  { id: "HESI", label: "HESI" },
  { id: "RegularCourse", label: "Course Curriculum" },
  { id: "ExitPredictor", label: "Exit Predictor" },
] as const;

export function StudyLibraryCategoryTabs({
  isExamView = false,
  selectedPathway,
  selectedCategory,
  onSelectPathway,
  onSelectCategory,
}: StudyLibraryCategoryTabsProps) {
  const pathwayOptions: string[] = [
    "All",
    "RN",
    "PN_LPN",
    "RN_Exit",
    "PN_Exit",
  ];

  if (isExamView) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-1" role="group" aria-label="Examination filters">
        <div className="w-full sm:w-56">
          <label htmlFor="filter-pathway-select" className="sr-only">Pathway filter</label>
          <select
            id="filter-pathway-select"
            value={selectedPathway}
            onChange={(e) => onSelectPathway(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {pathwayOptions.map((item) => (
              <option key={item} value={item}>
                {PATHWAY_LABELS[item] ?? item.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-56">
          <label htmlFor="filter-exam-body-select" className="sr-only">Exam body filter</label>
          <select
            id="filter-exam-body-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {EXAM_BODIES.map((body) => (
              <option key={body.id} value={body.id}>
                {body.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Nursing subject filters" className="flex flex-wrap gap-1.5">
        {NURSING_SUBJECT_FILTERS.map((item) => {
          const active = selectedCategory === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectCategory(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                active
                  ? "bg-brand-teal text-white shadow-2xs"
                  : "bg-surface text-foreground-secondary hover:bg-surface-muted hover:text-foreground border border-border"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
