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
    <Card className="flex h-full flex-col justify-between gap-2.5 border border-border bg-surface p-3.5 transition-colors hover:border-brand-teal/50 shadow-xs">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="teal" className="text-[11px] font-bold">
              {examBadgeText}
            </Badge>
            {studySet.isSaved && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-medium text-brand-teal"
                title="Saved to My Library"
              >
                <BookmarkCheck className="h-3 w-3" aria-hidden="true" />
                Saved
              </span>
            )}
          </div>
          <StudySetOverflowMenu
            studySet={studySet}
            detailHref={detailHref}
            isPublic={isPublic}
            onToggleSave={onToggleSave}
            onNotify={onNotify}
          />
        </div>

        <div className="pt-0.5">
          <Link
            href={detailHref}
            title={studySet.title}
            className="block truncate font-brand text-sm sm:text-base font-bold text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline"
          >
            {studySet.title}
          </Link>
          {studySet.description && (
            <p className="mt-1 line-clamp-2 text-xs text-foreground-secondary">
              {studySet.description}
            </p>
          )}
        </div>
      </div>

      <StudySetCardActions studySet={studySet} />
    </Card>
  );
}
