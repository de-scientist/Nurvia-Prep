"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Copy, ExternalLink, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamDeliveryMode, ExamLayoutPolicy, StudySetCardDto } from "@/lib/api-types";
import { isModeEnabled as sharedIsModeEnabled } from "@/lib/api-client";

export function isModeEnabled(
  modeAllowed: ExamDeliveryMode | string | undefined | null,
  target: "Exam" | "Review" | "Tutor"
): boolean {
  if (!modeAllowed) return false;
  const normalized = String(modeAllowed).trim().toLowerCase();
  if (normalized === "all") return true;
  if (normalized === "both") return target === "Exam" || target === "Review";
  return normalized === target.toLowerCase();
}

export function buildStudySessionHref(
  examId: string,
  mode: "Exam" | "Review" | "Tutor",
  layoutPolicy?: ExamLayoutPolicy
): string {
  const params = new URLSearchParams({ examId, mode });
  if (layoutPolicy === "AllInOneOnly") {
    params.set("layout", "AllInOne");
  } else if (layoutPolicy === "SequentialOnly") {
    params.set("layout", "Sequential");
  } else {
    params.set("layout", mode === "Review" ? "AllInOne" : "Sequential");
  }
  return `/exam-session?${params.toString()}`;
}

interface StudySetCardActionsProps {
  studySet: StudySetCardDto;
}

interface StudySetOverflowMenuProps {
  studySet: StudySetCardDto;
  detailHref: string;
  isPublic?: boolean;
  onToggleSave?: (studySet: StudySetCardDto) => void;
  onNotify?: (message: string) => void;
}

export function StudySetCardActions({
  studySet,
}: StudySetCardActionsProps) {
  const canExam = isModeEnabled(studySet.modeAllowed, "Exam");
  const canTutor = isModeEnabled(studySet.modeAllowed, "Tutor");

  return (
    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
      {canTutor ? (
        <Link href={buildStudySessionHref(studySet.id, "Tutor", studySet.allowedLayouts)} className="block">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-semibold hover:border-brand-teal/60">
            Tutor Mode
          </Button>
        </Link>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Tutor mode is not enabled for this examination."
          className="w-full h-8 text-xs font-semibold opacity-50 cursor-not-allowed"
        >
          Tutor Mode
        </Button>
      )}

      {canExam ? (
        <Link href={buildStudySessionHref(studySet.id, "Exam", studySet.allowedLayouts)} className="block">
          <Button size="sm" className="w-full h-8 text-xs font-semibold bg-brand-teal hover:bg-brand-tealDark text-white">
            Exam Mode
          </Button>
        </Link>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled
          title="Exam mode is not enabled for this examination."
          className="w-full h-8 text-xs font-semibold opacity-50 cursor-not-allowed"
        >
          Exam Mode
        </Button>
      )}
    </div>
  );
}

export function StudySetOverflowMenu({
  studySet,
  detailHref,
  isPublic = false,
  onToggleSave,
  onNotify,
}: StudySetOverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleCopyLink = async () => {
    setOpen(false);
    try {
      const url = `${window.location.origin}${detailHref}`;
      await navigator.clipboard.writeText(url);
      onNotify?.("Exam link copied to clipboard.");
    } catch {
      onNotify?.("Unable to copy link.");
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${studySet.title}`}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          <Link
            href={detailHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            <ExternalLink className="h-3.5 w-3.5 text-brand-teal" />
            View details
          </Link>

          {!isPublic && onToggleSave && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onToggleSave(studySet);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-surface-muted"
            >
              {studySet.isSaved ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5 text-brand-teal" />
                  Remove from My Library
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 text-brand-teal" />
                  Save to My Library
                </>
              )}
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopyLink()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            <Copy className="h-3.5 w-3.5 text-foreground-muted" />
            Copy study-set link
          </button>
        </div>
      )}
    </div>
  );
}
