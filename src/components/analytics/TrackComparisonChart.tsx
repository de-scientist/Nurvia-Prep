"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrackPerformanceItem } from "@/lib/analytics/performance-analytics";

interface TrackComparisonChartProps {
  data: TrackPerformanceItem[];
}

export function TrackComparisonChart({ data }: TrackComparisonChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-foreground-secondary">
        RN vs PN/LPN & Exit track comparison appears once attempts across tracks are recorded.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis
            dataKey="track"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as TrackPerformanceItem;
              return (
                <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1">
                  <p className="font-bold text-foreground">{item.track}</p>
                  <p className="text-brand-teal font-semibold">Average Score: {item.averageScore}%</p>
                  <p className="text-foreground-secondary">
                    {item.attempts} graded attempt{item.attempts > 1 ? "s" : ""} · {item.passRate}% passed
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="averageScore" name="Average Score" fill="#0D9488" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
