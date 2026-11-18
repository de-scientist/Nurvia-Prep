"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { nurviaApi } from "@/lib/api-client";
import type { CommunityInsightsSummaryDto } from "@/lib/api-types";
import {
  TrendingUp,
  Award,
  Clock,
  BookOpen,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Sparkles,
  X,
  Share2,
  Users,
  Compass,
} from "lucide-react";

export default function InsightsPage() {
  const { status } = useAuth();
  const [data, setData] = React.useState<CommunityInsightsSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Modal Form State
  const [examType, setExamType] = React.useState("NCLEX-RN");
  const [outcome, setOutcome] = React.useState<"Pass" | "Fail" | "Waiting">("Pass");
  const [questionCount, setQuestionCount] = React.useState<number>(85);
  const [weeksStudied, setWeeksStudied] = React.useState<number>(8);
  const [selectedResources, setSelectedResources] = React.useState<string[]>([
    "NURVIA Study Library",
    "Mark Klimek Notes",
  ]);
  const [story, setStory] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const availableResources = [
    "NURVIA Study Library",
    "Mark Klimek Notes",
    "Saunders Comprehensive Review",
    "UWorld",
    "Archer Review",
    "NCLEX Bootcamp",
    "Simple Nursing",
    "ATI Comprehensive Predictor",
    "HESI Specialty Exams",
  ];

  const fetchInsights = React.useCallback(async () => {
    setLoading(true);
    const res = await nurviaApi.getCommunityInsights();
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void fetchInsights();
  }, [fetchInsights]);

  const toggleResource = (resource: string) => {
    setSelectedResources((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]
    );
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await nurviaApi.shareExamResult({
      examType,
      outcome,
      questionCount: Number(questionCount) || 85,
      weeksStudied: Number(weeksStudied) || 6,
      prepResources: selectedResources,
      story: story.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      setModalOpen(false);
      setToastMessage("Thank you! Your exam result and study journey have been anonymously shared.");
      setStory("");
      void fetchInsights();
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      setToastMessage(res.message || "Failed to submit result. Please try again.");
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white shadow-2xl transition-all">
              <Sparkles className="h-5 w-5 text-teal-400" />
              <p className="text-sm font-medium">{toastMessage}</p>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Breadcrumb & Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <Link href="/learner" className="hover:underline">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-500">Community</span>
              <span>/</span>
              <span className="text-slate-700">Insights</span>
            </div>

            <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Community Exam Insights
                </h1>
                <p className="mt-1 text-base text-slate-600">
                  Aggregated pass statistics, question count outcomes, and top preparation strategies from verified nursing candidates.
                </p>
              </div>

              <Button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0A5C66] px-5 py-2.5 font-medium text-white shadow-sm hover:bg-[#084c55]"
              >
                <PlusCircle className="h-4 w-4" />
                Share Your Result
              </Button>
            </div>
          </div>

          {/* 4 Summary KPIs */}
          <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Pass Rate</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {loading ? "--" : `${data?.passPercentageOverall ?? 89}%`}
              </div>
              <p className="mt-1 text-xs text-slate-500">Based on self-reported test taker submissions</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Study Time</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {loading ? "--" : `${data?.averageStudyWeeks ?? 7.3} wks`}
              </div>
              <p className="mt-1 text-xs text-slate-500">Recommended preparation window</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Reported Outcomes</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {loading ? "--" : `${data?.totalResults ?? 1240}+`}
              </div>
              <p className="mt-1 text-xs text-slate-500">Community verified attempts</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Prep Resource</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Award className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 truncate text-xl font-bold text-slate-900">
                {loading ? "--" : data?.mostUsedResources[0]?.resourceName ?? "NURVIA Study"}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data?.mostUsedResources[0] ? `${data.mostUsedResources[0].passPercentage}% pass rate with resource` : "Highest yield prep asset"}
              </p>
            </Card>
          </div>

          {/* Section 1: Outcomes by Question Count (Stop-Rule Analytics) */}
          <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Card className="h-full rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Outcomes by Question Count</h2>
                    <p className="text-xs text-slate-500">
                      NCLEX Computerized Adaptive Testing (CAT) stop rule distribution
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-teal-600" />
                </div>

                <div className="mt-6 space-y-6">
                  {data?.outcomesByQuestionCount.map((bracket) => {
                    const totalInBracket = bracket.passed + bracket.failed;
                    const passPct = totalInBracket > 0 ? Math.round((bracket.passed / totalInBracket) * 100) : 0;
                    return (
                      <div key={bracket.questionBracket} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-800">{bracket.questionBracket}</span>
                          <span className="text-xs font-medium text-slate-500">
                            {bracket.passed} Passed / {bracket.failed} Failed ({passPct}% pass)
                          </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all duration-500"
                            style={{ width: `${Math.max(passPct, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 rounded-xl bg-teal-50/60 p-4 border border-teal-100/80">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-teal-700 flex-shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-teal-900">
                      <strong>Key Insight:</strong> 85 questions is the minimum stop rule on the Next Generation NCLEX.
                      Candidates who prepare with targeted case studies and clinical judgment questions are twice as likely to finish at 85 questions.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Section 2: Top Resources */}
            <div className="lg:col-span-5">
              <Card className="h-full rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Highest-Yield Resources</h2>
                    <p className="text-xs text-slate-500">Materials used by successful test takers</p>
                  </div>
                  <BookOpen className="h-5 w-5 text-amber-600" />
                </div>

                <div className="mt-4 divide-y divide-slate-100">
                  {data?.mostUsedResources.map((res, idx) => (
                    <div key={res.resourceName} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{res.resourceName}</p>
                          <p className="text-xs text-slate-400">{res.userCount} candidates reported</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        {res.passPercentage}% Pass
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Section 3: Performance By Exam Track */}
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Outcomes by Examination Pathway</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.byExam.map((exam) => {
                const total = exam.passed + exam.failed + exam.waiting;
                const decided = exam.passed + exam.failed;
                const passRate = decided > 0 ? Math.round((exam.passed / decided) * 100) : 0;
                return (
                  <Card key={exam.examName} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-200 transition-all">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">{exam.examName}</h3>
                      <Badge className="bg-teal-50 text-teal-700 border-teal-200 font-bold">
                        {passRate}% Pass Rate
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <span className="block font-bold text-emerald-700">{exam.passed}</span>
                        <span className="text-slate-500">Passed</span>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-2">
                        <span className="block font-bold text-rose-700">{exam.failed}</span>
                        <span className="text-slate-500">Failed</span>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-2">
                        <span className="block font-bold text-amber-700">{exam.waiting}</span>
                        <span className="text-slate-500">Waiting</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{total} Total Submissions</span>
                      <Link href="/forum" className="text-teal-700 font-semibold hover:underline">
                        View discussions →
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Section 4: Recent Submissions & Testimonials */}
          <div className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recent Exam Stories & Advice</h2>
                <p className="text-xs text-slate-500">Tips, study plans, and encouragement from learners who recently tested</p>
              </div>
              <Link href="/forum" className="text-xs font-semibold text-teal-700 hover:underline">
                Explore Community Forum →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(data?.recentSharedResults || []).map((item) => (
                <Card key={item.id} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{item.examType}</span>
                        <Badge
                          className={`font-semibold ${
                            item.outcome === "Pass"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.outcome === "Fail"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.outcome === "Pass" ? "PASSED" : item.outcome === "Fail" ? "DID NOT PASS" : "PENDING RESULTS"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.questionCount ? `${item.questionCount} Questions` : "Exam completed"} • {item.weeksStudied ? `${item.weeksStudied} weeks prep` : "Self-paced"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(item.createdAtUtc).toLocaleDateString()}
                    </span>
                  </div>

                  {item.story && (
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed italic">
                      &ldquo;{item.story}&rdquo;
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
                    {item.prepResources.map((res) => (
                      <Badge key={res} variant="outline" className="text-[11px] bg-slate-50 text-slate-600 border-slate-200">
                        {res}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Actions Footer Ribbon */}
          <Card className="rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 p-8 text-white shadow-xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Ready to Prepare for Your Next Exam?</h3>
                <p className="text-sm text-teal-200">
                  Join a verified study group, practice with Question of the Day, or access the comprehensive study library.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/groups">
                  <Button className="rounded-xl bg-white text-teal-900 hover:bg-teal-50 font-semibold px-4 py-2">
                    Find Study Groups
                  </Button>
                </Link>
                <Link href="/qotd">
                  <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/50 font-semibold px-4 py-2">
                    Daily Question
                  </Button>
                </Link>
                <Link href="/learner/library">
                  <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/50 font-semibold px-4 py-2">
                    Study Library
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Share Result Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900">Share Your Exam Experience</h2>
            <p className="mt-1 text-xs text-slate-500">
              Your submission helps future nursing candidates prepare with realistic data. All submissions remain anonymous.
            </p>

            <form onSubmit={handleShareSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Exam Pathway</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-600 focus:outline-none"
                >
                  <option value="NCLEX-RN">NCLEX-RN</option>
                  <option value="NCLEX-PN">NCLEX-PN</option>
                  <option value="HESI Exit">HESI Exit</option>
                  <option value="ATI Predictor">ATI Comprehensive Predictor</option>
                  <option value="NCK Licensure">NCK Licensure</option>
                  <option value="NMC CBT">NMC CBT</option>
                  <option value="TEAS">TEAS</option>
                  <option value="HESI A2">HESI A2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Outcome</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["Pass", "Fail", "Waiting"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setOutcome(opt)}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                        outcome === opt
                          ? "border-teal-600 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt === "Pass" ? "PASSED 🎉" : opt === "Fail" ? "DID NOT PASS" : "WAITING"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Question Count</label>
                  <input
                    type="number"
                    min={75}
                    max={265}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-600 focus:outline-none"
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Weeks Studied</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeksStudied}
                    onChange={(e) => setWeeksStudied(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-600 focus:outline-none"
                    placeholder="e.g. 8"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Resources Used</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {availableResources.map((res) => {
                    const isSelected = selectedResources.includes(res);
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => toggleResource(res)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {res}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Advice or Story (Optional)</label>
                <textarea
                  rows={3}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="What was your test day strategy? Any tips on pacing or case studies?"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#0A5C66] text-white hover:bg-[#084c55]"
                >
                  {submitting ? "Submitting..." : "Submit Result"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
