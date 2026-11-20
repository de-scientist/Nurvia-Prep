"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DetailSkeletonProps {
  className?: string;
  fields?: number;
}

export function DetailSkeleton({ className, fields = 4 }: DetailSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading details"
      className={cn("mx-auto max-w-4xl space-y-6", className)}
    >
      {/* Title & subtitle skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-surface-muted animate-pulse" />
        <div className="h-4 w-72 rounded bg-surface-muted animate-pulse" />
      </div>

      {/* Main card skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Banner/Header avatar skeleton */}
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="h-16 w-16 rounded-full bg-surface-muted animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-40 rounded bg-surface-muted animate-pulse" />
            <div className="h-3 w-56 rounded bg-surface-muted animate-pulse" />
          </div>
        </div>

        {/* Dynamic form field skeletons */}
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-24 rounded bg-surface-muted animate-pulse" />
              <div className="h-10 w-full rounded-lg bg-surface-muted animate-pulse" />
            </div>
          ))}
        </div>

        {/* Action button skeleton */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <div className="h-9 w-24 rounded-lg bg-surface-muted animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-surface-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
