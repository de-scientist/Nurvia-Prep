"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface QuizNurseLogoProps {
  variant?: "full" | "compact" | "symbol" | "stacked";
  size?: "sm" | "md" | "lg" | "xl";
  withLink?: boolean;
  href?: string;
  className?: string;
  inverted?: boolean;
  subtitle?: string;
}

export function QuizNurseSymbol({
  size = 36,
  className = "",
  inverted = false,
}: {
  size?: number;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-transform group-hover:scale-105", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="qnTealGradComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0A6265" />
          <stop offset="100%" stopColor="#148387" />
        </linearGradient>
        <linearGradient id="qnAmberGradComp" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C58B43" />
          <stop offset="100%" stopColor="#E2A65C" />
        </linearGradient>
      </defs>

      {/* Outer Q-Ring */}
      <path
        d="M 67 65 A 32 32 0 1 0 76 46"
        stroke={inverted ? "#2DD4BF" : "url(#qnTealGradComp)"}
        className={inverted ? "" : "dark:stroke-teal-400"}
        strokeWidth="9.5"
        strokeLinecap="round"
      />

      {/* Inner Nursing 'N' Contour & Clinical Pulse */}
      <path
        d="M 37 59 L 37 41 C 37 36 41 34 45 37 L 54 55 C 57 60 62 57 62 52 L 62 36"
        stroke={inverted ? "#F1F6F4" : "#193B42"}
        className={inverted ? "" : "dark:stroke-slate-200"}
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Clinical Mastery Chevron & Dynamic Q-Tail */}
      <path
        d="M 52 52 L 77 77"
        stroke="url(#qnAmberGradComp)"
        strokeWidth="9.5"
        strokeLinecap="round"
      />
      <path
        d="M 65 77 L 77 77 L 77 65"
        stroke="url(#qnAmberGradComp)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Zenith Clinical Excellence Beacon */}
      <circle cx="50" cy="22" r="5" fill="url(#qnAmberGradComp)" />
    </svg>
  );
}

export function QuizNurseLogo({
  variant = "full",
  size = "md",
  withLink = true,
  href = "/",
  className,
  inverted = false,
  subtitle = "NURSING EXAMINATION PREPARATION",
}: QuizNurseLogoProps) {
  const sizeMap = {
    sm: { symbol: 26, text: "text-lg", sub: "text-[8.5px]" },
    md: { symbol: 34, text: "text-2xl", sub: "text-[9.5px]" },
    lg: { symbol: 44, text: "text-3xl", sub: "text-xs" },
    xl: { symbol: 56, text: "text-4xl", sub: "text-sm" },
  };

  const { symbol: symbolSize, text: textSize, sub: subSize } = sizeMap[size];

  if (variant === "stacked") {
    const stackedContent = (
      <div className={cn("inline-flex flex-col items-center text-center select-none", className)}>
        <QuizNurseSymbol size={symbolSize * 1.3} inverted={inverted} />
        <div className="mt-2 flex flex-col items-center leading-none">
          <span className={cn("font-brand font-extrabold tracking-tight", textSize)}>
            <span className={inverted ? "text-white" : "text-[#193B42] dark:text-white"}>Quiz</span>
            <span className={inverted ? "text-teal-300" : "text-[#0A6265] dark:text-teal-400"}>Nurse</span>
          </span>
          <span
            className={cn(
              "font-semibold tracking-wider uppercase mt-1",
              subSize,
              inverted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
            )}
          >
            {subtitle}
          </span>
        </div>
      </div>
    );

    if (withLink) {
      return (
        <Link href={href} className="group inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6265] rounded-lg">
          {stackedContent}
        </Link>
      );
    }
    return stackedContent;
  }

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <QuizNurseSymbol size={symbolSize} inverted={inverted} />

      {variant !== "symbol" && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-brand font-extrabold tracking-tight transition-colors", textSize)}>
            <span className={inverted ? "text-white" : "text-[#193B42] dark:text-white"}>Quiz</span>
            <span className={inverted ? "text-teal-300" : "text-[#0A6265] dark:text-teal-400"}>Nurse</span>
          </span>
          {variant === "full" && (
            <span
              className={cn(
                "font-semibold tracking-wider uppercase mt-1 transition-colors",
                subSize,
                inverted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (withLink) {
    return (
      <Link
        href={href}
        className="group inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6265] rounded-lg"
      >
        {content}
      </Link>
    );
  }

  return content;
}
