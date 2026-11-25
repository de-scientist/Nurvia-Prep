"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock, Eye, EyeOff, KeyRound, ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [token, setToken] = React.useState(tokenFromUrl);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (tokenFromUrl && !token) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl, token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError("A valid password reset token is required. Please check your reset link.");
      return;
    }
    if (newPassword.length < 12) {
      setError("Please choose a password with at least 12 characters for your protection.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords you entered do not match. Please verify them.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await nurviaApi.resetPassword({
        token: token.trim(),
        newPassword,
      });
      if (!response.success) {
        setError(response.message || "This password reset token has expired or is invalid. Please request a new link.");
        return;
      }
      setSuccessMessage(
        response.message || "Your password has been successfully updated. You may now sign in."
      );
    } catch {
      setError("Unable to communicate with the authentication service. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Credential Reset
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Set your new password
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Sometimes we pause, sometimes we lose our way. What matters is finding the courage to begin again. Create a strong, memorable password to secure your progress.
        </p>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-sm text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                Password updated successfully
              </p>
              <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                {successMessage}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/sign-in"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!tokenFromUrl && (
            <div className="space-y-1.5">
              <label htmlFor="reset-token" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Reset verification token
              </label>
              <div className="relative">
                <input
                  id="reset-token"
                  name="token"
                  type="text"
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste your reset code or token"
                  className="h-12 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                name="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 12 characters"
                className="h-12 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-foreground-muted">
              Use a minimum of 12 characters combining letters, numbers, and symbols.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                className="h-12 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
            isLoading={submitting}
            disabled={submitting}
          >
            <span>Update Password & Re-enter</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="pt-2 text-center text-xs text-foreground-muted">
            Remembered your previous password?{" "}
            <Link href="/sign-in" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
              Sign in directly
            </Link>
          </p>
        </form>
      )}

      <p className="mt-6 border-t border-border pt-5 text-center text-sm text-foreground-secondary">
        Need assistance with your account?{" "}
        <Link href="/faq" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Visit Candidate Support
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell mode="reset-password">
      <React.Suspense
        fallback={
          <div className="py-12 text-center text-sm text-foreground-secondary">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-clinical-teal border-t-transparent" />
            <p className="mt-3">Preparing credential reset session...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </React.Suspense>
    </AuthShell>
  );
}
