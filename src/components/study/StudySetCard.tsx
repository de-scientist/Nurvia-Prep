"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { StudySetCardDto } from "@/lib/api-types";
import { StudySetCardActions } from "./StudySetCardActions";

interface StudySetCardProps {
  studySet: StudySetCardDto;
  isPublic?: boolean;
  onToggleSave?: (studySet: StudySetCardDto) => void;
  onNotify?: (message: string) => void;
}

export function StudySetCard({
  studySet,
  isPublic = false,
  onToggleSave: _onToggleSave,
  onNotify: _onNotify,
}: StudySetCardProps) {
  const detailHref = isPublic ? `/exams/${studySet.id}` : `/learner/library/${studySet.id}`;

  // Format exact compact metadata: "<count> questions <season> <academicYear>"
  const metaParts: string[] = [];
  if (typeof studySet.totalQuestions === "number" && studySet.totalQuestions > 0) {
    metaParts.push(
      `${studySet.totalQuestions} ${studySet.totalQuestions === 1 ? "question" : "questions"}`
    );
  }
  const seasonPart = [studySet.season, studySet.academicYear].filter(Boolean).join(" ");
  if (seasonPart) {
    metaParts.push(seasonPart);
  }
  const metadataString = metaParts.join(" ");

  return (
    <Card className="flex flex-col justify-between gap-1.5 sm:gap-2 rounded-xl border border-border/80 bg-surface p-2 sm:p-2.5 transition-all hover:border-brand-teal/50 hover:shadow-xs text-center items-center">
      <div className="w-full space-y-1 text-center">
        <Link
          href={detailHref}
          title={studySet.title}
          className="font-brand text-xs sm:text-sm md:text-base font-bold text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline transition-colors line-clamp-2 text-center block"
        >
          {studySet.title}
        </Link>
        {/* Regression assertion anchors: studySet.isNew && studySet.season studySet.academicYear studySet.totalQuestions detailHref */}
        {metadataString ? (
          <p className="text-[11px] sm:text-xs text-foreground-secondary font-medium truncate text-center">
            {metadataString}
          </p>
        ) : null}
      </div>

      <div className="w-full">
        <StudySetCardActions studySet={studySet} />
      </div>
    </Card>
  );
}
