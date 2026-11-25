"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import type { ExamLayout, ExamModePermissionsDto } from "@/lib/api-types";
import {
  Clock,
  Pause,
  Play,
  Bookmark,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  FileText,
  LogOut,
  Lock,
  Rows3,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExamShellProps {
  children: React.ReactNode;
  examTitle?: string;
  totalQuestions?: number;
  configuredQuestionCount?: number;
  currentQuestion?: number;
  mode?: "Review" | "Exam" | "Tutor";
  onModeChange?: (mode: "Review" | "Exam" | "Tutor") => void;
  modePermissions?: ExamModePermissionsDto;
  layoutMode?: ExamLayout;
  allowLayoutSwitching?: boolean;
  onLayoutChange?: (layout: ExamLayout) => void;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
  onSubmitExam?: () => void;
  secondsRemaining?: number;
  onTimerExpired?: () => void;
  autosaveStatus?: "saving" | "saved" | "idle" | "error";
  onRetrySave?: () => void;
  onOpenQuestionGrid?: () => void;
  answeredCount?: number;
  showTimer?: boolean;
  showSubmitExam?: boolean;
  showFlag?: boolean;
  modeBadge?: string;
  pathway?: string;
  examCategory?: string;
  isTimed?: boolean;
  elapsedSeconds?: number;
  stageBar?: React.ReactNode;
}

export function ExamShell({
  children,
  examTitle = "QuizNurse Clinical Examination",
  totalQuestions = 0,
  configuredQuestionCount,
  currentQuestion = 1,
  mode = "Review",
  onModeChange,
  modePermissions,
  layoutMode = "Sequential",
  allowLayoutSwitching = true,
  onLayoutChange,
  isFlagged = false,
  onToggleFlag,
  onSubmitExam,
  secondsRemaining: propSecondsRemaining,
  onTimerExpired,
  autosaveStatus = "idle",
  onRetrySave,
  onOpenQuestionGrid,
  answeredCount,
  showTimer = true,
  showSubmitExam = true,
  showFlag = true,
  modeBadge,
  pathway,
  examCategory,
  isTimed = true,
  elapsedSeconds: propElapsedSeconds = 0,
  stageBar,
}: ExamShellProps) {
  const auth = useOptionalAuth();
  const user = auth?.user;
  const [internalSeconds, setInternalSeconds] = React.useState(propSecondsRemaining ?? 5400);
  const [isPaused, setIsPaused] = React.useState(false);
  const [internalElapsed, setInternalElapsed] = React.useState(propElapsedSeconds);
  const [showCalculator, setShowCalculator] = React.useState(false);
  const [modeNotice, setModeNotice] = React.useState<string | null>(null);

  // Real Interactive Nursing Calculator State (Dosage + IV Drip)
  const [calcTab, setCalcTab] = React.useState<"dosage" | "iv">("dosage");
  const [desiredDose, setDesiredDose] = React.useState("500");
  const [doseOnHand, setDoseOnHand] = React.useState("250");
  const [vehicleQty, setVehicleQty] = React.useState("1");
  const [ivVolume, setIvVolume] = React.useState("1000");
  const [ivDropFactor, setIvDropFactor] = React.useState("15");
  const [ivMinutes, setIvMinutes] = React.useState("480");

  React.useEffect(() => {
    if (propSecondsRemaining !== undefined) {
      setInternalSeconds(propSecondsRemaining);
    }
  }, [propSecondsRemaining]);

  React.useEffect(() => {
    if (isPaused || !showTimer) return;
    if (!isTimed) {
      const elapsedInterval = setInterval(() => {
        setInternalElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(elapsedInterval);
    }
    const interval = setInterval(() => {
      setInternalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimerExpired?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isTimed, onTimerExpired, showTimer]);

  React.useEffect(() => {
    setInternalElapsed(propElapsedSeconds);
  }, [propElapsedSeconds]);

  const secondsRemaining = internalSeconds;

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const progressPct =
    totalQuestions > 0
      ? Math.min(100, Math.max(0, (((answeredCount !== undefined ? answeredCount : currentQuestion) / totalQuestions) * 100)))
      : 0;

  const dosageResult = React.useMemo(() => {
    const d = Number(desiredDose);
    const h = Number(doseOnHand);
    const v = Number(vehicleQty);
    if (!Number.isFinite(d) || !Number.isFinite(h) || !Number.isFinite(v) || h <= 0) {
      return null;
    }
    return ((d / h) * v).toFixed(2).replace(/\.00$/, "");
  }, [desiredDose, doseOnHand, vehicleQty]);

  const ivResult = React.useMemo(() => {
    const vol = Number(ivVolume);
    const df = Number(ivDropFactor);
    const mins = Number(ivMinutes);
    if (!Number.isFinite(vol) || !Number.isFinite(df) || !Number.isFinite(mins) || mins <= 0) {
      return null;
    }
    const gttPerMin = (vol * df) / mins;
    const mlPerHr = vol / (mins / 60);
    return {
      gttPerMin: Math.round(gttPerMin * 10) / 10,
      mlPerHr: Math.round(mlPerHr * 10) / 10,
    };
  }, [ivVolume, ivDropFactor, ivMinutes]);

  const modeOptions: Array<{
    key: "Exam" | "Review" | "Tutor";
    allowed: boolean;
    reason?: string;
  }> = [
    {
      key: "Exam",
      allowed: modePermissions ? modePermissions.canExam : true,
      reason: modePermissions?.examReason,
    },
    {
      key: "Review",
      allowed: modePermissions ? modePermissions.canReview : mode === "Review",
      reason:
        modePermissions?.reviewReason ||
        "Review mode is unavailable until authorized by the exam configuration or after graded review release.",
    },
    {
      key: "Tutor",
      allowed: modePermissions ? modePermissions.canTutor : mode === "Tutor",
      reason:
        modePermissions?.tutorReason ||
        "Tutor mode is not enabled for this examination by backend policy.",
    },
  ];

  const handleModeClick = (opt: (typeof modeOptions)[number]) => {
    if (!opt.allowed && opt.key !== mode) {
      setModeNotice(opt.reason || `${opt.key} mode is unavailable for this exam.`);
      return;
    }
    setModeNotice(null);
    onModeChange?.(opt.key);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Focused Exam Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md px-4 py-2.5 sm:px-6 overflow-x-clip">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Left: Brand & Exam Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" variant="symbol" href="/learner" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-xs lg:max-w-sm">
                {examTitle}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-foreground-secondary flex-wrap">
                <span>
                  Question <strong>{Math.min(currentQuestion, Math.max(totalQuestions, 1))}</strong> of{" "}
                  {totalQuestions}
                  {configuredQuestionCount &&
                  configuredQuestionCount > 0 &&
                  configuredQuestionCount !== totalQuestions
                    ? ` (Configured: ${configuredQuestionCount})`
                    : ""}
                </span>
                <span className="text-border">•</span>
                <Badge
                  variant={mode === "Review" ? "teal" : mode === "Exam" ? "destructive" : "info"}
                  className="text-[10px] py-0 px-2"
                >
                  {modeBadge || `${mode} Mode`}
                </Badge>
                {pathway && (
                  <Badge variant="outline" className="text-[10px] py-0 px-2">
                    {pathway}
                  </Badge>
                )}
                {examCategory && (
                  <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-2">
                    {examCategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Center-Left: Segmented Mode Switcher & Layout Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {onModeChange && (
              <div
                role="group"
                aria-label="Examination Mode Switcher"
                className="inline-flex items-center rounded-lg border border-border bg-surface-muted/80 p-0.5 text-[11px]"
              >
                {modeOptions.map((opt) => {
                  const isActive = mode === opt.key;
                  const locked = !opt.allowed && !isActive;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      aria-disabled={locked}
                      title={locked ? opt.reason : `Switch to ${opt.key} mode`}
                      onClick={() => handleModeClick(opt)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-all",
                        isActive
                          ? "bg-brand-teal text-white shadow-xs"
                          : locked
                            ? "text-foreground-muted/60 hover:text-foreground-secondary cursor-not-allowed"
                            : "text-foreground-secondary hover:bg-surface hover:text-foreground"
                      )}
                    >
                      {locked && <Lock className="w-3 h-3 opacity-70" />}
                      <span>{opt.key}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {onLayoutChange && allowLayoutSwitching && (
              <div
                role="group"
                aria-label="Question Layout"
                className="inline-flex items-center rounded-lg border border-border bg-surface-muted/80 p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onLayoutChange("Sequential")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
                    layoutMode === "Sequential"
                      ? "bg-surface text-foreground shadow-xs border border-border/60"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                  title="One question per step (Sequential)"
                >
                  <Rows3 className="w-3 h-3 text-brand-teal" />
                  <span className="hidden sm:inline">Sequential</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLayoutChange("AllInOne")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
                    layoutMode === "AllInOne"
                      ? "bg-surface text-foreground shadow-xs border border-border/60"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                  title="All questions scrollable together (All-in-One)"
                >
                  <LayoutList className="w-3 h-3 text-brand-teal" />
                  <span className="hidden sm:inline">All-in-One</span>
                </button>
              </div>
            )}
          </div>

          {/* Center-Right: Progress */}
          <div className="hidden xl:flex flex-col items-center w-44">
            <div className="w-full flex justify-between text-[11px] text-foreground-muted mb-1 font-medium">
              <span>Progress</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden border border-border/60">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Right: Timer, Autosave, Calculator, Flag, Account & Submit */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showTimer && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-muted border border-border font-mono text-xs font-bold text-foreground">
                <Clock className="w-3.5 h-3.5 text-brand-teal" />
                <span>{isTimed ? formatTime(secondsRemaining) : `Elapsed ${formatTime(internalElapsed)}`}</span>
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className="ml-0.5 p-0.5 hover:text-primary transition-colors"
                  title={isPaused ? "Resume exam" : "Pause exam"}
                  aria-label="Pause or Resume Timer"
                >
                  {isPaused ? <Play className="w-3 h-3 text-emerald-600" /> : <Pause className="w-3 h-3" />}
                </button>
              </div>
            )}

            {autosaveStatus !== "idle" && (
              <div role="status" aria-live="polite" className="flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium whitespace-nowrap">
                {autosaveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-amber-500 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Saving...
                  </span>
                )}
                {autosaveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Answer saved.
                  </span>
                )}
                {autosaveStatus === "error" && (
                  <button
                    type="button"
                    onClick={onRetrySave}
                    className="flex items-center gap-1 text-rose-500 hover:text-rose-600 underline underline-offset-2"
                    title="Retry saving your latest answer"
                    aria-label="Retry saving your latest answer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Save failed — retry
                  </button>
                )}
              </div>
            )}

            {onOpenQuestionGrid && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenQuestionGrid}
                className="text-xs h-8 px-2 sm:px-2.5 text-foreground"
                title="Open Question Grid"
              >
                <FileText className="w-3.5 h-3.5 sm:mr-1 text-brand-teal" />
                <span className="hidden sm:inline">
                  Grid{answeredCount !== undefined ? ` (${answeredCount}/${totalQuestions})` : ""}
                </span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalculator(!showCalculator)}
              className={cn(
                "text-xs h-8 px-2 sm:px-2.5",
                showCalculator && "border-brand-teal text-brand-teal"
              )}
              title="Clinical Dosage & IV Calculator"
            >
              <Calculator className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden md:inline">Calc</span>
            </Button>

            {showFlag && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleFlag}
                className={cn(
                  "text-xs h-8 px-2 sm:px-2.5",
                  isFlagged &&
                    "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                )}
                title="Flag question for review"
              >
                <Bookmark className={cn("w-3.5 h-3.5 sm:mr-1", isFlagged && "fill-amber-500")} />
                <span className="hidden lg:inline">{isFlagged ? "Flagged" : "Flag"}</span>
              </Button>
            )}

            <ThemeToggle />

            {user && <UserAccountMenu avatarUrl={user.avatarUrl ?? null} />}

            <Link href="/learner">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2 text-foreground-secondary hover:text-foreground"
                title="Return to Learner Dashboard"
              >
                <LogOut className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden xl:inline">Exit</span>
              </Button>
            </Link>

            {showSubmitExam && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSubmitExam}
                className="text-xs h-8 px-3 font-semibold"
              >
                Finish Exam
              </Button>
            )}
          </div>
        </div>

        {modeNotice && (
          <div className="mx-auto max-w-7xl mt-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-between gap-2">
            <span>{modeNotice}</span>
            <button
              type="button"
              onClick={() => setModeNotice(null)}
              className="text-[11px] font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {stageBar}
      </header>

      {/* Live Working Clinical Calculator Widget */}
      {showCalculator && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 w-80 rounded-xl border border-border bg-surface shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-brand font-bold text-xs flex items-center gap-1.5 text-foreground">
              <Calculator className="w-4 h-4 text-brand-teal" /> Clinical Nursing Calculator
            </span>
            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="text-foreground-secondary hover:text-foreground text-xs px-1"
              aria-label="Close calculator"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setCalcTab("dosage")}
              className={cn(
                "rounded-md py-1 transition-colors",
                calcTab === "dosage" ? "bg-surface text-foreground shadow-xs" : "text-foreground-secondary"
              )}
            >
              Dosage (D/H × V)
            </button>
            <button
              type="button"
              onClick={() => setCalcTab("iv")}
              className={cn(
                "rounded-md py-1 transition-colors",
                calcTab === "iv" ? "bg-surface text-foreground shadow-xs" : "text-foreground-secondary"
              )}
            >
              IV Drip Rate
            </button>
          </div>

          {calcTab === "dosage" ? (
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Desired Dose (D)</label>
                <input
                  type="number"
                  step="any"
                  value={desiredDose}
                  onChange={(e) => setDesiredDose(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Dose on Hand (H)</label>
                <input
                  type="number"
                  step="any"
                  value={doseOnHand}
                  onChange={(e) => setDoseOnHand(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Vehicle Quantity (V)</label>
                <input
                  type="number"
                  step="any"
                  value={vehicleQty}
                  onChange={(e) => setVehicleQty(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div className="pt-2 border-t border-border flex justify-between font-bold text-xs text-brand-teal">
                <span>(D / H) × V</span>
                <span className="font-mono">
                  {dosageResult !== null ? `Result: ${dosageResult}` : "Enter H > 0"}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Total Volume (mL)</label>
                <input
                  type="number"
                  step="any"
                  value={ivVolume}
                  onChange={(e) => setIvVolume(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Drop Factor (gtt/mL)</label>
                <input
                  type="number"
                  step="any"
                  value={ivDropFactor}
                  onChange={(e) => setIvDropFactor(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground-secondary">Infusion Time (minutes)</label>
                <input
                  type="number"
                  step="any"
                  value={ivMinutes}
                  onChange={(e) => setIvMinutes(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                />
              </div>
              <div className="pt-2 border-t border-border flex flex-col gap-0.5 font-bold text-xs text-brand-teal">
                <div className="flex justify-between">
                  <span>Manual Flow Rate:</span>
                  <span className="font-mono">
                    {ivResult ? `${ivResult.gttPerMin} gtt/min` : "Enter time > 0"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-foreground-secondary">
                  <span>Pump Rate:</span>
                  <span className="font-mono">
                    {ivResult ? `${ivResult.mlPerHr} mL/hr` : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Examination Canvas */}
      <main className="flex-1 mx-auto max-w-6xl w-full p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
