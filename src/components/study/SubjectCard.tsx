"use client";

import * as React from "react";
import { ArrowRight, BookOpen, ChevronDown, GraduationCap, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubjectCardDto } from "@/lib/api-types";

interface SubjectCardProps {
  subject: SubjectCardDto;
  isPublic?: boolean;
  onSelectSubject: (subjectName: string, pathway?: string) => void;
}

function formatCategoryBadge(pathway: string, category: string): string {
  const pathLabel = pathway.replace("_", " ");
  const catLabel = category.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${pathLabel} · ${catLabel}`;
}

export function SubjectCard({
  subject,
  isPublic: _isPublic = false,
  onSelectSubject,
}: SubjectCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const hasExams = subject.totalExams > 0;

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const pathways = subject.availablePathways && subject.availablePathways.length > 0
    ? subject.availablePathways
    : ["RN", "PN_LPN"];
  const hasMultiplePathways = pathways.includes("RN") && pathways.includes("PN_LPN");
  const rnCount = subject.rnExamCount ?? 0;
  const pnCount = subject.pnExamCount ?? 0;

  return (
    <Card className="flex h-full flex-col justify-between gap-4 border border-border bg-surface p-5 transition-colors hover:border-brand-teal/50">
      <div className="space-y-3">
        {/* Top Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="teal" className="text-[11px] font-semibold">
              {formatCategoryBadge(subject.pathway, subject.category)}
            </Badge>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal"
              title="Authoritative Academic Subject"
            >
              <GraduationCap className="h-3 w-3" aria-hidden="true" />
              Subject
            </span>
          </div>

          {subject.difficulty && (
            <span className="text-[11px] font-medium text-foreground-muted capitalize">
              {subject.difficulty}
            </span>
          )}
        </div>

        {/* Academic Course & Program context */}
        {(subject.courseName || subject.programName) && (
          <p className="text-[11px] font-medium text-foreground-muted truncate">
            {subject.courseName ? `Course: ${subject.courseName}` : ""}
            {subject.courseName && subject.programName ? " · " : ""}
            {subject.programName ? subject.programName : ""}
          </p>
        )}

        {/* Subject Title & Description */}
        <div>
          <button
            type="button"
            onClick={() => onSelectSubject(subject.title)}
            className="text-left font-brand text-lg font-bold leading-snug text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline"
          >
            {subject.title}
          </button>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground-secondary">
            {subject.description || "Comprehensive subject study materials, high-yield practice questions, and examination prep."}
          </p>
        </div>

        {/* Academic Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground-secondary">
            <BookOpen className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
            {subject.totalExams} {subject.totalExams === 1 ? "Examination" : "Examinations"}
          </span>
          <span className="inline-flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
            {subject.totalQuestions.toLocaleString()} Questions
          </span>
          {subject.school && <span>{subject.school}</span>}
          {subject.academicYear && <span>{subject.academicYear}</span>}
          {subject.season && <span>{subject.season}</span>}
        </div>

        {/* Authoritative Pathways Breakdown for Unified Subject Card */}
        {hasMultiplePathways && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-surface-muted/50 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground-secondary text-[11px] uppercase tracking-wider">Pathways:</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden="true" />
              <span>RN: <strong className="text-foreground">{rnCount}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden="true" />
              <span>PN: <strong className="text-foreground">{pnCount}</strong></span>
            </span>
          </div>
        )}

        {/* Featured Examinations Preview (if present) */}
        {subject.featuredExams && subject.featuredExams.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
              Included Examinations:
            </p>
            <div className="space-y-1">
              {subject.featuredExams.slice(0, 2).map((exam) => (
                <div key={exam.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSubject(subject.title)}
                    className="truncate text-left text-xs font-medium text-foreground hover:text-brand-teal hover:underline"
                    title={exam.title}
                  >
                    {exam.title}
                  </button>
                  <span className="shrink-0 text-[10px] text-foreground-muted">
                    {exam.totalQuestions} Qs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Button with Unified Subject Navigation */}
      <div className="relative pt-2" ref={menuRef}>
        {hasMultiplePathways && hasExams ? (
          <div className="flex w-full rounded-lg shadow-sm">
            <Button
              type="button"
              onClick={() => onSelectSubject(subject.title, subject.pathway)}
              className="flex-1 flex items-center justify-center gap-2 rounded-r-none"
            >
              <span>Explore Subject</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Select RN or PN Pathway"
              className="rounded-l-none border-l border-white/20 px-2.5"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", menuOpen && "rotate-180")} />
            </Button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full mb-1.5 right-0 z-30 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-xl animate-in fade-in zoom-in-95"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  Select Academic Pathway:
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelectSubject(subject.title, "RN");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-brand-teal/10 hover:text-brand-teal transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-teal" />
                    RN Pathway
                  </span>
                  <span className="text-[10px] text-foreground-muted">{rnCount > 0 ? `${rnCount} Exams` : "Available"}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelectSubject(subject.title, "PN_LPN");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-purple-500/10 hover:text-purple-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    LPN / PN Pathway
                  </span>
                  <span className="text-[10px] text-foreground-muted">{pnCount > 0 ? `${pnCount} Exams` : "Available"}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => onSelectSubject(subject.title, pathways[0])}
            className="w-full flex items-center justify-center gap-2"
            disabled={!hasExams}
          >
            <span>
              {hasExams
                ? `View ${pathways[0] === "PN_LPN" ? "LPN/PN" : "RN"} Examinations (${subject.totalExams})`
                : "No Examinations Available"}
            </span>
            {hasExams && <ArrowRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </Card>
  );
}
