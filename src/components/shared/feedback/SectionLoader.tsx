"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SectionLoaderProps {
  message?: string;
  className?: string;
  children?: React.ReactNode;
}

export function SectionLoader({
  message = "Loading content...",
  className,
  children,
}: SectionLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn("flex flex-col items-center justify-center py-10 px-4", className)}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-3.5"
      >
        <div className="flex items-center gap-2" aria-hidden="true">
          <div className="h-2.5 w-2.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none" />
          <div
            className="h-2.5 w-2.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.1s" }}
          />
          <div
            className="h-2.5 w-2.5 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.2s" }}
          />
        </div>

        <p className="text-xs font-medium text-foreground-secondary tracking-wide">
          {message}
        </p>
      </motion.div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
