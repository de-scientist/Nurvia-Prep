"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubjectCardDto } from "@/lib/api-types";
import {
  buildSubjectCardPresentation,
  buildSubjectSelectionContext,
  formatExclusiveCtaLabel,
  getVerifiedPathwayMetrics,
} from "@/lib/study-library/subject-card-presentation";

export interface SubjectSelectionContext {
  subjectName: string;
  pathway: string;
  programId: 6 | 9;
  subjectIds: string[];
  examId?: string;
  card: SubjectCardDto;
}

interface SubjectCardProps {
  subject: SubjectCardDto;
  isPublic?: boolean;
  activePathway?: string;
  onSelectSubject: (subjectName: string, pathway?: string) => void;
  onSelectSubjectSource?: (selection: SubjectSelectionContext) => void;
}

export function SubjectCard({
  subject,
  isPublic: _isPublic = false,
  activePathway,
  onSelectSubject,
  onSelectSubjectSource,
}: SubjectCardProps) {
  const presentation = React.useMemo(
    () => buildSubjectCardPresentation(subject, activePathway),
    [subject, activePathway]
  );

  const { hasMultiplePathways, pathwayOptions, classification } = presentation;
  const resolveInitialChosenPathway = React.useCallback((): "RN" | "PN_LPN" | null => {
    if (!hasMultiplePathways) return null;
    if (activePathway === "RN") return "RN";
    if (activePathway === "PN_LPN" || activePathway === "LPN" || activePathway === "PN") {
      return "PN_LPN";
    }
    return null;
  }, [hasMultiplePathways, activePathway]);

  const [userChosenPathway, setUserChosenPathway] = React.useState<"RN" | "PN_LPN" | null>(
    resolveInitialChosenPathway
  );
  const [selectedPathway, setSelectedPathway] = React.useState<string>(
    presentation.defaultSelectedPathway
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = React.useState(0);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const labelId = React.useId();
  const valueId = React.useId();
  const listboxId = React.useId();

  // Keep selected pathway aligned when page-level pathway filter changes
  React.useEffect(() => {
    setSelectedPathway(presentation.defaultSelectedPathway);
    setUserChosenPathway(resolveInitialChosenPathway());
  }, [presentation.defaultSelectedPathway, resolveInitialChosenPathway]);

  // Dismiss dropdown on outside pointer interaction or Escape
  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Focus the active option when menu opens or keyboard index updates
  React.useEffect(() => {
    if (!menuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[focusedOptionIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen, focusedOptionIndex]);

  const effectivePathway = hasMultiplePathways
    ? (userChosenPathway ?? selectedPathway)
    : presentation.defaultSelectedPathway;

  const selectedOption =
    hasMultiplePathways && userChosenPathway
      ? (pathwayOptions.find((opt) => opt.pathway === userChosenPathway) ?? null)
      : null;

  const metrics = React.useMemo(
    () => getVerifiedPathwayMetrics(subject, effectivePathway),
    [subject, effectivePathway]
  );

  const combinedExamCount = hasMultiplePathways
    ? metrics.rnExamCount + metrics.pnExamCount
    : Math.max(0, subject.totalExams);

  const hasExamsForSelection = hasMultiplePathways
    ? userChosenPathway
      ? metrics.examCount > 0
      : combinedExamCount > 0
    : subject.totalExams > 0;

  const displayedFeaturedExams = React.useMemo(() => {
    const allExams = subject.featuredExams ?? [];
    if (allExams.length === 0) return [];
    if (!hasMultiplePathways) return allExams.slice(0, 2);

    const matching = allExams.filter(
      (ex) =>
        ex.pathway === effectivePathway ||
        (effectivePathway === "PN_LPN" && ex.programId === 6) ||
        (effectivePathway === "RN" && ex.programId === 9)
    );
    return (matching.length > 0 ? matching : allExams).slice(0, 2);
  }, [subject.featuredExams, hasMultiplePathways, effectivePathway]);

  const selectPathway = (
    targetPathway: string,
    explicitOpts?: { subjectId?: string; examId?: string; programId?: 6 | 9 }
  ) => {
    if (onSelectSubjectSource) {
      onSelectSubjectSource(
        buildSubjectSelectionContext(subject, targetPathway, explicitOpts)
      );
      return;
    }

    onSelectSubject(subject.title, targetPathway);
  };

  const openMenuAt = (index: number) => {
    const bounded = Math.max(0, Math.min(pathwayOptions.length - 1, index));
    setFocusedOptionIndex(bounded);
    setMenuOpen(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!hasMultiplePathways) return;
    const selectedIdx = Math.max(
      0,
      pathwayOptions.findIndex((o) => o.pathway === effectivePathway)
    );
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openMenuAt(menuOpen ? (focusedOptionIndex + 1) % pathwayOptions.length : selectedIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenuAt(
        menuOpen
          ? (focusedOptionIndex - 1 + pathwayOptions.length) % pathwayOptions.length
          : pathwayOptions.length - 1
      );
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (menuOpen) {
        setMenuOpen(false);
      } else {
        openMenuAt(selectedIdx);
      }
    }
  };

  const handleOptionSelect = (pathway: "RN" | "PN_LPN") => {
    setUserChosenPathway(pathway);
    setSelectedPathway(pathway);
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    pathway: "RN" | "PN_LPN"
  ) => {
    const len = pathwayOptions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedOptionIndex((index + 1) % len);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedOptionIndex((index - 1 + len) % len);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedOptionIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedOptionIndex(len - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOptionSelect(pathway);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  };

  const pathwayBadgeClasses =
    classification === "COMMON"
      ? "border-brand-navy/25 bg-brand-navy/10 text-brand-navy dark:border-brand-teal/40 dark:bg-surface-elevated dark:text-slate-100"
      : classification === "LPN_ONLY"
        ? "border-purple-500/30 bg-purple-500/10 text-purple-800 dark:border-purple-400/35 dark:bg-purple-500/15 dark:text-purple-200"
        : "border-brand-teal/30 bg-brand-teal/10 text-brand-tealDark dark:border-teal-400/35 dark:bg-brand-teal/15 dark:text-teal-200";

  return (
    <Card
      data-testid="subject-card"
      data-classification={classification}
      className={cn(
        "relative flex h-full flex-col justify-between gap-4 border border-border bg-surface p-5 shadow-xs transition-[border-color,box-shadow] hover:border-brand-teal/50 hover:shadow-md",
        menuOpen ? "z-40 border-brand-teal/60 shadow-md" : "z-0"
      )}
    >
      {/* Upper + Content Wrapper */}
      <div className="flex flex-1 flex-col space-y-3.5">
        {/* 1. Card Header, Pathway Identification & Subject Identity */}
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                data-testid="subject-pathway-badge"
                data-classification={classification}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-tight",
                  pathwayBadgeClasses
                )}
              >
                {classification === "COMMON" ? (
                  <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-brand-teal" />
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                  </span>
                ) : classification === "LPN_ONLY" ? (
                  <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden="true" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden="true" />
                )}
                <span>{presentation.pathwayBadgeLabel}</span>
              </span>

              {classification === "COMMON" && (
                <span
                  data-testid="subject-merged-badge"
                  className="inline-flex items-center gap-1 rounded-full border border-brand-teal/35 bg-brand-teal/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-tealDark dark:border-teal-400/40 dark:bg-brand-teal/15 dark:text-teal-200"
                >
                  MERGED — RN + LPN
                </span>
              )}

              {presentation.categoryLabel && (
                <Badge variant="secondary" className="text-[11px]">
                  {presentation.categoryLabel}
                </Badge>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
              <span
                className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-secondary"
                title="Authoritative Academic Subject"
              >
                <GraduationCap className="h-3 w-3 text-brand-teal" aria-hidden="true" />
                Subject
              </span>
              {subject.difficulty && (
                <span className="capitalize">{subject.difficulty}</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (hasMultiplePathways && !userChosenPathway) {
                    openMenuAt(0);
                    return;
                  }
                  selectPathway(effectivePathway);
                }}
                title={subject.title}
                className="w-full text-left font-brand text-lg font-bold leading-snug text-foreground break-words line-clamp-2 transition-colors hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 rounded-sm"
              >
                {subject.title}
              </button>
            </h3>
            {(subject.courseName || subject.programName) && (
              <p
                className="mt-1 truncate text-[11px] font-medium text-foreground-muted"
                title={`${subject.courseName ? `Course: ${subject.courseName}` : ""}${
                  subject.courseName && subject.programName ? " · " : ""
                }${subject.programName ?? ""}`}
              >
                {subject.courseName ? `Course: ${subject.courseName}` : ""}
                {subject.courseName && subject.programName ? " · " : ""}
                {subject.programName ?? ""}
              </p>
            )}
          </div>
        </div>

        {/* 2. Upper Pathway Selection Dropdown (Controls content & primary action below) */}
        {hasMultiplePathways && (
          <div
            data-testid="subject-pathway-selector"
            className="space-y-1.5 rounded-xl border border-border/80 bg-background/70 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <label
                id={labelId}
                htmlFor={`${listboxId}-trigger`}
                className="block text-[11px] font-semibold uppercase tracking-wider text-foreground-secondary"
              >
                Select Academic Pathway
              </label>
              <span className="text-[10px] font-semibold text-foreground-muted">
                RN &amp; LPN / PN Available
              </span>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                id={`${listboxId}-trigger`}
                ref={triggerRef}
                type="button"
                onClick={() => {
                  if (menuOpen) {
                    setMenuOpen(false);
                  } else {
                    const idx = selectedOption
                      ? Math.max(
                          0,
                          pathwayOptions.findIndex((o) => o.pathway === selectedOption.pathway)
                        )
                      : 0;
                    openMenuAt(idx);
                  }
                }}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                aria-controls={listboxId}
                aria-labelledby={`${labelId} ${valueId}`}
                className={cn(
                  "flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border bg-surface-elevated px-3 py-2 text-left text-xs font-semibold text-foreground shadow-2xs transition-colors hover:border-brand-teal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1",
                  menuOpen ? "border-brand-teal ring-1 ring-brand-teal/30" : "border-border"
                )}
              >
                <span id={valueId} className="flex min-w-0 items-center gap-2">
                  {selectedOption ? (
                    <>
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          selectedOption.pathway === "PN_LPN" ? "bg-purple-500" : "bg-brand-teal"
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {selectedOption.label ||
                          (selectedOption.pathway === "PN_LPN" ? "LPN / PN Pathway" : "RN Pathway")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-teal" />
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                      </span>
                      <span className="truncate">Choose Pathway (RN or LPN / PN)</span>
                    </>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
                  <span>
                    {selectedOption
                      ? selectedOption.examCount > 0
                        ? `${selectedOption.examCount} ${selectedOption.examCount === 1 ? "exam" : "exams"}`
                        : "No exams"
                      : `${combinedExamCount} combined`}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-foreground-secondary transition-transform duration-150",
                      menuOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </span>
              </button>

              {menuOpen && (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={labelId}
                  className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-border-strong bg-surface-elevated p-1.5 shadow-xl"
                >
                  {pathwayOptions.map((opt, idx) => {
                    const isSelected = selectedOption?.pathway === opt.pathway;
                    const isLpn = opt.pathway === "PN_LPN";
                    return (
                      <button
                        key={opt.pathway}
                        ref={(el) => {
                          optionRefs.current[idx] = el;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={focusedOptionIndex === idx ? 0 : -1}
                        onClick={() => handleOptionSelect(opt.pathway)}
                        onKeyDown={(e) => handleOptionKeyDown(e, idx, opt.pathway)}
                        className={cn(
                          "flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                          isSelected
                            ? isLpn
                              ? "bg-purple-500/12 text-purple-800 dark:text-purple-200"
                              : "bg-brand-teal/12 text-brand-tealDark dark:text-teal-200"
                            : "text-foreground hover:bg-surface-muted"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 shrink-0 rounded-full",
                              isLpn ? "bg-purple-500" : "bg-brand-teal"
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{opt.label}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
                          <span>
                            {opt.examCount > 0
                              ? `${opt.examCount} ${opt.examCount === 1 ? "exam" : "exams"}`
                              : "No exams"}
                          </span>
                          {isSelected && (
                            <Check
                              className={cn(
                                "h-3.5 w-3.5",
                                isLpn ? "text-purple-600 dark:text-purple-300" : "text-brand-teal"
                              )}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Verified RN, LPN & Combined Content Metrics (Equal Pathway Prominence) */}
        <div
          data-testid="subject-content-metrics"
          className="space-y-2 rounded-lg border border-border/80 bg-background/60 p-3 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-foreground-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <BookOpen className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
              {hasMultiplePathways ? (
                selectedOption ? (
                  <>
                    {metrics.examCount} {metrics.examCount === 1 ? "Examination" : "Examinations"}{" "}
                    <span className="font-normal text-foreground-muted">
                      ({selectedOption.shortLabel} · {combinedExamCount} Combined)
                    </span>
                  </>
                ) : (
                  <>
                    Combined: {combinedExamCount}{" "}
                    {combinedExamCount === 1 ? "Examination" : "Examinations"}
                  </>
                )
              ) : (
                <>
                  {metrics.examCount} {metrics.examCount === 1 ? "Examination" : "Examinations"}
                </>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
              <HelpCircle className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
              {(selectedOption
                ? metrics.questionCount ?? metrics.totalQuestions
                : metrics.totalQuestions
              ).toLocaleString()}{" "}
              Questions
            </span>
          </div>

          {hasMultiplePathways && (
            <div className="grid grid-cols-3 gap-1.5 border-t border-border/60 pt-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleOptionSelect("RN")}
                aria-pressed={selectedOption?.pathway === "RN"}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md border px-2 py-1 font-semibold transition-colors",
                  selectedOption?.pathway === "RN"
                    ? "border-brand-teal bg-brand-teal/15 text-brand-tealDark dark:text-teal-200 ring-1 ring-brand-teal/30"
                    : "border-brand-teal/30 bg-brand-teal/10 text-brand-tealDark dark:border-teal-400/35 dark:bg-brand-teal/15 dark:text-teal-200 hover:border-brand-teal"
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" aria-hidden="true" />
                <span>RN: {metrics.rnExamCount}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOptionSelect("PN_LPN")}
                aria-pressed={selectedOption?.pathway === "PN_LPN"}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md border px-2 py-1 font-semibold transition-colors",
                  selectedOption?.pathway === "PN_LPN"
                    ? "border-purple-500 bg-purple-500/15 text-purple-800 dark:text-purple-200 ring-1 ring-purple-500/30"
                    : "border-purple-500/30 bg-purple-500/10 text-purple-800 dark:border-purple-400/35 dark:bg-purple-500/15 dark:text-purple-200 hover:border-purple-500"
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
                <span>LPN: {metrics.pnExamCount}</span>
              </button>

              <div className="flex items-center justify-center rounded-md border border-border bg-surface-muted px-2 py-1 font-semibold text-foreground">
                <span>Total: {combinedExamCount}</span>
              </div>
            </div>
          )}

          {(subject.school || subject.academicYear || subject.season) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
              {subject.school && <span>{subject.school}</span>}
              {subject.academicYear && <span>{subject.academicYear}</span>}
              {subject.season && <span>{subject.season}</span>}
            </div>
          )}

          {!metrics.examCountsVerified && (
            <p className="text-[11px] text-foreground-muted">
              Counts reflect currently verified records; refresh if partially loaded.
            </p>
          )}

          {!hasExamsForSelection && (
            <p className="text-[11px] font-medium text-foreground-muted">
              No published examinations are currently available for this selection.
            </p>
          )}
        </div>

        {/* 4. Content Description & Curriculum Notes */}
        <div className="space-y-2">
          <p className="line-clamp-2 text-sm leading-relaxed text-foreground-secondary">
            {subject.description ||
              "Comprehensive subject study materials, high-yield practice questions, and examination prep."}
          </p>
          {subject.ambiguityNotes && subject.ambiguityNotes.length > 0 && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
              {subject.ambiguityNotes[0]}
            </p>
          )}
        </div>

        {/* Featured Examinations Preview (Verified nominal exams only) */}
        {displayedFeaturedExams.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/50 p-2.5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
              Included Examinations:
            </p>
            <div className="space-y-1">
              {displayedFeaturedExams.map((exam) => {
                const examPathway =
                  exam.pathway ?? (exam.programId === 6 ? "PN_LPN" : effectivePathway);
                return (
                  <div key={exam.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        selectPathway(examPathway, {
                          subjectId: exam.subjectGuidId,
                          examId: exam.id,
                          programId: exam.programId,
                        })
                      }
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium text-foreground hover:text-brand-teal hover:underline focus-visible:outline-none focus-visible:underline"
                      title={exam.title}
                    >
                      {exam.title}
                    </button>
                    <span className="shrink-0 text-[10px] font-medium text-foreground-muted">
                      {exam.totalQuestions} Qs
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Primary Action */}
      <div className="pt-1">
        {hasMultiplePathways ? (
          selectedOption ? (
            <Button
              type="button"
              onClick={() => selectPathway(selectedOption.pathway)}
              disabled={!hasExamsForSelection}
              className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-lg"
            >
              <span>
                {hasExamsForSelection
                  ? `Explore ${selectedOption.shortLabel} Examinations (${selectedOption.examCount})`
                  : `No ${selectedOption.shortLabel} Examinations Available`}
              </span>
              {hasExamsForSelection && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => openMenuAt(0)}
              disabled={combinedExamCount === 0}
              className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-lg"
            >
              <span>
                {combinedExamCount > 0
                  ? `Choose RN (${metrics.rnExamCount}) or LPN (${metrics.pnExamCount}) Pathway`
                  : "No Examinations Available"}
              </span>
              {combinedExamCount > 0 && <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </Button>
          )
        ) : (
          <Button
            type="button"
            onClick={() => selectPathway(effectivePathway)}
            disabled={!hasExamsForSelection}
            className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-lg"
          >
            <span>{formatExclusiveCtaLabel(subject, effectivePathway)}</span>
            {hasExamsForSelection && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </Card>
  );
}
