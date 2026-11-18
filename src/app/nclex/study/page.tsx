"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { QotdQuestionDto } from "@/lib/api-types";
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
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  HeartHandshake,
  Brain,
  Pill,
} from "lucide-react";

interface CategoryMastery {
  title: string;
  weight: string;
  progress: number;
  icon: React.ReactNode;
  examId: string;
}

const NCLEX_CLIENT_NEEDS: CategoryMastery[] = [
  {
    title: "Management of Care & Safety (Delegation/Prioritization)",
    weight: "17 – 23%",
    progress: 88,
    icon: <ShieldCheck className="h-5 w-5 text-teal-600" />,
    examId: "set-management-of-care",
  },
  {
    title: "Safety & Infection Control (PPE / Standard Precautions)",
    weight: "9 – 15%",
    progress: 92,
    icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
    examId: "set-safety-infection",
  },
  {
    title: "Pharmacological & Parenteral Therapies",
    weight: "12 – 18%",
    progress: 74,
    icon: <Pill className="h-5 w-5 text-amber-600" />,
    examId: "set-pharmacology",
  },
  {
    title: "Reduction of Risk Potential (Diagnostics, Labs, Vitals)",
    weight: "9 – 15%",
    progress: 81,
    icon: <Activity className="h-5 w-5 text-indigo-600" />,
    examId: "set-risk-reduction",
  },
  {
    title: "Physiological Adaptation (Complex Acute & Chronic Care)",
    weight: "11 – 17%",
    progress: 79,
    icon: <HeartHandshake className="h-5 w-5 text-rose-600" />,
    examId: "set-physio-adaptation",
  },
  {
    title: "Psychosocial Integrity (Crisis, Coping, Mental Health)",
    weight: "6 – 12%",
    progress: 85,
    icon: <Brain className="h-5 w-5 text-purple-600" />,
    examId: "set-psychosocial",
  },
  {
    title: "Health Promotion & Maintenance (Maternity & Pediatrics)",
    weight: "6 – 12%",
    progress: 83,
    icon: <Award className="h-5 w-5 text-sky-600" />,
    examId: "set-health-promotion",
  },
];

export default function NclexStudyHubPage() {
  const [qotd, setQotd] = React.useState<QotdQuestionDto | null>(null);
  const [streak, setStreak] = React.useState(5);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadTodayQotd() {
      const res = await nurviaApi.getQotdToday();
      if (res.success && res.data) {
        setQotd(res.data);
      }
      setLoading(false);
    }
    void loadTodayQotd();
  }, []);

  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 mb-4">
            <Link href="/learner" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/nursing-exams/rn" className="hover:underline">
              NCLEX
            </Link>
            <span>/</span>
            <span className="text-slate-700">Study Hub</span>
          </div>

          {/* Hero Command Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 sm:p-10 text-white shadow-xl mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold">
                    NextGen NCLEX Command Center
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-0.5 text-xs font-bold text-amber-300">
                    <Flame className="h-3.5 w-3.5" />
                    {streak} Day Study Streak
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Personal NCLEX Readiness Hub
                </h1>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Track your mastery across all 8 NCSBN Client Needs categories, simulate Computerized Adaptive Testing (CAT) stop rules, and practice NGN case studies.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/learner/rn">
                    <Button className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-5 py-2.5 inline-flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Start CAT Adaptive Simulation (85 – 150 Qs)
                    </Button>
                  </Link>
                  <Link href="/learner/rn-exit">
                    <Button variant="outline" className="rounded-xl border-teal-400 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                      Launch NGN Case Studies
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Readiness Score Radial Box */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-teal-900/40 border border-teal-700/50 p-6 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  NCLEX Pass Probability
                </span>
                <div className="mt-2 text-5xl font-black text-white">92%</div>
                <Badge className="mt-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold">
                  HIGH PROBABILITY OF PASSING
                </Badge>
                <p className="mt-2 text-[11px] text-teal-200">
                  Based on 1,840 practice questions completed
                </p>
              </div>
            </div>
          </div>

          {/* 4 Diagnostic KPIs */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
                <span>Clinical Judgment</span>
                <Target className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">89%</div>
              <p className="mt-1 text-xs text-slate-500">CJMM 6-step cognitive mastery</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
                <span>CAT Endurance</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">85 Qs</div>
              <p className="mt-1 text-xs text-slate-500">Average projected stop rule</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
                <span>Questions Practiced</span>
                <BookOpen className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">1,840</div>
              <p className="mt-1 text-xs text-slate-500">Across 48 exam themes</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
                <span>Safety & Infection</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">94%</div>
              <p className="mt-1 text-xs text-slate-500">Highest priority testing domain</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 mb-10">
            {/* NCSBN Category Masteries (8 Columns) */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900">
                    NCSBN Client Needs Blueprint Progress
                  </h2>
                  <p className="text-xs text-slate-500">
                    Test weights and personal readiness per NCLEX blueprint domain
                  </p>
                </div>

                <div className="mt-6 space-y-5">
                  {NCLEX_CLIENT_NEEDS.map((cat) => (
                    <div key={cat.title} className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          {cat.icon}
                          <span>{cat.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-medium">Weight: {cat.weight}</span>
                          <span className="font-bold text-teal-800">{cat.progress}%</span>
                        </div>
                      </div>

                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600 transition-all duration-500"
                          style={{ width: `${cat.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Daily Question & Fast Launchers (4 Columns) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Daily Question Widget */}
              <Card className="rounded-2xl border-teal-200 bg-gradient-to-br from-teal-50/70 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">
                  <span>Question of the Day</span>
                  <Badge className="bg-teal-600 text-white text-[10px]">Active</Badge>
                </div>

                <p className="text-xs font-semibold text-slate-800 line-clamp-3 leading-relaxed">
                  {qotd ? qotd.stem : "Loading today's clinical judgment item..."}
                </p>

                <div className="mt-4 pt-3 border-t border-teal-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Earn streak credits</span>
                  <Link href="/qotd">
                    <Button size="sm" className="rounded-xl bg-[#0A5C66] text-white hover:bg-[#084c55] text-xs font-bold">
                      Answer Now →
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* High-Yield Companion Resources */}
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  NCLEX Study Resources
                </h3>

                <Link
                  href="/mark-k"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-amber-600" />
                    Mark Klimek Lectures (12 Audio Lessons)
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>

                <Link
                  href="/study-guides"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    Expanded Study Guides (99 Topics)
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>

                <Link
                  href="/care-plans"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Nursing Care Plans by Body System
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>

                <Link
                  href="/groups?track=NCLEX-RN"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-rose-600" />
                    NCLEX-RN Study Groups
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>

                <Link
                  href="/insights"
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    Pass Statistics & Question Count Analytics
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
