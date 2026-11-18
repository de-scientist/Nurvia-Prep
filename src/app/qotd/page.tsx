"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { nurviaApi } from "@/lib/api-client";
import type { QotdQuestionDto, QotdSubmissionResultDto } from "@/lib/api-types";
import {
  Sparkles,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  BookOpen,
  Share2,
  Lock,
  Calendar,
  Award,
} from "lucide-react";

export default function QotdPage() {
  const { status } = useAuth();
  const [question, setQuestion] = React.useState<QotdQuestionDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submissionResult, setSubmissionResult] = React.useState<QotdSubmissionResultDto | null>(null);
  const [history, setHistory] = React.useState<{ streak: number; totalCompleted: number; pastQuestions: { id: string; dateStr: string; title: string; category: string }[] } | null>(null);

  React.useEffect(() => {
    let active = true;
    async function loadData() {
      const [qRes, histRes] = await Promise.all([
        nurviaApi.getQotdToday(),
        nurviaApi.getQotdHistory(),
      ]);
      if (!active) return;
      if (qRes.success && qRes.data) {
        setQuestion(qRes.data);
        if (qRes.data.userAnswered && qRes.data.userSelectedOptionId) {
          setSelectedOptionId(qRes.data.userSelectedOptionId);
        }
      }
      if (histRes.success && histRes.data) {
        setHistory(histRes.data);
      }
      setLoading(false);
    }
    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectOption = (optionId: string) => {
    if (question?.userAnswered || submissionResult) return;
    setSelectedOptionId(optionId);
  };

  const handleSubmit = async () => {
    if (!question || !selectedOptionId || submitting) return;
    setSubmitting(true);
    const res = await nurviaApi.submitQotdAnswer(question.id, selectedOptionId);
    if (res.success && res.data) {
      setSubmissionResult(res.data);
      // reload question to fetch rationales
      const updated = await nurviaApi.getQotdToday();
      if (updated.success && updated.data) {
        setQuestion(updated.data);
      }
    }
    setSubmitting(false);
  };

  const isAnswered = Boolean(question?.userAnswered || submissionResult);
  const isAuthenticated = status === "authenticated";

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {/* Header Hero */}
        <section className="border-b border-border bg-gradient-to-b from-surface/80 via-background to-background py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Daily Practice &amp; Active Recall</span>
            </div>
            <h1 className="font-brand text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Question of the Day
            </h1>
            <p className="text-foreground-secondary text-xs sm:text-sm max-w-xl mx-auto">
              Test your clinical judgment daily with an original, board-calibrated NCLEX scenario. Answer to reveal detailed rationales and track your daily streak.
            </p>

            {/* Streak & Stats Pill */}
            {history && (
              <div className="inline-flex items-center gap-4 bg-surface px-4 py-2 rounded-2xl border border-border text-xs text-foreground">
                <span className="flex items-center gap-1.5 font-bold text-amber-500">
                  <Flame className="w-4 h-4 fill-amber-500" />
                  {history.streak} Day Streak
                </span>
                <span className="text-border">|</span>
                <span className="text-foreground-secondary">
                  <strong>{history.totalCompleted}</strong> Completed
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Question Container */}
        <section className="py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
            {loading ? (
              <div className="py-20 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading today&apos;s clinical question…
              </div>
            ) : !question ? (
              <Card className="p-8 text-center text-sm text-foreground-secondary">
                Question of the day is currently unavailable. Please check back shortly.
              </Card>
            ) : (
              <Card className="p-6 sm:p-8 space-y-6 border border-border bg-surface shadow-xs">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4 text-xs text-foreground-muted">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                    <span className="font-semibold text-foreground">{question.dateStr}</span>
                    <span>·</span>
                    <Badge variant="teal">{question.category}</Badge>
                  </div>
                  <span className="text-[11px] font-bold text-foreground-secondary">
                    {question.totalAnswers} community answers
                  </span>
                </div>

                {/* Vignette / Stem */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">
                    {question.examContext} · {question.cognitiveSkill}
                  </span>
                  <h2 className="font-brand text-lg sm:text-xl font-bold text-foreground leading-snug">
                    {question.stem}
                  </h2>
                </div>

                {/* Options List */}
                <div className="space-y-3 pt-2">
                  {question.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const hasSubmitted = isAnswered;
                    const isOptionCorrect = opt.rationale?.startsWith("Correct");

                    let optionStyle = "border-border bg-background hover:bg-surface-muted";
                    if (isSelected && !hasSubmitted) {
                      optionStyle = "border-brand-teal bg-brand-teal/10 text-foreground ring-1 ring-brand-teal";
                    } else if (hasSubmitted) {
                      if (isOptionCorrect) {
                        optionStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500";
                      } else if (isSelected && !isOptionCorrect) {
                        optionStyle = "border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500";
                      }
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(opt.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${optionStyle}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-surface-muted text-xs font-bold flex items-center justify-center shrink-0">
                            {opt.letter}
                          </span>
                          <span className="text-xs sm:text-sm font-medium leading-relaxed pt-0.5">
                            {opt.text}
                          </span>
                          {hasSubmitted && isOptionCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto shrink-0" />
                          )}
                          {hasSubmitted && isSelected && !isOptionCorrect && (
                            <XCircle className="w-5 h-5 text-rose-500 ml-auto shrink-0" />
                          )}
                        </div>

                        {/* Specific Rationale (revealed post-submission) */}
                        {hasSubmitted && opt.rationale && (
                          <div className="pl-9 text-xs text-foreground-secondary pt-1 leading-relaxed border-t border-border/40">
                            {opt.rationale}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Submit Action */}
                {!isAnswered ? (
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border">
                    <p className="text-xs text-foreground-muted">
                      Select an option to evaluate your answer and reveal the clinical rationale.
                    </p>
                    <Button
                      disabled={!selectedOptionId || submitting}
                      onClick={handleSubmit}
                      className="text-xs px-6 bg-brand-teal text-white hover:bg-brand-teal-dark"
                    >
                      {submitting ? "Evaluating…" : "Submit Answer"}
                    </Button>
                  </div>
                ) : (
                  /* General Clinical Rationale Box */
                  question.explanation && (
                    <div className="mt-6 p-5 rounded-xl border border-brand-teal/30 bg-brand-teal/5 space-y-2">
                      <div className="flex items-center gap-2 text-brand-teal font-bold text-xs uppercase tracking-wider">
                        <BookOpen className="w-4 h-4" />
                        Clinical Judgment Rationale
                      </div>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {question.explanation}
                      </p>
                    </div>
                  )
                )}

                <div className="text-[11px] text-foreground-muted pt-2">
                  Original practice item written for NURVIA — not actual secure licensure content.
                </div>
              </Card>
            )}

            {/* Past Daily Questions History */}
            {history && history.pastQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-brand text-lg font-bold text-foreground">
                  Recent Daily Questions
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {history.pastQuestions.slice(0, 4).map((pq) => (
                    <Card key={pq.id} className="p-4 space-y-1 bg-surface border-border">
                      <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                        <span>{pq.dateStr}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {pq.category}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-1">
                        {pq.title}
                      </h4>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
