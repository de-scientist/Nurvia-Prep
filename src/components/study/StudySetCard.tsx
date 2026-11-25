"use client";

import * as React from "react";
import Link from "next/link";
import { BookmarkCheck, Clock, HelpCircle, Star } from "lucide-react";
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

function formatCategoryBadge(pathway: string, category: string): string {
  const pathLabel = pathway.replace("_", " ");
  const catLabel = category.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${pathLabel} · ${catLabel}`;
}

export function StudySetCard({
  studySet,
  isPublic = false,
  onToggleSave,
  onNotify,
}: StudySetCardProps) {
  const detailHref = isPublic ? `/exams/${studySet.id}` : `/learner/library/${studySet.id}`;
  const pathLabel = studySet.pathway === "PN_LPN" ? "PN / LPN" : studySet.pathway.replace("_", " ");
  const examBody = studySet.category === "RegularCourse" || studySet.category === "ExitPredictor" ? "Core" : studySet.category;
  const examBadgeText = `${pathLabel} · ${examBody}`;

  return (
    <Card className="flex h-full flex-col justify-between gap-3 border border-border bg-surface p-4 transition-colors hover:border-brand-teal/50 shadow-xs">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="teal" className="text-[11px] font-bold">
              {examBadgeText}
            </Badge>
            {studySet.difficulty && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80 text-foreground-secondary">
                {studySet.difficulty}
              </Badge>
            )}
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
            className="block truncate font-brand text-base font-bold text-foreground hover:text-brand-teal focus-visible:outline-none focus-visible:underline"
          >
            {studySet.title}
          </Link>
        </div>
      </div>

      <StudySetCardActions
        studySet={studySet}
      />
    </Card>
  );
}
