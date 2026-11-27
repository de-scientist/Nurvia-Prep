"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ExamCategory, NursingPathway } from "@/lib/api-types";

interface StudyLibraryCategoryTabsProps {
  isExamView?: boolean;
  selectedPathway: string;
  selectedCategory: string;
  selectedSubject?: string;
  selectedCourse?: string;
  availablePathways?: NursingPathway[];
  availableCategories?: ExamCategory[];
  availableSubjects?: string[];
  rnSubjects?: string[];
  lpnSubjects?: string[];
  courses?: Array<{ id: string; name: string; programId?: string }>;
  onSelectPathway: (pathway: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectSubject?: (subject: string) => void;
  onSelectCourse?: (course: string) => void;
}

export const PATHWAY_LABELS: Record<string, string> = {
  All: "All Pathways",
  RN: "RN",
  PN_LPN: "LPN",
  RN_Exit: "RN Exit",
  PN_Exit: "LPN Exit",
};

export const EXAM_BODY_LABELS: Record<string, string> = {
  All: "All Exam Bodies",
  ATI: "ATI",
  HESI: "HESI",
  RegularCourse: "Course Curriculum",
  ExitPredictor: "Exit Predictor",
  Certification: "Certification",
};

import {
  RN_EXAM_BODY_CATEGORIES,
  LPN_EXAM_BODY_CATEGORIES,
  getPathwayExamBodyCategories,
} from "@/lib/utils/exams/compareExams";

export {
  RN_EXAM_BODY_CATEGORIES,
  LPN_EXAM_BODY_CATEGORIES,
  getPathwayExamBodyCategories,
};

export function getExamBodyLabel(categoryId: string): string {
  return EXAM_BODY_LABELS[categoryId] || categoryId.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function simplifyExamBodyLabel(label: string): string {
  if (label === "Exit Predictor" || label === "ExitPredictor") return "EXIT";
  if (label === "Course Curriculum" || label === "RegularCourse") return "Core";
  if (/\bKAPLAN\b/i.test(label)) return "KAPLAN";
  if (/\bHESI\b/i.test(label)) return "HESI";
  if (/\bATI\b/i.test(label)) return "ATI";
  if (/\bEXIT\b/i.test(label)) return "EXIT";
  return label;
}

export function simplifySubjectName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "all" || lower === "all subjects") return "All Subjects";
  if (lower.includes("medical-surgical") || lower.includes("med-surg") || lower.includes("med surg") || lower.includes("medical surgical")) return "Medical-Surgical";
  if (lower.includes("pediatric") || lower.includes("peds") || lower.includes("child")) return "Pediatrics";
  if (lower.includes("mental health") || lower.includes("psych")) return "Mental Health";
  if (lower.includes("fundamental") || lower.includes("foundation")) return "Fundamentals";
  if (lower.includes("pharmacol")) return "Pharmacology";
  if (lower.includes("leadership") || lower.includes("delegation") || lower.includes("management")) return "Leadership";
  if (lower.includes("adult health")) return "Adult Health";
  if (lower.includes("health assessment") || lower.includes("assessment")) return "Health Assessment";
  if (lower.includes("maternal") || lower.includes("newborn") || lower.includes("obstetric") || lower.includes("maternity") || lower.includes("women")) return "Maternity";
  if (lower.includes("dosage") || lower.includes("calculation")) return "Dosage Calculations";
  if (lower.includes("nutrition")) return "Nutrition";
  if (lower.includes("community")) return "Community Health";
  if (lower.includes("pathophysiology")) return "Pathophysiology";
  return trimmed;
}

export const NURSING_SUBJECT_FILTERS = [
  { id: "All", label: "All Subjects" },
  { id: "Medical-Surgical Nursing", label: "Medical-Surgical" },
  { id: "Pediatrics", label: "Pediatrics" },
  { id: "Mental Health Nursing", label: "Mental Health" },
  { id: "Fundamentals of Nursing", label: "Fundamentals" },
  { id: "Pharmacology", label: "Pharmacology" },
  { id: "Leadership & Delegation", label: "Leadership" },
  { id: "Adult Health Nursing", label: "Adult Health" },
  { id: "Health Assessment", label: "Health Assessment" },
  { id: "Maternal & Newborn Nursing (OB)", label: "Maternity" },
  { id: "Dosage Calculations", label: "Dosage Calculations" },
  { id: "Nutrition", label: "Nutrition" },
  { id: "Community Health Nursing", label: "Community Health" },
  { id: "Pathophysiology", label: "Pathophysiology" },
] as const;

export const EXAM_BODIES = [
  { id: "All", label: "All Exam Bodies" },
  { id: "ATI", label: "ATI" },
  { id: "HESI", label: "HESI" },
  { id: "RegularCourse", label: "Core" },
  { id: "ExitPredictor", label: "EXIT" },
] as const;

