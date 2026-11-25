"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please provide your candidate email address.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await nurviaApi.forgotPassword({ email: email.trim() });
      if (!response.success) {
        setError(response.message || "We could not process this password reset request right now.");
        return;
      }
      setSubmittedMessage(
        response.message ||
          "If an account with that email exists in our registry, a secure reset link has been dispatched to your inbox."
      );
    } catch {
      setError("Unable to reach the authentication service. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell mode="forgot-password">
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Account Recovery
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Recover your access
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Sometimes we pause, sometimes we lose our way. What matters is finding the courage to begin again. Enter your registered email to receive recovery instructions.
        </p>
      </div>

      {submittedMessage ? (
        <div
          role="status"
          className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                Recovery instructions sent
              </p>
              <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                {submittedMessage}
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 pt-1">
                Be sure to check both your inbox and spam folder. The link will remain active for 60 minutes.
              </p>
            </div>
          </div>

          <div className="pt-1.5">
            <Link
              href="/sign-in"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Candidate email address
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@nursing.edu"
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
            isLoading={submitting}
            disabled={submitting}
          >
            <span>Send Recovery Instructions</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="pt-1.5 text-center text-xs text-foreground-muted">
            Remembered your credentials?{" "}
            <Link href="/sign-in" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
              Return to sign in
            </Link>
          </p>
        </form>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Don’t have an account yet?{" "}
        <Link href="/sign-up" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Create a learner profile
        </Link>
      </p>
    </AuthShell>
  );
}
