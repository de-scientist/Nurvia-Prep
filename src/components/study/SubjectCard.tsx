"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubjectCardDto } from "@/lib/api-types";
import {
  buildSubjectCardPresentation,
  buildSubjectSelectionContext,
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

  const { classification } = presentation;
  const metrics = React.useMemo(
    () => getVerifiedPathwayMetrics(subject, activePathway || "All"),
    [subject, activePathway]
  );

  const hasMultiplePathways = metrics.rnExamCount > 0 && metrics.pnExamCount > 0;

  const combinedExamCount = metrics.rnExamCount + metrics.pnExamCount > 0
    ? metrics.rnExamCount + metrics.pnExamCount
    : Math.max(0, subject.totalExams);

  const selectPathway = (targetPathway: string) => {
    if (onSelectSubjectSource) {
      onSelectSubjectSource(
        buildSubjectSelectionContext(subject, targetPathway)
      );
      return;
    }
    onSelectSubject(subject.title, targetPathway);
  };

  const categoryLabel = presentation.categoryLabel || subject.category || "HESI";

  return (
    <Card
      data-testid="subject-card"
      data-classification={classification}
      className="flex h-full flex-col justify-between gap-3 border border-border bg-surface p-4 shadow-xs transition-[border-color,box-shadow] hover:border-brand-teal/50 hover:shadow-md"
    >
      <div className="space-y-2">
        {/* 1. Subject Category / Small Label */}
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground-muted">
          <span className="inline-flex items-center gap-1.5 text-brand-teal">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{categoryLabel} · Subject</span>
          </span>
          {subject.difficulty && (
            <span className="text-[11px] font-normal capitalize text-foreground-muted">
              {subject.difficulty}
            </span>
          )}
        </div>

        {/* 2. Subject Name */}
        <h3 className="min-w-0">
          <button
            type="button"
            onClick={() => selectPathway(metrics.rnExamCount > 0 ? "RN" : "PN_LPN")}
            title={`View Examinations: ${subject.title}`}
            className="w-full text-left font-brand text-base font-bold leading-snug text-foreground break-words line-clamp-2 transition-colors hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-sm"
          >
            {subject.title}
          </button>
        </h3>

        {/* Accessible screen-reader counts & CTA anchors */}
        <div className="sr-only">
          <span><BookOpen className="h-3 w-3" /> {combinedExamCount} examinations</span>
          <span><HelpCircle className="h-3 w-3" /> {metrics.totalQuestions} questions</span>
          <span>View Examinations</span>
        </div>
      </div>

      {/* 3 & 4. Direct Pathway Actions with Relevant Examination Counts */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60" data-multitrack={hasMultiplePathways}>
        <Button
          type="button"
          size="sm"
          aria-label={metrics.rnExamCount > 0 ? "RN Pathway" : "RN Pathway (No exams)"}
          disabled={metrics.rnExamCount === 0}
          onClick={() => selectPathway("RN")}
          title={metrics.rnExamCount > 0 ? `RN · ${metrics.rnExamCount} exams` : "No RN exams available"}
          className={cn(
            "h-9 w-full text-xs font-semibold rounded-lg flex items-center justify-center gap-1",
            metrics.rnExamCount > 0
              ? "bg-brand-teal hover:bg-brand-tealDark text-white shadow-2xs"
              : "opacity-50 cursor-not-allowed bg-surface-muted text-foreground-muted"
          )}
        >
          <span>{metrics.rnExamCount > 0 ? `RN · ${metrics.rnExamCount} exams` : "No RN exams"}</span>
          {metrics.rnExamCount > 0 && <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={metrics.pnExamCount > 0 ? "LPN / PN Pathway" : "LPN / PN Pathway (No exams)"}
          disabled={metrics.pnExamCount === 0}
          onClick={() => selectPathway("PN_LPN")}
          title={metrics.pnExamCount > 0 ? `LPN/PN · ${metrics.pnExamCount} exams` : "No LPN/PN exams available"}
          className={cn(
            "h-9 w-full text-xs font-semibold rounded-lg flex items-center justify-center gap-1",
            metrics.pnExamCount > 0
              ? "border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500"
              : "opacity-50 cursor-not-allowed border-border text-foreground-muted"
          )}
        >
          <span>{metrics.pnExamCount > 0 ? `LPN/PN · ${metrics.pnExamCount} exams` : "No LPN/PN exams"}</span>
          {metrics.pnExamCount > 0 && <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        </Button>
      </div>
    </Card>
  );
}
