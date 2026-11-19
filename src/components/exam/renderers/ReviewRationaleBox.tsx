"use client";

import * as React from "react";
import { BookOpenCheck, CheckCircle2, Info, MinusCircle, XCircle } from "lucide-react";
import type { RendererQuestion } from "./types";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { normalizeMediaUrl } from "@/lib/content/html-normalizer";
import { evaluateCanonicalQuestion } from "@/lib/attempts/strata-answer-adapter";

interface ReviewRationaleBoxProps {
  question: RendererQuestion;
  value?: string | null;
  includeOptionRationales?: boolean;
}

/**
 * Renders the authoritative inline Review outcome & clinical rationale box
 * directly beneath each reviewed question.
 */
export function ReviewRationaleBox({
  question,
  value,
  includeOptionRationales = false,
}: ReviewRationaleBoxProps) {
  const effectiveValue = value ?? question.learnerResponse ?? null;
  const hasAttempted =
    Boolean(effectiveValue && !["null", '""', "[]", "{}", ""].includes(String(effectiveValue).trim())) ||
    question.options.some((o) => o.wasSelected);

  const computedCorrect = React.useMemo(() => {
    if (typeof question.isCorrect === "boolean") return question.isCorrect;
    if (!hasAttempted) return null;
    return evaluateCanonicalQuestion(
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
  }, [question, effectiveValue, hasAttempted]);

  const rationaleText = (question.generalRationale || "").trim();
  const modelAnswer = (question.correctAnswerMeta?.modelAnswerHtml || "").trim();
  const explanationImages = question.correctAnswerMeta?.explanationImages || [];
  const optionRationales = includeOptionRationales
    ? question.options.filter((o) => o.specificRationale && o.specificRationale.trim())
    : [];

  return (
    <div
      data-review-rationale="true"
      className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-900/60 p-4 space-y-3 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 font-bold text-[#142B4A] dark:text-slate-100">
          <BookOpenCheck className="h-4 w-4 text-brand-teal shrink-0" />
          <span>Clinical Review & Authoritative Rationale</span>
        </div>

        {hasAttempted ? (
          computedCorrect ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> Correct Response
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 px-2.5 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
              <XCircle className="h-3.5 w-3.5" /> Incorrect Response
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 dark:bg-slate-800 px-2.5 py-0.5 font-medium text-slate-700 dark:text-slate-300">
            <MinusCircle className="h-3.5 w-3.5" /> No Response Recorded
          </span>
        )}
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

      {optionRationales.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            Option-Level Breakdown
          </div>
          {optionRationales.map((opt) => (
            <div
              key={opt.id}
              className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-2.5 flex items-start gap-2"
            >
              <span
                className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                  opt.isCorrect ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <div className="space-y-0.5">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  <RichQuestionContent content={opt.optionText} as="span" />
                </div>
                <RichQuestionContent
                  content={opt.specificRationale}
                  className="text-slate-600 dark:text-slate-400"
                />
              </div>
            </div>
          ))}
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
    </div>
  );
}
