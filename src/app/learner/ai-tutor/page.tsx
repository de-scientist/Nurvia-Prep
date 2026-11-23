"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextualTutorWorkspace } from "@/components/exam/ContextualTutorWorkspace";
import { nurviaApi } from "@/lib/api-client";
import type { ExamAttemptSummaryDto, SubmittedExamResultDto } from "@/lib/api-types";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AiTutorPage() {
  const router = useRouter();
  const [attempts, setAttempts] = React.useState<ExamAttemptSummaryDto[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState<boolean>(true);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const [selectedAttemptId, setSelectedAttemptId] = React.useState<string>("");
  const [loadedResult, setLoadedResult] = React.useState<SubmittedExamResultDto | null>(null);
  const [loadingAttempt, setLoadingAttempt] = React.useState<boolean>(false);
  const [attemptError, setAttemptError] = React.useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string>("");

  const selectAttempt = React.useCallback(async (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setLoadingAttempt(true);
    setAttemptError(null);
    setLoadedResult(null);

    try {
      const res = await nurviaApi.getAttemptReview(attemptId);
      if (res.success && res.data) {
        setLoadedResult(res.data);
        const firstMissed = res.data.reviewQuestions.find((q) => !q.isCorrect);
        const initialQ = firstMissed ?? res.data.reviewQuestions[0];
        setSelectedQuestionId(initialQ?.questionId || "");
      } else {
        setAttemptError(res.message || "Unable to load examination questions for Tutor coaching.");
      }
    } catch {
      setAttemptError("Unable to load examination questions right now.");
    } finally {
      setLoadingAttempt(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    nurviaApi
      .getAttemptHistory()
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setAttempts(res.data);
          const firstReviewable = res.data.find(
            (a) => a.status !== "InProgress" && (a.canReview ?? a.allowReview !== false)
          );
          if (firstReviewable) {
            void selectAttempt(firstReviewable.attemptId);
          }
        } else {
          setHistoryError(res.message || "Unable to load examination attempts.");
        }
      })
      .catch(() => {
        if (active) setHistoryError("Unable to load examination history.");
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, [selectAttempt]);

  const completedReviewableAttempts = React.useMemo(
    () =>
      attempts.filter(
        (a) => a.status !== "InProgress" && (a.canReview ?? a.allowReview !== false)
      ),
    [attempts]
  );

  const activeInProgressAttempts = React.useMemo(
    () => attempts.filter((a) => a.status === "InProgress"),
    [attempts]
  );

  const activeQuestionObj = React.useMemo(() => {
    if (!loadedResult?.reviewQuestions?.length) return null;
    const idx = loadedResult.reviewQuestions.findIndex(
      (q) => q.questionId === selectedQuestionId
    );
    const resolvedIdx = idx >= 0 ? idx : 0;
    return {
      question: loadedResult.reviewQuestions[resolvedIdx],
      questionNumber: resolvedIdx + 1,
    };
  }, [loadedResult, selectedQuestionId]);

  return (
    <LearnerShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="teal">Contextual Clinical Tutor</Badge>
            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-foreground">
              Attempt-Grounded Clinical Tutor
            </h1>
            <p className="text-xs sm:text-sm text-foreground-secondary">
              Analyze missed items, understand distractors, and master nursing rationales anchored directly to your completed NURVIA examination attempts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/learner/exams">
              <Button size="sm" variant="primary" className="text-xs">
                Browse Study Sets &amp; Exams
              </Button>
            </Link>
            <Link href="/learner/history">
              <Button size="sm" variant="outline" className="text-xs">
                Attempt History
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/40 p-4 flex items-start gap-3 text-xs text-foreground-secondary">
          <Info className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">
              Grounded in Real Examination Items
            </p>
            <p className="mt-0.5 leading-relaxed">
              NURVIA Tutor operates on specific questions from your examination attempts so every explanation reflects exact clinical stems, exhibits, your response, and authoritative rationales — without ever altering your submitted score. Open-ended standalone chat outside an examination attempt is not provisioned on the backend.
            </p>
          </div>
        </div>

        {historyError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {historyError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Eligible Attempts & Question Selector */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4 space-y-3">
              <h2 className="font-brand text-sm font-bold text-foreground flex items-center gap-1.5">
                <BookOpenCheck className="w-4 h-4 text-brand-teal" /> Completed Attempts
              </h2>

              {loadingHistory ? (
                <div className="flex items-center gap-2 py-4 text-xs text-foreground-secondary">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                  Loading attempts...
                </div>
              ) : completedReviewableAttempts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-xs text-foreground-secondary space-y-2">
                  <p>No completed reviewable examination attempts found yet.</p>
                  <Link href="/learner/exams" className="inline-flex items-center gap-1 text-brand-teal font-semibold hover:underline">
                    Start an exam or practice set <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {completedReviewableAttempts.map((a) => {
                    const isSelected = selectedAttemptId === a.attemptId;
                    return (
                      <button
                        key={a.attemptId}
                        type="button"
                        onClick={() => void selectAttempt(a.attemptId)}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-all space-y-1",
                          isSelected
                            ? "border-brand-teal bg-brand-teal/10 ring-1 ring-brand-teal/30"
                            : "border-border bg-background hover:bg-surface-muted"
                        )}
                      >
                        <div className="font-semibold text-xs text-foreground truncate">
                          {a.examTitle}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-foreground-secondary">
                          <span>
                            {a.scorePercentage !== undefined && a.scorePercentage !== null
                              ? `${a.scorePercentage}%`
                              : a.status}
                            {a.pathway ? ` · ${a.pathway}` : ""}
                          </span>
                          <span>{a.totalQuestions} Qs</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeInProgressAttempts.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                    In-Progress Exams
                  </p>
                  {activeInProgressAttempts.slice(0, 3).map((a) => (
                    <div
                      key={a.attemptId}
                      className="rounded-lg border border-border bg-surface-muted/40 p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-medium text-foreground">{a.examTitle}</span>
                      <Link href={`/exam-session?attemptId=${encodeURIComponent(a.attemptId)}&mode=Exam`}>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 gap-1">
                          <Play className="w-3 h-3" /> Resume
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {loadedResult && loadedResult.reviewQuestions.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-brand text-xs font-bold uppercase tracking-wider text-foreground">
                    Questions ({loadedResult.reviewQuestions.length})
                  </h3>
                  <Link href={`/exam-session?attemptId=${encodeURIComponent(loadedResult.attemptId)}&mode=Review`}>
                    <span className="text-[11px] font-semibold text-brand-teal hover:underline">
                      Open Review
                    </span>
                  </Link>
                </div>

                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {loadedResult.reviewQuestions.map((q, idx) => {
                    const isActive = activeQuestionObj?.question.questionId === q.questionId;
                    return (
                      <button
                        key={q.questionId}
                        type="button"
                        onClick={() => setSelectedQuestionId(q.questionId)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 transition-all",
                          isActive
                            ? "border-brand-teal bg-brand-teal/10 font-semibold text-foreground"
                            : "border-border bg-background hover:bg-surface-muted text-foreground-secondary"
                        )}
                      >
                        <span className="truncate">Question #{idx + 1}</span>
                        {q.isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : q.isPartiallyCorrect ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Contextual Tutor Workspace */}
          <div className="lg:col-span-8">
            {loadingAttempt ? (
              <Card className="p-10 flex items-center justify-center gap-2 text-xs text-foreground-secondary">
                <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                Loading examination questions for Contextual Tutor...
              </Card>
            ) : attemptError ? (
              <Card className="p-6 space-y-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Tutor Unavailable for This Attempt
                </div>
                <p className="text-foreground-secondary">{attemptError}</p>
              </Card>
            ) : loadedResult && !loadedResult.reviewReleased ? (
              <Card className="p-6 space-y-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Answer Keys &amp; Tutor Withheld
                </div>
                <p className="text-foreground-secondary">
                  This examination&apos;s published policy does not release question keys or rationales after submission.
                </p>
              </Card>
            ) : loadedResult && activeQuestionObj ? (
              <ContextualTutorWorkspace
                attemptId={loadedResult.attemptId}
                examTitle={loadedResult.examTitle}
                pathway={loadedResult.pathway ? String(loadedResult.pathway) : undefined}
                question={activeQuestionObj.question}
                questionNumber={activeQuestionObj.questionNumber}
                totalQuestions={loadedResult.reviewQuestions.length}
                keysReleased={loadedResult.reviewReleased}
                returnLabel="Open Full Attempt Review"
                onReturnToReview={() => {
                  router.push(
                    `/exam-session?attemptId=${encodeURIComponent(loadedResult.attemptId)}&mode=Review`
                  );
                }}
                onBackToResults={() => {
                  router.push(`/learner/attempts/${encodeURIComponent(loadedResult.attemptId)}`);
                }}
              />
            ) : (
              <Card className="p-10 text-center space-y-3">
                <Sparkles className="w-9 h-9 mx-auto text-brand-teal" />
                <h2 className="font-brand text-base font-bold text-foreground">
                  Select an Examination Attempt to Begin
                </h2>
                <p className="text-xs text-foreground-secondary max-w-md mx-auto">
                  Choose any completed attempt on the left to ask targeted questions, dissect distractors, and drill weak nursing concepts.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </LearnerShell>
  );
}
