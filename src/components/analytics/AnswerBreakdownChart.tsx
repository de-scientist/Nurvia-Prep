"use client";

import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface AnswerBreakdownChartProps {
  correct: number;
  wrong: number;
  unanswered: number;
}

export function AnswerBreakdownChart({
  correct,
  wrong,
  unanswered,
}: AnswerBreakdownChartProps) {
  const total = correct + wrong + unanswered;

  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-foreground-secondary">
        Cumulative response distribution (correct vs incorrect vs unanswered) populates after submitted exams.
      </div>
    );
  }

  const slices = [
    { name: "Correct", value: correct, color: "#10B981" },
    { name: "Incorrect", value: wrong, color: "#F43F5E" },
    { name: "Unanswered", value: unanswered, color: "#94A3B8" },
  ].filter((s) => s.value > 0);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={56}
            outerRadius={86}
            paddingAngle={3}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val) => {
              const num = Number(val ?? 0);
              const pct = total > 0 ? Math.round((num / total) * 100) : 0;
              return `${num} (${pct}%)`;
            }}
          />
          <Legend verticalAlign="bottom" height={32} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
