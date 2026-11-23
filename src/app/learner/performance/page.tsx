"use client";

import * as React from "react";
import Link from "next/link";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";
import type { ExamAttemptSummaryDto } from "@/lib/api-types";
import {
  computePerformanceSummary,
  normalizeTrackLabel,
} from "@/lib/analytics/performance-analytics";
import { ScoreProgressionChart } from "@/components/analytics/ScoreProgressionChart";
import { CategoryPerformanceChart } from "@/components/analytics/CategoryPerformanceChart";
import { AnswerBreakdownChart } from "@/components/analytics/AnswerBreakdownChart";
import { TrackComparisonChart } from "@/components/analytics/TrackComparisonChart";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Compass,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export default function PerformancePage() {
  const [attempts, setAttempts] = React.useState<ExamAttemptSummaryDto[]>([]);
  const [selectedTrack, setSelectedTrack] = React.useState<string>("All");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void nurviaApi.getAttemptHistory({ fetchAll: true }).then((response) => {
      if (!active) return;
      if (response.success) {
        setAttempts(response.data || []);
      } else {
        setError(response.message || "Unable to load saved performance records.");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const availableTracks = React.useMemo(() => {
    const tracks = new Set<string>(["All", "RN Track", "PN / LPN Track"]);
    for (const a of attempts) {
      tracks.add(normalizeTrackLabel(a.pathway, a.examTitle));
    }
    return Array.from(tracks);
  }, [attempts]);

  const filteredAttempts = React.useMemo(() => {
    if (selectedTrack === "All") return attempts;
    return attempts.filter((a) => {
      const normalized = normalizeTrackLabel(a.pathway, a.examTitle);
      if (selectedTrack === "RN Track") {
        return normalized === "RN Track" || normalized === "RN Exit" || a.pathway === "RN";
      }
      if (selectedTrack === "PN / LPN Track") {
        return normalized === "PN / LPN Track" || normalized === "PN / LPN Exit" || a.pathway === "PN_LPN";
      }
      return normalized === selectedTrack;
    });
  }, [attempts, selectedTrack]);

  const summary = React.useMemo(
    () => computePerformanceSummary(filteredAttempts),
    [filteredAttempts]
  );

  const completed = React.useMemo(
    () =>
      filteredAttempts.filter(
        (attempt) =>
          ["Graded", "Submitted"].includes(attempt.status) &&
          typeof attempt.scorePercentage === "number"
      ),
    [filteredAttempts]
  );

  return (
    <LearnerShell>
      <div className="space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="teal">RN &amp; PN / LPN Performance Intelligence</Badge>
            <h1 className="font-brand text-2xl font-bold text-foreground sm:text-3xl">
              Clinical Performance &amp; Analytics
            </h1>
            <p className="max-w-2xl text-sm text-foreground-secondary">
              Every score, pass rate, and domain metric below is calculated strictly from your authoritative RN and PN / LPN examination records.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by Nursing Pathway">
            {availableTracks.map((track) => (
              <button
                key={track}
                type="button"
                aria-pressed={selectedTrack === track}
                onClick={() => setSelectedTrack(track)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  selectedTrack === track
                    ? "border-brand-teal bg-brand-teal text-white"
                    : "border-border bg-surface text-foreground-secondary hover:bg-surface-muted"
                }`}
              >
                {track === "All" ? "All Pathways (RN & PN/LPN)" : track}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-28 animate-pulse p-5" />
            ))}
          </div>
        ) : (
          !error && (
            <>
              {/* Authoritative KPI Summary */}
              <section
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                aria-label="Performance summary"
              >
                <Card className="p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground-secondary">
                    <span>Average Recorded Score</span>
                    <TrendingUp className="h-4 w-4 text-brand-teal" />
                  </div>
                  <p className="font-brand text-3xl font-bold text-foreground">
                    {summary.averageScore === null ? "—" : `${summary.averageScore}%`}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    {summary.scoredAttempts > 0
                      ? `Across ${summary.scoredAttempts} graded attempt${summary.scoredAttempts > 1 ? "s" : ""}`
                      : "No graded attempts recorded yet"}
                  </p>
                </Card>

                <Card className="p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground-secondary">
                    <span>Pass Rate (≥75%)</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="font-brand text-3xl font-bold text-foreground">
                    {summary.passRate === null ? "—" : `${summary.passRate}%`}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    {summary.passedCount} passed of {summary.scoredAttempts} scored
                  </p>
                </Card>

                <Card className="p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground-secondary">
                    <span>Highest Recorded Score</span>
                    <Award className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="font-brand text-3xl font-bold text-foreground">
                    {summary.bestScore === null ? "—" : `${summary.bestScore}%`}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    Latest:{" "}
                    {summary.latestScore === null ? "—" : `${summary.latestScore}%`}
                  </p>
                </Card>

                <Card className="p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground-secondary">
                    <span>Submitted / Graded Exams</span>
                    <BarChart3 className="h-4 w-4 text-brand-teal" />
                  </div>
                  <p className="font-brand text-3xl font-bold text-foreground">
                    {summary.completedAttempts}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    {summary.inProgressAttempts} active in progress
                  </p>
                </Card>
              </section>

              {/* Charts Grid */}
              <section className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5 space-y-3">
                  <div>
                    <h2 className="font-brand text-base font-bold text-foreground">
                      Score Progression Over Time
                    </h2>
                    <p className="text-xs text-foreground-secondary">
                      Longitudinal score trajectory compared to the 75% benchmark.
                    </p>
                  </div>
                  <ScoreProgressionChart data={summary.progression} />
                </Card>

                <Card className="p-5 space-y-3">
                  <div>
                    <h2 className="font-brand text-base font-bold text-foreground">
                      Accuracy by Clinical Category / Subject
                    </h2>
                    <p className="text-xs text-foreground-secondary">
                      Sorted from lowest to highest average accuracy to highlight priority topics.
                    </p>
                  </div>
                  <CategoryPerformanceChart data={summary.byCategory} />
                </Card>

                <Card className="p-5 space-y-3">
                  <div>
                    <h2 className="font-brand text-base font-bold text-foreground">
                      RN vs PN / Exit Track Comparison
                    </h2>
                    <p className="text-xs text-foreground-secondary">
                      Average score across nursing tracks present in your attempt records.
                    </p>
                  </div>
                  <TrackComparisonChart data={summary.byTrack} />
                </Card>

                <Card className="p-5 space-y-3">
                  <div>
                    <h2 className="font-brand text-base font-bold text-foreground">
                      Cumulative Question Outcomes
                    </h2>
                    <p className="text-xs text-foreground-secondary">
                      Total correct, incorrect, and unanswered items across graded attempts.
                    </p>
                  </div>
                  <AnswerBreakdownChart
                    correct={summary.totalCorrect}
                    wrong={summary.totalWrong}
                    unanswered={summary.totalUnanswered}
                  />
                </Card>
              </section>

              {/* Personalized Data-Driven Recommendations */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-brand-teal" />
                  <h2 className="font-brand text-xl font-bold text-foreground">
                    Personalized Study Recommendations
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {summary.recommendations.map((rec) => (
                    <Card
                      key={rec.id}
                      className="p-5 flex flex-col justify-between gap-4 border-l-4 border-l-brand-teal"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-brand-teal shrink-0" />
                          <h3 className="font-semibold text-sm text-foreground">{rec.title}</h3>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground-secondary">
                          {rec.description}
                        </p>
                      </div>
                      <Link href={rec.href}>
                        <Button variant="outline" size="sm" className="text-xs">
                          {rec.actionLabel}
                        </Button>
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Attempt Breakdown Table */}
              <section className="space-y-3">
                <h2 className="font-brand text-xl font-bold text-foreground">
                  Score by Submitted Attempt
                </h2>
                {completed.length ? (
                  <div className="space-y-4">
                    {completed.map((attempt) => {
                      const score = Math.max(0, Math.min(100, attempt.scorePercentage || 0));
                      return (
                        <Card key={attempt.attemptId} className="space-y-3 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-foreground">{attempt.examTitle}</h3>
                              <p className="mt-1 text-xs text-foreground-muted">
                                {normalizeTrackLabel(attempt.pathway, attempt.examTitle)} ·{" "}
                                {attempt.submittedAtUtc
                                  ? new Date(attempt.submittedAtUtc).toLocaleString()
                                  : "Submission date recorded"}
                              </p>
                            </div>
                            <span className="shrink-0 font-bold text-foreground">{score}%</span>
                          </div>
                          <div
                            className="h-3 overflow-hidden rounded-full bg-surface-muted"
                            role="img"
                            aria-label={`${attempt.examTitle}: ${score} percent score`}
                          >
                            <div
                              className="h-full rounded-full bg-brand-teal"
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <p className="text-xs text-foreground-secondary">
                            {score}% across {attempt.totalQuestions} questions.
                            {attempt.passed === true
                              ? " Passed."
                              : attempt.passed === false
                                ? " Did not meet the exam's configured passing score."
                                : ""}
                          </p>
                          <Link
                            href={`/learner/attempts/${encodeURIComponent(attempt.attemptId)}`}
                            className="inline-block text-sm font-semibold text-brand-teal hover:underline"
                          >
                            View result and review
                          </Link>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="p-6">
                    <p className="font-semibold text-foreground">No submitted results yet.</p>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      Once you submit an exam, its saved score will appear here.
                    </p>
                    <Link
                      href="/learner/exams"
                      className="mt-4 inline-block text-sm font-semibold text-brand-teal hover:underline"
                    >
                      Choose an exam
                    </Link>
                  </Card>
                )}
              </section>
            </>
          )
        )}
      </div>
    </LearnerShell>
  );
}
