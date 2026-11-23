"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Info,
  MinusCircle,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { RendererQuestion } from "./types";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import {
  isResponseAnswered,
  scoreCanonicalQuestion,
  wasCanonicalOptionSelected,
} from "@/lib/attempts/strata-answer-adapter";

interface ReviewRationaleBoxProps {
  question: RendererQuestion;
  value?: string | null;
  includeOptionRationales?: boolean;
  onAskTutor?: (questionId: string) => void;
  canAskTutor?: boolean;
}

/**
 * Renders the authoritative inline Review outcome, Official Examination Bank Rationale,
 * distractor analysis, matrix cell explanations, and a clearly separated Tutor CTA.
 */
export function ReviewRationaleBox({
  question,
  value,
  includeOptionRationales = false,
  onAskTutor,
  canAskTutor = false,
}: ReviewRationaleBoxProps) {
  const effectiveValue = value ?? question.learnerResponse ?? null;
  const hasAttempted =
    isResponseAnswered(effectiveValue) ||
    question.options.some((o) => o.wasSelected);

  const scored = React.useMemo(() => {
    const computed = scoreCanonicalQuestion(
      {
        id: question.id,
        numericId: question.numericId,
        questionType: question.questionType,
        options: question.options,
        media: question.media,
        matrix: question.matrix,
        correctAnswerMeta: question.correctAnswerMeta,
        contentJsonData: question.contentJsonData,
      },
      effectiveValue
    );

    const isCorrect =
      typeof question.isCorrect === "boolean" ? question.isCorrect : computed.isCorrect;
    const isPartiallyCorrect =
      typeof question.isPartiallyCorrect === "boolean"
        ? question.isPartiallyCorrect
        : computed.isPartiallyCorrect;
    const pointsAwarded =
      typeof question.pointsAwarded === "number" ? question.pointsAwarded : computed.pointsAwarded;
    const maxPoints =
      typeof question.maxPoints === "number" ? question.maxPoints : computed.maxPoints;

    return {
      isCorrect,
      isPartiallyCorrect,
      pointsAwarded,
      maxPoints,
    };
  }, [question, effectiveValue]);

  const rationaleText = (question.generalRationale || "").trim();
  const modelAnswer = (question.correctAnswerMeta?.modelAnswerHtml || "").trim();
  const explanationImages = question.correctAnswerMeta?.explanationImages || [];

  const hasAnyOptionRationale = question.options.some(
    (o) => Boolean(o.specificRationale && o.specificRationale.trim())
  );
  const optionBreakdownItems =
    includeOptionRationales || hasAnyOptionRationale
      ? question.options.filter(
          (o) =>
            Boolean(o.specificRationale && o.specificRationale.trim()) ||
            Boolean(o.isCorrect) ||
            Boolean(o.wasSelected) ||
            wasCanonicalOptionSelected(o.id, effectiveValue)
        )
      : [];

  const matrixExplanations = React.useMemo(() => {
    if (!question.matrix) return [];
    const rows: Array<{ rowLabel: string; correctCols: string[]; notes: string[] }> = [];
    for (let r = 0; r < question.matrix.rowCount; r += 1) {
      const cells = question.matrix.cells.filter((c) => c.rowIndex === r);
      const correctCols = cells
        .filter((c) => c.isCorrect)
        .map((c) => question.matrix?.columnHeaders[c.columnIndex] ?? `Col ${c.columnIndex + 1}`);
      const notes = cells
        .map((c) => (c.explanation || "").trim())
        .filter(Boolean);
      if (notes.length > 0) {
        rows.push({
          rowLabel: question.matrix.rowHeaders[r] ?? `Row ${r + 1}`,
          correctCols,
          notes,
        });
      }
    }
    return rows;
  }, [question.matrix]);

  const objectives = question.learningObjectives?.filter((o) => Boolean(o?.trim())) ?? [];

  return (
    <div
      data-review-rationale="true"
      className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-900/60 p-4 space-y-3.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 font-bold text-[#142B4A] dark:text-slate-100">
          <BookOpenCheck className="h-4 w-4 text-brand-teal shrink-0" />
          <span>Clinical Review & Authoritative Rationale</span>
          <span className="inline-flex items-center rounded-md bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Official Examination Bank
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scored.maxPoints > 0 && (
            <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {scored.pointsAwarded} / {scored.maxPoints} pt{scored.maxPoints === 1 ? "" : "s"}
            </span>
          )}

          {hasAttempted ? (
            scored.isCorrect ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Correct Response
              </span>
            ) : scored.isPartiallyCorrect ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Partially Correct
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 px-2.5 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Incorrect Response
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 font-medium text-slate-700 dark:text-slate-300">
              <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" /> Unanswered
            </span>
          )}
        </div>
      </div>

      {rationaleText ? (
        <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
          <RichQuestionContent content={rationaleText} />
        </div>
      ) : modelAnswer ? null : (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>No narrative rationale was supplied by the examination bank for this item.</span>
        </div>
      )}

      {modelAnswer && modelAnswer !== rationaleText && (
        <div className="rounded-lg border border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 space-y-1">
          <div className="font-semibold text-emerald-800 dark:text-emerald-200">
            Expected Answer Key / Model Response
          </div>
          <RichQuestionContent content={modelAnswer} className="text-emerald-950 dark:text-emerald-100" />
        </div>
      )}

      {optionBreakdownItems.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            Option & Distractor Breakdown
          </div>
          {optionBreakdownItems.map((opt) => {
            const wasChosen =
              Boolean(opt.wasSelected) || wasCanonicalOptionSelected(opt.id, effectiveValue);
            return (
              <div
                key={opt.id}
                className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-2.5 flex items-start gap-2.5"
              >
                {opt.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                )}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                    <RichQuestionContent content={opt.optionText} as="span" />
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        opt.isCorrect
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {opt.isCorrect ? "Correct Key" : "Distractor"}
                    </span>
                    {wasChosen && (
                      <span className="inline-flex items-center rounded bg-brand-teal/15 text-brand-teal px-1.5 py-0.5 text-[10px] font-semibold">
                        Your Choice
                      </span>
                    )}
                  </div>
                  {opt.specificRationale && opt.specificRationale.trim() ? (
                    <RichQuestionContent
                      content={opt.specificRationale}
                      className="text-slate-600 dark:text-slate-400"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {matrixExplanations.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            Matrix Cell Explanations
          </div>
          {matrixExplanations.map((row, idx) => (
            <div
              key={`${row.rowLabel}-${idx}`}
              className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-2.5 space-y-1"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                <RichQuestionContent content={row.rowLabel} as="span" />{" "}
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  ({row.correctCols.join(", ")})
                </span>
              </div>
              {row.notes.map((n, nIdx) => (
                <RichQuestionContent
                  key={nIdx}
                  content={n}
                  className="text-slate-600 dark:text-slate-400"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {(objectives.length > 0 || (question.resources && question.resources.trim())) && (
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/30 p-3 space-y-1.5">
          {objectives.length > 0 && (
            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <GraduationCap className="h-3.5 w-3.5 mt-0.5 text-brand-teal shrink-0" />
              <div>
                <span className="font-semibold">Learning Objective(s): </span>
                <span>{objectives.join(" • ")}</span>
              </div>
            </div>
          )}
          {question.resources && question.resources.trim() && (
            <div className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Reference Note: </span>
              <RichQuestionContent content={question.resources} as="span" />
            </div>
          )}
        </div>
      )}

      {explanationImages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {explanationImages.map((imgUrl, idx) => {
            const safeUrl = normalizeMediaUrl(imgUrl) || imgUrl;
            return (
              <img
                key={`${safeUrl}-${idx}`}
                src={safeUrl}
                alt={`Rationale exhibit ${idx + 1}`}
                className="max-h-64 w-auto rounded-lg border border-border object-contain bg-white"
                loading="lazy"
              />
            );
          })}
        </div>
      )}

      {canAskTutor && onAskTutor && (
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Need deeper step-by-step guidance beyond the official bank rationale?
          </span>
          <button
            type="button"
            onClick={() => onAskTutor(question.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/40 bg-brand-teal/10 hover:bg-brand-teal/20 px-3 py-1.5 text-xs font-semibold text-brand-teal transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Ask Tutor to Explain This Question
          </button>
        </div>
      )}
    </div>
  );
}
