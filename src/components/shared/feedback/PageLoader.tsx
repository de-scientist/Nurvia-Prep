"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface PageLoaderProps {
  isLoading?: boolean;
  message?: string;
  fullscreen?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PageLoader({
  isLoading = true,
  message = "Loading your workspace...",
  fullscreen = true,
  className,
  children,
}: PageLoaderProps) {
  if (!isLoading) {
    return <>{children}</>;
  }

  const containerClasses = fullscreen
    ? cn("fixed inset-0 z-50 flex items-center justify-center bg-background px-4", className)
    : cn("flex min-h-[360px] w-full flex-col items-center justify-center bg-background/80 py-12 px-4", className);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={containerClasses}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center gap-5 text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 20 }}
          className="motion-reduce:transform-none"
        >
          <Logo size="lg" variant="full" withLink={false} />
        </motion.div>

        <p className="text-sm font-medium text-foreground-secondary leading-relaxed">
          {message}
        </p>

        <div
          className="flex items-center gap-2"
          aria-hidden="true"
        >
          <div className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none" />
          <div
            className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.1s" }}
          />
          <div
            className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.2s" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
