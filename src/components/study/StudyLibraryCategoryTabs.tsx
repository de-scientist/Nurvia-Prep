"use client";

import * as React from "react";
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
  { id: "med-surg", label: "Medical-Surgical Nursing" },
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

export const EXAM_BODIES = [
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
      <div className="flex flex-wrap items-center gap-2 sm:gap-3" role="group" aria-label="Examination library filters">
        {/* Filter by Exam Body alongside All Pathways */}
        <div className="w-full sm:w-48">
          <label htmlFor="filter-exam-body-select" className="sr-only">Filter by exam body</label>
          <select
            id="filter-exam-body-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {EXAM_BODIES.map((body) => (
              <option key={body.id} value={body.id}>
                {body.label}
              </option>
            ))}
          </select>
        </div>

        {/* All Pathways filter on the right */}
        <div className="w-full sm:w-44">
          <label htmlFor="filter-pathway-select" className="sr-only">All Pathways filter</label>
          <select
            id="filter-pathway-select"
            value={selectedPathway}
            onChange={(e) => onSelectPathway(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
          >
            {pathwayOptions.map((item) => (
              <option key={item} value={item}>
                {PATHWAY_LABELS[item] ?? item.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // Subject Discovery Library (/learner/library)
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3" role="group" aria-label="Subject library filters">
      {/* Filter by subject alongside All Pathways */}
      <div className="w-full sm:w-56">
        <label htmlFor="filter-subject-category-select" className="sr-only">Filter by subject</label>
        <select
          id="filter-subject-category-select"
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
        >
          {NURSING_SUBJECT_FILTERS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* All Pathways filter on the right */}
      <div className="w-full sm:w-44">
        <label htmlFor="filter-pathway-select" className="sr-only">All Pathways filter</label>
        <select
          id="filter-pathway-select"
          value={selectedPathway}
          onChange={(e) => onSelectPathway(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-teal"
        >
          {pathwayOptions.map((item) => (
            <option key={item} value={item}>
              {PATHWAY_LABELS[item] ?? item.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
