"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnswerBreakdownChart } from "@/components/analytics/AnswerBreakdownChart";
import type { SubmittedExamResultDto } from "@/lib/api-types";
import type { ReviewFilterKey } from "@/lib/attempts/exam-experience-state";

interface AssessmentResultsDashboardProps {
  result: SubmittedExamResultDto;
  canAskTutor: boolean;
  onEnterReview: (initialFilter?: ReviewFilterKey) => void;
  onEnterTutor: (questionId?: string) => void;
  onViewPerformance?: () => void;
  onBackToDashboard?: () => void;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function AssessmentResultsDashboard({
  result,
  canAskTutor,
  onEnterReview,
  onEnterTutor,
  onViewPerformance,
  onBackToDashboard,
}: AssessmentResultsDashboardProps) {
  const partialCount = result.partiallyCorrectQuestions ?? 0;
  const unansweredCount =
    result.unansweredQuestions ??
    Math.max(0, result.totalQuestions - (result.totalAnswered ?? result.totalQuestions));
  const wrongCount =
    result.incorrectQuestions ??
    Math.max(0, (result.totalWrong ?? result.totalQuestions - result.correctQuestions) - unansweredCount);

  const missedCount = wrongCount + partialCount + unansweredCount;
  const firstMissedQuestion = result.reviewQuestions?.find(
    (q) => !q.isCorrect
  );

  const sectionBreakdown = result.sectionBreakdown ?? result.categoryBreakdown ?? [];
  const strongestSection =
    sectionBreakdown.length > 0
      ? [...sectionBreakdown].sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)[0]
      : null;
  const focusSection =
    sectionBreakdown.length > 1
      ? [...sectionBreakdown].sort((a, b) => a.accuracyPercentage - b.accuracyPercentage)[0]
      : sectionBreakdown.length === 1 && sectionBreakdown[0].accuracyPercentage < 100
        ? sectionBreakdown[0]
        : null;

  const hasValidThreshold =
    result.passingScorePercentage !== null &&
    result.passingScorePercentage > 0 &&
    result.passed !== null;

