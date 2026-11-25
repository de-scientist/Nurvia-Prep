"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Button } from "@/components/ui/button";
import { StageProgressBar } from "@/components/exam/StageProgressBar";
import { AssessmentResultsDashboard } from "@/components/exam/AssessmentResultsDashboard";
import { ReviewWorkspace } from "@/components/exam/ReviewWorkspace";
import { ContextualTutorWorkspace } from "@/components/exam/ContextualTutorWorkspace";
import { nurviaApi } from "@/lib/api-client";
import type { ExamLayout, SubmittedExamResultDto } from "@/lib/api-types";
import {
  canTransitionStage,
  getStageAvailability,
  loadExamViewState,
  resolveAttemptLifecycleStatus,
  saveExamViewState,
  type ExamExperienceStage,
  type ReviewFilterKey,
} from "@/lib/attempts/exam-experience-state";
import { Sparkles } from "lucide-react";

export default function AttemptResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const attemptId = params.id;

  const [result, setResult] = React.useState<SubmittedExamResultDto | null>(null);
  const [loading, setLoading] = React.useState(true);
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
  const hasHydratedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    let active = true;
    void nurviaApi.getAttemptReview(attemptId).then((response) => {
      if (!active) return;
      if (response.success && response.data) {
        const savedView = loadExamViewState(attemptId);
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
          }
        }
        hasHydratedRef.current = true;
      } else {
        setError(response.message || "Unable to load this saved result.");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [attemptId]);

  React.useEffect(() => {
    if (!attemptId || !hasHydratedRef.current) return;
    saveExamViewState(attemptId, {
      stage,
      currentQuestionId: currentQuestionId || undefined,
      reviewFilter,
      reviewLayout,
      tutorQuestionId: tutorQuestionId || undefined,
      returnQuestionId: returnContext?.questionId,
      returnFilter: returnContext?.filter,
      returnLayout: returnContext?.layout,
    });
  }, [attemptId, stage, currentQuestionId, reviewFilter, reviewLayout, tutorQuestionId, returnContext]);

  const lifecycleStatus = resolveAttemptLifecycleStatus(result?.status);
  const reviewWithheld = result ? !result.reviewReleased : false;
  const canAskTutor = Boolean(result?.reviewReleased);

  const availability = React.useMemo(
    () =>
      getStageAvailability({
        lifecycleStatus,
        deliveryMode: "Exam",
        reviewReleased: Boolean(result?.reviewReleased),
        modePermissions: result?.modePermissions,
        hasAttemptId: Boolean(attemptId),
      }),
    [lifecycleStatus, result?.reviewReleased, result?.modePermissions, attemptId]
  );

  const handleSelectStage = (target: ExamExperienceStage) => {
    const check = canTransitionStage(stage, target, {
      lifecycleStatus,
      deliveryMode: "Exam",
      reviewReleased: Boolean(result?.reviewReleased),
      modePermissions: result?.modePermissions,
      hasAttemptId: Boolean(attemptId),
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
            <p className="text-xs font-bold uppercase tracking-wider text-brand-teal">
              Persisted exam result
            </p>
            <h1 className="font-brand text-2xl font-bold text-foreground sm:text-3xl">
              Result and review
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!reviewWithheld && (
              <Link href={`/exam-session?attemptId=${encodeURIComponent(attemptId)}&mode=Review`}>
                <Button className="bg-brand-teal hover:bg-brand-tealDeep text-white gap-1.5">
                  <Sparkles className="w-4 h-4" /> Open Full Review Mode
                </Button>
              </Link>
            )}
            <Link href="/learner">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </div>
        </div>

        {loading && (
          <p className="py-8 text-center text-sm text-foreground-secondary" aria-live="polite">
            Loading saved result…
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

        {result && (
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
