"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageProgressBar } from "@/components/exam/StageProgressBar";
import { AssessmentResultsDashboard } from "@/components/exam/AssessmentResultsDashboard";
import { ReviewWorkspace } from "@/components/exam/ReviewWorkspace";
import { ContextualTutorWorkspace } from "@/components/exam/ContextualTutorWorkspace";
import { nurviaApi } from "@/lib/api-client";
import type {
  ExamAttemptSummaryDto,
  ExamLayout,
  SubmittedExamResultDto,
} from "@/lib/api-types";
import {
  canTransitionStage,
  getStageAvailability,
  loadExamViewState,
  resolveAttemptLifecycleStatus,
  saveExamViewState,
  type ExamExperienceStage,
  type ReviewFilterKey,
} from "@/lib/attempts/exam-experience-state";
import { BookOpenCheck, Lock, Play, RotateCcw, Sparkles } from "lucide-react";

export default function LearnerAttemptWorkspacePage() {
  const router = useRouter();

  const [history, setHistory] = React.useState<ExamAttemptSummaryDto[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = React.useState<string>("");
  const [result, setResult] = React.useState<SubmittedExamResultDto | null>(null);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [loadingReview, setLoadingReview] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [stage, setStage] = React.useState<ExamExperienceStage>("results");
  const [reviewFilter, setReviewFilter] = React.useState<ReviewFilterKey>("All");
  const [reviewLayout, setReviewLayout] = React.useState<ExamLayout>("Sequential");
  const [currentQuestionId, setCurrentQuestionId] = React.useState<string>("");
  const [tutorQuestionId, setTutorQuestionId] = React.useState<string>("");
  const [returnContext, setReturnContext] = React.useState<{
    questionId: string;
    filter: ReviewFilterKey;
    layout: ExamLayout;
  } | null>(null);
  const [stageNotice, setStageNotice] = React.useState<string | null>(null);
  const hasHydratedAttemptRef = React.useRef<string>("");

  React.useEffect(() => {
    let active = true;
    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const queryAttemptId = (sp.get("attemptId") || sp.get("id") || "").trim();

    void nurviaApi.getAttemptHistory({ fetchAll: true }).then((res) => {
      if (!active) return;
      const items = res.success && Array.isArray(res.data) ? res.data : [];
      setHistory(items);

      if (queryAttemptId) {
        setSelectedAttemptId(queryAttemptId);
      } else {
        const firstCompleted = items.find((item) => item.status !== "InProgress");
        if (firstCompleted) {
          setSelectedAttemptId(firstCompleted.attemptId);
        }
      }
      setLoadingHistory(false);
    });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedAttemptId) {
      setResult(null);
      return;
    }
    let active = true;
    setLoadingReview(true);
    setError(null);

    void nurviaApi.getAttemptReview(selectedAttemptId).then((response) => {
      if (!active) return;
      if (response.success && response.data) {
        const savedView = loadExamViewState(selectedAttemptId);
        setResult(response.data);
        const firstId = response.data.reviewQuestions?.[0]?.questionId || "";
        const validCurrentId =
          savedView?.currentQuestionId &&
          response.data.reviewQuestions?.some((q) => q.questionId === savedView.currentQuestionId)
            ? savedView.currentQuestionId
            : firstId;
        const validTutorId =
          savedView?.tutorQuestionId &&
          response.data.reviewQuestions?.some((q) => q.questionId === savedView.tutorQuestionId)
            ? savedView.tutorQuestionId
            : validCurrentId;
        setCurrentQuestionId(validCurrentId);
        setTutorQuestionId(validTutorId);
        if (savedView?.reviewFilter) setReviewFilter(savedView.reviewFilter);
        if (savedView?.reviewLayout) setReviewLayout(savedView.reviewLayout);
        if (savedView?.returnQuestionId) {
          setReturnContext({
            questionId: savedView.returnQuestionId,
            filter: savedView.returnFilter || savedView.reviewFilter || "All",
            layout: savedView.returnLayout || savedView.reviewLayout || "Sequential",
          });
        }

        if (typeof window !== "undefined" && response.data.reviewReleased) {
          const sp = new URLSearchParams(window.location.search);
          const requestedStage = (sp.get("stage") || sp.get("mode") || "").toLowerCase();
          if (requestedStage === "review") {
            setStage("review");
          } else if (requestedStage === "tutor") {
            setStage("tutor");
          } else if (savedView && savedView.stage !== "assessment") {
            setStage(savedView.stage);
          } else {
            setStage("results");
          }
        } else {
          setStage("results");
        }
        hasHydratedAttemptRef.current = selectedAttemptId;
      } else {
        setResult(null);
        setError(response.message || "Unable to load review content for this attempt.");
      }
      setLoadingReview(false);
    });

    return () => {
      active = false;
    };
  }, [selectedAttemptId]);

  React.useEffect(() => {
    if (!selectedAttemptId || hasHydratedAttemptRef.current !== selectedAttemptId) return;
    saveExamViewState(selectedAttemptId, {
      stage,
      currentQuestionId: currentQuestionId || undefined,
      reviewFilter,
      reviewLayout,
      tutorQuestionId: tutorQuestionId || undefined,
      returnQuestionId: returnContext?.questionId,
      returnFilter: returnContext?.filter,
      returnLayout: returnContext?.layout,
    });
  }, [selectedAttemptId, stage, currentQuestionId, reviewFilter, reviewLayout, tutorQuestionId, returnContext]);

  const completedAttempts = React.useMemo(
    () => history.filter((item) => item.status !== "InProgress"),
    [history]
  );
  const activeAttempts = React.useMemo(
    () => history.filter((item) => item.status === "InProgress"),
    [history]
  );

  const lifecycleStatus = resolveAttemptLifecycleStatus(result?.status);
  // Derive review/tutor availability consistent with getStageAvailability:
  // - Review is withheld only when backend explicitly sets modePermissions.reviewReleased = false.
  // - Tutor is available for completed attempts where the backend policy permits.
  const reviewWithheld =
    result?.modePermissions?.reviewReleased === false ? true : result ? !result.reviewReleased : false;
  const canAskTutor =
    result?.modePermissions?.canTutor === true ? true : Boolean(result?.reviewReleased);

  const availability = React.useMemo(
    () =>
      getStageAvailability({
        lifecycleStatus,
        deliveryMode: "Exam",
        reviewReleased: Boolean(result?.reviewReleased),
        modePermissions: result?.modePermissions,
        hasAttemptId: Boolean(selectedAttemptId),
      }),
    [lifecycleStatus, result?.reviewReleased, result?.modePermissions, selectedAttemptId]
  );

  const handleSelectStage = (target: ExamExperienceStage) => {
    const check = canTransitionStage(stage, target, {
      lifecycleStatus,
      deliveryMode: "Exam",
      reviewReleased: Boolean(result?.reviewReleased),
      modePermissions: result?.modePermissions,
      hasAttemptId: Boolean(selectedAttemptId),
    });
    if (!check.allowed) {
      setStageNotice(check.reason || "That stage is unavailable for this attempt.");
      return;
    }
    setStageNotice(null);
    if (target === "tutor" && !tutorQuestionId && result?.reviewQuestions?.[0]) {
      setTutorQuestionId(result.reviewQuestions[0].questionId);
    }
    setStage(target);
  };

  const handleOpenTutorForQuestion = (questionId?: string) => {
    const fallbackId =
      questionId ||
      currentQuestionId ||
      result?.reviewQuestions?.[0]?.questionId ||
      "";
    if (!fallbackId) return;
    setReturnContext({
      questionId: currentQuestionId || fallbackId,
      filter: reviewFilter,
      layout: reviewLayout,
    });
    setTutorQuestionId(fallbackId);
    setStage("tutor");
    setStageNotice(null);
  };

  const handleReturnToReview = () => {
    if (returnContext) {
      setCurrentQuestionId(returnContext.questionId);
      setReviewFilter(returnContext.filter);
      setReviewLayout(returnContext.layout);
    }
    setStage("review");
  };

  const flaggedMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    result?.reviewQuestions?.forEach((q) => {
      if (q.isFlagged) map[q.questionId] = true;
    });
    result?.flaggedQuestionIds?.forEach((id) => {
      map[id] = true;
    });
    return map;
  }, [result]);

  const activeTutorQuestion = React.useMemo(() => {
    if (!result?.reviewQuestions?.length) return null;
    const idx = result.reviewQuestions.findIndex((q) => q.questionId === tutorQuestionId);
    const resolvedIdx = idx >= 0 ? idx : 0;
    return {
      question: result.reviewQuestions[resolvedIdx],
      questionNumber: resolvedIdx + 1,
    };
  }, [result, tutorQuestionId]);

  return (
    <LearnerShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="teal">Attempt Results &amp; Review</Badge>
            <h1 className="font-brand text-2xl font-bold text-foreground sm:text-3xl">
              Examination Attempt &amp; Review Workspace
            </h1>
            <p className="text-xs sm:text-sm text-foreground-secondary">
              Inspect submitted examination results, question-by-question rationales, and interactive Tutor guidance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedAttemptId && !reviewWithheld && (
              <Button
                type="button"
                onClick={() => handleSelectStage("review")}
                className="bg-brand-teal hover:bg-brand-tealDeep text-white gap-1.5"
              >
                <BookOpenCheck className="w-4 h-4" /> Review Questions
              </Button>
            )}
            {selectedAttemptId && !reviewWithheld && (
              <Link href={`/exam-session?attemptId=${encodeURIComponent(selectedAttemptId)}&mode=Review`}>
                <Button variant="outline" className="gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-teal" /> Open Full Review Mode
                </Button>
              </Link>
            )}
            <Link href="/learner/history">
              <Button variant="outline">Attempt History</Button>
            </Link>
          </div>
        </div>

        {/* Attempt Switcher for Completed Attempts */}
        {completedAttempts.length > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                Completed Attempts Ready for Review ({completedAttempts.length})
              </span>
              {activeAttempts.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  {activeAttempts.length} active attempt{activeAttempts.length > 1 ? "s" : ""} locked from Review until submitted
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select completed attempt for review">
              {completedAttempts.slice(0, 12).map((att) => {
                const isSelected = att.attemptId === selectedAttemptId;
                return (
                  <button
                    key={att.attemptId}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedAttemptId(att.attemptId)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "border-brand-teal bg-brand-teal/10 font-bold text-foreground"
                        : "border-border bg-surface text-foreground-secondary hover:border-brand-teal/50"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                    <span className="truncate max-w-[220px]">{att.examTitle}</span>
                    {typeof att.scorePercentage === "number" && (
                      <Badge variant={isSelected ? "teal" : "outline"} className="text-[10px]">
                        {Math.round(att.scorePercentage)}%
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Active In-Progress Attempts Notice (Strictly Protected from Premature Review) */}
        {activeAttempts.length > 0 && completedAttempts.length === 0 && !selectedAttemptId && (
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-brand text-base font-bold text-foreground">
                  Review Locked While Examination Attempt Is In Progress
                </h2>
                <p className="text-xs text-foreground-secondary">
                  Answer keys and rationales remain confidential until your active attempt is completed and submitted.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {activeAttempts.map((att) => (
                <div
                  key={att.attemptId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3.5"
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">{att.examTitle}</p>
                    <p className="text-[11px] text-foreground-muted">Status: In Progress</p>
                  </div>
                  <Link href={`/exam-session?attemptId=${encodeURIComponent(att.attemptId)}&mode=Exam`}>
                    <Button size="sm" className="bg-brand-teal text-white hover:bg-brand-tealDeep gap-1.5 text-xs">
                      <Play className="w-3.5 h-3.5" /> Resume Active Attempt
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        )}

        {(loadingHistory || loadingReview) && (
          <p className="py-8 text-center text-sm text-foreground-secondary" aria-live="polite">
            Loading saved attempt and review content…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {error}
          </p>
        )}

        {!loadingHistory && !loadingReview && !selectedAttemptId && activeAttempts.length === 0 && (
          <Card className="p-6 space-y-3">
            <p className="font-semibold text-foreground">No completed examination attempts found yet.</p>
            <p className="text-xs text-foreground-secondary">
              Complete and submit an examination to unlock full question-by-question Review and Tutor rationales.
            </p>
            <Link href="/learner/exams">
              <Button size="sm" className="bg-brand-teal text-white hover:bg-brand-tealDeep text-xs">
                Browse Study Library
              </Button>
            </Link>
          </Card>
        )}

        {result && !loadingReview && (
          <>
            <div className="rounded-2xl border border-border bg-surface px-4 pb-3 pt-1">
              <StageProgressBar
                currentStage={stage}
                availability={availability}
                onSelectStage={handleSelectStage}
                tutorQuestionNumber={activeTutorQuestion?.questionNumber}
              />
            </div>

            {stageNotice && (
              <div
                role="status"
                className="rounded-xl border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-100"
              >
                {stageNotice}
              </div>
            )}

            {stage === "results" && (
              <AssessmentResultsDashboard
                result={result}
                canAskTutor={canAskTutor && result.reviewQuestions.length > 0}
                onEnterReview={(initialFilter) => {
                  setReviewFilter(initialFilter || "All");
                  setStage("review");
                }}
                onEnterTutor={(qId) => handleOpenTutorForQuestion(qId)}
                onViewPerformance={() => router.push("/learner/performance")}
                onBackToDashboard={() => router.push("/learner")}
              />
            )}

            {stage === "review" && (
              <ReviewWorkspace
                questions={result.reviewQuestions}
                activeFilter={reviewFilter}
                onFilterChange={setReviewFilter}
                layout={reviewLayout}
                allowLayoutSwitching
                onLayoutChange={setReviewLayout}
                currentQuestionId={currentQuestionId}
                onSelectQuestion={setCurrentQuestionId}
                flaggedMap={flaggedMap}
                canAskTutor={canAskTutor}
                onAskTutor={(qId) => handleOpenTutorForQuestion(qId)}
                onBackToResults={() => setStage("results")}
              />
            )}

            {stage === "tutor" && activeTutorQuestion && (
              <ContextualTutorWorkspace
                attemptId={result.attemptId}
                examTitle={result.examTitle}
                pathway={result.pathway ? String(result.pathway) : undefined}
                question={activeTutorQuestion.question}
                questionNumber={activeTutorQuestion.questionNumber}
                totalQuestions={result.reviewQuestions.length}
                keysReleased={result.reviewReleased}
                returnLabel={`Return to Question #${activeTutorQuestion.questionNumber} in Review`}
                onReturnToReview={handleReturnToReview}
                onBackToResults={() => setStage("results")}
              />
            )}
          </>
        )}
      </div>
    </LearnerShell>
  );
}