  return (
    <div className="space-y-6">
      {/* Authoritative Score Hero */}
      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="teal">Authoritative Assessment Result</Badge>
              {result.pathway && (
                <Badge variant="outline" className="text-[11px]">
                  {result.pathway} Pathway
                </Badge>
              )}
              {result.examCategory && (
                <Badge variant="outline" className="text-[11px]">
                  {result.examCategory}
                </Badge>
              )}
              {result.subjectName && (
                <Badge variant="outline" className="text-[11px]">
                  {result.subjectName}
                </Badge>
              )}
            </div>

            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-foreground">
              {result.examTitle}
            </h1>
            <p className="text-xs text-foreground-secondary">
              Status: <strong>{result.status}</strong> · Submitted{" "}
              {new Date(result.submittedAtUtc).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-brand text-4xl sm:text-5xl font-extrabold text-foreground">
                {result.scorePercentage}%
              </span>
              {typeof result.rawScoreEarned === "number" &&
                typeof result.rawScoreMax === "number" &&
                result.rawScoreMax > 0 && (
                  <span className="text-xs font-semibold text-foreground-secondary">
                    ({result.rawScoreEarned}/{result.rawScoreMax} pts)
                  </span>
                )}
            </div>

            {hasValidThreshold ? (
              result.passed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  <Award className="w-4 h-4" /> Passed (Threshold: {result.passingScorePercentage}%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-400 px-3 py-1 text-xs font-bold text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="w-4 h-4" /> Below Threshold (Target: {result.passingScorePercentage}%)
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted border border-border px-3 py-1 text-xs font-medium text-foreground-secondary">
                <Info className="w-3.5 h-3.5 text-brand-teal" /> No pass threshold configured by exam policy
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid + Breakdown Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Correct
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {result.correctQuestions}
              </div>
              <div className="text-[11px] text-foreground-secondary">
                of {result.totalQuestions} items
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/30 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 dark:text-rose-200">
                <XCircle className="w-4 h-4" /> Incorrect
              </div>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                {wrongCount}
              </div>
              {partialCount > 0 && (
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  +{partialCount} partial credit
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
              <div className="text-xs font-semibold text-foreground-secondary">Unanswered</div>
              <div className="text-2xl font-bold text-foreground">{unansweredCount}</div>
              <div className="text-[11px] text-foreground-muted">
                {result.totalAnswered ?? result.totalQuestions - unansweredCount} answered
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary">
                <Clock className="w-4 h-4 text-brand-teal" /> Time Used
              </div>
              <div className="text-xl font-bold text-foreground">
                {formatDuration(result.timeSpentSeconds)}
              </div>
              <div className="text-[11px] text-foreground-muted">
                {result.isTimed === false || !result.timeLimitMinutes
                  ? "Untimed session"
                  : `${result.timeLimitMinutes}m limit`}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-border bg-background p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary mb-2">
              Response Distribution
            </h2>
            <AnswerBreakdownChart
              correct={result.correctQuestions}
              wrong={wrongCount + partialCount}
              unanswered={unansweredCount}
            />
          </div>
        </div>

        {/* Review withheld notice */}
        {!result.reviewReleased && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40 p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-100">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Question Review & Tutor Withheld by Exam Policy</p>
              <p className="text-amber-800 dark:text-amber-200 mt-0.5">
                {result.modePermissions?.reviewReason ||
                  "This examination does not release authoritative answer keys, rationales, or Tutor explanations after submission."}
              </p>
            </div>
          </div>
        )}

        {/* Primary Next Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          {result.reviewReleased && (
            <Button variant="primary" onClick={() => onEnterReview("All")}>
              <BookOpenCheck className="w-4 h-4 mr-1.5" />
              Review All Questions
            </Button>
          )}

          {result.reviewReleased && missedCount > 0 && (
            <Button variant="outline" onClick={() => onEnterReview("Incorrect")}>
              <XCircle className="w-4 h-4 mr-1.5 text-rose-500" />
              Review Missed Questions ({missedCount})
            </Button>
          )}

          {result.reviewReleased && canAskTutor && (
            <Button
              variant="outline"
              className="border-brand-teal/50 text-brand-teal hover:bg-brand-teal/10"
              onClick={() => onEnterTutor(firstMissedQuestion?.questionId ?? result.reviewQuestions?.[0]?.questionId)}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {firstMissedQuestion ? "Ask Tutor About Missed Questions" : "Open Question Tutor"}
            </Button>
          )}

          {onViewPerformance && (
            <Button variant="ghost" size="sm" onClick={onViewPerformance}>
              <TrendingUp className="w-4 h-4 mr-1.5" />
              View Performance Analytics
            </Button>
          )}

          {onBackToDashboard && (
            <Button variant="ghost" size="sm" onClick={onBackToDashboard}>
              Back to Dashboard
            </Button>
          )}
        </div>
      </section>

      {/* Section / Category Performance Breakdown + Informational Observations */}
      {sectionBreakdown.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-brand text-base font-bold text-foreground">
                Section & Category Breakdown
              </h2>
              <p className="text-xs text-foreground-secondary">
                Accuracy computed strictly from authoritative grading across submitted responses.
              </p>
            </div>
            <Badge variant="outline" className="text-[11px] w-fit">
              {sectionBreakdown.length} Section{sectionBreakdown.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="space-y-3">
            {sectionBreakdown.map((sec) => (
              <div
                key={sec.name}
                className="rounded-xl border border-border bg-background p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-foreground">{sec.name}</span>
                  <div className="flex flex-wrap items-center gap-2 text-foreground-secondary">
                    <span>
                      {sec.correct}/{sec.total} correct
                      {sec.partiallyCorrect > 0 ? ` · ${sec.partiallyCorrect} partial` : ""}
                      {sec.unanswered > 0 ? ` · ${sec.unanswered} skipped` : ""}
                    </span>
                    <span className="font-bold text-foreground">{sec.accuracyPercentage}%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full bg-brand-teal transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, sec.accuracyPercentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {(strongestSection || focusSection) && (
            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-1.5 text-xs">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brand-teal" />
                Informational Performance Observations
              </div>
              {strongestSection && (
                <p className="text-foreground-secondary">
                  Highest recorded section accuracy: <strong>{strongestSection.name}</strong> (
                  {strongestSection.accuracyPercentage}%, {strongestSection.pointsAwarded}/
                  {strongestSection.maxPoints} pts).
                </p>
              )}
              {focusSection && (
                <p className="text-foreground-secondary">
                  Primary area to review next: <strong>{focusSection.name}</strong> (
                  {focusSection.accuracyPercentage}%, {focusSection.incorrect} incorrect
                  {focusSection.unanswered > 0 ? `, ${focusSection.unanswered} unanswered` : ""}).
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
