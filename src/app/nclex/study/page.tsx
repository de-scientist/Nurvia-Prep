"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { ExamAttemptSummaryDto, QotdQuestionDto } from "@/lib/api-types";
import { computePerformanceSummary } from "@/lib/analytics/performance-analytics";
import {
  Flame,
  Target,
  Sparkles,
  Award,
  Play,
  BookOpen,
  Headphones,
  FileText,
  Users,
  ArrowRight,
  ShieldCheck,
  Clock,
  Activity,
  HeartHandshake,
  Brain,
  Pill,
} from "lucide-react";

interface BlueprintCategory {
  title: string;
  weight: string;
  matchKey: string;
  icon: React.ReactNode;
}

const NCLEX_CLIENT_NEEDS: BlueprintCategory[] = [
  {
    title: "Management of Care & Safety (Delegation/Prioritization)",
    weight: "17 – 23%",
    matchKey: "management",
    icon: <ShieldCheck className="h-5 w-5 text-teal-600" />,
  },
  {
    title: "Safety & Infection Control (PPE / Standard Precautions)",
    weight: "9 – 15%",
    matchKey: "safety",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
  },
  {
    title: "Pharmacological & Parenteral Therapies",
    weight: "12 – 18%",
    matchKey: "pharm",
    icon: <Pill className="h-5 w-5 text-amber-600" />,
  },
  {
    title: "Reduction of Risk Potential (Diagnostics, Labs, Vitals)",
    weight: "9 – 15%",
    matchKey: "risk",
    icon: <Activity className="h-5 w-5 text-indigo-600" />,
  },
  {
    title: "Physiological Adaptation (Complex Acute & Chronic Care)",
    weight: "11 – 17%",
    matchKey: "physio",
    icon: <HeartHandshake className="h-5 w-5 text-rose-600" />,
  },
  {
    title: "Psychosocial Integrity (Crisis, Coping, Mental Health)",
    weight: "6 – 12%",
    matchKey: "psycho",
    icon: <Brain className="h-5 w-5 text-purple-600" />,
  },
  {
    title: "Health Promotion & Maintenance (Maternity & Pediatrics)",
    weight: "6 – 12%",
    matchKey: "promotion",
    icon: <Award className="h-5 w-5 text-sky-600" />,
  },
];

