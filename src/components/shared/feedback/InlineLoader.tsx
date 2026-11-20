"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface InlineLoaderProps {
  message?: string;
  className?: string;
}

export function InlineLoader({
  message = "Loading...",
  className,
}: InlineLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 align-middle", className)}
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none" />
        <span
          className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: "0.1s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: "0.2s" }}
        />
      </span>

      {message && (
        <span className="text-xs font-medium text-foreground-secondary">
          {message}
        </span>
      )}
    </span>
  );
}
