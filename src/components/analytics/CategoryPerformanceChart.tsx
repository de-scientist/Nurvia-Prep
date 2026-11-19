"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryPerformanceItem } from "@/lib/analytics/performance-analytics";

interface CategoryPerformanceChartProps {
  data: CategoryPerformanceItem[];
}

export function CategoryPerformanceChart({ data }: CategoryPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-foreground-secondary">
        Category and subject accuracy bars appear automatically once scored attempts exist.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.slice(0, 8)}
          layout="vertical"
          margin={{ top: 8, right: 20, left: 12, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={130}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as CategoryPerformanceItem;
              return (
                <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1">
                  <p className="font-bold text-foreground">{item.category}</p>
                  <p className="text-brand-teal font-semibold">Average: {item.averageScore}%</p>
                  <p className="text-foreground-secondary">
                    {item.attempts} attempt{item.attempts > 1 ? "s" : ""} · Pass rate {item.passRate}%
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="averageScore" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {data.slice(0, 8).map((entry) => (
              <Cell
                key={entry.category}
                fill={
                  entry.averageScore >= 80
                    ? "#10B981"
                    : entry.averageScore >= 75
                      ? "#0D9488"
                      : "#F43F5E"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