export default function NclexStudyHubPage() {
  const [qotd, setQotd] = React.useState<QotdQuestionDto | null>(null);
  const [streak, setStreak] = React.useState<number>(0);
  const [attempts, setAttempts] = React.useState<ExamAttemptSummaryDto[]>([]);

  React.useEffect(() => {
    let active = true;
    async function loadStudyData() {
      const [qotdRes, histRes, attemptsRes] = await Promise.allSettled([
        nurviaApi.getQotdToday(),
        nurviaApi.getQotdHistory(),
        nurviaApi.getAttemptHistory({ fetchAll: true }),
      ]);
      if (!active) return;

      if (qotdRes.status === "fulfilled" && qotdRes.value.success && qotdRes.value.data) {
        setQotd(qotdRes.value.data);
      }
      if (histRes.status === "fulfilled" && histRes.value.success && histRes.value.data) {
        setStreak(histRes.value.data.streak ?? 0);
      }
      if (attemptsRes.status === "fulfilled" && attemptsRes.value.success && attemptsRes.value.data) {
        setAttempts(attemptsRes.value.data);
      }
    }
    void loadStudyData();
    return () => {
      active = false;
    };
  }, []);

  const summary = React.useMemo(() => computePerformanceSummary(attempts), [attempts]);
  const totalPracticedQuestions = summary.totalCorrect + summary.totalWrong;

  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 dark:bg-background py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-4">
            <Link href="/learner" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/nursing-exams/rn" className="hover:underline">
              NCLEX
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300">Study Hub</span>
          </div>

          {/* Hero Command Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 sm:p-10 text-white shadow-xl mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold">
                    NextGen NCLEX Study Hub
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-0.5 text-xs font-bold text-amber-300">
                    <Flame className="h-3.5 w-3.5" />
                    {streak} Day QOTD Streak
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Personal NCLEX Readiness Hub
                </h1>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Prepare across every NCSBN Client Needs category with published examinations, clinical rationales, and daily active-recall challenges.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/learner/exams?track=RN_Exit">
                    <Button className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-5 py-2.5 inline-flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Browse RN Exit & Licensure Exams
                    </Button>
                  </Link>
                  <Link href="/qotd">
                    <Button variant="outline" className="rounded-xl border-teal-400 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                      Solve Question of the Day
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Authoritative Recorded Readiness Box */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-teal-900/40 border border-teal-700/50 p-6 text-center min-w-[230px]">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  Average Recorded Score
                </span>
                <div className="mt-2 text-5xl font-black text-white">
                  {summary.averageScore !== null ? `${summary.averageScore}%` : "—"}
                </div>
                <Badge className="mt-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold">
                  {summary.passRate !== null
                    ? `${summary.passRate}% PASS RATE`
                    : "NO GRADED ATTEMPTS"}
                </Badge>
                <p className="mt-2 text-[11px] text-teal-200">
                  {summary.scoredAttempts > 0
                    ? `Across ${summary.scoredAttempts} recorded attempt${summary.scoredAttempts > 1 ? "s" : ""}`
                    : "Sign in and complete an exam to track readiness"}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Authoritative KPIs */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-foreground-muted">
                <span>Recorded Average</span>
                <Target className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-foreground">
                {summary.averageScore !== null ? `${summary.averageScore}%` : "—"}
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">Mean across scored exams</p>
            </Card>

            <Card className="rounded-2xl border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-foreground-muted">
                <span>Best Recorded Score</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-foreground">
                {summary.bestScore !== null ? `${summary.bestScore}%` : "—"}
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">Highest submitted attempt</p>
            </Card>

            <Card className="rounded-2xl border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-foreground-muted">
                <span>Items Evaluated</span>
                <BookOpen className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-foreground">
                {totalPracticedQuestions}
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">From recorded exam attempts</p>
            </Card>

            <Card className="rounded-2xl border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-foreground-muted">
                <span>Graded Exams</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-foreground">
                {summary.scoredAttempts}
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">Total scored submissions</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 mb-10">
            {/* NCSBN Client Needs Test Plan */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-3xl border-border bg-surface p-6 shadow-sm">
                <div className="border-b border-border pb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      NCSBN Client Needs Exam Blueprint
                    </h2>
                    <p className="text-xs text-foreground-secondary">
                      Official NCLEX content weights alongside any matching recorded category scores
                    </p>
                  </div>
                  <Link href="/learner/performance" className="text-xs font-semibold text-brand-teal hover:underline">
                    Full Analytics →
                  </Link>
                </div>

                <div className="mt-6 space-y-5">
                  {NCLEX_CLIENT_NEEDS.map((cat) => {
                    const matched = summary.byCategory.find((c) =>
                      c.category.toLowerCase().includes(cat.matchKey)
                    );
                    const pct = matched ? matched.averageScore : null;
                    return (
                      <div key={cat.title} className="space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-foreground">
                            {cat.icon}
                            <span>{cat.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-foreground-muted font-medium">Exam Weight: {cat.weight}</span>
                            <span className="font-bold text-brand-teal">
                              {pct !== null ? `${pct}% recorded` : "No recorded data"}
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all duration-500"
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Right Column: Daily Question & Fast Launchers */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="rounded-2xl border-teal-200 dark:border-teal-900 bg-gradient-to-br from-teal-50/70 to-white dark:from-teal-950/30 dark:to-surface p-5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider mb-2">
                  <span>Question of the Day</span>
                  <Badge className="bg-teal-600 text-white text-[10px]">UTC Daily</Badge>
                </div>

                <p className="text-xs font-semibold text-foreground line-clamp-3 leading-relaxed">
                  {qotd ? qotd.stem : "Loading today's clinical judgment item..."}
                </p>

                <div className="mt-4 pt-3 border-t border-teal-100 dark:border-border flex items-center justify-between">
                  <span className="text-[11px] text-foreground-secondary">Streak: {streak} days</span>
                  <Link href="/qotd">
                    <Button size="sm" className="rounded-xl bg-[#0A5C66] text-white hover:bg-[#084c55] text-xs font-bold">
                      Answer Now →
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card className="rounded-2xl border-border bg-surface p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">
                  NCLEX Study Resources
                </h3>

                <Link
                  href="/mark-k"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-muted border border-border text-xs font-semibold text-foreground-secondary"
                >
                  <span className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-amber-600" />
                    Mark Klimek Lectures
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground-muted" />
                </Link>

                <Link
                  href="/study-guides"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-muted border border-border text-xs font-semibold text-foreground-secondary"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    Expanded Study Guides
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground-muted" />
                </Link>

                <Link
                  href="/care-plans"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-muted border border-border text-xs font-semibold text-foreground-secondary"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Nursing Care Plans by Body System
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground-muted" />
                </Link>

                <Link
                  href="/groups?track=NCLEX-RN"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-muted border border-border text-xs font-semibold text-foreground-secondary"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-rose-600" />
                    NCLEX-RN Study Groups
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground-muted" />
                </Link>

                <Link
                  href="/insights"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-muted border border-border text-xs font-semibold text-foreground-secondary"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    Pass Statistics & Question Analytics
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground-muted" />
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
