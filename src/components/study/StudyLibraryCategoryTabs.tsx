"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ExamCategory, NursingPathway } from "@/lib/api-types";

interface StudyLibraryCategoryTabsProps {
  selectedPathway: string;
  selectedCategory: string;
  availablePathways: NursingPathway[];
  availableCategories: ExamCategory[];
  onSelectPathway: (pathway: string) => void;
  onSelectCategory: (category: string) => void;
}

const PATHWAY_LABELS: Record<string, string> = {
  All: "All",
  RN: "RN Exams",
  PN_LPN: "LPN Exams",
  RN_Exit: "NCLEX",
  PN_Exit: "LPN Exit",
  NursingMath: "Dosage Calculations",
};

const CATEGORY_LABELS: Record<string, string> = {
  All: "All Categories",
  FUNDAMENTALS: "Fundamentals",
  "CORE SERIES": "Core Series",
  SPECIALTIES: "Specialties",
  "NURSING MATH": "Nursing Math",
  "EXIT EXAM": "Exit Exam",
  ATI: "ATI",
  HESI: "HESI",
  RegularCourse: "Regular Course",
  Certification: "Certification",
  ExitPredictor: "Exit Predictor",
};

export function StudyLibraryCategoryTabs({
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
    "NursingMath",
  ];

  const categoryOptions: string[] = [
    "All",
    "FUNDAMENTALS",
    "CORE SERIES",
    "SPECIALTIES",
    "NURSING MATH",
    "EXIT EXAM",
    "ATI",
    "HESI",
    "RegularCourse",
    "Certification",
  ];

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Program and examination track" className="flex flex-wrap gap-2">
        {pathwayOptions.map((item) => {
          const active = selectedPathway === item;
          return (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={active ? "primary" : "outline"}
              aria-pressed={active}
              onClick={() => onSelectPathway(item)}
              className="rounded-full"
            >
              {PATHWAY_LABELS[item] ?? item.replace("_", " ")}
            </Button>
          );
        })}
      </div>

      <div role="group" aria-label="Examination category" className="flex flex-wrap gap-1.5">
        {categoryOptions.map((item) => {
          const active = selectedCategory === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectCategory(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                active
                  ? "bg-brand-teal/15 text-brand-teal ring-1 ring-brand-teal/40"
                  : "bg-surface text-foreground-secondary hover:bg-surface-muted hover:text-foreground border border-border"
              }`}
            >
              {CATEGORY_LABELS[item] ?? item.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
