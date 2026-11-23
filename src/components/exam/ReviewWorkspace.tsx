"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Lock,
  MinusCircle,
  Rows3,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { QuestionRendererRegistry } from "@/components/exam/renderers/QuestionRendererRegistry";
import type { RendererQuestion } from "@/components/exam/renderers/types";
import type { ExamLayout, ReviewQuestionDto } from "@/lib/api-types";
import {
  computeReviewCounts,
  filterReviewQuestions,
  resolveQuestionReviewStatus,
  type ReviewFilterKey,
  type ReviewFilterableItem,
} from "@/lib/attempts/exam-experience-state";
import { cn } from "@/lib/utils";

interface ReviewWorkspaceProps {
  questions: ReviewQuestionDto[];
  activeFilter: ReviewFilterKey;
  onFilterChange: (filter: ReviewFilterKey) => void;
  layout: ExamLayout;
  allowLayoutSwitching?: boolean;
  onLayoutChange?: (layout: ExamLayout) => void;
  currentQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  flaggedMap?: Record<string, boolean>;
  canAskTutor: boolean;
  onAskTutor: (questionId: string) => void;
  onBackToResults?: () => void;
}

function toRendererQuestion(q: ReviewQuestionDto, isFlagged: boolean): RendererQuestion {
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
    isFlagged,
    options: q.options.map((o) => ({
      id: o.id,
      numericId: o.numericId,
      optionIndex: o.optionIndex,
      optionText: o.optionText,
      displayOrder: o.optionIndex,
      description: o.description,
      data: o.data,
      label: o.label,
      order: o.order,
      link: o.link,
      isCorrect: o.isCorrect,
      specificRationale: o.specificRationale,
      wasSelected: o.wasSelected,
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

interface ReviewQuestionCardProps {
  question: ReviewQuestionDto;
  originalNumber: number;
  isFlagged: boolean;
  canAskTutor: boolean;
  onAskTutor: (questionId: string) => void;
  isFocused?: boolean;
}

const ReviewQuestionCard = React.memo(function ReviewQuestionCard({
  question,
  originalNumber,
  isFlagged,
  canAskTutor,
  onAskTutor,
  isFocused = false,
}: ReviewQuestionCardProps) {
  const status = resolveQuestionReviewStatus({
    learnerResponse: question.learnerResponse,
    isCorrect: question.isCorrect,
    isPartiallyCorrect: question.isPartiallyCorrect,
    pointsAwarded: question.pointsAwarded,
    maxPoints: question.maxPoints,
    options: question.options,
  });

  const rendererQuestion = React.useMemo(
    () => toRendererQuestion(question, isFlagged),
    [question, isFlagged]
  );

  return (
    <article
      id={`review-q-${question.questionId}`}
      className={cn(
        "rounded-2xl border bg-surface p-5 sm:p-7 shadow-xs space-y-5 scroll-mt-32 transition-all",
        isFocused ? "border-brand-teal/70 ring-1 ring-brand-teal/20" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/80">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-bold">
            Question #{originalNumber}
          </Badge>
          {question.sectionName && (
            <Badge variant="outline" className="text-[11px] font-medium">
              {question.sectionName}
            </Badge>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-secondary">
            {String(question.questionType)}
          </span>
          {isFlagged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-400/50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
              <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" aria-hidden="true" />
              Flagged
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "correct" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Correct
            </span>
          )}
          {status === "partial" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-400/50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Partially Correct
            </span>
          )}
          {status === "incorrect" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-400/50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-200">
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Incorrect
            </span>
          )}
          {status === "unanswered" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" /> Unanswered
            </span>
          )}

          {canAskTutor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAskTutor(question.questionId)}
              className="h-7 px-2.5 text-xs border-brand-teal/40 text-brand-teal hover:bg-brand-teal/10"
            >
              <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" /> Ask Tutor
            </Button>
          )}
        </div>
      </div>

      <RichQuestionContent
        content={question.stem}
        className="text-base sm:text-lg font-medium leading-relaxed text-foreground"
      />

      {question.instructions && (
        <p className="text-xs italic text-foreground-secondary">{question.instructions}</p>
      )}

      <QuestionRendererRegistry
        question={rendererQuestion}
        value={question.learnerResponse ?? null}
        disabled
        isReview
        canAskTutor={canAskTutor}
        onAskTutor={onAskTutor}
      />
    </article>
  );
});

export function ReviewWorkspace({
  questions,
  activeFilter,
  onFilterChange,
  layout,
  allowLayoutSwitching = true,
  onLayoutChange,
  currentQuestionId,
  onSelectQuestion,
  flaggedMap,
  canAskTutor,
  onAskTutor,
  onBackToResults,
}: ReviewWorkspaceProps) {
  const originalIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((q, idx) => map.set(q.questionId, idx + 1));
    return map;
  }, [questions]);

  const filterableItems = React.useMemo<Array<ReviewFilterableItem & { raw: ReviewQuestionDto }>>(
    () =>
      questions.map((q) => ({
        id: q.questionId,
        learnerResponse: q.learnerResponse,
        isCorrect: q.isCorrect,
        isPartiallyCorrect: q.isPartiallyCorrect,
        pointsAwarded: q.pointsAwarded,
        maxPoints: q.maxPoints,
        isFlagged: Boolean(flaggedMap?.[q.questionId] ?? q.isFlagged),
        options: q.options,
        raw: q,
      })),
    [questions, flaggedMap]
  );

  const counts = React.useMemo(
    () => computeReviewCounts(filterableItems, flaggedMap),
    [filterableItems, flaggedMap]
  );

  const filteredQuestions = React.useMemo(
    () => filterReviewQuestions(filterableItems, activeFilter, flaggedMap).map((x) => x.raw),
    [filterableItems, activeFilter, flaggedMap]
  );

  const activeIdxInFiltered = React.useMemo(() => {
    const idx = filteredQuestions.findIndex((q) => q.questionId === currentQuestionId);
    return idx >= 0 ? idx : 0;
  }, [filteredQuestions, currentQuestionId]);

  const activeQuestion = filteredQuestions[activeIdxInFiltered] ?? null;

  const handleJumpToQuestion = (questionId: string) => {
    onSelectQuestion(questionId);
    if (layout === "AllInOne") {
      requestAnimationFrame(() => {
        document
          .getElementById(`review-q-${questionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const filterButtons: Array<{ key: ReviewFilterKey; label: string; count: number }> = [
    { key: "All", label: "All", count: counts.total },
    { key: "Correct", label: "Correct", count: counts.correct },
    { key: "Incorrect", label: "Incorrect", count: counts.incorrect },
    { key: "Unanswered", label: "Unanswered", count: counts.unanswered },
    { key: "Flagged", label: "Flagged", count: counts.flagged },
  ];

  return (
    <div className="space-y-5">
      {/* Read-Only Integrity Banner */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <Lock className="w-4 h-4 text-brand-teal shrink-0" aria-hidden="true" />
          <span>
            <strong>Read-Only Examination Review</strong> — Submitted answers, official scoring, and
            bank rationales cannot be modified.
          </span>
        </div>
        {onBackToResults && (
          <Button variant="ghost" size="sm" onClick={onBackToResults} className="h-7 text-xs">
            <Trophy className="w-3.5 h-3.5 mr-1 text-brand-teal" /> Results Summary
          </Button>
        )}
      </div>

      {/* Filter Bar + Layout Switch */}
      <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter Review Questions"
          className="flex flex-wrap items-center gap-1.5"
        >
          {filterButtons.map((btn) => {
            const isSelected = activeFilter === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onFilterChange(btn.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                  isSelected
                    ? "border-brand-teal bg-brand-teal text-white shadow-2xs"
                    : "border-border bg-background hover:bg-surface-muted text-foreground-secondary hover:text-foreground"
                )}
              >
                <span>{btn.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    isSelected ? "bg-white/20 text-white" : "bg-surface-muted text-foreground"
                  )}
                >
                  {btn.count}
                </span>
              </button>
            );
          })}
        </div>

        {allowLayoutSwitching && onLayoutChange && (
          <div
            role="group"
            aria-label="Review Layout Switcher"
            className="inline-flex items-center self-start rounded-lg border border-border bg-surface-muted/70 p-0.5 text-xs"
          >
            <button
              type="button"
              aria-pressed={layout === "Sequential"}
              onClick={() => onLayoutChange("Sequential")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all",
                layout === "Sequential"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-foreground-secondary hover:text-foreground"
              )}
            >
              <Rows3 className="w-3.5 h-3.5 text-brand-teal" /> Sequential
            </button>
            <button
              type="button"
              aria-pressed={layout === "AllInOne"}
              onClick={() => onLayoutChange("AllInOne")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all",
                layout === "AllInOne"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-foreground-secondary hover:text-foreground"
              )}
            >
              <LayoutList className="w-3.5 h-3.5 text-brand-teal" /> All-in-One
            </button>
          </div>
        )}
      </div>

      {/* Empty Filter State */}
      {filteredQuestions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center space-y-3">
          <p className="text-sm font-bold text-foreground">
            No questions match the &ldquo;{activeFilter}&rdquo; filter
          </p>
          <p className="text-xs text-foreground-secondary">
            {activeFilter === "Incorrect"
              ? "Every item in this examination was either answered correctly or skipped."
              : "Adjust your filter to inspect other questions in this attempt."}
          </p>
          <Button variant="outline" size="sm" onClick={() => onFilterChange("All")}>
            Show All Questions ({counts.total})
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Persistent Filter-Preserving Navigator (Desktop Sidebar + Mobile Strip) */}
          <aside className="lg:col-span-3 lg:sticky lg:top-36 rounded-2xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">
                Navigator ({filteredQuestions.length})
              </span>
              <span className="text-[11px] text-foreground-secondary">{activeFilter}</span>
            </div>

            <div className="flex lg:grid lg:grid-cols-4 gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {filteredQuestions.map((q) => {
                const origNum = originalIndexById.get(q.questionId) ?? 1;
                const isSelected = activeQuestion?.questionId === q.questionId;
                const st = resolveQuestionReviewStatus({
                  learnerResponse: q.learnerResponse,
                  isCorrect: q.isCorrect,
                  isPartiallyCorrect: q.isPartiallyCorrect,
                  pointsAwarded: q.pointsAwarded,
                  maxPoints: q.maxPoints,
                  options: q.options,
                });
                const isFlagged = Boolean(flaggedMap?.[q.questionId] ?? q.isFlagged);

                return (
                  <button
                    key={q.questionId}
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => handleJumpToQuestion(q.questionId)}
                    title={`Question #${origNum} — ${st}${isFlagged ? ", Flagged" : ""}`}
                    className={cn(
                      "relative min-w-[38px] h-9 rounded-lg border text-xs font-bold transition-all flex items-center justify-center shrink-0",
                      isSelected
                        ? "bg-brand-teal text-white border-brand-teal ring-2 ring-brand-teal/30"
                        : st === "correct"
                          ? "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100"
                          : st === "partial"
                            ? "border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                            : st === "incorrect"
                              ? "border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
                              : "border-border bg-background text-foreground-secondary hover:bg-surface-muted"
                    )}
                  >
                    {origNum}
                    {isFlagged && (
                      <Bookmark
                        className="w-2.5 h-2.5 text-amber-500 fill-amber-500 absolute -top-1 -right-1"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Review Question Canvas */}
          <div className="lg:col-span-9 space-y-5">
            {layout === "Sequential" && activeQuestion ? (
              <>
                <ReviewQuestionCard
                  question={activeQuestion}
                  originalNumber={originalIndexById.get(activeQuestion.questionId) ?? 1}
                  isFlagged={Boolean(
                    flaggedMap?.[activeQuestion.questionId] ?? activeQuestion.isFlagged
                  )}
                  canAskTutor={canAskTutor}
                  onAskTutor={onAskTutor}
                  isFocused
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    variant="outline"
                    disabled={activeIdxInFiltered <= 0}
                    onClick={() => {
                      const prev = filteredQuestions[activeIdxInFiltered - 1];
                      if (prev) onSelectQuestion(prev.questionId);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous ({activeFilter})
                  </Button>

                  <span className="text-xs font-semibold text-foreground-secondary">
                    Showing {activeIdxInFiltered + 1} of {filteredQuestions.length} ({activeFilter})
                  </span>

                  <Button
                    variant="outline"
                    disabled={activeIdxInFiltered >= filteredQuestions.length - 1}
                    onClick={() => {
                      const next = filteredQuestions[activeIdxInFiltered + 1];
                      if (next) onSelectQuestion(next.questionId);
                    }}
                  >
                    Next ({activeFilter}) <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                {filteredQuestions.map((q) => (
                  <ReviewQuestionCard
                    key={q.questionId}
                    question={q}
                    originalNumber={originalIndexById.get(q.questionId) ?? 1}
                    isFlagged={Boolean(flaggedMap?.[q.questionId] ?? q.isFlagged)}
                    canAskTutor={canAskTutor}
                    onAskTutor={onAskTutor}
                    isFocused={q.questionId === currentQuestionId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