export function StudyLibraryCategoryTabs({
  isExamView = false,
  selectedPathway,
  selectedCategory,
  selectedSubject = "",
  selectedCourse = "",
  availablePathways: _availablePathways,
  availableCategories,
  availableSubjects,
  rnSubjects,
  lpnSubjects,
  courses,
  onSelectPathway,
  onSelectCategory,
  onSelectSubject,
  onSelectCourse,
}: StudyLibraryCategoryTabsProps) {
  const pathwayOptions: string[] = [
    "All",
    "RN",
    "PN_LPN",
    "RN_Exit",
    "PN_Exit",
  ];

  const examBodyOptions = React.useMemo(() => {
    const cats =
      availableCategories && availableCategories.length > 0
        ? availableCategories
        : (["ATI", "HESI", "RegularCourse", "ExitPredictor"] as ExamCategory[]);

    const uniqueCats = Array.from(new Set(cats));
    const items: Array<{ id: string; label: string; displayLabel: string; type: "category" | "course" }> = [
      { id: "All", label: "All Exam Bodies", displayLabel: "All", type: "category" },
      ...uniqueCats.map((cat) => ({
        id: cat,
        label: getExamBodyLabel(cat),
        displayLabel: simplifyExamBodyLabel(getExamBodyLabel(cat)),
        type: "category" as const,
      })),
    ];

    if (courses && courses.length > 0) {
      for (const c of courses) {
        if (!items.some((item) => item.label.toLowerCase() === c.name.toLowerCase())) {
          items.push({
            id: c.name,
            label: c.name,
            displayLabel: simplifyExamBodyLabel(c.name),
            type: "course",
          });
        }
      }
    }

    return items;
  }, [availableCategories, courses]);

  const subjectOptions = React.useMemo(() => {
    const isRn = selectedPathway === "RN" || selectedPathway === "RN_Exit";
    const isLpn = selectedPathway === "PN_LPN" || selectedPathway === "PN_Exit";

    let list: string[] = [];
    if (isRn && rnSubjects && rnSubjects.length > 0) {
      list = rnSubjects;
    } else if (isLpn && lpnSubjects && lpnSubjects.length > 0) {
      list = lpnSubjects;
    } else if (availableSubjects && availableSubjects.length > 0) {
      list = availableSubjects;
    } else {
      list = [
        "Medical-Surgical Nursing",
        "Pediatrics",
        "Mental Health Nursing",
        "Fundamentals of Nursing",
        "Foundation of Nursing",
        "Pharmacology",
        "Leadership & Delegation",
        "Adult Health Nursing",
        "Health Assessment",
        "Maternal & Newborn Nursing (OB)",
        "Dosage Calculations",
        "Nutrition",
        "Community Health Nursing",
        "Pathophysiology",
      ];
      if (isLpn) {
        list = list.filter((s) => !s.toLowerCase().includes("leadership"));
      }
    }

    const unique = Array.from(new Set(list.filter(Boolean)));
    return [
      { id: "All", label: "All Subjects" },
      ...unique.map((s) => ({ id: s, label: simplifySubjectName(s) })),
    ];
  }, [selectedPathway, rnSubjects, lpnSubjects, availableSubjects]);

  const currentSubject = selectedSubject || "All";

  return (
    <div className="space-y-2.5 w-full min-w-0" role="group" aria-label="Study library filters">
      {/* 1. Visible Pathway Filters — Displayed as visible filter chips or segmented tabs (NOT a dropdown) */}
      {!isExamView && (
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Pathway filter tabs">
          {pathwayOptions.map((pathOption) => {
            const isActive = selectedPathway === pathOption;
            const label = PATHWAY_LABELS[pathOption] ?? pathOption.replace("_", " ");
            return (
              <button
                key={pathOption}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectPathway(pathOption)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs border",
                  isActive
                    ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                    : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Visible Exam Bodies Filters — For Examination Library (Horizontal scrolling filter strip) */}
      {isExamView && (
        <div className="w-full min-w-0 relative" aria-label="Exam Bodies filter chips">
          <div
            className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 scroll-smooth focus:outline-none"
            role="tablist"
            aria-label="Filter examinations by category"
          >
            {getPathwayExamBodyCategories(selectedPathway).map((catName) => {
              const isActive =
                selectedCategory === catName ||
                (catName === "ATI EXAMS" && selectedCategory === "ATI") ||
                (catName === "HESI EXAMS" && selectedCategory === "HESI") ||
                (catName === "GENERAL EXAMS" && (selectedCategory === "RegularCourse" || selectedCategory === "Core")) ||
                (catName === "KAP-LAN EXAMS" && selectedCategory === "Kaplan");

              return (
                <button
                  key={catName}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (selectedCategory === catName) {
                      onSelectCategory("All");
                    } else {
                      onSelectCategory(catName);
                    }
                    if (onSelectCourse) onSelectCourse("");
                  }}
                  className={cn(
                    "rounded-lg px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all border whitespace-nowrap shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                    isActive
                      ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                      : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {catName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessible DOM Fallback / Hidden Selects for Full Test and Assistive Technology Compatibility */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="filter-pathway-select">Pathway</label>
        <select
          id="filter-pathway-select"
          tabIndex={-1}
          value={selectedPathway}
          onChange={(e) => onSelectPathway(e.target.value)}
        >
          {pathwayOptions.map((item) => (
            <option key={item} value={item}>
              {PATHWAY_LABELS[item] ?? item.replace("_", " ")}
            </option>
          ))}
        </select>

        <label htmlFor="filter-subject-category-select">Filter by subject</label>
        <select
          id="filter-subject-category-select"
          tabIndex={-1}
          value={currentSubject}
          onChange={(e) => {
            const nextSub = e.target.value;
            if (onSelectSubject) {
              onSelectSubject(nextSub);
            } else {
              onSelectCategory(nextSub);
            }
          }}
        >
          {subjectOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-exam-body-select">Filter by exam body</label>
        <select
          id="filter-exam-body-select"
          tabIndex={-1}
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
        >
          {examBodyOptions.map((body) => (
            <option key={body.id} value={body.id}>
              {body.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
