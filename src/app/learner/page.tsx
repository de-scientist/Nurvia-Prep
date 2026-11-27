"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { nurviaApi } from "@/lib/api-client";
import type {
  ExamAttemptSummaryDto,
  StudySetCardDto,
  SubjectCardDto,
  StudyLibrarySummaryDto,
  UserSubscriptionDto,
} from "@/lib/api-types";
import { SubjectCard } from "@/components/study/SubjectCard";
import { TableSkeleton } from "@/components/shared/feedback";
import { computePerformanceSummary } from "@/lib/analytics/performance-analytics";
import { getPersonalizedGreeting } from "@/lib/greeting-utils";
import {
  Sparkles,
  Flame,
  Users,
  GraduationCap,
  Stethoscope,
  Compass,
  BookOpen,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LearnerDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [attempts, setAttempts] = React.useState<ExamAttemptSummaryDto[]>([]);
  const [exams, setExams] = React.useState<StudySetCardDto[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectCardDto[]>([]);
  const [summaryData, setSummaryData] = React.useState<StudyLibrarySummaryDto | null>(null);
  const [subscription, setSubscription] = React.useState<UserSubscriptionDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const [attemptResponse, examResponse, subjectsResponse, summaryResponse, subResponse] = await Promise.all([
        nurviaApi.getAttemptHistory().catch(() => ({
          success: false,
          data: [] as ExamAttemptSummaryDto[],
          message: "Unable to load attempt history",
        })),
        nurviaApi.getStudyLibrary({ pageSize: 6 }),
        nurviaApi.getStudyLibrarySubjects({ pageSize: 6 }),
        nurviaApi.getStudyLibrarySummary(),
        nurviaApi.getMySubscription().catch(() => ({
          success: false,
          data: null,
        })),
      ]);
      if (!active) return;

      if (attemptResponse.success && attemptResponse.data) {
        setAttempts(attemptResponse.data);
      }
      if (examResponse.success && examResponse.data?.items) {
        setExams(examResponse.data.items);
      }
      if (subjectsResponse.success && subjectsResponse.data?.items) {
        setSubjects(subjectsResponse.data.items);
      }
      if (summaryResponse.success && summaryResponse.data) {
        setSummaryData(summaryResponse.data);
      }
      if (subResponse.success && subResponse.data) {
        setSubscription(subResponse.data.activeSubscription);
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
  const perfSummary = React.useMemo(() => computePerformanceSummary(attempts), [attempts]);
  const averageScore = perfSummary.averageScore !== null ? Math.round(perfSummary.averageScore) : null;
  const activeAttempts = attempts.filter((attempt) => attempt.status === "InProgress");
  const totalEligibleExams = summaryData?.totalPublishedStudySets ?? 0;

  return (
    <LearnerShell>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-surface via-surface to-teal-50/30 p-6 sm:p-8 shadow-xs dark:to-teal-950/20">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-teal">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>Learner Workspace</span>
            </div>
            <h1 className="mt-1 font-brand text-2xl font-bold text-foreground sm:text-3xl">
              {getPersonalizedGreeting(user?.name) || "Welcome to NURVIA"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-secondary">
              Access the complete RN and LPN examination catalogue, continue active attempts, and master nursing clinical judgment.
            </p>
          </div>
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
            <a
              href="https://www.prepford.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 text-xs font-semibold text-foreground hover:border-teal-400 hover:text-teal-700 transition-all"
            >
              <GraduationCap className="h-4 w-4 text-teal-600" />
              <span className="truncate">PrepFord Licensure</span>
            </a>
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
          <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading your learner activity">
            {/* Progress stats skeleton */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-5 space-y-3">
                  <div className="h-4 w-32 rounded bg-surface-muted animate-pulse" />
                  <div className="h-8 w-16 rounded bg-surface-muted animate-pulse" />
                </Card>
              ))}
            </div>

            {/* Subject catalogue skeleton */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="h-6 w-56 rounded bg-surface-muted animate-pulse" />
                <div className="h-3 w-72 rounded bg-surface-muted animate-pulse" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="h-48 p-5 space-y-3">
                    <div className="h-5 w-24 rounded-full bg-surface-muted animate-pulse" />
                    <div className="h-6 w-3/4 rounded bg-surface-muted animate-pulse" />
                    <div className="h-4 w-full rounded bg-surface-muted animate-pulse" />
                    <div className="h-9 w-full rounded-lg bg-surface-muted animate-pulse mt-4" />
                  </Card>
                ))}
              </div>
            </div>

            {/* Examinations catalogue skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-52 rounded bg-surface-muted animate-pulse" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-52 p-5 space-y-3">
                    <div className="h-5 w-28 rounded-full bg-surface-muted animate-pulse" />
                    <div className="h-6 w-3/4 rounded bg-surface-muted animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-surface-muted animate-pulse" />
                    <div className="h-9 w-full rounded-lg bg-surface-muted animate-pulse mt-4" />
                  </Card>
                ))}
              </div>
            </div>

            {/* Recent attempts skeleton */}
            <div className="space-y-3">
              <div className="h-6 w-36 rounded bg-surface-muted animate-pulse" />
              <TableSkeleton rows={4} columns={4} />
            </div>
          </div>
        ) : !error && (
          <>
            <section aria-label="Your progress" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border border-border/80 bg-surface p-5 flex flex-col justify-between shadow-xs hover:border-brand-teal/40 transition-all">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Completed attempts</p>
                  <p className="mt-2 font-brand text-3xl font-bold text-foreground">{completedAttempts.length}</p>
                </div>
              </Card>
              <Card className="rounded-2xl border border-border/80 bg-surface p-5 flex flex-col justify-between shadow-xs hover:border-brand-teal/40 transition-all">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Average recorded score</p>
                  <p className="mt-2 font-brand text-3xl font-bold text-foreground">{averageScore === null ? "—" : `${averageScore}%`}</p>
                </div>
              </Card>
              <Card className="rounded-2xl border border-border/80 bg-surface p-5 flex flex-col justify-between shadow-xs hover:border-brand-teal/40 transition-all">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Available exams</p>
                  <p className="mt-2 font-brand text-3xl font-bold text-foreground">{totalEligibleExams.toLocaleString()}</p>
                </div>
              </Card>
              <Card className="rounded-2xl border border-border/80 bg-surface p-5 flex flex-col justify-between shadow-xs hover:border-brand-teal/40 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Subscription status</p>
                    <CreditCard className="h-4 w-4 text-brand-teal" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                        subscription?.status?.toLowerCase() === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-surface-muted text-foreground-secondary border border-border"
                      )}
                    >
                      {subscription?.status?.toLowerCase() === "active"
                        ? `${subscription.planName || "Active Plan"}`
                        : "Starter / Inactive"}
                    </span>
                  </div>
                </div>
                <Link href="/learner/subscription" className="mt-3 block">
                  <Button
                    variant={subscription?.status?.toLowerCase() === "active" ? "outline" : "primary"}
                    size="sm"
                    className={cn(
                      "w-full text-xs h-8 font-semibold rounded-lg",
                      subscription?.status?.toLowerCase() === "active"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        : "bg-primary hover:bg-primary-hover text-white shadow-xs"
                    )}
                  >
                    {subscription?.status?.toLowerCase() === "active"
                      ? "Active"
                      : "Subscribe"}
                  </Button>
                </Link>
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

            {/* Academic Subject Catalogue with Unified RN / PN Selection */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-brand text-xl font-bold text-foreground">
                    Academic Subject Catalogue
                  </h2>
                  <p className="text-xs text-foreground-secondary">
                    Explore authoritative RN and LPN nursing subjects with direct pathway navigation.
                  </p>
                </div>
                <Link
                  href="/learner/library"
                  className="text-sm font-semibold text-brand-teal hover:underline flex items-center gap-1"
                >
                  View all subjects
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {subjects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {subjects.map((subject) => (
                    <SubjectCard
                      key={subject.presentationId ?? subject.id}
                      subject={subject}
                      onSelectSubjectSource={(selection) => {
                        const qs = new URLSearchParams({
                          subject: selection.subjectName,
                          track: selection.pathway,
                          programId: String(selection.programId),
                        });
                        if (selection.subjectIds.length > 0) {
                          qs.set("subjectIds", selection.subjectIds.join(","));
                        }
                        if (selection.examId) {
                          qs.set("examId", selection.examId);
                        }
                        router.push(`/learner/library?${qs.toString()}`);
                      }}
                      onSelectSubject={(subjectName, selectedPathway) => {
                        const trackParam = selectedPathway ? `&track=${encodeURIComponent(selectedPathway)}` : "";
                        router.push(`/learner/library?subject=${encodeURIComponent(subjectName)}${trackParam}`);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-6 text-sm text-foreground-secondary">
                  No subjects currently available.
                </Card>
              )}
            </section>

            {/* Published Examinations Catalogue */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-brand text-xl font-bold text-foreground">Published Examinations</h2>
                <Link href="/learner/library" className="text-sm font-semibold text-brand-teal hover:underline flex items-center gap-1">
                  View complete library ({totalEligibleExams.toLocaleString()})
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {exams.length ? (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="flex flex-col justify-between gap-2.5 p-3.5 sm:p-4 rounded-xl hover:border-brand-teal/50 transition-colors">
                      <div className="space-y-1.5">
                        <div className="sr-only">
                          <span>{exam.pathway.replace("_", " ")} · {exam.category}</span>
                          {exam.difficulty && <span>{exam.difficulty}</span>}
                        </div>
                        <h3 className="font-brand text-sm sm:text-base font-bold text-foreground line-clamp-2">{exam.title}</h3>
                        <p className="line-clamp-2 text-xs leading-relaxed text-foreground-secondary">{exam.description}</p>
                        <p className="text-xs text-foreground-muted">{exam.totalQuestions} questions · {exam.timeLimitMinutes} minutes</p>
                      </div>
                      <Link
                        href={
                          user
                            ? `/exam-session?examId=${encodeURIComponent(exam.id)}`
                            : `/sign-in?returnTo=${encodeURIComponent(`/exam-session?examId=${encodeURIComponent(exam.id)}`)}`
                        }
                        className="block w-full"
                      >
                        <Button size="sm" className="w-full h-7.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-brand-teal hover:bg-brand-tealDark text-white shadow-2xs">Start Exam</Button>
                      </Link>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6">
                  <p className="font-semibold text-foreground">No published examinations are available yet.</p>
                  <p className="mt-1 text-sm text-foreground-secondary">Your dashboard will show assessments here when they are published.</p>
                  <Link href="/learner/library" className="mt-4 inline-block text-sm font-semibold text-brand-teal hover:underline">Explore the exam catalog</Link>
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
                              <>
                                <Link href={`/learner/attempts/${encodeURIComponent(attempt.attemptId)}`} className="ml-3 text-brand-teal hover:underline">Result</Link>
                                {attempt.canReview !== false && attempt.allowReview !== false && (
                                  <Link href={`/learner/attempts/${encodeURIComponent(attempt.attemptId)}?stage=review`} className="ml-3 text-brand-teal hover:underline">Review</Link>
                                )}
                              </>
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
