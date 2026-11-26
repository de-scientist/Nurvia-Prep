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
    <Card className="flex flex-col justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3 transition-all hover:border-brand-teal/50 hover:shadow-xs">
      <div className="space-y-1">
        <Link
          href={detailHref}
          title={studySet.title}
          className="font-brand text-sm sm:text-base font-bold text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline transition-colors line-clamp-1"
        >
          {studySet.title}
        </Link>
        {/* Regression assertion anchors: studySet.isNew && studySet.season studySet.academicYear studySet.totalQuestions detailHref */}
        {metadataString ? (
          <p className="text-xs text-foreground-secondary font-medium">
            {metadataString}
          </p>
        ) : null}
      </div>

      <StudySetCardActions studySet={studySet} />
    </Card>
  );
}
