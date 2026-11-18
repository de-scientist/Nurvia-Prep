"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  STUDY_GUIDE_CATALOGUE,
  getAllStudyGuideTopics,
  getStudyGuideSubjectBySlug,
  getStudyGuideTopicBySlug,
  type StudyGuideTopicItem,
  type StudyGuideSubjectItem,
} from "@/lib/content/study-guides-repository";
import {
  BookOpen,
  Search,
  Sparkles,
  ChevronRight,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  Table,
  ArrowLeft,
  FileText,
  Headphones,
  Users,
  Compass,
} from "lucide-react";

function StudyGuidesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedSubjectParam = searchParams?.get("subject") ?? "";
  const selectedTopicParam = searchParams?.get("topic") ?? "";

  const [activeSubject, setActiveSubject] = React.useState<string>(selectedSubjectParam || "all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [currentTopic, setCurrentTopic] = React.useState<StudyGuideTopicItem | null>(null);

  // Sync state with URL params
  React.useEffect(() => {
    if (selectedSubjectParam && selectedTopicParam) {
      const topic = getStudyGuideTopicBySlug(selectedSubjectParam, selectedTopicParam);
      if (topic) {
        setCurrentTopic(topic);
        setActiveSubject(selectedSubjectParam);
        return;
      }
    }
    setCurrentTopic(null);
    if (selectedSubjectParam) {
      setActiveSubject(selectedSubjectParam);
    }
  }, [selectedSubjectParam, selectedTopicParam]);

  const handleSelectTopic = (subjectSlug: string, topicSlug: string) => {
    router.push(`/study-guides?subject=${encodeURIComponent(subjectSlug)}&topic=${encodeURIComponent(topicSlug)}`);
    const topic = getStudyGuideTopicBySlug(subjectSlug, topicSlug);
    if (topic) setCurrentTopic(topic);
  };

  const handleBackToToc = () => {
    router.push("/study-guides");
    setCurrentTopic(null);
  };

  // Filter topics based on search query
  const allTopics = getAllStudyGuideTopics();
  const filteredTopics = searchQuery.trim()
    ? allTopics.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.keyConcepts.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        {/* Topic Reader Mode */}
        {currentTopic ? (
          <div className="space-y-6">
            {/* Back Button & Breadcrumbs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={handleBackToToc}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Table of Contents
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Link href="/learner" className="hover:underline">
                  Dashboard
                </Link>
                <span>/</span>
                <Link href="/study-guides" className="hover:underline">
                  Study Guides
                </Link>
                <span>/</span>
                <span className="text-slate-800">{currentTopic.subjectTitle}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left Main Reader */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="rounded-3xl border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                  {/* Topic Header */}
                  <div className="border-b border-slate-100 pb-6">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className="bg-teal-50 text-teal-800 border-teal-200 font-semibold text-xs">
                        {currentTopic.subjectTitle}
                      </Badge>
                      <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-bold text-xs">
                        {currentTopic.nclexYield} NCLEX Yield
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {currentTopic.readingMinutes} min read
                      </span>
                    </div>

                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                      {currentTopic.title}
                    </h1>
                    <p className="mt-2 text-base text-slate-600 leading-relaxed">
                      {currentTopic.summary}
                    </p>
                  </div>

                  {/* NCLEX Board Alerts */}
                  {currentTopic.nclexAlerts.length > 0 && (
                    <div className="mt-6 rounded-2xl bg-amber-50/80 border border-amber-200/90 p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                            Critical Examination Trap
                          </h4>
                          {currentTopic.nclexAlerts.map((alert, i) => (
                            <p key={i} className="mt-1 text-xs font-medium text-amber-950 leading-relaxed">
                              {alert}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Clinical Priorities */}
                  <div className="mt-8">
                    <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Award className="h-5 w-5 text-teal-700" />
                      Priority Nursing Interventions & Safety Actions
                    </h2>
                    <div className="space-y-2.5">
                      {currentTopic.clinicalPriorities.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-800 border border-slate-100">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comparison Matrix Table */}
                  {currentTopic.comparisonTable && (
                    <div className="mt-8">
                      <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Table className="h-5 w-5 text-teal-700" />
                        {currentTopic.comparisonTable.title}
                      </h2>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              {currentTopic.comparisonTable.headers.map((h, i) => (
                                <th key={i} className="px-4 py-3 font-bold border-b border-slate-200">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentTopic.comparisonTable.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/70">
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-4 py-3 ${
                                      cIdx === 0 ? "font-semibold text-slate-900" : "text-slate-700"
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Structured Clinical Notes */}
                  {currentTopic.notes.map((note, nIdx) => (
                    <div key={nIdx} className="mt-8">
                      <h3 className="text-base font-bold text-slate-900 mb-2">{note.heading}</h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
                        {note.points.map((pt, pIdx) => (
                          <li key={pIdx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Right Sidebar: Quick Subject Navigation */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm mb-3">
                    Other Topics in {currentTopic.subjectTitle}
                  </h3>
                  <div className="space-y-1.5">
                    {getStudyGuideSubjectBySlug(currentTopic.subjectSlug)?.topics.map((t) => {
                      const isCurrent = t.slug === currentTopic.slug;
                      return (
                        <button
                          key={t.slug}
                          onClick={() => handleSelectTopic(t.subjectSlug, t.slug)}
                          className={`w-full text-left rounded-xl p-2.5 text-xs font-semibold transition-all ${
                            isCurrent
                              ? "bg-teal-700 text-white shadow-sm"
                              : "text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{t.title}</span>
                            <span className="text-[10px] opacity-80">{t.readingMinutes}m</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* Related Learning Assets */}
                <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Reinforce This Topic
                  </h4>

                  <Link
                    href={`/search?q=${encodeURIComponent(currentTopic.title)}&type=study_set`}
                    className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-teal-600" />
                      Practice Exam Sets
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>

                  <Link
                    href="/care-plans"
                    className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      View Related Care Plans
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>

                  <Link
                    href="/mark-k"
                    className="flex items-center justify-between rounded-xl p-2.5 hover:bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <Headphones className="h-4 w-4 text-amber-600" />
                      Mark Klimek Audio & Notes
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* Table of Contents View */
          <div>
            {/* Hero Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 mb-2">
                <Link href="/learner" className="hover:underline">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-slate-700">Study Guides</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Expanded Nursing Study Guide Library
              </h1>
              <p className="mt-2 text-base text-slate-600 max-w-3xl">
                High-yield clinical summaries, NCLEX alerts, priority interventions, and comparison tables across 9 core nursing subjects.
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all 99 clinical topics, mnemonics, drugs, or lab interpretations..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            {/* Filtered Search Results or Subject Categories */}
            {searchQuery.trim() ? (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-500">
                  Found {filteredTopics.length} matching topics:
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filteredTopics.map((topic) => (
                    <Card
                      key={topic.id}
                      onClick={() => handleSelectTopic(topic.subjectSlug, topic.slug)}
                      className="cursor-pointer rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-400 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <Badge className="bg-teal-50 text-teal-800 border-teal-200 font-semibold">
                          {topic.subjectTitle}
                        </Badge>
                        <span className="text-slate-400 font-medium">{topic.readingMinutes} min read</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{topic.title}</h3>
                      <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">{topic.summary}</p>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {/* Subject Tabs */}
                <div className="mb-8 flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubject("all")}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      activeSubject === "all"
                        ? "bg-teal-700 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    All Subjects ({STUDY_GUIDE_CATALOGUE.length})
                  </button>
                  {STUDY_GUIDE_CATALOGUE.map((subject) => {
                    const active = activeSubject === subject.slug;
                    return (
                      <button
                        key={subject.slug}
                        onClick={() => setActiveSubject(subject.slug)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                          active
                            ? "bg-teal-700 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {subject.title} ({subject.topicCount})
                      </button>
                    );
                  })}
                </div>

                {/* Subject Cards & Topic Lists */}
                <div className="space-y-8">
                  {STUDY_GUIDE_CATALOGUE.filter((s) =>
                    activeSubject === "all" ? true : s.slug === activeSubject
                  ).map((subject) => (
                    <Card
                      key={subject.slug}
                      className="rounded-3xl border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">{subject.title}</h2>
                          <p className="text-xs text-slate-500 mt-0.5">{subject.description}</p>
                        </div>
                        <Badge className="bg-slate-100 text-slate-700 font-semibold text-xs self-start sm:self-auto">
                          {subject.topicCount} Topics
                        </Badge>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {subject.topics.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleSelectTopic(t.subjectSlug, t.slug)}
                            className="group cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-teal-400 hover:bg-white hover:shadow-md flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="text-[10px] font-bold bg-amber-50 text-amber-900 border-amber-200">
                                  {t.nclexYield} Yield
                                </Badge>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {t.readingMinutes}m
                                </span>
                              </div>
                              <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition-colors">
                                {t.title}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                                {t.summary}
                              </p>
                            </div>

                            <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-teal-700 font-semibold group-hover:underline">
                              <span>Read Study Guide</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyGuidesPage() {
  return (
    <PublicShell>
      <React.Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent" />
          </div>
        }
      >
        <StudyGuidesContent />
      </React.Suspense>
    </PublicShell>
  );
}
