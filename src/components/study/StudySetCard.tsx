"use client";

import * as React from "react";
import Link from "next/link";
import { BookmarkCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StudySetCardDto } from "@/lib/api-types";
import { StudySetCardActions, StudySetOverflowMenu } from "./StudySetCardActions";

interface StudySetCardProps {
  studySet: StudySetCardDto;
  isPublic?: boolean;
  onToggleSave?: (studySet: StudySetCardDto) => void;
  onNotify?: (message: string) => void;
}

export function StudySetCard({
  studySet,
  isPublic = false,
  onToggleSave,
  onNotify,
}: StudySetCardProps) {
  const detailHref = isPublic ? `/exams/${studySet.id}` : `/learner/library/${studySet.id}`;
  const pathLabel =
    studySet.pathway === "PN_LPN"
      ? "LPN"
      : studySet.pathway === "PN_Exit"
        ? "LPN Exit"
        : studySet.pathway === "RN_Exit"
          ? "RN Exit"
          : studySet.pathway.replace("_", " ");

  const examBody =
    studySet.category === "RegularCourse" || studySet.category === "ExitPredictor"
      ? "Core"
      : studySet.category;
  const examBadgeText = `${pathLabel} · ${examBody}`;

  return (
    <Card className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-4 transition-all hover:border-brand-teal/50 hover:shadow-xs">
      <div className="space-y-2.5">
        {/* Top: Examination Title, NEW Badge, and Overflow Menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={detailHref}
                title={studySet.title}
                className="font-brand text-sm sm:text-base font-bold text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline transition-colors line-clamp-1"
              >
                {studySet.title}
              </Link>
              {studySet.isNew && (
                <span
                  data-testid="exam-card-new-badge"
                  className="inline-flex items-center rounded-md bg-brand-teal px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs"
                >
                  NEW
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {studySet.isSaved && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-medium text-brand-teal"
                title="Saved to My Library"
              >
                <BookmarkCheck className="h-3 w-3" aria-hidden="true" />
                Saved
              </span>
            )}
            <StudySetOverflowMenu
              studySet={studySet}
              detailHref={detailHref}
              isPublic={isPublic}
              onToggleSave={onToggleSave}
              onNotify={onNotify}
            />
          </div>
        </div>

        {/* Compact Metadata Row: Category/Pathway, Question Count, Season, Academic Year */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-secondary">
          <Badge variant="teal" className="text-[11px] font-semibold px-2 py-0.5">
            {examBadgeText}
          </Badge>
          {typeof studySet.totalQuestions === "number" && (
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="text-foreground-muted/60" aria-hidden="true">·</span>
              <span>
                {studySet.totalQuestions} {studySet.totalQuestions === 1 ? "question" : "questions"}
              </span>
            </span>
          )}
          {Boolean(studySet.season) && (
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="text-foreground-muted/60" aria-hidden="true">·</span>
              <span>{studySet.season}</span>
            </span>
          )}
          {studySet.academicYear != null && (
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="text-foreground-muted/60" aria-hidden="true">·</span>
              <span>{studySet.academicYear}</span>
            </span>
          )}
        </div>

        {studySet.description && (
          <p className="line-clamp-2 text-xs text-foreground-secondary leading-relaxed pt-0.5">
            {studySet.description}
          </p>
        )}
      </div>

      <StudySetCardActions studySet={studySet} />
    </Card>
  );
}
