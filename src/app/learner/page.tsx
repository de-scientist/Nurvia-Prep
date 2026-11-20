"use client";

import * as React from "react";
import Link from "next/link";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { nurviaApi } from "@/lib/api-client";
import type { ExamAttemptSummaryDto, ExamDto } from "@/lib/api-types";
import { computePerformanceSummary } from "@/lib/analytics/performance-analytics";
import { getPersonalizedGreeting } from "@/lib/greeting-utils";
import {
  Sparkles,
  Flame,
  Users,
  GraduationCap,
  Compass,
  BookOpen,
} from "lucide-react";

export default function LearnerDashboardPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = React.useState<ExamAttemptSummaryDto[]>([]);
  const [exams, setExams] = React.useState<ExamDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const [attemptResponse, examResponse] = await Promise.all([
        nurviaApi.getAttemptHistory().catch(() => ({
          success: false,
          data: [] as ExamAttemptSummaryDto[],
          message: "Unable to load attempt history",
        })),
        nurviaApi.getExams({ status: "Published", pageSize: 8 }),
      ]);
      if (!active) return;

      if (attemptResponse.success && attemptResponse.data) {
        setAttempts(attemptResponse.data);
      }
      if (examResponse.success && examResponse.data?.items) {
        setExams(examResponse.data.items);
      }

      if (!examResponse.success && !attemptResponse.success) {
        setError(examResponse.message || ("message" in attemptResponse ? attemptResponse.message : undefined) || "Unable to load your learner dashboard.");
      }
      setLoading(false);
    }

    void loadDashboard();
    return () => { active = false; };
  }, []);

  const completedAttempts = attempts.filter((attempt) =>
    ["Graded", "Submitted"].includes(attempt.status));
  const summary = React.useMemo(() => computePerformanceSummary(attempts), [attempts]);
  const averageScore = summary.averageScore !== null ? Math.round(summary.averageScore) : null;
  const activeAttempts = attempts.filter((attempt) => attempt.status === "InProgress");

  return (
    <LearnerShell>
      <div className="space-y-8">
        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-teal">Learner dashboard</p>
          <h1 className="mt-2 font-brand text-2xl font-bold text-foreground sm:text-3xl">
            {getPersonalizedGreeting(user?.name) || "Welcome to NURVIA"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-secondary">
            Continue an in-progress attempt or choose a published exam. Your activity and results are drawn from your saved account data.
          </p>
        </section>

        {/* Additive Ecosystem Banner */}
        <section className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50/70 via-white to-slate-50/70 p-5 shadow-sm dark:border-teal-900/60 dark:bg-surface">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-100/80 pb-4 dark:border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                    Question of the Day
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Daily Challenge
                  </span>
                </div>
                <p className="text-xs text-foreground-secondary">
                  Solve today&apos;s clinical judgment case question and maintain your daily streak.
                </p>
              </div>
            </div>
            <Link href="/qotd">
              <Button size="sm" className="bg-[#0A5C66] text-white hover:bg-[#084c55] font-semibold text-xs">
                Solve Today&apos;s Question →
              </Button>
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 pt-1">
            <Link
              href="/nclex/study"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <GraduationCap className="h-4 w-4 text-teal-600" />
              <span className="truncate">NCLEX Hub</span>
            </Link>
            <Link
              href="/study-guides"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <span className="truncate">Study Guides</span>
            </Link>
            <Link
              href="/groups"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <Users className="h-4 w-4 text-rose-600" />
              <span className="truncate">Study Groups</span>
            </Link>
            <Link
              href="/mentors"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <Compass className="h-4 w-4 text-purple-600" />
              <span className="truncate">Nurse Mentors</span>
            </Link>
            <Link
              href="/insights"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <Flame className="h-4 w-4 text-amber-600" />
              <span className="truncate">Pass Rates</span>
            </Link>
            <Link
              href="/forum"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <Users className="h-4 w-4 text-sky-600" />
              <span className="truncate">Community</span>
            </Link>
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}

        {loading ? (
          <p className="py-8 text-center text-sm text-foreground-secondary" aria-live="polite">Loading your saved activity…</p>
        ) : !error && (
          <>
            <section aria-label="Your progress" className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <p className="text-sm text-foreground-secondary">Completed attempts</p>
                <p className="mt-2 font-brand text-3xl font-bold text-foreground">{completedAttempts.length}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-foreground-secondary">Average recorded score</p>
                <p className="mt-2 font-brand text-3xl font-bold text-foreground">{averageScore === null ? "—" : `${averageScore}%`}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-foreground-secondary">Available exams</p>
                <p className="mt-2 font-brand text-3xl font-bold text-foreground">{exams.length}</p>
              </Card>
            </section>

            {activeAttempts.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-brand text-xl font-bold text-foreground">Continue an attempt</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {activeAttempts.map((attempt) => (
                    <Card key={attempt.attemptId} className="flex items-center justify-between gap-4 p-5">
                      <div>
                        <h3 className="font-semibold text-foreground">{attempt.examTitle}</h3>
                        <p className="mt-1 text-xs text-foreground-muted">{attempt.totalQuestions} questions · Started {new Date(attempt.startedAtUtc).toLocaleDateString()}</p>
                      </div>
                      <Link href={`/exam-session?attemptId=${encodeURIComponent(attempt.attemptId)}`}>
                        <Button size="sm">Continue</Button>
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-brand text-xl font-bold text-foreground">Published exams</h2>
                <Link href="/learner/exams" className="text-sm font-semibold text-brand-teal hover:underline">View exam library</Link>
              </div>
              {exams.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="flex flex-col justify-between gap-4 p-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">{exam.pathway} · {exam.category}</p>
                        <h3 className="mt-2 font-brand text-lg font-bold text-foreground">{exam.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-foreground-secondary">{exam.description}</p>
                        <p className="mt-3 text-xs text-foreground-muted">{exam.totalQuestions} questions · {exam.timeLimitMinutes} minutes</p>
                      </div>
                      <Link href={`/exam-session?examId=${encodeURIComponent(exam.id)}`}>
                        <Button className="w-full">Start exam</Button>
                      </Link>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6">
                  <p className="font-semibold text-foreground">No published exams are available yet.</p>
                  <p className="mt-1 text-sm text-foreground-secondary">Your dashboard will show assessments here when they are published.</p>
                  <Link href="/exams" className="mt-4 inline-block text-sm font-semibold text-brand-teal hover:underline">Explore the exam catalog</Link>
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-brand text-xl font-bold text-foreground">Recent attempts</h2>
              {attempts.length ? (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted text-xs text-foreground-secondary">
                      <tr><th className="p-3 font-semibold">Exam</th><th className="p-3 font-semibold">Started</th><th className="p-3 font-semibold">Status</th><th className="p-3 text-right font-semibold">Score</th></tr>
                    </thead>
                    <tbody>
                      {attempts.slice(0, 6).map((attempt) => (
                        <tr key={attempt.attemptId} className="border-b border-border last:border-0">
                          <td className="p-3 font-medium text-foreground">{attempt.examTitle}</td>
                          <td className="p-3 text-foreground-secondary">{new Date(attempt.startedAtUtc).toLocaleDateString()}</td>
                          <td className="p-3 text-foreground-secondary">{attempt.status}</td>
                          <td className="p-3 text-right font-semibold text-foreground">
                            {typeof attempt.scorePercentage === "number" ? `${attempt.scorePercentage}%` : "—"}
                            {completedAttempts.includes(attempt) && (
                              <Link href={`/learner/attempts/${encodeURIComponent(attempt.attemptId)}`} className="ml-3 text-brand-teal hover:underline">Result</Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Card className="p-6 text-sm text-foreground-secondary">No exam attempts have been recorded for this account.</Card>
              )}
            </section>
          </>
        )}
      </div>
    </LearnerShell>
  );
}
