"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function BowTieRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const state = React.useMemo<{
    actions: string[];
    condition: string | null;
    parameters: string[];
  }>(() => {
    if (!value) return { actions: [], condition: null, parameters: [] };
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return {
          actions: Array.isArray(parsed.Actions || parsed.actions)
            ? (parsed.Actions || parsed.actions).map(String)
            : [],
          condition: parsed.Condition || parsed.condition ? String(parsed.Condition || parsed.condition) : null,
          parameters: Array.isArray(parsed.Parameters || parsed.parameters)
            ? (parsed.Parameters || parsed.parameters).map(String)
            : [],
        };
      }
      return { actions: [], condition: null, parameters: [] };
    } catch {
      return { actions: [], condition: null, parameters: [] };
    }
  }, [value]);

  const updateBowTie = (newActions: string[], newCond: string | null, newParams: string[]) => {
    if (disabled) return;
    onChange?.(
      JSON.stringify({
        Actions: newActions,
        Condition: newCond,
        Parameters: newParams,
      })
    );
  };

  const toggleAction = (optId: string) => {
    const current = state.actions;
    const next = current.includes(optId)
      ? current.filter((id) => id !== optId)
      : current.length < 2
        ? [...current, optId]
        : current;
    updateBowTie(next, state.condition, state.parameters);
  };

  const setCondition = (optId: string) => {
    updateBowTie(state.actions, state.condition === optId ? null : optId, state.parameters);
  };

  const toggleParam = (optId: string) => {
    const current = state.parameters;
    const next = current.includes(optId)
      ? current.filter((id) => id !== optId)
      : current.length < 2
        ? [...current, optId]
        : current;
    updateBowTie(state.actions, state.condition, next);
  };

  const options = question.options;

  if (question.contentIntegrityError || options.length === 0) {
    return (
      <div className="space-y-4">
        <ContentIntegrityAlert
          questionId={question.id}
          questionType={question.questionType}
          message={question.contentIntegrityError}
        />
        {isReview && !hideRationaleBox && (
          <ReviewRationaleBox question={question} value={value} />
        )}
      </div>
    );
  }

  // Prefer explicit option metadata grouping (`data` or `label`), else divide evenly without overlap
  const taggedActions = options.filter((o) => /action/i.test(`${o.data ?? ""} ${o.label ?? ""}`));
  const taggedConditions = options.filter((o) => /condit|diag/i.test(`${o.data ?? ""} ${o.label ?? ""}`));
  const taggedParams = options.filter((o) => /param|monitor/i.test(`${o.data ?? ""} ${o.label ?? ""}`));

  const hasExplicitGroups =
    taggedActions.length > 0 && taggedConditions.length > 0 && taggedParams.length > 0;

  const third = Math.max(1, Math.ceil(options.length / 3));
  const actionOptions = hasExplicitGroups ? taggedActions : options.slice(0, third);
  const conditionOptions = hasExplicitGroups ? taggedConditions : options.slice(third, third * 2);
  const paramOptions = hasExplicitGroups ? taggedParams : options.slice(third * 2);

  const renderBtnClass = (isSelected: boolean, isCorrect?: boolean, isPrimary?: boolean) => {
    if (isReview) {
      if (isCorrect) {
        return "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500";
      }
      if (isSelected && !isCorrect) {
        return "border-rose-500 bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-semibold ring-1 ring-rose-500";
      }
    }
    if (isSelected) {
      return isPrimary
        ? "border-brand-teal bg-brand-teal text-white font-bold shadow-xs"
        : "border-brand-teal bg-brand-teal/10 text-foreground font-semibold ring-1 ring-brand-teal";
    }
    return "border-border bg-surface hover:bg-surface-muted text-foreground-secondary";
  };

  return (
    <div className="space-y-6">
      <div className="text-xs text-foreground-secondary flex items-center justify-between gap-2">
        <span>Complete the clinical judgment Bow-Tie by selecting items for each column:</span>
        <Badge variant="outline" className="text-[10px]">NGN NextGen Format</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 rounded-2xl border border-border bg-surface-muted/40">
        {/* Left: Actions to Take (Pick 2) */}
        <div className="space-y-3 rounded-xl border border-border bg-background p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-brand font-bold text-xs text-foreground uppercase tracking-wider">
              1. Actions to Take
            </span>
            <Badge variant="teal" className="text-[10px] shrink-0">Pick 2</Badge>
          </div>
          <div className="space-y-2">
            {actionOptions.map((opt) => {
              const isSelected = state.actions.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleAction(opt.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                    renderBtnClass(isSelected, opt.isCorrect)
                  )}
                >
                  <RichQuestionContent content={opt.optionText} as="span" className="flex-1" />
                  {isReview && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {isReview && isSelected && !opt.isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Potential Condition (Pick 1) */}
        <div className="space-y-3 rounded-xl border-2 border-brand-teal/40 bg-brand-teal/5 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-brand font-bold text-xs text-brand-teal uppercase tracking-wider">
                2. Potential Condition
              </span>
              <Badge variant="teal" className="text-[10px] shrink-0">Pick 1</Badge>
            </div>
            <div className="space-y-2">
              {conditionOptions.map((opt) => {
                const isSelected = state.condition === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCondition(opt.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                      renderBtnClass(isSelected, opt.isCorrect, true)
                    )}
                  >
                    <RichQuestionContent content={opt.optionText} as="span" className="flex-1" />
                    {isReview && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {isReview && isSelected && !opt.isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-[11px] text-center text-foreground-muted italic pt-2">
            Core Client Condition / Hypothesis
          </div>
        </div>

        {/* Right: Parameters to Monitor (Pick 2) */}
        <div className="space-y-3 rounded-xl border border-border bg-background p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-brand font-bold text-xs text-foreground uppercase tracking-wider">
              3. Parameters to Monitor
            </span>
            <Badge variant="teal" className="text-[10px] shrink-0">Pick 2</Badge>
          </div>
          <div className="space-y-2">
            {paramOptions.map((opt) => {
              const isSelected = state.parameters.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleParam(opt.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                    renderBtnClass(isSelected, opt.isCorrect)
                  )}
                >
                  <RichQuestionContent content={opt.optionText} as="span" className="flex-1" />
                  {isReview && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {isReview && isSelected && !opt.isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
