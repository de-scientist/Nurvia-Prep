import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  children?: React.ReactNode;
  animate?: boolean;
}

export function SkeletonCard({ className, children, animate: _animate = true }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}