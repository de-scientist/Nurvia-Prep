"use client";

import * as React from "react";
import Link from "next/link";

interface NurviaLogoProps {
  variant?: "full" | "compact" | "symbol";
  size?: "sm" | "md" | "lg";
  withLink?: boolean;
  href?: string;
  label?: string;
  subtitle?: string;
  className?: string;
}

export function NurviaLogo({
  variant = "full",
  size = "md",
  withLink = true,
  href = "/",
  label = "NURVIA",
  subtitle = "PATHWAY TO CONFIDENCE",
  className = "",
}: NurviaLogoProps) {
  const sizeConfig = {
    sm: { symbol: 28, text: "text-lg", sub: "text-[9px]" },
    md: { symbol: 34, text: "text-2xl", sub: "text-[10px]" },
    lg: { symbol: 42, text: "text-3xl", sub: "text-xs" },
  };

  const { symbol: symbolSize, text: textSize, sub: subSize } = sizeConfig[size];

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Canonical NURVIA Geometric Learning Path Vector Symbol */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform group-hover:scale-105"
        style={{ width: symbolSize, height: symbolSize }}
      >
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 22 76 C 22 52, 40 38, 56 38 C 66 38, 74 44, 78 52"
            stroke="currentColor"
            className="text-[#142B4A] dark:text-slate-300"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="M 28 82 C 42 82, 60 76, 74 58 C 82 48, 82 32, 72 24 C 64 17, 50 20, 48 34"
            stroke="#0D9488"
            className="dark:stroke-teal-400"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <circle cx="76" cy="22" r="7.5" fill="#0D9488" className="dark:fill-teal-300" />
          <circle
            cx="24"
            cy="76"
            r="5.5"
            fill="currentColor"
            className="text-[#142B4A] dark:text-slate-300"
          />
        </svg>
      </div>

      {variant !== "symbol" && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-brand font-extrabold tracking-wider text-[#142B4A] dark:text-white transition-colors ${textSize}`}
          >
            {label}
          </span>
          {variant === "full" && (
            <span
              className={`font-semibold text-slate-500 dark:text-slate-400 tracking-wider mt-0.5 ${subSize}`}
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
      <Link href={href} className="group inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}

export default NurviaLogo;
