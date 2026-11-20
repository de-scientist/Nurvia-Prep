"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ExamShell } from "@/components/layout/exam-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  ClipboardList,
  Sparkles,
  Trophy,
  LayoutList,
  Rows3,
  CheckCircle2,
  Lightbulb,
  XCircle,
  MinusCircle,
  FileText,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nurviaApi } from "@/lib/api-client";
import { TutorModePanel } from "@/components/exam/TutorModePanel";
import { ExamLoadingScreen } from "@/components/exam/ExamLoadingScreen";
import {
  StartAttemptResultDto,
  SubmittedExamResultDto,
  ExamReviewContentDto,
  ExamLayout,
  ExamModePermissionsDto,
  TutorEvaluateResponseDto,
} from "@/lib/api-types";
import { resolveNormalizedQuestionType } from "@/lib/attempts/strata-answer-core.mjs";
import { QuestionRendererRegistry, RendererQuestion } from "@/components/exam/renderers";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { useAuth } from "@/components/auth/auth-provider";

type DeliveryMode = "Review" | "Exam" | "Tutor";type LayoutPolicy = "AllInOneOnly" | "SequentialOnly" | "Both" | null;

function formatUtcTimestamp(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAllocatedMinutes(minutes?: number | null): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return "Untimed";
  }
  return `${Math.round(minutes)} min`;
}

