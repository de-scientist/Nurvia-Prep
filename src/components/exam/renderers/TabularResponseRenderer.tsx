"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { RichQuestionContent } from "@/components/exam/RichQuestionContent";
import { SingleChoiceRenderer } from "./SingleChoiceRenderer";

/**
 * Renders authoritative clinical tables/exhibits (from `question.matrix` or
 * `question.exhibits`) alongside selectable response options. Never injects
 * fabricated hardcoded vital-sign rows.
 */
export function TabularResponseRenderer(props: QuestionRendererProps) {
  const { question } = props;
  const tableExhibits = (question.exhibits ?? []).filter(
    (ex) => Boolean(ex.content && ex.content.trim())
  );

  return (
    <div className="space-y-4">
      {question.matrix && question.matrix.rowHeaders.length > 0 && (
        <div className="rounded-xl border border-border overflow-x-auto bg-background">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-foreground font-semibold">
                <th className="p-3 text-left">{question.matrix.topLeftCell || "Parameter"}</th>
                {question.matrix.columnHeaders.map((col, idx) => (
                  <th key={idx} className="p-3 text-center whitespace-nowrap">
                    <RichQuestionContent content={col} as="span" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground-secondary">
              {question.matrix.rowHeaders.map((rowLabel, rIdx) => (
                <tr key={rIdx}>
                  <td className="p-3 font-medium text-foreground">
                    <RichQuestionContent content={rowLabel} as="span" />
                  </td>
                  {question.matrix!.columnHeaders.map((_, cIdx) => {
                    const cell = question.matrix!.cells.find(
                      (c) => c.rowIndex === rIdx && c.columnIndex === cIdx
                    );
                    return (
                      <td key={cIdx} className="p-3 text-center">
                        {cell?.cellValue ? <RichQuestionContent content={cell.cellValue} as="span" /> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tableExhibits.map((ex, idx) => (
        <div key={ex.id || idx} className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
          {ex.title && (
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{ex.title}</p>
          )}
          <RichQuestionContent content={ex.content} className="text-xs text-foreground-secondary" />
        </div>
      ))}

      <SingleChoiceRenderer {...props} />
    </div>
  );
}
