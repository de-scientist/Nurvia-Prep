"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { QuestionRendererRegistry, type RendererQuestion } from "@/components/exam/renderers";
import { normalizeExhibits } from "@/lib/content/case-study-normalizer";
import { TutorModePanel } from "@/components/exam/TutorModePanel";
import { nurviaApi } from "@/lib/api-client";
import type {
  QuestionType,
  ReviewQuestionDto,
  TutorActionType,
  TutorConversationMessageDto,
  TutorEvaluateResponseDto,
  TutorHintResponseDto,
  TutorPracticeCheckResponseDto,
} from "@/lib/api-types";
import { isResponseAnswered } from "@/lib/attempts/strata-answer-core.mjs";
import { resolveQuestionReviewStatus } from "@/lib/attempts/exam-experience-state";
import { cn } from "@/lib/utils";

const DEFAULT_DISCLAIMER =
  "Tutor guidance is a supplemental clinical learning aid generated to deepen understanding. It is separate from the official examination bank rationale and never alters your submitted answers or authoritative score.";

const QUICK_ACTIONS: Array<{
  action: Exclude<TutorActionType, "custom_question">;
  label: string;
  shortDesc: string;
}> = [
  {
    action: "explain_question",
    label: "Explain Question",
    shortDesc: "Break down clinical cues and priorities",
  },
  {
    action: "why_my_answer_incorrect",
    label: "Why Was My Answer Wrong?",
    shortDesc: "Contrast your answer vs priority",
  },
  {
    action: "why_correct_better",
    label: "Why Correct Answer Is Better",
    shortDesc: "Compare clinical superiority",
  },
  {
    action: "explain_each_option",
    label: "Explain Every Option",
    shortDesc: "Analyze distractors option by option",
  },
  {
    action: "teach_concept",
    label: "Teach Core Concept",
    shortDesc: "Underlying pathophysiology & principles",
  },
  {
    action: "similar_practice",
    label: "Try Similar Practice",
    shortDesc: "Isolated follow-up comprehension check",
  },
  {
    action: "summarize_takeaway",
    label: "Summarize Key Takeaway",
    shortDesc: "High-yield rule for exam day",
  },
];

export interface TutorTargetQuestion {
  questionId: string;
  numericId?: number;
  guidId?: string;
  sectionId?: number;
  sectionGuidId?: string;
  sectionName?: string;
  orderIndex?: number;
  stem: string;
  metaStem?: string;
  instructions?: string;
  questionType: QuestionType | string | number;
  cognitiveSkill?: string | number;
  clientNeedCategory?: string | number;
  difficulty?: string;
  learningObjectives?: string[];
  resources?: string;
  prerequisites?: string;
  generalRationale?: string;
  learnerResponse?: string;
  isCorrect?: boolean;
  isPartiallyCorrect?: boolean;
  allowPartialCredit?: boolean;
  pointsAwarded?: number;
  maxPoints?: number;
  isFlagged?: boolean;
  options?: ReviewQuestionDto["options"];
  exhibits?: ReviewQuestionDto["exhibits"];
  media?: ReviewQuestionDto["media"];
  matrix?: ReviewQuestionDto["matrix"];
  blankSelectPassage?: ReviewQuestionDto["blankSelectPassage"];
  highlightPassage?: ReviewQuestionDto["highlightPassage"];
  correctAnswerMeta?: ReviewQuestionDto["correctAnswerMeta"];
  contentIntegrityError?: string;
}

function toTutorRendererQuestion(q: TutorTargetQuestion): RendererQuestion {
  return {
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
    options: (q.options ?? []).map((opt) => ({
      id: opt.id,
      numericId: opt.numericId,
      optionIndex: opt.optionIndex,
      optionText: opt.optionText,
      description: opt.description,
      data: opt.data,
      label: opt.label,
      order: opt.order,
      link: opt.link,
      isCorrect: opt.isCorrect,
      specificRationale: opt.specificRationale,
      wasSelected: opt.wasSelected,
    })),
    exhibits: q.exhibits,
    media: q.media,
    matrix: q.matrix,
    blankSelectPassage: q.blankSelectPassage,
    highlightPassage: q.highlightPassage,
    correctAnswerMeta: q.correctAnswerMeta,
    contentIntegrityError: q.contentIntegrityError,
  };
}

interface ContextualTutorWorkspaceProps {
  attemptId: string;
  examTitle: string;
  pathway?: string;
  question: TutorTargetQuestion;
  questionNumber: number;
  totalQuestions: number;
  keysReleased: boolean;
  returnLabel?: string;
  onReturnToReview: () => void;
  onBackToResults?: () => void;
}