function formatElapsedDuration(seconds?: number | null): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function ExamSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status, user } = useAuth();

  const attemptIdParam = searchParams?.get("attemptId");
  const examIdParam = searchParams?.get("examId");
  const modeParam = searchParams?.get("mode") as "Exam" | "Tutor" | "Review" | "Preview" | null;
  const layoutParam = searchParams?.get("layout") as ExamLayout | null;

  // Session state
  const [attemptId, setAttemptId] = React.useState<string | null>(attemptIdParam);
  const [examTitle, setExamTitle] = React.useState<string>("NURVIA examination");
  const [questions, setQuestions] = React.useState<RendererQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(5400); // 90 min default
  const [deliveryMode, setDeliveryMode] = React.useState<DeliveryMode>(modeParam === "Tutor" ? "Tutor" : modeParam === "Preview" ? "Review" : modeParam || "Exam");
  const [autosaveStatus, setAutosaveStatus] = React.useState<"saving" | "saved" | "idle" | "error">("idle");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [loadingStage, setLoadingStage] = React.useState<number>(1);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Layout state — defaults to Sequential during active exams and AllInOne during Review.
  const [layout, setLayout] = React.useState<ExamLayout>(
    layoutParam || (modeParam === "Review" || modeParam === "Preview" ? "AllInOne" : "Sequential")
  );
  const [layoutPolicy, setLayoutPolicy] = React.useState<LayoutPolicy>(null);
  const [modePermissions, setModePermissions] = React.useState<ExamModePermissionsDto | undefined>(undefined);
  const [configuredQuestionCount, setConfiguredQuestionCount] = React.useState<number | undefined>(undefined);
  const [integrityWarnings, setIntegrityWarnings] = React.useState<string[]>([]);
  const [modeSwitchNotice, setModeSwitchNotice] = React.useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = React.useState<"All" | "Correct" | "Incorrect" | "Unanswered" | "Flagged">("All");

  // Review-mode study session (no graded attempt) and Tutor reveal state.
  const [isReviewContent, setIsReviewContent] = React.useState<boolean>(false);
  const [isPreview, setIsPreview] = React.useState<boolean>(false);
  const [tutorEvaluations, setTutorEvaluations] = React.useState<Record<string, TutorEvaluateResponseDto>>({});
  const [tutorResponseJsons, setTutorResponseJsons] = React.useState<Record<string, string | null>>({});

  // Review & Submit state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = React.useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = React.useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = React.useState<SubmittedExamResultDto | null>(null);
  const [isQuestionGridOpen, setIsQuestionGridOpen] = React.useState<boolean>(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  // Autosave debounce timers, keyed per question so that answering a new
  // question can never cancel a pending save for a previous one.
  const autosaveTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout | null>>({});
  const autosaveRetryTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const allInOneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const returnTo = typeof window === "undefined"
        ? "/exam-session"
        : `${window.location.pathname}${window.location.search}`;
      router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    } else if (status === "authenticated" && user?.role !== "Learner" && user?.role !== "Superadmin") {
      router.replace("/access-denied");
    }
  }, [status, user, router]);

  // 1. Initialize session from the API
  React.useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (attemptIdParam) {
        setIsLoading(true);
        setLoadingStage(2);
        setLoadError(null);
        if (modeParam === "Review") {
          const reviewRes = await nurviaApi.getAttemptReview(attemptIdParam);
          if (cancelled) return;
          if (reviewRes.success && reviewRes.data) {
            setLoadingStage(4);
            hydrateFromReview(reviewRes.data);
            setLoadingStage(5);
            setIsLoading(false);
            return;
          } else {
            // NEVER silently fall back to Exam mode when the learner explicitly requested Review mode!
            setLoadError(
              reviewRes.message ||
                "Review mode is not available for this attempt until it has been submitted and graded."
            );
            setIsLoading(false);
            return;
          }
        }

        setLoadingStage(3);
        const res = await nurviaApi.getActiveAttempt(attemptIdParam, {
          mode: (modeParam as "Exam" | "Tutor" | "Review") ?? undefined,
        });
        if (!cancelled && res.success && res.data) {
          setLoadingStage(4);
          hydrateFromAttempt(res.data);
          setLoadingStage(5);
        } else if (!cancelled) {
          // Attempt may already be submitted, try loading completed review
          const reviewRes = await nurviaApi.getAttemptReview(attemptIdParam);
          if (reviewRes.success && reviewRes.data) {
            setLoadingStage(4);
            hydrateFromReview(reviewRes.data);
            setLoadingStage(5);
          } else {
            setLoadError(reviewRes.message || res.message || "Unable to load this exam attempt.");
          }
        }
        if (!cancelled) setIsLoading(false);
      } else if (examIdParam && (modeParam === "Review" || modeParam === "Preview")) {
        // Review mode: study the published exam's approved answer keys without
        // creating any graded attempt. Preview mode is the admin equivalent.
        setIsLoading(true);
        setLoadingStage(2);
        setLoadError(null);
        const res = modeParam === "Preview"
          ? await nurviaApi.getExamPreviewContent(examIdParam)
          : await nurviaApi.getExamReviewContent(examIdParam);
        if (!cancelled && res.success && res.data) {
          setLoadingStage(4);
          hydrateFromReviewContent(res.data);
          if (modeParam === "Preview") setIsPreview(true);
          setLoadingStage(5);
        } else if (!cancelled) {
          setLoadError(res.message || "Review is not available for this examination.");
        }
        if (!cancelled) setIsLoading(false);
      } else if (examIdParam) {
        // Immediately start in Sequential layout unless AllInOne is explicitly requested (no blocking pre-start modal)
        const initialLayout: ExamLayout = layoutParam === "AllInOne" ? "AllInOne" : "Sequential";
        await startFreshAttempt(initialLayout);
      } else {
        setLoadError("Choose a published exam before opening an exam session.");
      }
    }

    async function startFreshAttempt(chosenLayout: ExamLayout) {
      setIsLoading(true);
      setLoadingStage(2);
      setLoadError(null);
      const res = await nurviaApi.startAttempt(examIdParam!, {
        deliveryMode: modeParam === "Tutor" ? "Tutor" : "Exam",
        layoutMode: chosenLayout,
      });
      if (cancelled) return;
      if (res.success && res.data) {
        setLoadingStage(4);
        setAttemptId(res.data.attemptId);
        hydrateFromAttempt(res.data);
        setLoadingStage(5);
        if (typeof window !== "undefined") {
          const canonicalUrl = `/exam-session?attemptId=${encodeURIComponent(res.data.attemptId)}&examId=${encodeURIComponent(examIdParam!)}&mode=${encodeURIComponent(res.data.deliveryMode)}&layout=${encodeURIComponent(chosenLayout)}`;
          window.history.replaceState(null, "", canonicalUrl);
        }
      } else {
        setLoadError(res.message || "Unable to start this exam. Please choose another published exam.");
      }
      setIsLoading(false);
    }

    loadSession();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptIdParam, examIdParam, modeParam, layoutParam]);

  // Cancel pending autosaves when the exam session is unmounted.
  React.useEffect(() => {
    const timeouts = autosaveTimeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      if (autosaveRetryTimerRef.current) clearTimeout(autosaveRetryTimerRef.current);
    };
  }, []);

  const hydrateFromReviewContent = (data: ExamReviewContentDto) => {
    setExamTitle(data.examTitle);
    setIsReviewContent(true);
    setDeliveryMode("Review");
    setLayout(layoutParam === "Sequential" ? "Sequential" : "AllInOne");
    if (data.modePermissions) setModePermissions(data.modePermissions);
    if (data.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);

    const mapped: RendererQuestion[] = data.questions.map((q) => ({
      id: q.questionId,
      numericId: q.numericId,
      guidId: q.guidId,
      sectionId: q.sectionId,
      sectionGuidId: q.sectionGuidId,
      sectionName: q.sectionName,
      orderIndex: q.orderIndex,
      stem: q.stem,
      metaStem: q.metaStem,
      instructions: q.instructions,
      questionType: q.questionType,
      cognitiveSkill: q.cognitiveSkill,
      clientNeedCategory: q.clientNeedCategory,
      generalRationale: q.generalRationale,
      learnerResponse: q.learnerResponse,
      isCorrect: q.isCorrect,
      options: q.options.map((o) => ({
        id: o.id,
        numericId: o.numericId,
        optionIndex: o.optionIndex,
        optionText: o.optionText,
        description: o.description,
        data: o.data,
        label: o.label,
        order: o.order,
        link: o.link,
        isCorrect: o.isCorrect,
        specificRationale: o.specificRationale,
        wasSelected: o.wasSelected,
        displayOrder: o.optionIndex,
      })),
      exhibits: q.exhibits,
      media: q.media,
      matrix: q.matrix,
      blankSelectPassage: q.blankSelectPassage,
      highlightPassage: q.highlightPassage,
      correctAnswerMeta: q.correctAnswerMeta,
      contentIntegrityError: q.contentIntegrityError,
    }));
    setQuestions(mapped);
  };

  const hydrateFromReview = (data: SubmittedExamResultDto) => {
    setAttemptId(data.attemptId);
    setExamTitle(data.examTitle);
    setIsSubmitted(true);
    setSubmittedResult(data);
    setDeliveryMode("Review");
    setLayout(layoutParam === "Sequential" ? "Sequential" : "AllInOne");
    if (data.modePermissions) setModePermissions(data.modePermissions);

    if (data.reviewQuestions && data.reviewQuestions.length > 0) {
      const mapped: RendererQuestion[] = data.reviewQuestions.map((q) => ({
        id: q.questionId,
        numericId: q.numericId,
        guidId: q.guidId,
        sectionId: q.sectionId,
        sectionGuidId: q.sectionGuidId,
        sectionName: q.sectionName,
        orderIndex: q.orderIndex,
        stem: q.stem,
        metaStem: q.metaStem,
        instructions: q.instructions,
        questionType: q.questionType,
        cognitiveSkill: q.cognitiveSkill,
        clientNeedCategory: q.clientNeedCategory,
        generalRationale: q.generalRationale,
        learnerResponse: q.learnerResponse,
        isCorrect: q.isCorrect,
        options: q.options.map((o) => ({
          id: o.id,
          numericId: o.numericId,
          optionIndex: o.optionIndex,
          optionText: o.optionText,
          description: o.description,
          data: o.data,
          label: o.label,
          order: o.order,
          link: o.link,
          isCorrect: o.isCorrect,
          specificRationale: o.specificRationale,
          wasSelected: o.wasSelected,
          displayOrder: o.optionIndex,
        })),
        exhibits: q.exhibits,
        media: q.media,
        matrix: q.matrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        correctAnswerMeta: q.correctAnswerMeta,
        contentIntegrityError: q.contentIntegrityError,
      }));
      setQuestions(mapped);

      const initialAnswers: Record<string, string> = {};
      data.reviewQuestions.forEach((q) => {
        if (q.learnerResponse) {
          initialAnswers[q.questionId] = q.learnerResponse;
        }
      });
      setAnswers(initialAnswers);
    }
  };

  const hydrateFromAttempt = (data: StartAttemptResultDto) => {
    setAttemptId(data.attemptId);
    setExamTitle(data.examTitle);
    setSecondsRemaining(data.remainingSeconds);
    setLayoutPolicy(data.allowedLayouts);
    setLayout(data.layoutMode || "Sequential");
    const effectiveDeliveryMode: DeliveryMode =
      (data.deliveryMode as string) === "Tutor" || modeParam === "Tutor"
        ? "Tutor"
        : (data.deliveryMode as string) === "Review" || modeParam === "Review"
        ? "Review"
        : "Exam";
    setDeliveryMode(effectiveDeliveryMode);
    if (data.modePermissions) setModePermissions(data.modePermissions);
    if (data.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    if (Array.isArray(data.integrityWarnings)) setIntegrityWarnings(data.integrityWarnings);

    if (data.questions && data.questions.length > 0) {
      const mapped: RendererQuestion[] = data.questions.map((q) => ({
        id: q.id,
        numericId: q.numericId,
        guidId: q.guidId,
        sectionId: q.sectionId,
        sectionGuidId: q.sectionGuidId,
        sectionName: q.sectionName,
        orderIndex: q.orderIndex,
        stem: q.stem,
        metaStem: q.metaStem,
        instructions: q.instructions,
        questionType: q.questionType,
        cognitiveSkill: q.cognitiveSkill,
        clientNeedCategory: q.clientNeedCategory,
        contentJsonData: q.contentJsonData,
        generalRationale: q.generalRationale,
        options: q.options.map((o) => ({
          id: o.id,
          numericId: o.numericId,
          optionIndex: o.optionIndex,
          optionText: o.optionText,
          displayOrder: o.displayOrder,
          description: o.description,
          data: o.data,
          label: o.label,
          order: o.order,
          link: o.link,
          isCorrect: o.isCorrect,
          specificRationale: o.specificRationale,
        })),
        exhibits: q.exhibits,
        media: q.media,
        matrix: q.matrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        correctAnswerMeta: q.correctAnswerMeta,
        contentIntegrityError: q.contentIntegrityError,
      }));
      setQuestions(mapped);
    }

    // Saved answers
    if (data.savedResponses) {
      const initialAnswers: Record<string, string> = {};
      const initialFlags: Record<string, boolean> = {};
      Object.entries(data.savedResponses).forEach(([qId, state]) => {
        if (state.responseJson) initialAnswers[qId] = state.responseJson;
        if (state.isFlagged) initialFlags[qId] = true;
      });
      setAnswers(initialAnswers);
      setFlags(initialFlags);
    }

    // Tutor session recovery: restore server-authoritative stage progression when
    // the published configuration permits Tutor access. The backend only returns
    // evaluation content for questions whose own answer was already evaluated
    // (stage >= 4) — no premature answer disclosure.
    if (data.modePermissions?.canTutor) {
      void (async () => {
        try {
          const res = await nurviaApi.getTutorSessionState(data.attemptId);
          if (res.success && res.data) {
            const recovered: Record<string, TutorEvaluateResponseDto> = {};
            res.data.questions.forEach((q) => {
              if (q.evaluation) recovered[q.questionId] = q.evaluation;
              setTutorResponseJsons((prev) => ({ ...prev, [q.questionId]: q.responseJson ?? null }));
            });
            if (Object.keys(recovered).length > 0) {
              setTutorEvaluations((prev) => ({ ...recovered, ...prev }));
            }
          }
        } catch {
          // Recovery is best-effort; the learner can re-evaluate if unavailable.
        }
      })();
    }
  };

  // 2. Debounced Autosave Handler
  const persistResponse = async (
    questionId: string,
    payloadJson: string | null,
    isFlagged: boolean,
    layoutMode?: ExamLayout
  ) => {
    if (!attemptId) return;
    try {
      const res = await nurviaApi.autosaveResponse(attemptId, {
        questionId,
        responseJson: payloadJson,
        isFlagged,
        layoutMode: layoutMode ?? null,
      });
      setAutosaveStatus(res.success ? "saved" : "error");
    } catch {
      setAutosaveStatus("error");
    }
  };

  // Retries a failed save for the latest pending answer. Safe to repeat: the
  // backend autosave is an idempotent per-question update.
  const scheduleSaveRetry = (questionId: string, payloadJson: string | null, isFlagged: boolean) => {
    if (autosaveRetryTimerRef.current) clearTimeout(autosaveRetryTimerRef.current);
    autosaveRetryTimerRef.current = setTimeout(async () => {
      autosaveRetryTimerRef.current = null;
      setAutosaveStatus("saving");
      await persistResponse(questionId, payloadJson, isFlagged);
    }, 4000);
  };

  // Manual retry affordance: re-save the current question's latest answer right
  // away when the automatic retry has not (yet) resolved a save failure.
  const retrySaveNow = () => {
    const qid = questions[currentIndex]?.id;
    if (!qid || !attemptId || isSubmitted) return;
    if (autosaveRetryTimerRef.current) {
      clearTimeout(autosaveRetryTimerRef.current);
      autosaveRetryTimerRef.current = null;
    }
    setAutosaveStatus("saving");
    void persistResponse(qid, answers[qid] ?? null, flags[qid] || false);
  };

  React.useEffect(() => {
    // Schedule a safe retry whenever a save fails while an attempt is active.
    if (autosaveStatus !== "error" || !attemptId || isSubmitted) return;
    const qid = questions[currentIndex]?.id;
    if (!qid) return;
    scheduleSaveRetry(qid, answers[qid] ?? null, flags[qid] || false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveStatus]);

  // Immediately persists a debounced-but-unsaved response (used before
  // navigating to another question or opening the submit dialog). Returns a
  // promise so submission can await reconciliation of every pending save.
  const flushPendingAutosave = (questionId: string): Promise<void> => {
    const pending = autosaveTimeoutsRef.current[questionId];
    if (!pending) return Promise.resolve();
    clearTimeout(pending);
    autosaveTimeoutsRef.current[questionId] = null;
    return persistResponse(questionId, answers[questionId] ?? null, flags[questionId] || false);
  };

  const handleAnswerChange = (questionId: string, payloadJson: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: payloadJson }));

    if (!attemptId || isReviewContent) return;

    setAutosaveStatus("saving");
    if (autosaveTimeoutsRef.current[questionId]) clearTimeout(autosaveTimeoutsRef.current[questionId]);
    if (autosaveRetryTimerRef.current) {
      clearTimeout(autosaveRetryTimerRef.current);
      autosaveRetryTimerRef.current = null;
    }

    autosaveTimeoutsRef.current[questionId] = setTimeout(async () => {
      autosaveTimeoutsRef.current[questionId] = null;
      await persistResponse(questionId, payloadJson, flags[questionId] || false);
    }, 600);
  };

  // 3. Toggle Flag Handler
  const handleToggleFlag = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    const currentFlag = flags[currentQ.id] || false;
    const nextFlag = !currentFlag;

    setFlags((prev) => ({ ...prev, [currentQ.id]: nextFlag }));

    if (attemptId) {
      setAutosaveStatus("saving");
      if (autosaveTimeoutsRef.current[currentQ.id]) {
        clearTimeout(autosaveTimeoutsRef.current[currentQ.id]!);
        autosaveTimeoutsRef.current[currentQ.id] = null;
      }
      await persistResponse(currentQ.id, answers[currentQ.id] || null, nextFlag);
    }
  };

  // Layout switch: permitted only when the exam allows both layouts. Switching
  // never touches persisted responses; the choice is persisted on the attempt.
  const handleLayoutChange = async (nextLayout: ExamLayout) => {
    if (layoutPolicy === "AllInOneOnly" || layoutPolicy === "SequentialOnly") return;
    if (nextLayout === layout) return;
    setLayout(nextLayout);
    if (attemptId && !isSubmitted) {
      const currentQ = questions[currentIndex];
      if (currentQ) {
        setAutosaveStatus("saving");
        await persistResponse(currentQ.id, answers[currentQ.id] ?? null, flags[currentQ.id] || false, nextLayout);
      }
    }
  };

  // Mode switch: enforces exam backend permissions & prevents key leakage mid-exam
  const handleModeChange = (nextMode: DeliveryMode) => {
    setModeSwitchNotice(null);
    if (nextMode === deliveryMode) return;

    if (nextMode === "Review") {
      if (!isSubmitted && !isReviewContent) {
        if (modePermissions && !modePermissions.canReview) {
          setModeSwitchNotice(
            modePermissions.reviewReason ||
              "Review mode is disabled by this examination's backend configuration."
          );
          return;
        }
        setModeSwitchNotice(
          "Submit your examination first (click Finish Exam) to unlock Review mode with answer keys and rationales."
        );
        return;
      }
      if (isSubmitted && submittedResult && !submittedResult.reviewReleased) {
        setModeSwitchNotice(
          modePermissions?.reviewReason ||
            "Detailed Review rationales are withheld for this examination by backend policy."
        );
        return;
      }
      setDeliveryMode("Review");
      setLayout("AllInOne");
      return;
    }

    if (nextMode === "Tutor") {
      // Allow Tutor mode entry from submitted state when the published
      // configuration permits it. Tutor has independent answer/evaluation state
      // and does not modify the submitted examination.
      if (modePermissions && !modePermissions.canTutor) {
        setModeSwitchNotice(
          modePermissions.tutorReason ||
            "Tutor mode is not enabled for this examination by backend policy."
        );
        return;
      }
      setDeliveryMode("Tutor");
      return;
    }

    if (nextMode === "Exam") {
      if (isSubmitted || isReviewContent) {
        setModeSwitchNotice(
          "Graded reviews are read-only. Return to the Study Library to begin a new timed Exam attempt."
        );
        return;
      }
      setDeliveryMode("Exam");
    }
  };

  // 4. Submit Examination Handler (Automatic Transition into Review Mode)
  const handleSubmitExam = async () => {
    if (isSubmitting) return;
    setSubmissionError(null);
    if (!attemptId) {
      setSubmissionError("There is no persisted exam attempt to submit.");
      return;
    }
    setIsSubmitting(true);

    try {
      // Reconcile every debounced-but-unsaved response before submitting so the
      // authoritative backend grading uses the learner's latest answers.
      await Promise.all(
        Object.keys(autosaveTimeoutsRef.current).map((qid) => flushPendingAutosave(qid))
      );

      const response = await nurviaApi.submitAttempt(attemptId);
      if (!response.success || !response.data) {
        setSubmissionError(response.message || "The exam could not be submitted. Your attempt has not been marked complete.");
      } else {
        setIsSubmitModalOpen(false);
        setIsSubmitted(true);
        setSubmittedResult(response.data);

        // Automatic review transition ONLY if published configuration permits Review and review resource is ready
        if (response.data.reviewReleased) {
          hydrateFromReview(response.data);
          setDeliveryMode("Review");
          setCurrentIndex(0);
          // Canonical URL updated to review mode without disrupting state
          const canonicalUrl = `/exam-session?attemptId=${encodeURIComponent(attemptId)}&mode=Review`;
          window.history.replaceState(null, "", canonicalUrl);
        }
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "The exam could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];
  const isCurrentFlagged = currentQ ? Boolean(flags[currentQ.id]) : false;

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = Object.values(flags).filter(Boolean).length;

  const correctCount = isSubmitted && submittedResult
    ? submittedResult.correctQuestions
    : questions.filter((q) => q.options.some((o) => o.wasSelected && o.isCorrect)).length;
  const incorrectCount = isSubmitted && submittedResult
    ? Math.max(0, submittedResult.totalQuestions - correctCount - (questions.length - answeredCount))
    : questions.filter((q) => answers[q.id] && !q.options.some((o) => o.wasSelected && o.isCorrect)).length;

  // Tutor progressive learning: reveal correctness + rationale once the learner
  // submits their answer for evaluation in TutorModePanel.
  const isTutorRevealed = (q: RendererQuestion) =>
    deliveryMode === "Tutor" && !isSubmitted && Boolean(tutorEvaluations[q.id]);

  const reviewStateFor = (q: RendererQuestion) =>
    isSubmitted || isReviewContent || deliveryMode === "Review" || isTutorRevealed(q);

  const scrollToQuestion = (qId: string) => {
    const el = allInOneRefs.current[qId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (status !== "authenticated" ||
      (user?.role !== "Learner" && user?.role !== "Superadmin")) {
    return (
      <ExamLoadingScreen
        title={examTitle}
        currentStage={2}
        mode={deliveryMode}
      />
    );
  }

  if (isLoading) {
    return (
      <ExamLoadingScreen
        title={examTitle}
        currentStage={loadingStage}
        totalQuestions={questions.length || null}
        mode={deliveryMode}
      />
    );
  }

  if (loadError && !questions.length) {
    return (
      <ExamLoadingScreen
        title={examTitle}
        error={loadError}
        onRetry={() => window.location.reload()}
        mode={deliveryMode}
      />
    );
  }

  const renderQuestion = (q: RendererQuestion, index: number, isSequential: boolean) => {
    const showReview = reviewStateFor(q);
    return (
      <div
        key={q.id}
        id={`question-card-${q.id}`}
        ref={(el) => { if (!isSequential) allInOneRefs.current[q.id] = el; }}
        className="scroll-mt-28"
      >
      <Card
        className={cn("p-6 space-y-6")}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-semibold text-brand-teal">
              Item {index + 1}
              {!isSequential && ` of ${questions.length}`}
            </span>
            <div className="flex items-center gap-2">
              {showReview && (
                (() => {
                  const rq = submittedResult?.reviewQuestions?.find((item) => item.questionId === q.id);
                  const isCorrect = rq ? rq.isCorrect : q.options.some((o) => o.wasSelected && o.isCorrect);
                  const isUnans = !answers[q.id] && !rq?.learnerResponse;
                  if (isUnans) {
                    return (
                      <Badge variant="outline" className="text-foreground-muted text-[10px] gap-1">
                        <MinusCircle className="w-3 h-3" /> Unanswered
                      </Badge>
                    );
                  }
                  return isCorrect ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Correct
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold gap-1">
                      <XCircle className="w-3 h-3 text-rose-500" /> Incorrect
                    </Badge>
                  );
                })()
              )}
              {q.cognitiveSkill && (
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="w-3 h-3 mr-1 text-brand-teal" />
                  {String(q.cognitiveSkill)}
                </Badge>
              )}
              {isSequential && flags[q.id] && !showReview && (
                <Badge variant="destructive" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  <Bookmark className="w-3 h-3 mr-1 fill-amber-500" /> Flagged
                </Badge>
              )}
            </div>
          </div>

          <RichQuestionContent
            content={q.stem}
            as="h2"
            className="font-brand text-base sm:text-lg font-bold text-foreground leading-relaxed"
          />

          {/* Electronic Health Record (EHR) Clinical Exhibits (when attached and not rendered by CaseStudy wrapper) */}
          {q.exhibits &&
            q.exhibits.length > 0 &&
            !resolveNormalizedQuestionType(q.questionType).isCaseBased &&
            q.questionType !== 9 &&
            q.questionType !== "CaseStudy" &&
            q.questionType !== "UnfoldingCaseStudy" && (
            <div className="rounded-xl border border-border bg-surface-muted overflow-hidden text-xs">
              <div className="bg-surface border-b border-border px-3 py-2 flex items-center gap-1.5 font-bold text-foreground">
                <ClipboardList className="w-3.5 h-3.5 text-brand-teal" />
                <span>EHR Clinical Exhibits ({q.exhibits.length})</span>
              </div>
              <div className="p-3 space-y-2">
                {q.exhibits.map((exh, eIdx) => (
                  <div key={exh.id || eIdx} className="rounded-lg border border-border/70 bg-surface p-2.5 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                      <FileText className="w-3 h-3 text-brand-teal" /> {exh.title}
                    </p>
                    <RichQuestionContent content={exh.content} className="text-foreground-secondary leading-relaxed text-[11px]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modular Renderer Registry */}
        <div className="pt-2">
          <QuestionRendererRegistry
            question={q}
            value={answers[q.id] ?? null}
            onChange={(val) => handleAnswerChange(q.id, val)}
            disabled={isSubmitted || isReviewContent}
            isReview={showReview}
          />
        </div>

        {/* Progressive Tutor Mode Panel (Stages 1-6)
            Tutor is available after submission when the published configuration
            permits it (modePermissions.canTutor). Tutor maintains independent
            answer/evaluation state that does not modify the submitted examination. */}
        {deliveryMode === "Tutor" && attemptId && (isSubmitted
          ? modePermissions?.canTutor
          : true
        ) && (
          <TutorModePanel
            key={q.id}
            attemptId={attemptId}
            questionId={q.id}
            hasSelectedAnswer={Boolean(answers[q.id])}
            serializedAnswer={answers[q.id] ?? null}
            evaluation={tutorEvaluations[q.id] ?? null}
            responseJson={tutorResponseJsons[q.id] ?? null}
            onEvaluated={(result) =>
              setTutorEvaluations((prev) => ({ ...prev, [q.id]: result }))
            }
          />
        )}

        {/* All-in-One inline flag control */}
        {!isSequential && !isSubmitted && !isReviewContent && attemptId && (
          <button
            type="button"
            onClick={async () => {
              const nextFlag = !flags[q.id];
              setFlags((prev) => ({ ...prev, [q.id]: nextFlag }));
              setAutosaveStatus("saving");
              await persistResponse(q.id, answers[q.id] ?? null, nextFlag);
            }}
            className={cn(
              "text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors",
              flags[q.id]
                ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border text-foreground-secondary hover:bg-surface-muted"
            )}
          >
            <Bookmark className={cn("w-3.5 h-3.5", flags[q.id] && "fill-amber-500")} />
            {flags[q.id] ? "Flagged" : "Flag for review"}
          </button>
        )}
      </Card>
      </div>
    );
  };

  return (
    <ExamShell
      examTitle={examTitle}
      totalQuestions={questions.length}
      configuredQuestionCount={configuredQuestionCount}
      currentQuestion={layout === "Sequential" ? currentIndex + 1 : Math.min(answeredCount + 1, questions.length)}
      mode={deliveryMode}
      onModeChange={handleModeChange}
      modePermissions={modePermissions}
      layoutMode={layout}
      allowLayoutSwitching={layoutPolicy !== "AllInOneOnly" && layoutPolicy !== "SequentialOnly"}
      onLayoutChange={(next) => void handleLayoutChange(next)}
      isFlagged={isCurrentFlagged}
      onToggleFlag={handleToggleFlag}
      onSubmitExam={() => {
        setIsSubmitModalOpen(true);
      }}
      secondsRemaining={secondsRemaining}
      onTimerExpired={handleSubmitExam}
      autosaveStatus={autosaveStatus}
      onRetrySave={retrySaveNow}
      answeredCount={answeredCount}
      onOpenQuestionGrid={() => setIsQuestionGridOpen(true)}
      showTimer={!isReviewContent && !isSubmitted}
      showSubmitExam={!isReviewContent && !isSubmitted}
      showFlag={layout === "Sequential" && !isReviewContent && !isSubmitted}
      modeBadge={deliveryMode === "Tutor" ? "Tutor Mode · Immediate Feedback" : undefined}
    >
      <div className="space-y-6">
        {modeSwitchNotice && (
          <div
            role="status"
            className="rounded-xl border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-950 dark:text-amber-100 flex items-center justify-between gap-3"
          >
            <span>{modeSwitchNotice}</span>
            <button
              type="button"
              onClick={() => setModeSwitchNotice(null)}
              className="font-semibold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {integrityWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Examination Delivery Integrity Notice</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
              {integrityWarnings.slice(0, 3).map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
              {integrityWarnings.length > 3 && (
                <li>And {integrityWarnings.length - 3} additional item warning(s).</li>
              )}
            </ul>
          </div>
        )}
        {/* Post-Submission Result Hero Banner */}
        {isSubmitted && submittedResult && (
          <div className="p-6 rounded-2xl border border-brand-teal/30 bg-surface shadow-md space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0",
                  submittedResult.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                )}>
                  {submittedResult.passed ? <Trophy className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground-muted">
                    {submittedResult.examTitle || examTitle}
                  </p>
                  <h3 className="font-brand font-bold text-lg text-foreground">
                    {submittedResult.passed ? "Examination Passed!" : "Remediation Recommended"}
                  </h3>
                  <p className="text-xs text-foreground-secondary">
                    {submittedResult.reviewReleased
                      ? "Your attempt has been scored deterministically. Review clinical rationales below."
                      : "Your attempt has been scored deterministically. Detailed rationales are currently withheld."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-brand font-extrabold text-foreground">
                    {submittedResult.scorePercentage}%
                  </div>
                  <div className="text-[11px] text-foreground-muted font-medium">
                    Passing: {submittedResult.passingScorePercentage}%
                  </div>
                </div>
                <Badge variant={submittedResult.passed ? "teal" : "destructive"} className="text-xs px-3 py-1">
                  {submittedResult.passed ? "Passed" : "Needs Review"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-foreground-secondary">
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="block text-[11px] text-foreground-muted">Total Questions</span>
                <span className="font-bold text-sm text-foreground">{submittedResult.totalQuestions}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="block text-[11px] text-foreground-muted">Correct Answers</span>
                <span className="font-bold text-sm text-emerald-600">{submittedResult.correctQuestions}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="block text-[11px] text-foreground-muted">Time Allocated</span>
                <span className="font-bold text-sm text-foreground">
                  {formatAllocatedMinutes(submittedResult.timeLimitMinutes)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="block text-[11px] text-foreground-muted">Time Used</span>
                <span className="font-bold text-sm text-foreground">
                  {formatElapsedDuration(submittedResult.timeSpentSeconds)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border/50">
                <span className="block text-[11px] text-foreground-muted">Review Status</span>
                <span className="font-bold text-sm text-brand-teal">
                  {submittedResult.reviewReleased ? "Released" : "Withheld"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] text-foreground-muted">
              <span>Started: <strong className="text-foreground-secondary">{formatUtcTimestamp(submittedResult.startedAtUtc)}</strong></span>
              <span>Submitted: <strong className="text-foreground-secondary">{formatUtcTimestamp(submittedResult.submittedAtUtc)}</strong></span>
              <span>Status: <strong className="text-foreground-secondary">{submittedResult.status}</strong></span>
            </div>
          </div>
        )}

        {/* Review-mode study banner (no graded attempt) */}
        {isReviewContent && (
          <div className="p-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
            <div className="text-xs text-foreground-secondary space-y-1">
              <p className="font-brand font-bold text-sm text-foreground">
                {isPreview ? "Admin Preview — Content Validation" : "Review Mode — Study Session"}
              </p>
              <p>
                {isPreview
                  ? "Previewing every question with its approved answer keys and rationales. This preview does not create an attempt and never affects examination statistics."
                  : "Study each question with its approved correct answers and clinical rationales. This session is separate from any graded examination attempt and is not scored."}
              </p>
            </div>
          </div>
        )}

        {/* Layout selector — only when the exam permits both layouts */}
        {layoutPolicy === "Both" && !isSubmitted && !isReviewContent && (
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-1" role="group" aria-label="Navigation layout">
              <Button
                variant={layout === "Sequential" ? "primary" : "outline"}
                size="sm"
                className="text-xs gap-1.5"
                aria-pressed={layout === "Sequential"}
                onClick={() => void handleLayoutChange("Sequential")}
              >
                <Rows3 className="w-3.5 h-3.5" /> Sequential
              </Button>
              <Button
                variant={layout === "AllInOne" ? "primary" : "outline"}
                size="sm"
                className="text-xs gap-1.5"
                aria-pressed={layout === "AllInOne"}
                onClick={() => void handleLayoutChange("AllInOne")}
              >
                <LayoutList className="w-3.5 h-3.5" /> All-in-One
              </Button>
            </div>
            <span className="text-[11px] text-foreground-muted hidden sm:block">
              Switching layout never loses your answers.
            </span>
          </div>
        )}

        {/* Sequential View — one question at a time */}
        {layout === "Sequential" ? (
          <>
            {/* Question Header Bar */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  Item {currentIndex + 1} of {questions.length}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsQuestionGridOpen(true)}
                  className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Question List ({answeredCount}/{questions.length})</span>
                </button>
              </div>
            </div>

            {currentQ ? (
              renderQuestion(currentQ, currentIndex, true)
            ) : (
              <div className="p-12 text-center text-xs text-foreground-muted">
                No questions available for this session.
              </div>
            )}

            {/* Question Stepper Navigation Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={async () => {
                    if (currentQ) await flushPendingAutosave(currentQ.id);
                    setCurrentIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="text-xs gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous Item
                </Button>

                <Button
                  size="sm"
                  disabled={currentIndex === questions.length - 1}
                  onClick={async () => {
                    if (currentQ) await flushPendingAutosave(currentQ.id);
                    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
                  }}
                  className="text-xs gap-1 bg-brand-navy hover:bg-brand-navyDeep text-white dark:bg-brand-teal"
                >
                  Next Item <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {deliveryMode === "Review" && attemptId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleModeChange("Tutor")}
                    className="text-xs gap-1.5 border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Switch to Guided Tutor Mode
                  </Button>
                )}
                {deliveryMode === "Tutor" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleModeChange("Review")}
                    className="text-xs gap-1.5 border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" /> Return to Review Mode
                  </Button>
                )}
                <span className="text-xs font-medium text-foreground-muted hidden sm:inline-block">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* All-in-One View — continuous vertical scroll + Review filter/navigator */
          <>
            <div className="sticky top-[62px] z-30 rounded-xl border border-border bg-surface/95 backdrop-blur-md p-3 shadow-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-mono">
                    All-in-One View · {questions.length} items
                  </Badge>
                  {(isSubmitted || deliveryMode === "Review") && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {(["All", "Correct", "Incorrect", "Unanswered", "Flagged"] as const).map((filterKey) => (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setReviewFilter(filterKey)}
                          className={cn(
                            "rounded-md border px-2 py-0.5 font-semibold transition-colors",
                            reviewFilter === filterKey
                              ? "border-brand-teal bg-brand-teal text-white"
                              : "border-border bg-background text-foreground-secondary hover:bg-surface-muted"
                          )}
                        >
                          {filterKey}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuestionGridOpen(true)}
                  className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Question List ({answeredCount}/{questions.length})</span>
                </button>
              </div>

              {(isSubmitted || deliveryMode === "Review") && questions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {questions.map((q, idx) => {
                    const rq = submittedResult?.reviewQuestions?.find((item) => item.questionId === q.id);
                    const hasAns = Boolean(answers[q.id] || rq?.learnerResponse);
                    const isRight = rq ? rq.isCorrect : q.options.some((o) => o.wasSelected && o.isCorrect);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setReviewFilter("All");
                          document
                            .getElementById(`question-card-${q.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={cn(
                          "h-7 min-w-7 px-1.5 rounded-md border text-[11px] font-bold shrink-0 transition-colors",
                          !hasAns
                            ? "border-border bg-surface-muted text-foreground-muted"
                            : isRight
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        )}
                        title={`Jump to Question ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {questions
                .map((q, idx) => ({ q, idx }))
                .filter(({ q }) => {
                  if (!(isSubmitted || deliveryMode === "Review") || reviewFilter === "All") return true;
                  const rq = submittedResult?.reviewQuestions?.find((item) => item.questionId === q.id);
                  const hasAns = Boolean(answers[q.id] || rq?.learnerResponse);
                  const isRight = rq ? rq.isCorrect : q.options.some((o) => o.wasSelected && o.isCorrect);
                  if (reviewFilter === "Correct") return hasAns && isRight;
                  if (reviewFilter === "Incorrect") return hasAns && !isRight;
                  if (reviewFilter === "Unanswered") return !hasAns;
                  if (reviewFilter === "Flagged") return Boolean(flags[q.id]);
                  return true;
                })
                .map(({ q, idx }) => renderQuestion(q, idx, false))}
            </div>
          </>
        )}
      </div>

      {/* Review/Tutor transition controls (All-In-One layout) */}
      <div className="flex items-center gap-2">
                  {deliveryMode === "Review" && attemptId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleModeChange("Tutor")}
                      className="text-xs gap-1.5 border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Switch to Guided Tutor Mode
                    </Button>
                  )}
                  {deliveryMode === "Tutor" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleModeChange("Review")}
                      className="text-xs gap-1.5 border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" /> Return to Review Mode
                    </Button>
                  )}
                </div>

      {isQuestionGridOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-brand font-bold text-base text-foreground">Examination Question Navigator</h3>
                <p className="text-xs text-foreground-secondary">
                  Jump directly to any item. Review answered and flagged items before submission.
                </p>
              </div>
              <button
                onClick={() => setIsQuestionGridOpen(false)}
                className="text-foreground-secondary hover:text-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Legend */}
            {isSubmitted || deliveryMode === "Review" ? (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Correct ({correctCount})</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Incorrect ({incorrectCount})</span>
                </span>
                <span className="flex items-center gap-1.5 text-foreground-muted">
                  <MinusCircle className="w-3.5 h-3.5 text-foreground-muted" />
                  <span>Unanswered ({unansweredCount})</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-brand-teal/20 border border-brand-teal" />
                  <span>Answered ({answeredCount})</span>
                </span>
                <span className="flex-1 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-surface-muted border border-border" />
                  <span>Unanswered ({unansweredCount})</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>Flagged ({flaggedCount})</span>
                </span>
              </div>
            )}

            {/* Questions Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-72 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAns = Boolean(answers[q.id]);
                const isFlg = Boolean(flags[q.id]);
                const isCurr = layout === "Sequential" && idx === currentIndex;
                const isReviewMode = isSubmitted || deliveryMode === "Review";

                const rq = submittedResult?.reviewQuestions?.find((item) => item.questionId === q.id);
                const isCorrect = rq ? rq.isCorrect : q.options.some((o) => o.wasSelected && o.isCorrect);
                const isUnans = isReviewMode ? (!answers[q.id] && !rq?.learnerResponse) : !isAns;

                let btnStyle = "bg-surface-muted border-border text-foreground-secondary hover:bg-surface";
                if (isReviewMode) {
                  if (isUnans) {
                    btnStyle = "bg-surface-muted border-border text-foreground-muted";
                  } else if (isCorrect) {
                    btnStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold";
                  } else {
                    btnStyle = "bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300 font-bold";
                  }
                } else {
                  if (isAns) {
                    btnStyle = "bg-brand-teal/15 border-brand-teal text-brand-teal";
                  }
                  if (isFlg) {
                    btnStyle = cn(btnStyle, "border-amber-500 text-amber-700 dark:text-amber-400");
                  }
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setIsQuestionGridOpen(false);
                      if (layout === "AllInOne") {
                        setCurrentIndex(idx);
                        scrollToQuestion(q.id);
                      } else {
                        setCurrentIndex(idx);
                      }
                    }}
                    className={cn(
                      "h-10 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center border gap-0.5",
                      btnStyle,
                      isCurr && "ring-2 ring-foreground"
                    )}
                  >
                    <span>{idx + 1}</span>
                    {isReviewMode && !isUnans && (
                      isCorrect ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      )
                    )}
                    {!isReviewMode && isFlg && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button size="sm" onClick={() => setIsQuestionGridOpen(false)} className="text-xs">
                Resume
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-brand font-bold text-base text-foreground">Finish Examination?</h3>
                <p className="text-xs text-foreground-secondary">
                  Please review your submission status.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-muted border border-border text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Total Questions:</span>
                <span className="font-bold text-foreground">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Answered:</span>
                <span className="font-bold text-emerald-600">{answeredCount}</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between font-semibold text-rose-500">
                  <span>Unanswered:</span>
                  <span>{unansweredCount}</span>
                </div>
              )}
              {flaggedCount > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>Flagged for Review:</span>
                  <span>{flaggedCount}</span>
                </div>
              )}
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-rose-500 font-medium">
                Warning: You have {unansweredCount} unanswered questions. Unanswered items will receive zero points.
              </p>
            )}

            {submissionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Submission could not be completed</p>
                  <p>{submissionError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setSubmissionError(null);
                  setIsSubmitModalOpen(false);
                }}
                className="text-xs"
              >
                Return to Exam
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleSubmitExam}
                className="text-xs flex items-center gap-1.5"
              >
                {isSubmitting ? "Submitting & Grading..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </ExamShell>
  );
}

export default function ExamSessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-foreground-muted">Loading NURVIA examination session...</div>}>
      <ExamSessionContent />
    </Suspense>
  );
}
