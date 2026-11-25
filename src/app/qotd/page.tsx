"use client";

import * as React from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { QotdQuestionDto, QotdSubmissionResultDto } from "@/lib/api-types";
import { QuestionRendererRegistry, type RendererQuestion } from "@/components/exam/renderers";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import {
  Sparkles,
  Flame,
  Calendar,
  Clock,
} from "lucide-react";

function formatUtcResetCountdown(): string {
  const now = new Date();
  const nextUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((nextUtc - now.getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

export default function QotdPage() {
  const [question, setQuestion] = React.useState<QotdQuestionDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submissionResult, setSubmissionResult] = React.useState<QotdSubmissionResultDto | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [utcCountdown, setUtcCountdown] = React.useState<string>(() => formatUtcResetCountdown());
  const [history, setHistory] = React.useState<{
    streak: number;
    totalCompleted: number;
    pastQuestions: { id: string; dateStr: string; title: string; category: string }[];
  } | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setUtcCountdown(formatUtcResetCountdown());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

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

  const isAnswered = Boolean(question?.userAnswered || submissionResult);

  const handleRendererChange = (serialized: string) => {
    if (isAnswered) return;
    try {
      const parsed = JSON.parse(serialized);
      const id = parsed?.SelectedOptionId ?? parsed?.selectedOptionId ?? parsed?.value ?? serialized;
      if (id) setSelectedOptionId(String(id));
    } catch {
      if (serialized) setSelectedOptionId(serialized.replace(/^"(.*)"$/, "$1"));
    }
  };

  const handleSubmit = async () => {
    if (!question || !selectedOptionId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await nurviaApi.submitQotdAnswer(question.id, selectedOptionId);
    if (res.success && res.data) {
      setSubmissionResult(res.data);
      const [updated, histUpdated] = await Promise.all([
        nurviaApi.getQotdToday(),
        nurviaApi.getQotdHistory(),
      ]);
      if (updated.success && updated.data) {
        setQuestion(updated.data);
      }
      if (histUpdated.success && histUpdated.data) {
        setHistory(histUpdated.data);
      }
    } else {
      setSubmitError(res.message || "Unable to evaluate answer submission.");
    }
    setSubmitting(false);
  };

  const rendererQuestion: RendererQuestion | null = React.useMemo(() => {
    if (!question) return null;
    if (question.rendererQuestion) return question.rendererQuestion;
    const rationaleMap = new Map(
      (submissionResult?.optionRationales ?? []).map((item) => [item.id, item])
    );

    return {
      id: question.id,
      stem: question.stem,
      questionType: question.questionType || "SingleChoice",
      cognitiveSkill: question.cognitiveSkill,
      clientNeedCategory: question.clientNeedCategory,
      generalRationale: isAnswered
        ? submissionResult?.explanation || question.explanation
        : undefined,
      learnerResponse: selectedOptionId
        ? JSON.stringify({ SelectedOptionId: selectedOptionId })
        : undefined,
      isCorrect: isAnswered
        ? (submissionResult?.isCorrect ?? question.userIsCorrect)
        : undefined,
      options: question.options.map((o, idx) => {
        const subMeta = rationaleMap.get(o.id);
        return {
          id: o.id,
          optionIndex: idx + 1,
          optionText: o.text,
          displayOrder: idx + 1,
          label: o.letter,
          isCorrect: isAnswered
            ? (o.isCorrect ?? subMeta?.isCorrect ?? submissionResult?.correctOptionId === o.id)
            : undefined,
          specificRationale: isAnswered ? (o.rationale ?? subMeta?.rationale) : undefined,
          wasSelected: isAnswered && selectedOptionId === o.id,
        };
      }),
    };
  }, [question, isAnswered, submissionResult, selectedOptionId]);

  const serializedValue = selectedOptionId
    ? JSON.stringify({ SelectedOptionId: selectedOptionId })
    : null;

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {/* Header Hero */}
        <section className="border-b border-border bg-gradient-to-b from-surface/80 via-background to-background py-10 sm:py-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Daily Clinical Judgment · UTC Schedule</span>
            </div>
            <h1 className="font-brand text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Question of the Day
            </h1>
            <p className="text-foreground-secondary text-xs sm:text-sm max-w-xl mx-auto">
              Answer one daily clinical judgment scenario before 00:00 UTC to reveal authoritative rationales and maintain your consecutive-day study streak.
            </p>

            {/* Streak & UTC Reset Stats Pill */}
            <div className="inline-flex flex-wrap items-center justify-center gap-4 bg-surface px-4 py-2 rounded-2xl border border-border text-xs text-foreground">
              <span className="flex items-center gap-1.5 font-bold text-amber-500">
                <Flame className="w-4 h-4 fill-amber-500" />
                {submissionResult?.userStreak ?? history?.streak ?? 0} Day UTC Streak
              </span>
              <span className="text-border">|</span>
              <span className="text-foreground-secondary">
                <strong>{history?.totalCompleted ?? 0}</strong> Answered
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1 text-foreground-secondary font-mono">
                <Clock className="w-3.5 h-3.5 text-brand-teal" />
                Resets in {utcCountdown} UTC
              </span>
            </div>
          </div>
        </section>

        {/* Question Container */}
        <section className="py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
            {loading ? (
              <div className="py-20 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading today&apos;s clinical question…
              </div>
            ) : !question || !rendererQuestion ? (
              <Card className="p-8 text-center text-sm text-foreground-secondary">
                Question of the day is currently unavailable. Please check back shortly.
              </Card>
            ) : (
              <Card className="p-6 sm:p-8 space-y-6 border border-border bg-surface shadow-xs">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4 text-xs text-foreground-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                    <span className="font-semibold text-foreground">{question.dateStr} (UTC)</span>
                    <span>·</span>
                    <Badge variant="teal">{question.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {question.source === "backend" ? "Backend Bank" : "Published Bank"}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-bold text-foreground-secondary">
                    {question.totalAnswers} recorded responses
                  </span>
                </div>

                {/* Stem */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">
                    {question.examContext} · {question.cognitiveSkill}
                  </span>
                  <div className="font-brand text-base sm:text-lg font-bold text-foreground leading-snug">
                    <RichQuestionContent content={question.stem} />
                  </div>
                </div>

                {/* Unified 38-Type Renderer Engine */}
                <QuestionRendererRegistry
                  question={rendererQuestion}
                  value={serializedValue}
                  onChange={handleRendererChange}
                  disabled={isAnswered}
                  isReview={isAnswered}
                />

                {submitError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {submitError}
                  </p>
                )}

                {!isAnswered && (
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border">
                    <p className="text-xs text-foreground-muted">
                      Select an answer choice above and submit to reveal correctness and clinical rationales.
                    </p>
                    <Button
                      disabled={!selectedOptionId || submitting}
                      onClick={() => void handleSubmit()}
                      className="text-xs px-6 bg-brand-teal text-white hover:bg-brand-tealDark"
                    >
                      {submitting ? "Evaluating…" : "Submit Answer"}
                    </Button>
                  </div>
                )}

                <div className="text-[11px] text-foreground-muted pt-1">
                  Original QuizNurse clinical scenario calibrated for NCLEX judgment practice.
                </div>
              </Card>
            )}

            {/* Past Daily Questions Archive */}
            {history && history.pastQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-brand text-lg font-bold text-foreground">
                  Daily Question Pool Overview
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {history.pastQuestions.slice(0, 4).map((pq) => (
                    <Card key={pq.id} className="p-4 space-y-1 bg-surface border-border">
                      <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                        <span>{pq.dateStr}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {pq.category}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-1">
                        {pq.title}
                      </h3>
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
