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
  LayoutList,
  Rows3,
  CheckCircle2,
  Lightbulb,
  XCircle,
  MinusCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nurviaApi } from "@/lib/api-client";
import { TutorModePanel } from "@/components/exam/TutorModePanel";
import { ExamLoadingScreen } from "@/components/exam/ExamLoadingScreen";
import { StageProgressBar } from "@/components/exam/StageProgressBar";
import { AssessmentResultsDashboard } from "@/components/exam/AssessmentResultsDashboard";
import { ReviewWorkspace } from "@/components/exam/ReviewWorkspace";
import { ContextualTutorWorkspace } from "@/components/exam/ContextualTutorWorkspace";
import { QuestionNavigatorModal } from "@/components/exam/QuestionNavigatorModal";
import { SubmitConfirmationModal } from "@/components/exam/SubmitConfirmationModal";
import {
  StartAttemptResultDto,
  SubmittedExamResultDto,
  ExamReviewContentDto,
  ReviewQuestionDto,
  ExamLayout,
  ExamModePermissionsDto,
  TutorEvaluateResponseDto,
  TutorHintResponseDto,
} from "@/lib/api-types";
import {
  isResponseAnswered,
  resolveNormalizedQuestionType,
  scoreCanonicalQuestion,
  wasCanonicalOptionSelected,
} from "@/lib/attempts/strata-answer-core.mjs";
import {
  canTransitionStage,
  getStageAvailability,
  loadExamViewState,
  resolveAttemptLifecycleStatus,
  resolveExamExperiencePermissions,
  saveExamViewState,
  type ExamExperienceStage,
  type ReviewFilterKey,
} from "@/lib/attempts/exam-experience-state";
import { QuestionRendererRegistry, RendererQuestion } from "@/components/exam/renderers";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { useAuth } from "@/components/auth/auth-provider";
import { isSataQuestion, validateSataSelection } from "@/lib/attempts/sata-validation";
import { feedback } from "@/lib/feedback/feedback-context";
import {
  normalizeExhibits,
  isCaseStudyQuestion,
  resolveAuthoritativeCaseStudyId,
  getCaseStudyNavigation,
} from "@/lib/content/case-study-normalizer";

type DeliveryMode = "Review" | "Exam" | "Tutor";
type LayoutPolicy = "AllInOneOnly" | "SequentialOnly" | "Both" | null;

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

function toReviewQuestionDto(
  q: RendererQuestion,
  answer?: string | null,
  isFlagged = false,
  tutorEval?: TutorEvaluateResponseDto | null
): ReviewQuestionDto {
  const effectiveAnswer = answer ?? q.learnerResponse ?? undefined;
  const isUnanswered = !isResponseAnswered(effectiveAnswer);
  const scored = tutorEval
    ? {
        isCorrect: tutorEval.isCorrect,
        isPartiallyCorrect:
          !tutorEval.isCorrect &&
          tutorEval.pointsAwarded > 0 &&
          tutorEval.pointsAwarded < tutorEval.maxPoints,
        pointsAwarded: tutorEval.pointsAwarded,
        maxPoints: tutorEval.maxPoints,
      }
    : scoreCanonicalQuestion(q as unknown as Record<string, unknown>, effectiveAnswer);
  const isCorrect = tutorEval
    ? tutorEval.isCorrect
    : !isUnanswered && (scored.isCorrect || Boolean(q.isCorrect));
  const isPartiallyCorrect = tutorEval
    ? scored.isPartiallyCorrect
    : !isUnanswered && Boolean(q.isPartiallyCorrect ?? scored.isPartiallyCorrect);

  return {
    questionId: q.id,
    numericId: q.numericId,
    guidId: q.guidId,
    sectionId: q.sectionId,
    sectionGuidId: q.sectionGuidId,
    sectionName: q.sectionName,
    orderIndex: q.orderIndex ?? 0,
    stem: q.stem,
    metaStem: q.metaStem,
    instructions: q.instructions,
    questionType: q.questionType as ReviewQuestionDto["questionType"],
    cognitiveSkill: (q.cognitiveSkill ?? "RecognizeCues") as ReviewQuestionDto["cognitiveSkill"],
    clientNeedCategory: (q.clientNeedCategory ?? "ManagementOfCare") as ReviewQuestionDto["clientNeedCategory"],
    difficulty: q.difficulty,
    learningObjectives: q.learningObjectives,
    resources: q.resources,
    prerequisites: q.prerequisites,
    generalRationale: q.generalRationale,
    learnerResponse: effectiveAnswer,
    isCorrect,
    isPartiallyCorrect,
    isUnanswered,
    isFlagged,
    allowPartialCredit: q.allowPartialCredit,
    pointsAwarded: q.pointsAwarded ?? (isUnanswered ? 0 : scored.pointsAwarded),
    maxPoints: q.maxPoints ?? scored.maxPoints ?? 1,
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
      isCorrect: Boolean(o.isCorrect),
      specificRationale: o.specificRationale,
      wasSelected:
        Boolean(o.wasSelected) ||
        wasCanonicalOptionSelected(o.id, effectiveAnswer) ||
        (o.numericId !== undefined &&
          wasCanonicalOptionSelected(String(o.numericId), effectiveAnswer)),
    })),
    caseStudyId: q.caseStudyId || resolveAuthoritativeCaseStudyId(q as any) || undefined,
    caseStudyTitle: q.caseStudyTitle,
    exhibits: (normalizeExhibits(q.exhibits) as ReviewQuestionDto["exhibits"]),
    media: q.media,
    matrix: q.matrix,
    blankSelectPassage: q.blankSelectPassage,
    highlightPassage: q.highlightPassage,
    correctAnswerMeta: q.correctAnswerMeta,
    contentIntegrityError: q.contentIntegrityError,
  };
}

function ExamSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status, user } = useAuth();

  const attemptIdParam = searchParams?.get("attemptId");
  const examIdParam = searchParams?.get("examId");
  const modeParam = searchParams?.get("mode") as "Exam" | "Tutor" | "Review" | "Preview" | null;
  const layoutParam = searchParams?.get("layout") as ExamLayout | null;

  // Core session & explicit experience stage state
  const [attemptId, setAttemptId] = React.useState<string | null>(attemptIdParam);
  const [examTitle, setExamTitle] = React.useState<string>("QuizNurse Examination");
  const [pathway, setPathway] = React.useState<string | undefined>(undefined);
  const [examCategory, setExamCategory] = React.useState<string | undefined>(undefined);
  const [isTimed, setIsTimed] = React.useState<boolean>(true);
  const [attemptStatus, setAttemptStatus] = React.useState<string>("InProgress");
  const [stage, setStage] = React.useState<ExamExperienceStage>(
    modeParam === "Review" || modeParam === "Preview" ? "review" : "assessment"
  );

  const [questions, setQuestions] = React.useState<RendererQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(5400);
  const [deliveryMode, setDeliveryMode] = React.useState<DeliveryMode>(
    modeParam === "Tutor" ? "Tutor" : modeParam === "Preview" ? "Review" : modeParam || "Exam"
  );
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
  const [reviewFilter, setReviewFilter] = React.useState<ReviewFilterKey>("All");

  // Contextual Tutor & Review return-state memory
  const [tutorQuestionId, setTutorQuestionId] = React.useState<string | null>(null);
  const [returnContext, setReturnContext] = React.useState<{
    questionId: string;
    filter: ReviewFilterKey;
    layout: ExamLayout;
  } | null>(null);

  // Review-mode study session (no graded attempt) and progressive Tutor reveal state.
  const [isReviewContent, setIsReviewContent] = React.useState<boolean>(false);
  const [isPreview, setIsPreview] = React.useState<boolean>(false);
  const [tutorEvaluations, setTutorEvaluations] = React.useState<Record<string, TutorEvaluateResponseDto>>({});
  const [tutorResponseJsons, setTutorResponseJsons] = React.useState<Record<string, string | null>>({});
  const [tutorHints, setTutorHints] = React.useState<Record<string, TutorHintResponseDto[]>>({});

  // Submission & modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = React.useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = React.useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = React.useState<SubmittedExamResultDto | null>(null);
  const [isQuestionGridOpen, setIsQuestionGridOpen] = React.useState<boolean>(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [failedSaveCount, setFailedSaveCount] = React.useState<number>(0);

  // Refs for concurrent-safe debounced autosaves without stale closure bugs
  const hasHydratedSessionRef = React.useRef<boolean>(false);
  const autosaveTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout | null>>({});
  const autosaveRetryTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const allInOneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const latestAnswersRef = React.useRef<Record<string, string>>({});
  const latestFlagsRef = React.useRef<Record<string, boolean>>({});
  const saveSeqRef = React.useRef<Record<string, number>>({});
  const failedSaveQuestionsRef = React.useRef<Record<string, boolean>>({});

  React.useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  React.useEffect(() => {
    latestFlagsRef.current = flags;
  }, [flags]);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const returnTo = typeof window === "undefined"
        ? "/exam-session"
        : `${window.location.pathname}${window.location.search}`;
      router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    } else if (status === "authenticated" && user?.role !== "Learner" && user?.role !== "Superadmin") {
      router.replace("/access-denied");
    } else if (status === "authenticated" && user?.emailVerified === false) {
      setLoadError("Email verification is required before accessing protected examination or tutor sessions. Please verify your email address in Account Settings.");
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

  // Cancel pending autosaves when unmounted
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
    hasHydratedSessionRef.current = true;
    setExamTitle(data.examTitle);
    setPathway(data.pathway ? String(data.pathway) : undefined);
    setExamCategory(data.category ? String(data.category) : undefined);
    setIsTimed((data.timeLimitMinutes ?? 0) > 0);
    setIsReviewContent(true);
    setAttemptStatus("Graded");
    setDeliveryMode("Review");
    setLayout(layoutParam === "Sequential" ? "Sequential" : "AllInOne");
    setStage("review");
    if (data.modePermissions) setModePermissions(data.modePermissions);
    if (data.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);

    const mapped: RendererQuestion[] = data.questions.map((q) => ({
      id: q.questionId,
      numericId: q.numericId,
      guidId: q.guidId,
      caseStudyId: q.caseStudyId || resolveAuthoritativeCaseStudyId(q as any) || undefined,
      caseStudyTitle: q.caseStudyTitle,
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
      difficulty: q.difficulty,
      learningObjectives: q.learningObjectives,
      resources: q.resources,
      prerequisites: q.prerequisites,
      generalRationale: q.generalRationale,
      learnerResponse: q.learnerResponse,
      isCorrect: q.isCorrect,
      isPartiallyCorrect: q.isPartiallyCorrect,
      allowPartialCredit: q.allowPartialCredit,
      pointsAwarded: q.pointsAwarded,
      maxPoints: q.maxPoints,
      isFlagged: q.isFlagged,
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
      exhibits: normalizeExhibits(q.exhibits),
      media: q.media,
      matrix: q.matrix,
      blankSelectPassage: q.blankSelectPassage,
      highlightPassage: q.highlightPassage,
      correctAnswerMeta: q.correctAnswerMeta,
      contentIntegrityError: q.contentIntegrityError,
    }));
    setQuestions(mapped);
  };

  const hydrateFromReview = (data: SubmittedExamResultDto, preferredStage?: ExamExperienceStage) => {
    hasHydratedSessionRef.current = true;
    const savedView = loadExamViewState(data.attemptId);

    setAttemptId(data.attemptId);
    setExamTitle(data.examTitle);
    setPathway(data.pathway ? String(data.pathway) : undefined);
    setExamCategory(data.examCategory ? String(data.examCategory) : undefined);
    setIsTimed(data.isTimed ?? ((data.timeLimitMinutes ?? 0) > 0));
    setAttemptStatus(data.status || "Graded");
    setIsSubmitted(true);
    setSubmittedResult(data);
    setDeliveryMode("Review");
    setLayout(
      layoutParam === "Sequential"
        ? "Sequential"
        : layoutParam === "AllInOne"
          ? "AllInOne"
          : savedView?.reviewLayout || "AllInOne"
    );
    if (data.modePermissions) setModePermissions(data.modePermissions);

    if (savedView?.reviewFilter) {
      setReviewFilter(savedView.reviewFilter);
    }
    if (savedView?.returnQuestionId) {
      setReturnContext({
        questionId: savedView.returnQuestionId,
        filter: savedView.returnFilter || savedView.reviewFilter || "All",
        layout: savedView.returnLayout || savedView.reviewLayout || "AllInOne",
      });
    }

    if (data.reviewQuestions && data.reviewQuestions.length > 0) {
      const mapped: RendererQuestion[] = data.reviewQuestions.map((q) => ({
        id: q.questionId,
        numericId: q.numericId,
        guidId: q.guidId,
        caseStudyId: q.caseStudyId || resolveAuthoritativeCaseStudyId(q as any) || undefined,
        caseStudyTitle: q.caseStudyTitle,
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
        difficulty: q.difficulty,
        learningObjectives: q.learningObjectives,
        resources: q.resources,
        prerequisites: q.prerequisites,
        generalRationale: q.generalRationale,
        learnerResponse: q.learnerResponse,
        isCorrect: q.isCorrect,
        isPartiallyCorrect: q.isPartiallyCorrect,
        allowPartialCredit: q.allowPartialCredit,
        pointsAwarded: q.pointsAwarded,
        maxPoints: q.maxPoints,
        isFlagged: q.isFlagged,
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
        exhibits: normalizeExhibits(q.exhibits),
        media: q.media,
        matrix: q.matrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        correctAnswerMeta: q.correctAnswerMeta,
        contentIntegrityError: q.contentIntegrityError,
      }));
      setQuestions(mapped);

      const initialAnswers: Record<string, string> = {};
      const initialFlags: Record<string, boolean> = {};
      data.reviewQuestions.forEach((q) => {
        if (q.learnerResponse) {
          initialAnswers[q.questionId] = q.learnerResponse;
        }
        if (q.isFlagged) {
          initialFlags[q.questionId] = true;
        }
      });
      data.flaggedQuestionIds?.forEach((qid) => {
        initialFlags[qid] = true;
      });
      latestAnswersRef.current = initialAnswers;
      latestFlagsRef.current = initialFlags;
      setAnswers(initialAnswers);
      setFlags(initialFlags);

      if (savedView?.currentQuestionId) {
        const restoredIdx = mapped.findIndex((q) => q.id === savedView.currentQuestionId);
        if (restoredIdx >= 0) setCurrentIndex(restoredIdx);
      }
      if (savedView?.tutorQuestionId) {
        setTutorQuestionId(savedView.tutorQuestionId);
      }
    }

    if (preferredStage) {
      setStage(preferredStage);
    } else if (modeParam === "Tutor" && data.reviewReleased) {
      setStage("tutor");
      setDeliveryMode("Tutor");
    } else if (savedView && savedView.stage !== "assessment") {
      if ((savedView.stage === "review" || savedView.stage === "tutor") && !data.reviewReleased) {
        setStage("results");
      } else {
        setStage(savedView.stage);
        if (savedView.stage === "tutor") {
          setDeliveryMode("Tutor");
        }
      }
    } else if (modeParam === "Review" && data.reviewReleased) {
      setStage("review");
    } else {
      setStage("results");
    }

    if (data.reviewReleased) {
      void (async () => {
        try {
          const res = await nurviaApi.getTutorSessionState(data.attemptId);
          if (res.success && res.data) {
            const recoveredEvals: Record<string, TutorEvaluateResponseDto> = {};
            const recoveredHints: Record<string, TutorHintResponseDto[]> = {};
            res.data.questions.forEach((q) => {
              if (q.evaluation) recoveredEvals[q.questionId] = q.evaluation;
              if (Array.isArray(q.hints) && q.hints.length > 0) {
                recoveredHints[q.questionId] = q.hints;
              }
              setTutorResponseJsons((prev) => ({
                ...prev,
                [q.questionId]: q.responseJson ?? null,
              }));
            });
            if (Object.keys(recoveredEvals).length > 0) {
              setTutorEvaluations((prev) => ({ ...recoveredEvals, ...prev }));
            }
            if (Object.keys(recoveredHints).length > 0) {
              setTutorHints((prev) => ({ ...recoveredHints, ...prev }));
            }
          }
        } catch {
          // Best-effort tutor session recovery on completed review hydration
        }
      })();
    }
  };

  const hydrateFromAttempt = (data: StartAttemptResultDto) => {
    hasHydratedSessionRef.current = true;
    const savedView = loadExamViewState(data.attemptId);

    setAttemptId(data.attemptId);
    setExamTitle(data.examTitle);
    setPathway(data.pathway ? String(data.pathway) : undefined);
    setExamCategory(data.examCategory ? String(data.examCategory) : undefined);
    setIsTimed(data.isTimed ?? ((data.timeLimitMinutes ?? 0) > 0));
    setAttemptStatus("InProgress");
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
    setStage(
      effectiveDeliveryMode === "Tutor" && savedView?.stage === "tutor"
        ? "tutor"
        : "assessment"
    );
    if (savedView?.tutorQuestionId) {
      setTutorQuestionId(savedView.tutorQuestionId);
    }
    if (data.modePermissions) setModePermissions(data.modePermissions);
    if (data.configuredQuestionCount) setConfiguredQuestionCount(data.configuredQuestionCount);
    if (Array.isArray(data.integrityWarnings)) setIntegrityWarnings(data.integrityWarnings);

    if (data.questions && data.questions.length > 0) {
      const mapped: RendererQuestion[] = data.questions.map((q) => ({
        id: q.id,
        numericId: q.numericId,
        guidId: q.guidId,
        caseStudyId: q.caseStudyId || resolveAuthoritativeCaseStudyId(q as any) || undefined,
        caseStudyTitle: q.caseStudyTitle,
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
        difficulty: q.difficulty,
        learningObjectives: q.learningObjectives,
        resources: q.resources,
        prerequisites: q.prerequisites,
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
        exhibits: normalizeExhibits(q.exhibits),
        media: q.media,
        matrix: q.matrix,
        blankSelectPassage: q.blankSelectPassage,
        highlightPassage: q.highlightPassage,
        correctAnswerMeta: q.correctAnswerMeta,
        contentIntegrityError: q.contentIntegrityError,
      }));
      setQuestions(mapped);

      if (savedView?.currentQuestionId) {
        const idx = mapped.findIndex((q) => q.id === savedView.currentQuestionId);
        if (idx >= 0) setCurrentIndex(idx);
      }
    }

    if (data.savedResponses) {
      const initialAnswers: Record<string, string> = {};
      const initialFlags: Record<string, boolean> = {};
      Object.entries(data.savedResponses).forEach(([qId, st]) => {
        if (st.responseJson) initialAnswers[qId] = st.responseJson;
        if (st.isFlagged) initialFlags[qId] = true;
      });
      latestAnswersRef.current = initialAnswers;
      latestFlagsRef.current = initialFlags;
      setAnswers(initialAnswers);
      setFlags(initialFlags);
    }

    if (data.modePermissions?.canTutor) {
      void (async () => {
        try {
          const res = await nurviaApi.getTutorSessionState(data.attemptId);
          if (res.success && res.data) {
            const recovered: Record<string, TutorEvaluateResponseDto> = {};
            const recoveredHints: Record<string, TutorHintResponseDto[]> = {};
            res.data.questions.forEach((q) => {
              if (q.evaluation) recovered[q.questionId] = q.evaluation;
              if (Array.isArray(q.hints) && q.hints.length > 0) {
                recoveredHints[q.questionId] = q.hints;
              }
              setTutorResponseJsons((prev) => ({ ...prev, [q.questionId]: q.responseJson ?? null }));
            });
            if (Object.keys(recovered).length > 0) {
              setTutorEvaluations((prev) => ({ ...recovered, ...prev }));
            }
            if (Object.keys(recoveredHints).length > 0) {
              setTutorHints((prev) => ({ ...recoveredHints, ...prev }));
            }
          }
        } catch {
          // Recovery is best-effort; learner can re-evaluate if unavailable.
        }
      })();
    }
  };

  // Persist non-sensitive UI view state (current question, stage, active filter/layout)
  React.useEffect(() => {
    if (!attemptId || !hasHydratedSessionRef.current) return;
    const currentQId = questions[currentIndex]?.id;
    saveExamViewState(attemptId, {
      stage,
      currentQuestionId: currentQId,
      reviewFilter,
      reviewLayout: layout,
      tutorQuestionId: tutorQuestionId ?? undefined,
      returnQuestionId: returnContext?.questionId,
      returnFilter: returnContext?.filter,
      returnLayout: returnContext?.layout,
    });
  }, [attemptId, stage, questions, currentIndex, reviewFilter, layout, tutorQuestionId, returnContext]);

  // 2. Concurrent-safe Debounced Autosave Handler
  const persistResponse = async (
    questionId: string,
    payloadJson: string | null,
    isFlagged: boolean,
    layoutMode?: ExamLayout
  ): Promise<boolean> => {
    if (!attemptId) return false;
    const nextSeq = (saveSeqRef.current[questionId] ?? 0) + 1;
    saveSeqRef.current[questionId] = nextSeq;

    try {
      const res = await nurviaApi.autosaveResponse(attemptId, {
        questionId,
        responseJson: payloadJson,
        isFlagged,
        layoutMode: layoutMode ?? null,
      });

      const backendConfirmed = Boolean(res.success && res.data?.backendSynced !== false);
      if (saveSeqRef.current[questionId] === nextSeq) {
        if (backendConfirmed) {
          delete failedSaveQuestionsRef.current[questionId];
          const remainingFailures = Object.keys(failedSaveQuestionsRef.current).length;
          setFailedSaveCount(remainingFailures);
          setAutosaveStatus(remainingFailures > 0 ? "error" : "saved");
        } else {
          failedSaveQuestionsRef.current[questionId] = true;
          setFailedSaveCount(Object.keys(failedSaveQuestionsRef.current).length);
          setAutosaveStatus("error");
        }
      }
      return backendConfirmed;
    } catch {
      if (saveSeqRef.current[questionId] === nextSeq) {
        failedSaveQuestionsRef.current[questionId] = true;
        setFailedSaveCount(Object.keys(failedSaveQuestionsRef.current).length);
        setAutosaveStatus("error");
      }
      return false;
    }
  };

  const scheduleSaveRetry = (questionId: string) => {
    if (autosaveRetryTimerRef.current) clearTimeout(autosaveRetryTimerRef.current);
    autosaveRetryTimerRef.current = setTimeout(async () => {
      autosaveRetryTimerRef.current = null;
      setAutosaveStatus("saving");
      await persistResponse(
        questionId,
        latestAnswersRef.current[questionId] ?? null,
        Boolean(latestFlagsRef.current[questionId])
      );
    }, 4000);
  };

  const retrySaveNow = () => {
    if (!attemptId || isSubmitted) return;
    if (autosaveRetryTimerRef.current) {
      clearTimeout(autosaveRetryTimerRef.current);
      autosaveRetryTimerRef.current = null;
    }
    const failedIds = Object.keys(failedSaveQuestionsRef.current);
    const currentQid = questions[currentIndex]?.id;
    const targets = failedIds.length > 0 ? failedIds : currentQid ? [currentQid] : [];
    if (targets.length === 0) return;

    setAutosaveStatus("saving");
    void Promise.all(
      targets.map((qid) =>
        persistResponse(
          qid,
          latestAnswersRef.current[qid] ?? null,
          Boolean(latestFlagsRef.current[qid])
        )
      )
    );
  };

  React.useEffect(() => {
    if (autosaveStatus !== "error" || !attemptId || isSubmitted) return;
    const failedQid = Object.keys(failedSaveQuestionsRef.current)[0] ?? questions[currentIndex]?.id;
    if (!failedQid) return;
    scheduleSaveRetry(failedQid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveStatus]);

  const flushPendingAutosave = async (questionId: string): Promise<boolean> => {
    const pending = autosaveTimeoutsRef.current[questionId];
    if (pending) {
      clearTimeout(pending);
      autosaveTimeoutsRef.current[questionId] = null;
    }
    if (!pending && !failedSaveQuestionsRef.current[questionId]) {
      return true;
    }
    return persistResponse(
      questionId,
      latestAnswersRef.current[questionId] ?? null,
      Boolean(latestFlagsRef.current[questionId])
    );
  };

  const handleAnswerChange = (questionId: string, payloadJson: string) => {
    if (isSubmitted || isReviewContent) return;
    const updatedMap = { ...latestAnswersRef.current, [questionId]: payloadJson };
    latestAnswersRef.current = updatedMap;
    setAnswers((prev) => ({ ...prev, [questionId]: payloadJson }));

    if (!attemptId) return;

    setAutosaveStatus("saving");
    if (autosaveTimeoutsRef.current[questionId]) {
      clearTimeout(autosaveTimeoutsRef.current[questionId]!);
    }
    if (autosaveRetryTimerRef.current) {
      clearTimeout(autosaveRetryTimerRef.current);
      autosaveRetryTimerRef.current = null;
    }

    autosaveTimeoutsRef.current[questionId] = setTimeout(async () => {
      autosaveTimeoutsRef.current[questionId] = null;
      await persistResponse(
        questionId,
        latestAnswersRef.current[questionId] ?? null,
        Boolean(latestFlagsRef.current[questionId])
      );
    }, 600);
  };

  // 3. Toggle Flag Handler
  const handleToggleFlag = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || isSubmitted || isReviewContent) return;
    const nextFlag = !latestFlagsRef.current[currentQ.id];
    latestFlagsRef.current = { ...latestFlagsRef.current, [currentQ.id]: nextFlag };
    setFlags((prev) => ({ ...prev, [currentQ.id]: nextFlag }));

    if (attemptId) {
      setAutosaveStatus("saving");
      if (autosaveTimeoutsRef.current[currentQ.id]) {
        clearTimeout(autosaveTimeoutsRef.current[currentQ.id]!);
        autosaveTimeoutsRef.current[currentQ.id] = null;
      }
      await persistResponse(
        currentQ.id,
        latestAnswersRef.current[currentQ.id] ?? null,
        nextFlag
      );
    }
  };

  const handleLayoutChange = async (nextLayout: ExamLayout) => {
    if (layoutPolicy === "AllInOneOnly" || layoutPolicy === "SequentialOnly") return;
    if (nextLayout === layout) return;
    setLayout(nextLayout);
    if (attemptId && !isSubmitted) {
      const currentQ = questions[currentIndex];
      if (currentQ) {
        setAutosaveStatus("saving");
        await persistResponse(
          currentQ.id,
          latestAnswersRef.current[currentQ.id] ?? null,
          Boolean(latestFlagsRef.current[currentQ.id]),
          nextLayout
        );
      }
    }
  };

  const lifecycleStatus = resolveAttemptLifecycleStatus(
    isSubmitted ? submittedResult?.status || "Graded" : attemptStatus
  );

  const stageContext = React.useMemo(
    () => ({
      lifecycleStatus,
      deliveryMode,
      reviewReleased: isReviewContent
        ? true
        : submittedResult
          ? Boolean(submittedResult.reviewReleased)
          : false,
      modePermissions,
      isReviewStudyContent: isReviewContent,
      hasAttemptId: Boolean(attemptId),
    }),
    [lifecycleStatus, deliveryMode, isReviewContent, submittedResult, modePermissions, attemptId]
  );

  const stageAvailability = React.useMemo(
    () => getStageAvailability(stageContext),
    [stageContext]
  );

  const effectiveModePermissions = React.useMemo(
    () => resolveExamExperiencePermissions(stageContext),
    [stageContext]
  );

  const transitionToStage = (target: ExamExperienceStage, focusQuestionId?: string) => {
    setModeSwitchNotice(null);
    const check = canTransitionStage(stage, target, stageContext);
    if (!check.allowed) {
      setModeSwitchNotice(check.reason || "That stage is unavailable in the current session state.");
      return;
    }
    if (target === "tutor") {
      const chosenQid = focusQuestionId || currentQ?.id || questions[0]?.id || null;
      if (stage === "review" && currentQ?.id) {
        setReturnContext({
          questionId: currentQ.id,
          filter: reviewFilter,
          layout,
        });
      }
      setTutorQuestionId(chosenQid);
      setDeliveryMode("Tutor");
    } else if (target === "review") {
      setDeliveryMode("Review");
    }
    setStage(target);
  };

  // Mode switch: enforces exam backend permissions & prevents key leakage mid-exam
  const handleModeChange = (nextMode: DeliveryMode) => {
    setModeSwitchNotice(null);
    if (nextMode === deliveryMode && stage !== "results") return;

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
      setStage("review");
      return;
    }

    if (nextMode === "Tutor") {
      const tutorPermitted = modePermissions?.canTutor ?? stageAvailability.tutor.canEnter;
      if (!tutorPermitted) {
        setModeSwitchNotice(
          modePermissions?.tutorReason ||
            stageAvailability.tutor.reason ||
            "Tutor mode is not enabled for this examination by backend policy."
        );
        return;
      }
      setDeliveryMode("Tutor");
      if (isSubmitted) {
        transitionToStage("tutor");
      } else {
        setStage("tutor");
      }
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
      setStage("assessment");
    }
  };

  // 4. Submit Examination Handler (Transitions into Results Dashboard first)
  const handleSubmitExam = async () => {
    if (isSubmitting) return;
    setSubmissionError(null);
    if (!attemptId) {
      setSubmissionError("There is no persisted exam attempt to submit.");
      return;
    }

    // Frontend SATA validation: strictly ensure all SATA questions meet exact required selection counts
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (isSataQuestion(q.questionType)) {
        const ans = latestAnswersRef.current[q.id] ?? answers[q.id] ?? null;
        const validation = validateSataSelection(q, ans);
        if (!validation.isValid) {
          const msg = validation.message || "Select the required number of answers to continue.";
          feedback.warn(msg);
          setSubmissionError(msg);
          setIsSubmitModalOpen(false);
          if (layout === "Sequential") {
            setCurrentIndex(i);
          } else {
            scrollToQuestion(q.id);
          }
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const pendingFlushIds = Array.from(
        new Set([
          ...Object.keys(autosaveTimeoutsRef.current),
          ...Object.keys(failedSaveQuestionsRef.current),
        ])
      );
      await Promise.all(pendingFlushIds.map((qid) => flushPendingAutosave(qid)));

      const response = await nurviaApi.submitAttempt(attemptId);
      if (!response.success || !response.data) {
        setSubmissionError(
          response.message || "The exam could not be submitted. Your attempt has not been marked complete."
        );
      } else {
        setIsSubmitModalOpen(false);
        setIsSubmitted(true);
        setSubmittedResult(response.data);
        setAttemptStatus(response.data.status || "Graded");

        if (response.data.reviewReleased) {
          hydrateFromReview(response.data, "results");
          const canonicalUrl = `/exam-session?attemptId=${encodeURIComponent(attemptId)}&mode=Review`;
          window.history.replaceState(null, "", canonicalUrl);
        } else {
          setStage("results");
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

  const answeredCount = React.useMemo(
    () => questions.filter((q) => isResponseAnswered(answers[q.id])).length,
    [questions, answers]
  );
  const flaggedCount = Object.values(flags).filter(Boolean).length;

  const isTutorRevealed = (q: RendererQuestion) =>
    deliveryMode === "Tutor" && !isSubmitted && Boolean(tutorEvaluations[q.id]);

  const reviewStateFor = (q: RendererQuestion) =>
    isSubmitted || isReviewContent || deliveryMode === "Review" || isTutorRevealed(q);

  const scrollToQuestion = (qId: string) => {
    const el = allInOneRefs.current[qId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reviewQuestionsList = React.useMemo<ReviewQuestionDto[]>(() => {
    if (submittedResult?.reviewQuestions && submittedResult.reviewQuestions.length > 0) {
      return submittedResult.reviewQuestions;
    }
    return questions.map((q) =>
      toReviewQuestionDto(q, answers[q.id], Boolean(flags[q.id]), tutorEvaluations[q.id])
    );
  }, [submittedResult, questions, answers, flags, tutorEvaluations]);

  const activeTutorEntry = React.useMemo(() => {
    if (reviewQuestionsList.length === 0) return null;
    const targetId = tutorQuestionId || currentQ?.id || reviewQuestionsList[0].questionId;
    const idx = reviewQuestionsList.findIndex((q) => q.questionId === targetId);
    const resolvedIdx = idx >= 0 ? idx : 0;
    return {
      question: reviewQuestionsList[resolvedIdx],
      questionNumber: resolvedIdx + 1,
    };
  }, [reviewQuestionsList, tutorQuestionId, currentQ]);

  const handleOpenTutorFromReview = (qId: string) => {
    setReturnContext({
      questionId: qId,
      filter: reviewFilter,
      layout,
    });
    const idx = questions.findIndex((q) => q.id === qId);
    if (idx >= 0) setCurrentIndex(idx);
    transitionToStage("tutor", qId);
  };

  const handleReturnFromTutor = () => {
    if (returnContext) {
      setReviewFilter(returnContext.filter);
      setLayout(returnContext.layout);
      const idx = questions.findIndex((q) => q.id === returnContext.questionId);
      if (idx >= 0) setCurrentIndex(idx);
    }
    if (isSubmitted || isReviewContent) {
      setDeliveryMode("Review");
      setStage("review");
    } else {
      setStage("assessment");
    }
  };

  if (status !== "authenticated" || (user?.role !== "Learner" && user?.role !== "Superadmin")) {
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

  const renderAssessmentQuestion = (
    q: RendererQuestion,
    index: number,
    isSequential: boolean,
    suppressCaseContext = false
  ) => {
    const showReview = reviewStateFor(q);
    return (
      <div
        key={q.id}
        id={`question-card-${q.id}`}
        ref={(el) => {
          if (!isSequential) allInOneRefs.current[q.id] = el;
        }}
        className="scroll-mt-28"
      >
        <Card className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-foreground-muted">
              <span className="font-semibold text-brand-teal">
                Item {index + 1}
                {!isSequential && ` of ${questions.length}`}
              </span>
              <div className="flex items-center gap-2">
                {showReview &&
                  (() => {
                    const rq = submittedResult?.reviewQuestions?.find((item) => item.questionId === q.id);
                    const tEval = tutorEvaluations[q.id];
                    const effectiveAns = answers[q.id] ?? rq?.learnerResponse;
                    const isUnans = !isResponseAnswered(effectiveAns);
                    if (isUnans) {
                      return (
                        <Badge variant="outline" className="text-foreground-muted text-[10px] gap-1">
                          <MinusCircle className="w-3 h-3" /> Unanswered
                        </Badge>
                      );
                    }
                    const scored = scoreCanonicalQuestion(
                      q as unknown as Record<string, unknown>,
                      effectiveAns
                    );
                    const isCorrect = rq
                      ? rq.isCorrect
                      : tEval
                        ? tEval.isCorrect
                        : scored.isCorrect || q.options.some((o) => o.wasSelected && o.isCorrect);
                    const isPartial = rq
                      ? Boolean(rq.isPartiallyCorrect)
                      : tEval
                        ? !tEval.isCorrect &&
                          tEval.pointsAwarded > 0 &&
                          tEval.pointsAwarded < tEval.maxPoints
                        : Boolean(scored.isPartiallyCorrect);
                    if (isCorrect) {
                      return (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Correct
                        </Badge>
                      );
                    }
                    if (isPartial) {
                      return (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-bold gap-1"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Partially Correct
                        </Badge>
                      );
                    }
                    return (
                      <Badge
                        variant="outline"
                        className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold gap-1"
                      >
                        <XCircle className="w-3 h-3 text-rose-500" /> Incorrect
                      </Badge>
                    );
                  })()}
                {q.cognitiveSkill && (
                  <Badge variant="outline" className="text-[10px]">
                    <Sparkles className="w-3 h-3 mr-1 text-brand-teal" />
                    {String(q.cognitiveSkill)}
                  </Badge>
                )}
                {isSequential && flags[q.id] && !showReview && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  >
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

            {q.exhibits &&
              q.exhibits.length > 0 &&
              !isCaseStudyQuestion(q.questionType) && (
                <div className="rounded-xl border border-border bg-surface-muted overflow-hidden text-xs">
                  <div className="bg-surface border-b border-border px-3 py-2 flex items-center gap-1.5 font-bold text-foreground">
                    <ClipboardList className="w-3.5 h-3.5 text-brand-teal" />
                    <span>EHR Clinical Exhibits ({normalizeExhibits(q.exhibits).length})</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {normalizeExhibits(q.exhibits).map((exh, eIdx) => (
                      <div
                        key={exh.id ? `ehr-exh-${exh.id}` : `ehr-exh-idx-${eIdx}`}
                        className="rounded-lg border border-border/70 bg-surface p-2.5 space-y-1"
                      >
                        <p className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                          <FileText className="w-3 h-3 text-brand-teal" /> {exh.title}
                        </p>
                        <RichQuestionContent
                          content={exh.content}
                          className="text-foreground-secondary leading-relaxed text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="pt-2">
            <QuestionRendererRegistry
              question={q}
              value={answers[q.id] ?? null}
              onChange={(val) => handleAnswerChange(q.id, val)}
              disabled={isSubmitted || isReviewContent}
              isReview={deliveryMode === "Tutor" && !isSubmitted ? false : showReview}
              hideRationaleBox={deliveryMode === "Tutor" || !showReview}
              canAskTutor={stageAvailability.tutor.canEnter}
              onAskTutor={(qid) => handleOpenTutorFromReview(qid)}
              suppressCaseContext={suppressCaseContext}
            />
          </div>

          {deliveryMode === "Tutor" &&
            attemptId &&
            (isSubmitted ? Boolean(submittedResult?.reviewReleased) : true) && (
              <TutorModePanel
                key={q.id}
                attemptId={attemptId}
                questionId={q.id}
                question={q}
                hasSelectedAnswer={isResponseAnswered(answers[q.id])}
                serializedAnswer={answers[q.id] ?? null}
                evaluation={tutorEvaluations[q.id] ?? null}
                responseJson={tutorResponseJsons[q.id] ?? null}
                initialHints={tutorHints[q.id]}
                onHintReceived={(hint) =>
                  setTutorHints((prev) => {
                    const existing = prev[q.id] ?? [];
                    if (existing.some((h) => h.stage === hint.stage)) return prev;
                    return { ...prev, [q.id]: [...existing, hint] };
                  })
                }
                onEvaluated={(result) =>
                  setTutorEvaluations((prev) => ({ ...prev, [q.id]: result }))
                }
              />
            )}

          {!isSequential && !isSubmitted && !isReviewContent && attemptId && (
            <button
              type="button"
              onClick={async () => {
                const nextFlag = !latestFlagsRef.current[q.id];
                latestFlagsRef.current = { ...latestFlagsRef.current, [q.id]: nextFlag };
                setFlags((prev) => ({ ...prev, [q.id]: nextFlag }));
                setAutosaveStatus("saving");
                await persistResponse(q.id, latestAnswersRef.current[q.id] ?? null, nextFlag);
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
      pathway={pathway}
      examCategory={examCategory}
      isTimed={isTimed}
      totalQuestions={questions.length}
      configuredQuestionCount={configuredQuestionCount}
      currentQuestion={
        layout === "Sequential"
          ? currentIndex + 1
          : Math.min(answeredCount + 1, Math.max(questions.length, 1))
      }
      mode={deliveryMode}
      onModeChange={handleModeChange}
      modePermissions={effectiveModePermissions}
      layoutMode={layout}
      allowLayoutSwitching={layoutPolicy !== "AllInOneOnly" && layoutPolicy !== "SequentialOnly"}
      onLayoutChange={(next) => void handleLayoutChange(next)}
      isFlagged={isCurrentFlagged}
      onToggleFlag={handleToggleFlag}
      onSubmitExam={() => {
        // Pre-validate SATA questions before opening submit confirmation modal
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (isSataQuestion(q.questionType)) {
            const ans = latestAnswersRef.current[q.id] ?? answers[q.id] ?? null;
            const validation = validateSataSelection(q, ans);
            if (!validation.isValid) {
              const msg = validation.message || "Select the required number of answers to continue.";
              feedback.warn(msg);
              setSubmissionError(msg);
              if (layout === "Sequential") {
                setCurrentIndex(i);
              } else {
                scrollToQuestion(q.id);
              }
              return;
            }
          }
        }
        setIsSubmitModalOpen(true);
      }}
      secondsRemaining={secondsRemaining}
      onTimerExpired={handleSubmitExam}
      autosaveStatus={autosaveStatus}
      onRetrySave={retrySaveNow}
      answeredCount={answeredCount}
      onOpenQuestionGrid={
        stage === "assessment" ? () => setIsQuestionGridOpen(true) : undefined
      }
      showTimer={!isReviewContent && !isSubmitted}
      showSubmitExam={!isReviewContent && !isSubmitted}
      showFlag={stage === "assessment" && layout === "Sequential" && !isReviewContent && !isSubmitted}
      modeBadge={
        stage === "results"
          ? "Results Summary"
          : stage === "tutor"
            ? "Contextual Tutor"
            : deliveryMode === "Tutor"
              ? "Tutor Mode · Immediate Feedback"
              : undefined
      }
      stageBar={
        <StageProgressBar
          currentStage={stage}
          availability={stageAvailability}
          onSelectStage={(next) => transitionToStage(next)}
          tutorQuestionNumber={stage === "tutor" ? activeTutorEntry?.questionNumber : undefined}
        />
      }
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

        {integrityWarnings.length > 0 && stage === "assessment" && (
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

        {/* STAGE 2: RESULTS DASHBOARD */}
        {stage === "results" && submittedResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-[11px] text-foreground-muted">
              <span>
                Started: <strong className="text-foreground-secondary">{formatUtcTimestamp(submittedResult.startedAtUtc)}</strong>
              </span>
              <span>
                Submitted: <strong className="text-foreground-secondary">{formatUtcTimestamp(submittedResult.submittedAtUtc)}</strong>
              </span>
              <span>
                Allocated: <strong className="text-foreground-secondary">{formatAllocatedMinutes(submittedResult.timeLimitMinutes)}</strong>
              </span>
              <span>
                Used: <strong className="text-foreground-secondary">{formatElapsedDuration(submittedResult.timeSpentSeconds)}</strong>
              </span>
            </div>

            <AssessmentResultsDashboard
              result={submittedResult}
              canAskTutor={stageAvailability.tutor.canEnter}
              onEnterReview={(initialFilter) => {
                setReviewFilter(initialFilter || "All");
                transitionToStage("review");
              }}
              onEnterTutor={(qId) => transitionToStage("tutor", qId)}
              onViewPerformance={() => router.push("/learner/performance")}
              onBackToDashboard={() => router.push("/learner")}
            />
          </div>
        )}

        {/* STAGE 3: READ-ONLY REVIEW WORKSPACE */}
        {stage === "review" && (
          <div className="space-y-5">
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

            <ReviewWorkspace
              questions={reviewQuestionsList}
              activeFilter={reviewFilter}
              onFilterChange={setReviewFilter}
              layout={layout}
              allowLayoutSwitching={layoutPolicy !== "AllInOneOnly" && layoutPolicy !== "SequentialOnly"}
              onLayoutChange={(next) => setLayout(next)}
              currentQuestionId={
                currentQ?.id || reviewQuestionsList[0]?.questionId || ""
              }
              onSelectQuestion={(qid) => {
                const idx = questions.findIndex((q) => q.id === qid);
                if (idx >= 0) setCurrentIndex(idx);
              }}
              flaggedMap={flags}
              canAskTutor={stageAvailability.tutor.canEnter}
              onAskTutor={(qid) => handleOpenTutorFromReview(qid)}
              onBackToResults={submittedResult ? () => transitionToStage("results") : undefined}
            />
          </div>
        )}

        {/* STAGE 4: CONTEXTUAL TUTOR WORKSPACE */}
        {stage === "tutor" && attemptId && activeTutorEntry && (
          <ContextualTutorWorkspace
            attemptId={attemptId}
            examTitle={examTitle}
            pathway={pathway}
            question={activeTutorEntry.question}
            questionNumber={activeTutorEntry.questionNumber}
            totalQuestions={reviewQuestionsList.length}
            keysReleased={
              isSubmitted
                ? Boolean(submittedResult?.reviewReleased)
                : Boolean(tutorEvaluations[activeTutorEntry.question.questionId])
            }
            returnLabel={
              isSubmitted || isReviewContent
                ? `Return to Question #${returnContext?.questionId ? (reviewQuestionsList.findIndex((q) => q.questionId === returnContext.questionId) + 1 || activeTutorEntry.questionNumber) : activeTutorEntry.questionNumber} in Review`
                : `Return to Question #${activeTutorEntry.questionNumber}`
            }
            onReturnToReview={handleReturnFromTutor}
            onBackToResults={submittedResult ? () => transitionToStage("results") : undefined}
          />
        )}

        {/* STAGE 1: ACTIVE ASSESSMENT EXPERIENCE */}
        {stage === "assessment" && (
          <>
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

            {layout === "Sequential" ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      Item {currentIndex + 1} of {questions.length}
                    </Badge>
                    {(() => {
                      const nav = getCaseStudyNavigation(questions, currentIndex);
                      if (nav.isCaseStudy && nav.totalQuestionsInCase > 1) {
                        return (
                          <Badge variant="teal" className="text-xs font-sans">
                            Case Item {nav.questionIndexInCase + 1} of {nav.totalQuestionsInCase}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQuestionGridOpen(true)}
                      className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>
                        Question List ({answeredCount}/{questions.length})
                      </span>
                    </button>
                  </div>
                </div>

                {currentQ ? (
                  renderAssessmentQuestion(currentQ, currentIndex, true)
                ) : (
                  <div className="p-12 text-center text-xs text-foreground-muted">
                    No questions available for this session.
                  </div>
                )}

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
                    {deliveryMode === "Tutor" && attemptId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => transitionToStage("tutor", currentQ?.id)}
                        className="text-xs gap-1.5 border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Open Deep Tutor Workspace
                      </Button>
                    )}
                    <span className="text-xs font-medium text-foreground-muted hidden sm:inline-block">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sticky top-[62px] z-30 rounded-xl border border-border bg-surface/95 backdrop-blur-md p-3 shadow-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      All-in-One View · {questions.length} items
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setIsQuestionGridOpen(true)}
                      className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>
                        Question List ({answeredCount}/{questions.length})
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {questions.map((q, idx) => {
                    const prevQ = idx > 0 ? questions[idx - 1] : null;
                    const qCaseId = q.caseStudyId || resolveAuthoritativeCaseStudyId(q as any);
                    const prevCaseId = prevQ
                      ? prevQ.caseStudyId || resolveAuthoritativeCaseStudyId(prevQ as any)
                      : null;
                    const isSharedContinuation = Boolean(
                      qCaseId && prevCaseId && qCaseId === prevCaseId
                    );
                    return renderAssessmentQuestion(q, idx, false, isSharedContinuation);
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <QuestionNavigatorModal
        open={isQuestionGridOpen}
        onClose={() => setIsQuestionGridOpen(false)}
        questions={questions.map((q) => ({
          id: q.id,
          orderIndex: q.orderIndex,
          isAnswered: isResponseAnswered(answers[q.id]),
          isFlagged: Boolean(flags[q.id]),
        }))}
        currentIndex={currentIndex}
        onSelectIndex={(idx) => {
          setCurrentIndex(idx);
          const targetQ = questions[idx];
          if (layout === "AllInOne" && targetQ) {
            scrollToQuestion(targetQ.id);
          }
        }}
      />

      <SubmitConfirmationModal
        open={isSubmitModalOpen}
        onCancel={() => {
          if (!isSubmitting) {
            setSubmissionError(null);
            setIsSubmitModalOpen(false);
          }
        }}
        onConfirm={() => void handleSubmitExam()}
        examTitle={examTitle}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        flaggedCount={flaggedCount}
        failedSaveCount={failedSaveCount}
        isSubmitting={isSubmitting}
        isLoading={isSubmitting}
        submissionError={submissionError}
        isTutorPractice={deliveryMode === "Tutor"}
      />
    </ExamShell>
  );
}

export default function ExamSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-foreground-muted">
          Loading QuizNurse examination session...
        </div>
      }
    >
      <ExamSessionContent />
    </Suspense>
  );
}
