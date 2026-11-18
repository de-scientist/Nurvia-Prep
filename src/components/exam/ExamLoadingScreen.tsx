"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExamLoadingStage {
  step: number;
  label: string;
  description: string;
}

export const EXAM_LOADING_STAGES: ExamLoadingStage[] = [
  { step: 1, label: "Preparing your examination", description: "Configuring examination parameters and session profile" },
  { step: 2, label: "Verifying examination access", description: "Validating learner enrollment, permissions, and security token" },
  { step: 3, label: "Loading questions and supporting materials", description: "Retrieving verified clinical items, answer keys, and EHR exhibits" },
  { step: 4, label: "Preparing your examination workspace", description: "Initializing responsive interface and item layout" },
  { step: 5, label: "Finalizing your session", description: "Session ready. Opening your clinical examination" },
];

interface ExamLoadingScreenProps {
  title?: string;
  category?: string;
  currentStage?: number; // 1 to 5
  totalQuestions?: number | null;
  allocatedMinutes?: number | null;
  mode?: "Exam" | "Tutor" | "Review" | "Preview";
  error?: string | null;
  errorDetails?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ExamLoadingScreen({
  title = "Clinical Examination Session",
  category,
  currentStage = 1,
  totalQuestions,
  allocatedMinutes,
  mode = "Exam",
  error,
  errorDetails,
  onRetry,
  isRetrying = false,
}: ExamLoadingScreenProps) {
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);

  const activeStageIndex = Math.min(Math.max(currentStage, 1), 5) - 1;
  const activeStage = EXAM_LOADING_STAGES[activeStageIndex];
  const progressPercent = Math.min(100, Math.round((currentStage / 5) * 100));

  return (
    <main
      className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground transition-colors sm:px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="md" withLink={false} />
          <Badge
            variant="outline"
            className="mt-1 border-brand-teal/30 bg-brand-teal/5 text-[10px] font-bold uppercase tracking-wider text-brand-teal"
          >
            Clinical Examination Workspace
          </Badge>
          <h1 className="font-brand text-xl font-bold text-foreground sm:text-2xl leading-tight">
            {title}
          </h1>
          {category && (
            <p className="text-xs font-medium text-foreground-secondary">{category}</p>
          )}
        </div>

        {/* Normal Loading State */}
        {!error && (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
            {/* Animated Pulse Ring Indicator */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                {/* Outer pulsing ring (respects prefers-reduced-motion) */}
                <div
                  className="absolute inset-0 rounded-full bg-brand-teal/15 animate-ping motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {/* SVG Radial Progress */}
                <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-surface-muted"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * progressPercent) / 100}
                    strokeLinecap="round"
                    className="text-brand-teal transition-all duration-500 ease-out"
                    fill="transparent"
                  />
                </svg>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
                  <Sparkles className="h-6 w-6 animate-pulse motion-reduce:animate-none" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="font-brand text-base font-bold text-foreground">
                  {activeStage.label}
                </p>
                <p className="text-xs text-foreground-secondary leading-relaxed max-w-sm">
                  {activeStage.description}
                </p>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px] font-semibold text-foreground-muted">
                <span>Stage {activeStage.step} of 5</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full bg-brand-teal transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Stage Indicators */}
              <div className="grid grid-cols-5 gap-1 pt-2">
                {EXAM_LOADING_STAGES.map((s) => {
                  const isDone = s.step < currentStage;
                  const isCurrent = s.step === currentStage;
                  return (
                    <div
                      key={s.step}
                      className={cn(
                        "h-1.5 rounded-full transition-colors",
                        isDone
                          ? "bg-brand-teal"
                          : isCurrent
                          ? "bg-brand-teal animate-pulse"
                          : "bg-surface-muted"
                      )}
                      title={s.label}
                    />
                  );
                })}
              </div>
            </div>

            {/* Supporting Information Badges */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-border/60 text-center text-xs">
              <div className="rounded-xl bg-surface-muted p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] text-foreground-muted">
                  <Layers className="h-3.5 w-3.5 text-brand-teal" /> Mode
                </div>
                <div className="mt-1 font-bold text-foreground">{mode} Mode</div>
              </div>

              <div className="rounded-xl bg-surface-muted p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] text-foreground-muted">
                  <FileText className="h-3.5 w-3.5 text-brand-teal" /> Questions
                </div>
                <div className="mt-1 font-bold text-foreground">
                  {typeof totalQuestions === "number" && totalQuestions > 0
                    ? `${totalQuestions} items`
                    : "Standard"}
                </div>
              </div>

              <div className="rounded-xl bg-surface-muted p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] text-foreground-muted">
                  <Clock className="h-3.5 w-3.5 text-brand-teal" /> Allocated
                </div>
                <div className="mt-1 font-bold text-foreground">
                  {typeof allocatedMinutes === "number" && allocatedMinutes > 0
                    ? `${allocatedMinutes} min`
                    : "Untimed"}
                </div>
              </div>
            </div>

            {/* Reassuring Clinical Microcopy */}
            <div className="flex items-center justify-center gap-2 text-center text-[11px] text-foreground-muted">
              <ShieldCheck className="h-4 w-4 text-brand-teal shrink-0" />
              <span>Answers are automatically autosaved to your persistent learner account.</span>
            </div>
          </div>
        )}

        {/* Safe Error & Recovery State */}
        {error && (
          <div className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-surface p-6 sm:p-8 shadow-sm space-y-5 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="font-brand text-lg font-bold text-foreground">
                  Unable to prepare examination session
                </h2>
                <p role="alert" className="text-xs text-foreground-secondary leading-relaxed">
                  {error}
                </p>
              </div>
            </div>

            {/* Diagnostics Accordion */}
            {errorDetails && (
              <div className="rounded-xl border border-border bg-surface-muted p-3 text-xs space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="flex w-full items-center justify-between font-semibold text-foreground-secondary hover:text-foreground text-left"
                >
                  <span>Diagnostic Details</span>
                  {showDiagnostics ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showDiagnostics && (
                  <pre className="overflow-x-auto rounded-lg bg-background p-2.5 font-mono text-[11px] text-foreground-muted leading-relaxed">
                    {errorDetails}
                  </pre>
                )}
              </div>
            )}

            {/* Actions (with debounced / protected retry button) */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Link href="/learner/library" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full text-xs">
                  Return to Study Library
                </Button>
              </Link>
              {onRetry && (
                <Button
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="w-full sm:w-auto text-xs bg-brand-teal hover:bg-brand-tealDeep text-white gap-1.5"
                >
                  <RotateCcw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                  {isRetrying ? "Retrying..." : "Safe Retry"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
