"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Mail,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { resolveValidation } from "@/lib/services/auth/validateService";
import { confirmEmailVerificationCode, resetCredentials } from "@/lib/services/auth/supportService";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  sanitizeInternalDestination,
  getAuthReturnContext,
  saveAuthReturnContext,
  clearAuthReturnContext,
  getSubscriptionCart,
  buildValidatedLearningContext,
} from "@/lib/subscriptions/cart-store";

type Phase = "form" | "checking" | "credentials" | "success" | "error";
type Method = "password" | "pin" | "both";

const EMAIL_REASONS = ["verification", "registration", "login"];
const CRED_REASONS = ["password", "social"];

const REASON_LABEL: Record<string, string> = {
  verification: "Verify my email address",
  registration: "Confirm new candidate account",
  login: "Authorize candidate sign-in",
  password: "Reset account password",
  social: "Establish direct password access",
};

interface Props {
  reason?: string;
  userGuid?: string;
  token?: string;
}

interface Ctx {
  reason: string;
  email: string;
  userGuidId: string;
  code: string;
}

export default function ValidateClient({ reason: reasonProp, userGuid, token }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const { status: authStatus, user: authUser, refresh } = useAuth();
  const isLink = Boolean(reasonProp && userGuid && token);

  const [reason, setReason] = useState(
    (reasonProp ?? params.get("reason") ?? "verification").toLowerCase()
  );
  const [phase, setPhase] = useState<Phase>(isLink ? "checking" : "form");
  const [message, setMessage] = useState("");
  const [ctx, setCtx] = useState<Ctx | null>(null);

  // manual code form
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState(params.get("code") ?? "");

  // resend throttling state
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);

  // credentials form
  const [method, setMethod] = useState<Method>("password");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const ran = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const safeDestination = useMemo(() => {
    const requested =
      params.get("returnTo") || params.get("redirectPath") || params.get("next");
    const track = params.get("track") || params.get("pathway");

    const sanitizedRequested = sanitizeInternalDestination(requested);
    if (sanitizedRequested) {
      try {
        const url = new URL(sanitizedRequested, "https://quiznurse.com");
        if (track && !url.searchParams.has("track") && !url.searchParams.has("pathway")) {
          url.searchParams.set("track", track);
        }
        return `${url.pathname}${url.search}${url.hash}`;
      } catch {
        return sanitizedRequested;
      }
    }

    // Recover persisted destination when verification was opened from an email link without query params
    const identityHint = {
      id: userGuid || ctx?.userGuidId || authUser?.id || null,
      email: ctx?.email || email || authUser?.email || null,
    };
    const storedReturn = getAuthReturnContext(identityHint);
    if (storedReturn?.returnTo) {
      return storedReturn.returnTo;
    }

    const storedCart = getSubscriptionCart(identityHint);
    if (storedCart?.learningContext?.returnTo) {
      const cartDest = sanitizeInternalDestination(storedCart.learningContext.returnTo);
      if (cartDest) return cartDest;
    }

    if (track) return `/learner/library?track=${encodeURIComponent(track)}`;
    return "/learner/library";
  }, [params, userGuid, ctx?.userGuidId, ctx?.email, email, authUser?.id, authUser?.email]);

  const continueLabel = useMemo(() => {
    if (safeDestination.startsWith("/learner/subscription")) {
      return "Continue to Subscription Checkout";
    }
    if (safeDestination.startsWith("/exam-session")) {
      return "Continue to Selected Examination";
    }
    return "Continue to Study Library";
  }, [safeDestination]);

  // Persist URL-supplied returnTo into storage so manual retries or subsequent sign-in never lose it
  useEffect(() => {
    const requested =
      params.get("returnTo") || params.get("redirectPath") || params.get("next");
    const sanitized = sanitizeInternalDestination(requested);
    if (sanitized) {
      saveAuthReturnContext(
        buildValidatedLearningContext({
          returnTo: sanitized,
          ownerUserId: userGuid || authUser?.id,
          ownerEmail: email || authUser?.email,
        })
      );
    }
  }, [params, userGuid, email, authUser?.id, authUser?.email]);

  const fail = (msg: string) => {
    setMessage(msg);
    setPhase("error");
  };

  const run = useCallback(
    async (r: string, rawToken: string, who: { userGuidId?: string; email?: string }) => {
      setPhase("checking");
      setMessage("");

      const resolved = await resolveValidation({ context: r, token: rawToken, ...who });
      if (resolved.error || !resolved.data) {
        fail(resolved.error ?? "This verification link or code is invalid or has already been used.");
        return;
      }

      const c: Ctx = {
        reason: r,
        email: resolved.data.email,
        userGuidId: resolved.data.userGuidId,
        code: rawToken.trim(),
      };
      setCtx(c);

      if (CRED_REASONS.includes(r)) {
        setPhase("credentials");
        return;
      }

      if (EMAIL_REASONS.includes(r)) {
        const res = await confirmEmailVerificationCode(c.userGuidId, c.email, c.code, c.reason);
        if (res.error || res.success === false) {
          fail(
            res.error ??
              res.message ??
              "Email verification could not be completed. Please request a new link."
          );
          return;
        }
        setMessage(res.message ?? "Your email has been verified successfully.");
        setPhase("success");
        return;
      }

      fail("Unknown validation request type.");
    },
    []
  );

  useEffect(() => {
    if (!isLink || ran.current) return;
    ran.current = true;
    void run(reasonProp!.toLowerCase(), token!, { userGuidId: userGuid });
  }, [isLink, reasonProp, token, userGuid, run]);

  useEffect(() => {
    if (isLink || ran.current) return;
    const e = params.get("email");
    const c = params.get("code");
    if (e && c) {
      ran.current = true;
      void run(reason, c, { email: e });
    }
  }, [isLink, params, reason, run]);

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !code.trim()) return;
    void run(reason, code, { email: email.trim() });
  };

  const handleResendVerification = async () => {
    const targetEmail = (ctx?.email || email || authUser?.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setResendFeedback("Enter your candidate email address above so we can send a fresh verification link.");
      return;
    }
    if (resending || resendCooldown > 0) return;

    setResending(true);
    setResendFeedback(null);
    try {
      const res = await fetch("/api/auth/support/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          userGuidId: ctx?.userGuidId || userGuid || authUser?.id || undefined,
          context: "verification",
          action: "resend-verification",
          returnTo: safeDestination,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setResendCooldown(60);
        setResendFeedback(`Verification code sent to ${targetEmail}. Check your inbox and spam folder.`);
      } else {
        setResendFeedback(data.message || data.error || "Unable to resend verification code right now.");
      }
    } catch {
      setResendFeedback("Network error while requesting a new verification code.");
    } finally {
      setResending(false);
    }
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    setFormError("");

    if (method !== "pin") {
      if (password.length < 8) return setFormError("Password must be at least 8 characters long.");
      if (password !== passwordConfirmation) return setFormError("Passwords do not match.");
    }
    if (method !== "password") {
      if (!/^\d{4,24}$/.test(pin)) return setFormError("PIN must be 4 to 24 digits.");
      if (pin !== pinConfirmation) return setFormError("PINs do not match.");
    }

    setSaving(true);
    const res = await resetCredentials({
      userGuidId: ctx.userGuidId,
      email: ctx.email,
      code: ctx.code,
      context: ctx.reason as "password" | "social",
      loginMethod: method,
      password: method !== "pin" ? password : undefined,
      passwordConfirmation: method !== "pin" ? passwordConfirmation : undefined,
      pin: method !== "password" ? pin : undefined,
      pinConfirmation: method !== "password" ? pinConfirmation : undefined,
    });
    setSaving(false);

    if (res.error || res.success === false) {
      setFormError(res.error ?? res.message ?? "Could not update your credentials.");
      return;
    }
    setMessage(res.message ?? "Your credentials were updated successfully.");
    setPhase("success");
  };

  useEffect(() => {
    if (phase === "success") {
      void refresh();
    }
  }, [phase, refresh]);

  useEffect(() => {
    if (phase === "success" && authStatus === "authenticated") {
      const timer = setTimeout(() => {
        clearAuthReturnContext();
        router.push(safeDestination);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [phase, authStatus, router, safeDestination]);

  const signInContinuationHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (safeDestination) qs.set("returnTo", safeDestination);
    const candidateEmail = ctx?.email || email;
    if (candidateEmail) qs.set("email", candidateEmail);
    return `/sign-in?${qs.toString()}`;
  }, [safeDestination, ctx?.email, email]);

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal";

  return (
    <AuthShell mode="verify">
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <ShieldCheck className="h-3.5 w-3.5" />
          Security &amp; Identity Verification
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {REASON_LABEL[reason] ?? "Candidate Verification"}
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Progress is built one step at a time. Verifying your nursing learner credentials ensures uninterrupted access to your selected examination and study mode.
        </p>
      </div>

      {phase === "checking" && (
        <div className="py-8 text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-clinical-teal" />
          <div className="space-y-1">
            <h3 className="font-brand text-lg font-bold text-foreground">Verifying your access token</h3>
            <p className="text-xs text-foreground-secondary">
              Connecting with the candidate registry. This will take just a moment...
            </p>
          </div>
        </div>
      )}

      {phase === "success" && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-1.5">
              <h2 className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                Verification Successful!
              </h2>
              <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                {message || "Your email address has been verified successfully."}
              </p>
            </div>
          </div>

          <div className="pt-1.5">
            {authStatus === "authenticated" ? (
              <div className="space-y-2">
                <Link
                  href={safeDestination}
                  onClick={() => clearAuthReturnContext()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
                >
                  <span>{continueLabel}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-emerald-700/80">
                  Redirecting automatically to your destination...
                </p>
              </div>
            ) : (
              <Link
                href={signInContinuationHref}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
              >
                <span>Sign In to Continue</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm text-rose-950 shadow-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="space-y-1.5">
              <h2 className="font-bold text-base text-rose-900 dark:text-rose-200">
                Verification Incomplete
              </h2>
              <p className="text-xs leading-relaxed text-rose-800/90 dark:text-rose-300/90">{message}</p>
            </div>
          </div>

          {resendFeedback && (
            <p className="text-xs font-medium text-clinical-teal bg-white/80 dark:bg-slate-900/60 rounded-lg p-2.5 border border-border">
              {resendFeedback}
            </p>
          )}

          <div className="flex flex-col gap-2.5 pt-1.5 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                ran.current = true;
                setPhase("form");
                setMessage("");
              }}
              className="flex-1 h-11 rounded-xl border border-border bg-white dark:bg-surface px-4 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
            >
              Enter Code Manually
            </button>
            {EMAIL_REASONS.includes(reason) ? (
              <button
                type="button"
                disabled={resending || resendCooldown > 0}
                onClick={() => void handleResendVerification()}
                className="flex-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-clinical-teal px-4 text-xs font-semibold text-white hover:bg-clinical-tealHover transition-all disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>
                  {resending
                    ? "Sending…"
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Verification"}
                </span>
              </button>
            ) : (
              <Link
                href="/forgot-password"
                className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-clinical-teal px-4 text-xs font-semibold text-white hover:bg-clinical-tealHover transition-all"
              >
                Request New Link
              </Link>
            )}
          </div>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={submitCode} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Verification Action
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            >
              {Object.entries(REASON_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Candidate Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nurse@example.com"
                className={`${inputClass} pl-10`}
              />
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Verification Code
              </label>
              {EMAIL_REASONS.includes(reason) && (
                <button
                  type="button"
                  disabled={resending || resendCooldown > 0}
                  onClick={() => void handleResendVerification()}
                  className="text-xs font-semibold text-clinical-teal hover:underline disabled:opacity-50"
                >
                  {resending
                    ? "Sending code…"
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend code"}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="Paste numerical or alpha code"
                className={`${inputClass} font-mono tracking-widest pl-10`}
              />
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
            <p className="text-[11px] text-foreground-muted">
              Check the confirmation message sent to your registered inbox.
            </p>
            {resendFeedback && (
              <p className="text-xs font-medium text-clinical-teal pt-0.5">{resendFeedback}</p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
          >
            <span>Confirm Verification Code</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      {phase === "credentials" && ctx && (
        <form onSubmit={submitCredentials} className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Verified candidate identity for {ctx.email}. Please set your credentials below.</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Login Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={inputClass}
            >
              <option value="password">Password (Recommended)</option>
              <option value="pin">Security PIN</option>
              <option value="both">Both Password and PIN</option>
            </select>
          </div>

          {method !== "pin" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={64}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={64}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {method !== "password" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Security PIN (4 to 24 digits)
                </label>
                <input
                  inputMode="numeric"
                  maxLength={24}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter digits only"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Confirm PIN
                </label>
                <input
                  inputMode="numeric"
                  maxLength={24}
                  value={pinConfirmation}
                  onChange={(e) => setPinConfirmation(e.target.value.replace(/\D/g, ""))}
                  placeholder="Repeat your PIN"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={saving}
            isLoading={saving}
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
          >
            <span>Save &amp; Access Study Sanctuary</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Return to{" "}
        <Link
          href={signInContinuationHref}
          className="font-semibold text-clinical-teal underline-offset-4 hover:underline"
        >
          Sign In
        </Link>{" "}
        or{" "}
        <Link href="/faq" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Get Support
        </Link>
      </p>
    </AuthShell>
  );
}