export function ContextualTutorWorkspace({
  attemptId,
  examTitle,
  pathway,
  question,
  questionNumber,
  totalQuestions,
  keysReleased,
  returnLabel,
  onReturnToReview,
  onBackToResults,
}: ContextualTutorWorkspaceProps) {
  const [messages, setMessages] = React.useState<TutorConversationMessageDto[]>([]);
  const [disclosureNotice, setDisclosureNotice] = React.useState<string>(DEFAULT_DISCLAIMER);
  const [aiProviderConfigured, setAiProviderConfigured] = React.useState<boolean>(false);
  const [remainingTurns, setRemainingTurns] = React.useState<number>(15);
  const [isLoadingInitial, setIsLoadingInitial] = React.useState<boolean>(true);
  const [loadingAction, setLoadingAction] = React.useState<TutorActionType | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = React.useState<{
    action: TutorActionType;
    userMessage?: string;
  } | null>(null);

  const [customInput, setCustomInput] = React.useState<string>("");
  const [showContextPanel, setShowContextPanel] = React.useState<boolean>(true);
  const [showOfficialRationale, setShowOfficialRationale] = React.useState<boolean>(false);

  // Isolated practice selection/results keyed by practiceId
  const [practiceSelections, setPracticeSelections] = React.useState<Record<string, string>>({});
  const [practiceChecks, setPracticeChecks] = React.useState<
    Record<string, TutorPracticeCheckResponseDto>
  >({});
  const [checkingPracticeId, setCheckingPracticeId] = React.useState<string | null>(null);

  // Progressive hint & immediate answer evaluation state (/tutor/hint, /tutor/evaluate, /tutor/session)
  const [tutorEval, setTutorEval] = React.useState<TutorEvaluateResponseDto | null>(null);
  const [tutorRespJson, setTutorRespJson] = React.useState<string | null>(
    question.learnerResponse ?? null
  );
  const [tutorHints, setTutorHints] = React.useState<TutorHintResponseDto[]>([]);

  const feedEndRef = React.useRef<HTMLDivElement | null>(null);

  const questionStatus = resolveQuestionReviewStatus({
    learnerResponse: question.learnerResponse,
    isCorrect: question.isCorrect,
    isPartiallyCorrect: question.isPartiallyCorrect,
    pointsAwarded: question.pointsAwarded,
    maxPoints: question.maxPoints,
    options: question.options,
  });

  React.useEffect(() => {
    let active = true;
    setIsLoadingInitial(true);
    setErrorMsg(null);
    setLastFailedAction(null);
    setTutorEval(null);
    setTutorRespJson(question.learnerResponse ?? null);
    setTutorHints([]);

    nurviaApi
      .getTutorConversations(attemptId, question.questionId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setMessages(res.data.conversation);
          setDisclosureNotice(res.data.disclosureNotice || DEFAULT_DISCLAIMER);
          setAiProviderConfigured(res.data.aiProviderConfigured);
          setRemainingTurns(res.data.remainingTurns);
          const dataWithPractice = res.data as typeof res.data & { practiceChecks?: Record<string, TutorPracticeCheckResponseDto> };
          if (dataWithPractice.practiceChecks && typeof dataWithPractice.practiceChecks === "object") {
            setPracticeChecks((prev) => ({ ...(dataWithPractice.practiceChecks as Record<string, TutorPracticeCheckResponseDto>), ...prev }));
          }
        } else {
          setErrorMsg(res.message || "Unable to load Tutor conversation for this question.");
        }
      })
      .catch(() => {
        if (!active) return;
        setErrorMsg("Unable to connect to Tutor service right now.");
      })
      .finally(() => {
        if (active) setIsLoadingInitial(false);
      });

    nurviaApi
      .getTutorSessionState(attemptId)
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        const match = res.data.questions.find(
          (q) =>
            q.questionId === question.questionId ||
            (question.numericId !== undefined && q.questionId === String(question.numericId)) ||
            (question.guidId && q.questionId === question.guidId)
        );
        if (match) {
          if (match.evaluation) setTutorEval(match.evaluation);
          if (match.responseJson !== undefined) {
            setTutorRespJson(match.responseJson ?? question.learnerResponse ?? null);
          }
          if (Array.isArray(match.hints) && match.hints.length > 0) {
            setTutorHints(match.hints);
          }
        }
      })
      .catch(() => {
        // Best-effort session state restoration
      });

    return () => {
      active = false;
    };
  }, [attemptId, question.questionId, question.numericId, question.guidId, question.learnerResponse]);

  React.useEffect(() => {
    if (messages.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages.length]);

  const runAssistAction = async (action: TutorActionType, userMessage?: string) => {
    if (loadingAction) return;
    setLoadingAction(action);
    setErrorMsg(null);
    setLastFailedAction(null);

    try {
      const res = await nurviaApi.requestTutorAssist(attemptId, {
        questionId: question.questionId,
        action,
        userMessage,
      });
      if (res.success && res.data) {
        setMessages(res.data.conversation);
        setDisclosureNotice(res.data.disclosureNotice || DEFAULT_DISCLAIMER);
        setAiProviderConfigured(res.data.aiProviderConfigured);
        setRemainingTurns(res.data.remainingTurns);
        if (action === "custom_question") {
          setCustomInput("");
        }
      } else {
        setErrorMsg(res.message || "Tutor could not generate an explanation for that request.");
        setLastFailedAction({ action, userMessage });
      }
    } catch {
      setErrorMsg("Network error contacting Tutor service. Retry below.");
      setLastFailedAction({ action, userMessage });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || loadingAction || remainingTurns <= 0) return;
    void runAssistAction("custom_question", trimmed);
  };

  const handleCheckPractice = async (practiceId: string) => {
    const selectedOptId = practiceSelections[practiceId];
    if (!selectedOptId || checkingPracticeId) return;
    setCheckingPracticeId(practiceId);
    setErrorMsg(null);

    try {
      const res = await nurviaApi.checkTutorPractice(attemptId, {
        questionId: question.questionId,
        practiceQuestionId: practiceId,
        responseJson: JSON.stringify({ SelectedOptionId: selectedOptId }),
      });
      if (res.success && res.data) {
        setPracticeChecks((prev) => ({ ...prev, [practiceId]: res.data! }));
      } else {
        setErrorMsg(res.message || "Could not check practice response.");
      }
    } catch {
      setErrorMsg("Network error checking isolated practice item.");
    } finally {
      setCheckingPracticeId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Contextual Header + Return to Exact Review Question */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal" className="gap-1">
              <Sparkles className="w-3 h-3" /> Contextual Tutor
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Question #{questionNumber} of {totalQuestions}
            </Badge>
            {pathway && (
              <Badge variant="outline" className="text-[11px]">
                {pathway}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[11px]",
                questionStatus === "correct"
                  ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                  : questionStatus === "partial"
                    ? "border-amber-500/50 text-amber-800 dark:text-amber-200"
                    : questionStatus === "incorrect"
                      ? "border-rose-500/50 text-rose-700 dark:text-rose-300"
                      : "border-border text-foreground-secondary"
              )}
            >
              {questionStatus === "correct"
                ? "Correct"
                : questionStatus === "partial"
                  ? "Partially Correct"
                  : questionStatus === "incorrect"
                    ? "Incorrect"
                    : "Unanswered"}
            </Badge>
          </div>
          <h2 className="font-brand text-base sm:text-lg font-bold text-foreground truncate">
            {examTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReturnToReview}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            {returnLabel || `Return to Question #${questionNumber} in Review`}
          </Button>
          {onBackToResults && (
            <Button variant="ghost" size="sm" onClick={onBackToResults}>
              Results
            </Button>
          )}
        </div>
      </div>

      {/* Explicit Separation / Non-Mutation Notice */}
      <div className="rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-3.5 flex items-start gap-2.5 text-xs text-foreground-secondary">
        <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <p className="text-foreground font-semibold">
            {aiProviderConfigured
              ? "AI + Grounded Clinical Tutor (Attempt Isolated)"
              : "QuizNurse Grounded Clinical Coach (Attempt Isolated)"}
          </p>
          <p>{disclosureNotice}</p>
        </div>
      </div>

      {/* Collapsible Question Context */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowContextPanel((v) => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-2 bg-surface-muted/40 hover:bg-surface-muted/70 transition-colors text-left"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-brand-teal" />
            Question #{questionNumber} Clinical Context
          </span>
          {showContextPanel ? (
            <ChevronUp className="w-4 h-4 text-foreground-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-foreground-secondary" />
          )}
        </button>

        {showContextPanel && (
          <div className="p-5 space-y-4 border-t border-border">
            {keysReleased && (
              <div
                data-testid="tutor-answer-state-banner"
                className={cn(
                  "rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs",
                  questionStatus === "correct"
                    ? "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
                    : questionStatus === "partial"
                      ? "border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
                      : questionStatus === "incorrect"
                        ? "border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100"
                        : "border-border bg-surface-muted/60 text-foreground-secondary"
                )}
              >
                <div className="flex items-center gap-2 font-bold">
                  {questionStatus === "correct" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Your Answer Status: Correct</span>
                    </>
                  ) : questionStatus === "partial" ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Your Answer Status: Partially Correct</span>
                    </>
                  ) : questionStatus === "incorrect" ? (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Your Answer Status: Incorrect — Review Your Selection vs Correct Answer Below</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 text-foreground-muted shrink-0" />
                      <span>Your Answer Status: Unanswered — Correct Answer Highlighted Below</span>
                    </>
                  )}
                </div>
                {typeof question.pointsAwarded === "number" &&
                  typeof question.maxPoints === "number" && (
                    <span className="font-semibold">
                      Score: {question.pointsAwarded} / {question.maxPoints} pt
                    </span>
                  )}
              </div>
            )}

            <RichQuestionContent
              content={question.stem}
              className="text-sm leading-relaxed text-foreground font-medium"
            />

            {(() => {
              const exhibits = normalizeExhibits(question.exhibits);
              if (exhibits.length === 0) return null;
              return (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-secondary">
                    Question Exhibits ({exhibits.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {exhibits.map((ex, i) => (
                      <div
                        key={ex.id ? `tutor-exh-${ex.id}` : `tutor-exh-idx-${i}`}
                        className="rounded-xl border border-border bg-background p-3 text-xs space-y-1 max-h-48 overflow-y-auto"
                      >
                        <div className="font-bold text-foreground">{ex.title || `Exhibit ${i + 1}`}</div>
                        <RichQuestionContent
                          content={ex.content}
                          className="text-foreground-secondary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Interactive / Read-Only Answer-State Breakdown Across All 18 Question Types */}
            <div className="pt-2 border-t border-border/70">
              <QuestionRendererRegistry
                question={toTutorRendererQuestion(question)}
                value={question.learnerResponse ?? null}
                disabled={true}
                isReview={keysReleased}
                hideRationaleBox={!showOfficialRationale}
              />
            </div>

            {keysReleased && question.generalRationale && (
              <div className="pt-2 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setShowOfficialRationale((v) => !v)}
                  className="text-xs font-semibold text-brand-teal hover:underline inline-flex items-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showOfficialRationale
                    ? "Hide Official Examination Bank Rationale"
                    : "View Official Examination Bank Rationale"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progressive Hints & Immediate Answer Evaluation Panel */}
      <TutorModePanel
        key={question.questionId}
        attemptId={attemptId}
        questionId={question.questionId}
        question={question}
        hasSelectedAnswer={isResponseAnswered(tutorRespJson ?? question.learnerResponse)}
        serializedAnswer={tutorRespJson ?? question.learnerResponse ?? null}
        evaluation={tutorEval}
        responseJson={tutorRespJson}
        initialHints={tutorHints}
        onHintReceived={(hint) =>
          setTutorHints((prev) =>
            prev.some((h) => h.stage === hint.stage) ? prev : [...prev, hint]
          )
        }
        onEvaluated={(evalRes) => setTutorEval(evalRes)}
      />

      {/* 7 Quick Pedagogical Action Buttons */}
      <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-brand-teal" /> Guided Learning Actions
          </h3>
          <span className="text-[11px] text-foreground-muted">
            {remainingTurns} follow-up turns remaining
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((item) => {
            const isBusy = loadingAction === item.action;
            return (
              <button
                key={item.action}
                type="button"
                disabled={Boolean(loadingAction) || remainingTurns <= 0}
                onClick={() => void runAssistAction(item.action)}
                className={cn(
                  "rounded-xl border border-border bg-background hover:border-brand-teal/60 hover:bg-brand-teal/5 p-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed space-y-1",
                  isBusy && "border-brand-teal bg-brand-teal/10"
                )}
              >
                <div className="text-xs font-bold text-foreground flex items-center justify-between gap-1.5">
                  <span>{item.label}</span>
                  {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-teal shrink-0" />}
                </div>
                <p className="text-[11px] text-foreground-secondary leading-snug">
                  {item.shortDesc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Error + Safe Retry */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          {lastFailedAction && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runAssistAction(lastFailedAction.action, lastFailedAction.userMessage)}
              disabled={Boolean(loadingAction)}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Tutor Conversation Stream */}
      <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-brand-teal" /> Coaching Conversation
        </h3>

        {isLoadingInitial ? (
          <div className="flex items-center gap-2 py-8 justify-center text-xs text-foreground-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
            <span>Loading Tutor session history for Question #{questionNumber}...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/60 p-6 text-center space-y-1.5">
            <p className="text-sm font-semibold text-foreground">
              Choose a guided action above or ask your own question below
            </p>
            <p className="text-xs text-foreground-secondary max-w-xl mx-auto">
              Every explanation is grounded in Question #{questionNumber}, its clinical exhibits,
              your submitted answer, and official nursing reasoning principles.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isLearner = msg.role === "learner";
              const practice = msg.practicePrompt;
              const practiceCheck = practice ? practiceChecks[practice.practiceId] : undefined;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    isLearner
                      ? "border-brand-teal/40 bg-brand-teal/5 ml-auto max-w-2xl"
                      : "border-border bg-background"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-foreground">
                      {isLearner ? "You" : msg.providerLabel}
                    </span>
                    <span className="text-foreground-muted">
                      {new Date(msg.createdAtUtc).toLocaleTimeString()}
                    </span>
                  </div>

                  {msg.sections && msg.sections.length > 0 ? (
                    <div className="space-y-3">
                      {msg.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                          <div className="text-xs font-bold text-foreground">
                            {sec.stepNumber ? `${sec.stepNumber}. ` : ""}
                            {sec.heading}
                          </div>
                          <div className="text-xs text-foreground-secondary whitespace-pre-line leading-relaxed">
                            {sec.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </div>
                  )}

                  {practice && (
                    <div className="mt-3 rounded-xl border border-brand-teal/40 bg-surface p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand-teal">
                          Isolated Practice Check
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Does not affect attempt score
                        </Badge>
                      </div>

                      <RichQuestionContent
                        content={practice.stem}
                        className="text-xs text-foreground font-medium leading-relaxed"
                      />

                      <div className="space-y-2">
                        {practice.options.map((opt) => {
                          const picked = practiceSelections[practice.practiceId] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={Boolean(practiceCheck)}
                              aria-pressed={picked}
                              onClick={() =>
                                setPracticeSelections((prev) => ({
                                  ...prev,
                                  [practice.practiceId]: opt.id,
                                }))
                              }
                              className={cn(
                                "w-full text-left rounded-lg border p-2.5 text-xs transition-all",
                                picked
                                  ? "border-brand-teal bg-brand-teal/10 font-semibold text-foreground"
                                  : "border-border bg-background hover:bg-surface-muted text-foreground-secondary"
                              )}
                            >
                              <RichQuestionContent content={opt.optionText} as="span" />
                            </button>
                          );
                        })}
                      </div>

                      {!practiceCheck ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={
                            !practiceSelections[practice.practiceId] ||
                            checkingPracticeId === practice.practiceId
                          }
                          onClick={() => void handleCheckPractice(practice.practiceId)}
                        >
                          {checkingPracticeId === practice.practiceId ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Checking...
                            </>
                          ) : (
                            "Check Practice Answer"
                          )}
                        </Button>
                      ) : (
                        <div
                          className={cn(
                            "rounded-lg border p-3 text-xs space-y-1.5",
                            practiceCheck.isCorrect
                              ? "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
                              : "border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100"
                          )}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            {practiceCheck.isCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600" />
                            )}
                            {practiceCheck.feedback}
                          </div>
                          {practiceCheck.officialRationale && (
                            <p className="text-foreground-secondary leading-relaxed">
                              <strong>Official Rationale: </strong>
                              {practiceCheck.officialRationale}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={feedEndRef} />
          </div>
        )}

        {/* Follow-up Input */}
        <form onSubmit={handleSubmitCustom} className="pt-3 border-t border-border space-y-2">
          <label
            htmlFor={`tutor-follow-up-${question.questionId}`}
            className="text-xs font-semibold text-foreground-secondary block"
          >
            Ask a specific follow-up question about Question #{questionNumber}:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              id={`tutor-follow-up-${question.questionId}`}
              rows={2}
              maxLength={1200}
              disabled={Boolean(loadingAction) || remainingTurns <= 0}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={
                remainingTurns <= 0
                  ? "Maximum Tutor turns reached for this question."
                  : "e.g., Why is assessing airway prioritized before administering this medication?"
              }
              className="flex-1 rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:outline-brand-teal focus:ring-1 focus:ring-brand-teal"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!customInput.trim() || Boolean(loadingAction) || remainingTurns <= 0}
              className="sm:self-end"
            >
              {loadingAction === "custom_question" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" /> Ask Tutor
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
