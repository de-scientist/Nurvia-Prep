"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoreProgressionPoint } from "@/lib/analytics/performance-analytics";

interface ScoreProgressionChartProps {
  data: ScoreProgressionPoint[];
}

export function ScoreProgressionChart({ data }: ScoreProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-foreground-secondary">
        No scored examination attempts recorded yet. Complete and submit an exam to chart your longitudinal score trend.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
          <defs>
            <linearGradient id="nurviaScoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ScoreProgressionPoint;
              return (
                <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1 max-w-xs">
                  <p className="font-bold text-foreground line-clamp-2">{point.examTitle}</p>
                  <p className="text-foreground-muted">
                    {point.pathway} · {point.fullDate}
                  </p>
                  <div className="flex items-center justify-between gap-4 pt-1 font-semibold">
                    <span className="text-brand-teal">Recorded Score: {point.score}%</span>
                    <span className={point.passed ? "text-emerald-600" : "text-rose-500"}>
                      {point.passed ? "Passed" : "Needs Review"}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={75}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            label={{ value: "75% Benchmark", position: "insideTopRight", fontSize: 10, fill: "#D97706" }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#0D9488"
            strokeWidth={2.5}
            fill="url(#nurviaScoreGrad)"
            activeDot={{ r: 5, fill: "#0D9488" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
