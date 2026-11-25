"use client";

import * as React from "react";
import { Mail, CheckCircle2, AlertCircle, RefreshCw, LogOut, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useFeedback } from "@/lib/feedback/feedback-context";

interface LearnerVerificationModalProps {
  isOpen: boolean;
  onVerified?: () => void;
  returnTo?: string;
}

export function LearnerVerificationModal({ isOpen, onVerified, returnTo }: LearnerVerificationModalProps) {
  const { user, refresh, signOut } = useAuth();
  const feedback = useFeedback();

  const [resending, setResending] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [resendStatus, setResendStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Cooldown countdown
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Periodic background check every 6s while modal is active
  React.useEffect(() => {
    if (!isOpen || !user) return;

    let active = true;
    const timer = setInterval(async () => {
      if (!active) return;
      try {
        await refresh();
      } catch {
        // Silently ignore background polling errors
      }
    }, 6000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen, user, refresh]);

  // If user becomes verified, trigger callback
  React.useEffect(() => {
    if (user?.emailVerified && isOpen) {
      feedback.showSuccess(
        "Your candidate email has been verified. Welcome to your QuizNurse study sanctuary!",
        "Email Confirmed"
      );
      onVerified?.();
    }
  }, [user?.emailVerified, isOpen, onVerified, feedback]);

  if (!isOpen || !user || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    if (resending || resendCooldown > 0) return;

    setResending(true);
    setStatusMessage(null);
    setResendStatus("idle");

    try {
      const res = await fetch("/api/auth/support/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          userGuidId: user.guidId || user.id,
          action: "resend-verification",
          returnTo: returnTo || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setResendStatus("success");
        setResendCooldown(60);
        setStatusMessage(`A fresh verification link has been dispatched to ${user.email}. Please check your inbox and spam folder.`);
        feedback.showSuccess(`Verification email dispatched to ${user.email}.`, "Verification Sent");
      } else {
        setResendStatus("error");
        const errMsg = data.message || data.error || "Unable to resend verification email. Please try again shortly.";
        setStatusMessage(errMsg);
        feedback.showError(errMsg, "Resend Failed");
      }
    } catch {
      setResendStatus("error");
      setStatusMessage("Network error while requesting verification email. Check your connection.");
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (checking) return;
    setChecking(true);
    setStatusMessage(null);

    try {
      await refresh();
    } catch {
      setStatusMessage("Failed to refresh verification status. Please check your connection.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinical-slate/80 backdrop-blur-md"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-surface-elevated p-6 sm:p-8 shadow-2xl space-y-6 auth-animate-fade-in-up">
        {/* Header Icon with Clinical Warmth Badging */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-clinical-mist text-clinical-teal ring-1 ring-clinical-teal/20 shadow-xs">
          <Mail className="h-8 w-8" />
        </div>

        {/* Title & Poetic Clinical Notice */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-0.5 text-[11px] font-semibold text-clinical-teal">
            <ShieldCheck className="h-3 w-3" />
            Email Verification Required
          </div>
          <h2 id="verification-dialog-title" className="font-brand text-2xl font-bold tracking-tight text-foreground">
            Confirm your candidate email
          </h2>
          <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed">
            Progress is built one step at a time. A small confirmation today brings you closer to the future you&apos;re working towards. Please verify your email address to unlock your full examination access.
          </p>
        </div>

        {/* Account Email Display */}
        <div className="rounded-2xl border border-border bg-clinical-mist/50 p-4 text-center">
          <span className="text-[10px] uppercase tracking-widest text-foreground-muted font-bold block mb-1">
            Registered Nursing Candidate
          </span>
          <span className="font-semibold text-sm sm:text-base text-foreground break-all">
            {user.email || "Your account"}
          </span>
        </div>

        {/* Status Alerts */}
        {resendStatus === "success" && statusMessage && (
          <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="leading-snug">{statusMessage}</p>
          </div>
        )}

        {resendStatus === "error" && statusMessage && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <p className="leading-snug">{statusMessage}</p>
          </div>
        )}

        {/* Helpful Guidance */}
        <div className="rounded-xl border border-border/70 bg-background/50 p-4 text-xs text-foreground-secondary space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-clinical-teal" />
            <span>Next steps for verification:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-foreground-secondary">
            <li>Open the message from QuizNurse in your registered inbox.</li>
            <li>Click the secure link or copy the numerical confirmation code.</li>
            <li>Check your spam or promotion folder if it hasn’t arrived yet.</li>
            <li>Once confirmed, click &ldquo;I&apos;ve Verified My Email&rdquo; below.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          <Button
            type="button"
            size="lg"
            className="w-full h-12 rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg disabled:cursor-not-allowed"
            disabled={checking}
            onClick={handleCheckStatus}
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Status…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {"I've Verified My Email"}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-11 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-clinical-mist/50 transition-all disabled:opacity-60"
            disabled={resending || resendCooldown > 0}
            onClick={handleResend}
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dispatching Verification Link…
              </>
            ) : resendCooldown > 0 ? (
              `Resend available in ${resendCooldown}s`
            ) : (
              "Resend Verification Link"
            )}
          </Button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-foreground-muted hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out or switch candidate account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
