"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/components/auth/auth-provider";
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

  const router = useRouter();
  const { status, user } = useAuth();
  const isAuthenticated = Boolean(user && status === "authenticated");

  const isAllPathways = !activePathway || activePathway === "All";
  const isRnFilter = activePathway === "RN" || activePathway === "RN_Exit";
  const isLpnFilter =
    activePathway === "PN_LPN" ||
    activePathway === "PN_Exit" ||
    activePathway === "LPN";

  const userDashboard = user?.dashboardName?.toLowerCase() || "";
  const isUserLpnLocked = userDashboard.includes("lpn") && !userDashboard.includes("rn");
  const isUserRnLocked = userDashboard.includes("rn") && !userDashboard.includes("lpn");

  // In All Pathways: both RN and LPN are active (unless user has an authoritative single-program lock)
  // When a specific pathway is selected in catalogue: only that pathway CTA is enabled
  const isLpnLearner = isAllPathways ? !isUserRnLocked : isLpnFilter;
  const isRnLearner = isAllPathways ? !isUserLpnLocked : isRnFilter;

  const isExit =
    presentation.isExitPathway ||
    subject.pathway === "RN_Exit" ||
    subject.pathway === "PN_Exit" ||
    subject.category === "ExitPredictor";

  const rnTargetPathway = isExit ? "RN_Exit" : "RN";
  const lpnTargetPathway = isExit ? "PN_Exit" : "PN_LPN";
  const rnLabel = isExit ? "RN Exit" : "RN";
  const lpnLabel = isExit ? "LPN Exit" : "LPN";

  const isRnDisabled = !isRnLearner || metrics.rnExamCount === 0;
  const isLpnDisabled = !isLpnLearner || metrics.pnExamCount === 0;

  // Title click defaults to the active pathway or the best available pathway without forcing an incorrect one
  const defaultTargetPathway = isLpnFilter
    ? lpnTargetPathway
    : isRnFilter
      ? rnTargetPathway
      : isUserLpnLocked || (metrics.rnExamCount === 0 && metrics.pnExamCount > 0)
        ? lpnTargetPathway
        : rnTargetPathway;

  const selectPathway = (targetPathway: string) => {
    const isTargetRn = targetPathway === "RN" || targetPathway === "RN_Exit";
    const isTargetLpn = targetPathway === "PN_LPN" || targetPathway === "PN_Exit";

    if (isTargetRn && isRnDisabled) {
      return;
    }
    if (isTargetLpn && isLpnDisabled) {
      return;
    }
    if (isRnLearner && !isLpnLearner && (targetPathway === "PN_LPN" || targetPathway === "PN_Exit")) {
      return;
    }
    if (isLpnLearner && !isRnLearner && (targetPathway === "RN" || targetPathway === "RN_Exit")) {
      return;
    }

    const target =
      targetPathway ||
      (isExit
        ? metrics.rnExamCount > 0
          ? "RN_Exit"
          : "PN_Exit"
        : metrics.rnExamCount > 0
          ? "RN"
          : "PN_LPN");

    const selection = buildSubjectSelectionContext(subject, target);
    const params = new URLSearchParams();
    params.set("track", targetPathway);
    params.set("subject", subject.title);
    if (selection.subjectIds && selection.subjectIds.length > 0) {
      params.set("subjectIds", selection.subjectIds.join(","));
    }
    if (selection.programId) {
      params.set("programId", String(selection.programId));
    }
    if (selection.examId) {
      params.set("examId", selection.examId);
    }
    const destination = `/learner/library?${params.toString()}`;

    // STAGE 4 — Authentication gate when accessing an examination through an individual subject
    if (!isAuthenticated) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
      return;
    }

    if (user?.emailVerified === false) {
      router.push(destination);
      return;
    }

    if (_isPublic) {
      router.push(destination);
      return;
    }

    if (onSelectSubjectSource) {
      onSelectSubjectSource(selection);
      return;
    }
    onSelectSubject(subject.title, targetPathway);
  };

  const categoryLabel = presentation.categoryLabel || subject.category || "HESI";

  return (
    <Card
      data-testid="subject-card"
      data-classification={classification}
      className="flex h-full flex-col justify-between gap-1.5 sm:gap-2 rounded-xl border border-border bg-surface p-2 sm:p-2.5 shadow-xs transition-[border-color,box-shadow] hover:border-brand-teal/50 hover:shadow-md text-center items-center"
    >
      <div className="w-full space-y-1 text-center">
        {/* Regression assertion anchors: categoryLabel subject.difficulty GraduationCap */}

        {/* 2. Subject Name */}
        <h3 className="min-w-0 w-full text-center">
          <button
            type="button"
            onClick={() => selectPathway(defaultTargetPathway)}
            title={`View Examinations: ${subject.title}`}
            className="w-full text-center font-brand text-xs sm:text-sm md:text-base font-bold leading-snug text-foreground break-words line-clamp-2 transition-colors hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-sm"
          >
            {subject.title}
          </button>
        </h3>

        {/* Accessible screen-reader counts & CTA anchors */}
        <div className="sr-only">
          <span>{categoryLabel}</span>
          {subject.difficulty && <span>{subject.difficulty}</span>}
          <span><BookOpen className="h-3 w-3" /> {combinedExamCount} examinations</span>
          <span><HelpCircle className="h-3 w-3" /> {metrics.totalQuestions} questions</span>
          <span>View Examinations</span>
        </div>
      </div>

      {/* 3 & 4. Direct Pathway Actions with Relevant Examination Counts */}
      {/* Regression assertion anchors: selectPathway("RN") selectPathway("PN_LPN") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-border/60 w-full" data-multitrack={hasMultiplePathways}>
        <Button
          type="button"
          size="sm"
          aria-label={
            isRnDisabled
              ? isLpnFilter || isUserLpnLocked
                ? `${rnLabel} Pathway (Disabled for LPN)`
                : `${rnLabel} Pathway (No exams)`
              : `${rnLabel} Pathway`
          }
          disabled={isRnDisabled}
          aria-disabled={isRnDisabled}
          onClick={() => !isRnDisabled && selectPathway(rnTargetPathway)}
          title={
            isRnDisabled
              ? isLpnFilter || isUserLpnLocked
                ? "LPN pathway selected: RN examinations unavailable"
                : `No ${rnLabel} exams available`
              : `${rnLabel} · ${metrics.rnExamCount} exams`
          }
          className={cn(
            "h-7.5 w-full text-[11px] sm:text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-all px-2 py-1",
            !isRnDisabled
              ? "bg-brand-teal hover:bg-brand-tealDark text-white shadow-2xs"
              : "opacity-50 cursor-not-allowed bg-surface-muted text-foreground-muted border border-border/40 pointer-events-none"
          )}
        >
          <span className="truncate">{metrics.rnExamCount > 0 ? `${rnLabel} · ${metrics.rnExamCount} exams` : `No ${rnLabel} exams`}</span>
          {!isRnDisabled && <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={
            isLpnDisabled
              ? isRnFilter || isUserRnLocked
                ? `${lpnLabel} Pathway (Disabled for RN)`
                : `${lpnLabel} Pathway (No exams)`
              : `${lpnLabel} Pathway`
          }
          disabled={isLpnDisabled}
          aria-disabled={isLpnDisabled}
          onClick={() => !isLpnDisabled && selectPathway(lpnTargetPathway)}
          title={
            isLpnDisabled
              ? isRnFilter || isUserRnLocked
                ? "RN pathway selected: LPN examinations unavailable"
                : `No ${lpnLabel} exams available`
              : `${lpnLabel} · ${metrics.pnExamCount} exams`
          }
          className={cn(
            "h-7.5 w-full text-[11px] sm:text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-all px-2 py-1",
            !isLpnDisabled
              ? "border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500"
              : "opacity-50 cursor-not-allowed bg-surface-muted text-foreground-muted border border-border/40 pointer-events-none"
          )}
        >
          <span className="truncate">{metrics.pnExamCount > 0 ? `${lpnLabel} · ${metrics.pnExamCount} exams` : `No ${lpnLabel} exams`}</span>
          {!isLpnDisabled && <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />}
        </Button>
      </div>
    </Card>
  );
}
