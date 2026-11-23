"use client";

import * as React from "react";
import { BookOpenCheck, ClipboardCheck, Lock, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ExamExperienceStage,
  StageAvailability,
} from "@/lib/attempts/exam-experience-state";

interface StageProgressBarProps {
  currentStage: ExamExperienceStage;
  availability: Record<ExamExperienceStage, StageAvailability>;
  onSelectStage: (stage: ExamExperienceStage) => void;
  tutorQuestionNumber?: number;
}

const STAGES: Array<{
  key: ExamExperienceStage;
  number: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "assessment",
    number: "1",
    label: "Assessment",
    subtitle: "Measure performance",
    icon: ClipboardCheck,
  },
  {
    key: "results",
    number: "2",
    label: "Results",
    subtitle: "Score summary",
    icon: Trophy,
  },
  {
    key: "review",
    number: "3",
    label: "Review",
    subtitle: "Understand why",
    icon: BookOpenCheck,
  },
  {
    key: "tutor",
    number: "4",
    label: "Tutor",
    subtitle: "Build mastery",
    icon: Sparkles,
  },
];

export function StageProgressBar({
  currentStage,
  availability,
  onSelectStage,
  tutorQuestionNumber,
}: StageProgressBarProps) {
  return (
    <nav
      aria-label="Examination Experience Stages"
      className="mx-auto max-w-7xl pt-2 mt-2 border-t border-border/60"
    >
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {STAGES.map((step) => {
          const Icon = step.icon;
          const isCurrent = currentStage === step.key;
          const stageInfo = availability[step.key];
          const canEnter = isCurrent || stageInfo.canEnter;
          const displayLabel =
            step.key === "tutor" && isCurrent && tutorQuestionNumber
              ? `Tutor (Q${tutorQuestionNumber})`
              : step.label;

          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!canEnter}
                aria-current={isCurrent ? "step" : undefined}
                title={canEnter ? `${step.label}: ${step.subtitle}` : stageInfo.reason}
                onClick={() => {
                  if (canEnter && !isCurrent) onSelectStage(step.key);
                }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all",
                  isCurrent
                    ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-2xs"
                    : canEnter
                      ? "border-border/80 bg-background/70 hover:bg-surface-muted text-foreground"
                      : "border-border/40 bg-surface-muted/40 text-foreground-muted cursor-not-allowed opacity-70"
                )}
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    isCurrent
                      ? "bg-brand-teal text-white"
                      : canEnter
                        ? "bg-surface-muted text-foreground-secondary border border-border"
                        : "bg-surface-muted text-foreground-muted"
                  )}
                >
                  {!canEnter ? <Lock className="w-2.5 h-2.5" aria-hidden="true" /> : step.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold truncate">
                    <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{displayLabel}</span>
                  </div>
                  <div className="hidden md:block text-[10px] text-foreground-secondary truncate">
                    {!canEnter && stageInfo.reason ? "Locked" : step.subtitle}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
