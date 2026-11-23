"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { resolveNormalizedQuestionType } from "@/lib/attempts/strata-answer-adapter";
import { ContentIntegrityAlert } from "./ContentIntegrityAlert";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

export function MatrixGridRenderer({
  question,
  value,
  onChange,
  disabled = false,
  isReview = false,
  hideRationaleBox = false,
}: QuestionRendererProps) {
  const { baseType } = resolveNormalizedQuestionType(question.questionType);
  const matrix = question.matrix;

  const isMultiSelect = React.useMemo(() => {
    if (baseType === "matrixmultipleselect") return true;
    return matrix?.responseType?.toLowerCase().includes("multiple") ?? false;
  }, [baseType, matrix?.responseType]);

  // Parse Strata cell-based or legacy row->col selection state
  const parsedState = React.useMemo(() => {
    const empty = {
      selectedCellId: null as string | null,
      selectedCellIds: [] as string[],
      legacySelections: {} as Record<string, string>,
    };
    if (!value) return empty;
    try {
      if (value.startsWith("{")) {
        const parsed = JSON.parse(value);
        return {
          selectedCellId: parsed.SelectedCellId ? String(parsed.SelectedCellId) : null,
          selectedCellIds: Array.isArray(parsed.SelectedCellIds)
            ? parsed.SelectedCellIds.map(String)
            : [],
          legacySelections: (parsed.MatrixSelections || parsed.matrixSelections || {}) as Record<
            string,
            string
          >,
        };
      }
      if (value.startsWith("[")) {
        return {
          ...empty,
          selectedCellIds: (JSON.parse(value) as unknown[]).map(String),
        };
      }
      return { ...empty, selectedCellId: value.replace(/^"(.*)"$/, "$1") };
    } catch {
      return empty;
    }
  }, [value]);

  const handleCellToggle = (cellId: string) => {
    if (disabled) return;
    if (isMultiSelect) {
      const exists = parsedState.selectedCellIds.includes(cellId);
      const next = exists
        ? parsedState.selectedCellIds.filter((id: string) => id !== cellId)
        : [...parsedState.selectedCellIds, cellId];
      onChange?.(JSON.stringify({ SelectedCellIds: next }));
    } else {
      onChange?.(JSON.stringify({ SelectedCellId: cellId }));
    }
  };

  const handleLegacySelect = (rowId: string, col: string) => {
    if (disabled) return;
    const updated = { ...parsedState.legacySelections, [rowId]: col };
    onChange?.(JSON.stringify({ MatrixSelections: updated }));
  };

  const hasAnyMatrixSelection =
    Boolean(parsedState.selectedCellId) ||
    parsedState.selectedCellIds.length > 0 ||
    Object.values(parsedState.legacySelections).some((v) => Boolean(v));

  // Authoritative Strata Matrix rendering
  if (matrix && matrix.cells.length > 0) {
    const rowCount = Math.max(matrix.rowCount || 0, matrix.rowHeaders.length);
    const colCount = Math.max(matrix.columnCount || 0, matrix.columnHeaders.length);

    return (
      <div className="space-y-4">
        {matrix.instructions && (
          <div className="text-xs text-foreground-secondary">
            <RichQuestionContent content={matrix.instructions} as="span" />
          </div>
        )}

        {isReview && !hasAnyMatrixSelection && (
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Your Submitted Answer: Unanswered
          </div>
        )}

        <div className="rounded-xl border border-border overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-foreground font-semibold">
                  <th className="p-3 text-left min-w-[180px]">
                    {matrix.topLeftCell ? (
                      <RichQuestionContent content={matrix.topLeftCell} as="span" />
                    ) : (
                      matrix.title || "Clinical Item"
                    )}
                  </th>
                  {Array.from({ length: colCount }).map((_, cIdx) => (
                    <th key={cIdx} className="p-3 text-center whitespace-nowrap">
                      {matrix.columnHeaders[cIdx] ? (
                        <RichQuestionContent content={matrix.columnHeaders[cIdx]} as="span" />
                      ) : (
                        `Column ${cIdx + 1}`
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: rowCount }).map((_, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="p-3 text-foreground font-medium">
                      {matrix.rowHeaders[rIdx] ? (
                        <RichQuestionContent content={matrix.rowHeaders[rIdx]} />
                      ) : (
                        `Row ${rIdx + 1}`
                      )}
                    </td>
                    {Array.from({ length: colCount }).map((__, cIdx) => {
                      const cell = matrix.cells.find(
                        (c) => c.rowIndex === rIdx && c.columnIndex === cIdx
                      );
                      if (!cell) {
                        return (
                          <td key={cIdx} className="p-3 text-center text-foreground-muted">
                            —
                          </td>
                        );
                      }

                      const isSelected = isMultiSelect
                        ? parsedState.selectedCellIds.includes(cell.id) ||
                          (cell.numericId !== undefined &&
                            parsedState.selectedCellIds.includes(String(cell.numericId)))
                        : parsedState.selectedCellId === cell.id ||
                          (cell.numericId !== undefined &&
                            parsedState.selectedCellId === String(cell.numericId));

                      const isCorrectCell = Boolean(cell.isCorrect);
                      let tdClass = "";
                      if (isReview) {
                        if (isCorrectCell) {
                          tdClass = "bg-emerald-50/90 dark:bg-emerald-950/40";
                        } else if (isSelected && !isCorrectCell) {
                          tdClass = "bg-rose-50/90 dark:bg-rose-950/40";
                        }
                      }

                      return (
                        <td key={cell.id} className={cn("p-3 text-center align-middle", tdClass)}>
                          <div className="inline-flex flex-col items-center gap-1">
                            <input
                              type={isMultiSelect ? "checkbox" : "radio"}
                              name={isMultiSelect ? undefined : `matrix-${question.id}`}
                              aria-label={`${matrix.rowHeaders[rIdx] || `Row ${rIdx + 1}`} — ${matrix.columnHeaders[cIdx] || `Column ${cIdx + 1}`}`}
                              disabled={disabled || cell.isLocked}
                              checked={isSelected}
                              onChange={() => handleCellToggle(cell.id)}
                              className="w-4 h-4 text-brand-teal focus:ring-brand-teal cursor-pointer"
                            />
                            {cell.cellValue && (
                              <span className="text-[11px] text-foreground-secondary">
                                <RichQuestionContent content={cell.cellValue} as="span" />
                              </span>
                            )}
                            {isReview && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold">
                                {isCorrectCell ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                                    {isSelected ? "Your Answer · Correct" : "Correct Key"}
                                  </span>
                                ) : isSelected ? (
                                  <span className="inline-flex items-center gap-0.5 text-rose-700 dark:text-rose-300">
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                                    Your Answer · Incorrect
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isReview && !hideRationaleBox && (
          <ReviewRationaleBox question={question} value={value} />
        )}
      </div>
    );
  }

  // Fallback when no Strata matrix is supplied
  if (question.contentIntegrityError || question.options.length === 0) {
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

  // Legacy per-option matrix fallback
  const columns = ["Indicated", "Non-Essential", "Contraindicated"];

  return (
    <div className="space-y-4">
      <div className="text-xs text-foreground-secondary">
        For each clinical action or finding below, select the appropriate classification:
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-foreground font-semibold">
                <th className="p-3 text-left w-1/2">Clinical Action / Intervention</th>
                {columns.map((c) => (
                  <th key={c} className="p-3 text-center whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {question.options.map((opt) => {
                const selectedCol = parsedState.legacySelections[opt.id] || "";
                const expectedCol = opt.data || opt.description || "";
                return (
                  <tr key={opt.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="p-3 text-foreground font-medium">
                      <RichQuestionContent content={opt.optionText} />
                    </td>
                    {columns.map((col) => {
                      const isChecked = selectedCol === col;
                      const isExpected = expectedCol === col;
                      return (
                        <td
                          key={col}
                          className={cn(
                            "p-3 text-center",
                            isReview && isExpected && "bg-emerald-50/80 dark:bg-emerald-950/30",
                            isReview && isChecked && !isExpected && expectedCol && "bg-rose-50/80 dark:bg-rose-950/30"
                          )}
                        >
                          <div className="inline-flex flex-col items-center gap-1">
                            <input
                              type="radio"
                              name={`matrix-${opt.id}`}
                              disabled={disabled}
                              checked={isChecked}
                              onChange={() => handleLegacySelect(opt.id, col)}
                              className="w-4 h-4 text-brand-teal focus:ring-brand-teal cursor-pointer"
                            />
                            {isReview && isExpected && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {isChecked ? "Correct" : "Correct Key"}
                              </span>
                            )}
                            {isReview && isChecked && !isExpected && expectedCol && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                Incorrect
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox question={question} value={value} includeOptionRationales />
      )}
    </div>
  );
}
