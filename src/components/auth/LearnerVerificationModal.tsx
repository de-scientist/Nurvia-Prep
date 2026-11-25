"use client";

import * as React from "react";
import { Mail, CheckCircle2, AlertCircle, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useFeedback } from "@/lib/feedback/feedback-context";

interface LearnerVerificationModalProps {
  isOpen: boolean;
  onVerified?: () => void;
}

export function LearnerVerificationModal({ isOpen, onVerified }: LearnerVerificationModalProps) {
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
      feedback.showSuccess("Your email address has been verified successfully. Welcome to the Study Library!", "Email Verified");
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
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setResendStatus("success");
        setResendCooldown(60);
        setStatusMessage(`A new verification link has been sent to ${user.email}. Please check your inbox and spam folder.`);
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
      // user.emailVerified will be updated by refresh() in context
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
        {/* Header Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
          <Mail className="h-7 w-7" />
        </div>

        {/* Title & Description */}
        <div className="text-center space-y-2">
          <h2 id="verification-dialog-title" className="font-brand text-xl font-bold text-foreground">
            Email Verification Required
          </h2>
          <p className="text-xs text-foreground-secondary leading-relaxed">
            To protect your learning account and ensure secure access to the Study Library,
            please verify your email address.
          </p>
        </div>

        {/* Account Email Display */}
        <div className="rounded-xl border border-border bg-surface-muted/60 p-3 text-center">
          <span className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold block mb-0.5">
            Registered Account
          </span>
          <span className="font-medium text-xs sm:text-sm text-foreground break-all">
            {user.email || "Your account"}
          </span>
        </div>

        {/* Status Alerts */}
        {resendStatus === "success" && statusMessage && (
          <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <p className="leading-snug">{statusMessage}</p>
          </div>
        )}

        {resendStatus === "error" && statusMessage && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 p-3 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <p className="leading-snug">{statusMessage}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-[11px] text-foreground-secondary space-y-1 bg-surface-muted/30 p-3 rounded-lg border border-border/50">
          <p className="font-semibold text-foreground">Next steps:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Click the verification link sent to your inbox.</li>
            <li>If you do not see it, check your spam or junk folder.</li>
            <li>After verifying, click &quot;Check Verification Status&quot; below.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full text-xs font-semibold"
            disabled={checking}
            onClick={handleCheckStatus}
          >
            {checking ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Checking Status…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                I&apos;ve Verified My Email
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full text-xs font-medium"
            disabled={resending || resendCooldown > 0}
            onClick={handleResend}
          >
            {resending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Sending Link…
              </>
            ) : resendCooldown > 0 ? (
              `Resend available in ${resendCooldown}s`
            ) : (
              "Resend Verification Email"
            )}
          </Button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-[11px] text-foreground-muted hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign out / switch account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
