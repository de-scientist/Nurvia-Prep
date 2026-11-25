"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { resolveValidation } from "@/lib/services/auth/validateService";
import { confirmEmailVerificationCode, resetCredentials } from "@/lib/services/auth/supportService";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

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
  const { status: authStatus, refresh } = useAuth();
  const isLink = Boolean(reasonProp && userGuid && token);

  const safeDestination = useMemo(() => {
    const requested = params.get("returnTo");
    const track = params.get("track") || params.get("pathway");

    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      try {
        const url = new URL(requested, "http://localhost");
        if (!["/sign-in", "/sign-up", "/access-denied"].includes(url.pathname)) {
          if (track && !url.searchParams.has("track") && !url.searchParams.has("pathway")) {
            url.searchParams.set("track", track);
          }
          return `${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        // Ignore parse errors
      }
    }
    if (track) return `/learner/library?track=${encodeURIComponent(track)}`;
    return "/learner/library";
  }, [params]);

  const [reason, setReason] = useState(
    (reasonProp ?? params.get("reason") ?? "verification").toLowerCase()
  );
  const [phase, setPhase] = useState<Phase>(isLink ? "checking" : "form");
  const [message, setMessage] = useState("");
  const [ctx, setCtx] = useState<Ctx | null>(null);

  // manual code form
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState(params.get("code") ?? "");

  // credentials form
  const [method, setMethod] = useState<Method>("password");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const ran = useRef(false);

  const fail = (msg: string) => {
    setMessage(msg);
    setPhase("error");
  };

  const run = useCallback(async (r: string, token: string, who: { userGuidId?: string; email?: string }) => {
    setPhase("checking");
    setMessage("");

    const resolved = await resolveValidation({ context: r, token, ...who });
    if (resolved.error || !resolved.data) {
      fail(resolved.error ?? "This verification link or code is invalid or has already been used.");
      return;
    }

    const c: Ctx = {
      reason: r,
      email: resolved.data.email,
      userGuidId: resolved.data.userGuidId,
      code: token.trim(),
    };
    setCtx(c);

    if (CRED_REASONS.includes(r)) {
      setPhase("credentials");
      return;
    }

    if (EMAIL_REASONS.includes(r)) {
      const res = await confirmEmailVerificationCode(c.userGuidId, c.email, c.code, c.reason);
      if (res.error || res.success === false) {
        fail(res.error ?? res.message ?? "Email verification could not be completed. Please request a new link.");
        return;
      }
      setMessage(res.message ?? "Your email has been verified successfully. Welcome to the study library!");
      setPhase("success");
      return;
    }

    fail("Unknown validation request type.");
  }, []);

  useEffect(() => {
    if (!isLink || ran.current) return;
    ran.current = true;
    run(reasonProp!.toLowerCase(), token!, { userGuidId: userGuid });
  }, [isLink, reasonProp, token, userGuid, run]);

  useEffect(() => {
    if (isLink || ran.current) return;
    const e = params.get("email");
    const c = params.get("code");
    if (e && c) {
      ran.current = true;
      run(reason, c, { email: e });
    }
  }, [isLink, params, reason, run]);

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !code.trim()) return;
    run(reason, code, { email });
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
      if (authStatus === "authenticated") {
        const timer = setTimeout(() => {
          router.push(safeDestination);
        }, 2200);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, authStatus, refresh, router, safeDestination]);

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal";

  return (
    <AuthShell mode="verify">
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <ShieldCheck className="h-3.5 w-3.5" />
          Security & Identity Verification
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {REASON_LABEL[reason] ?? "Candidate Verification"}
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Progress is built one step at a time. A small confirmation today brings you closer to the future you&apos;re working towards. Verifying your nursing learner credentials ensures secure access to curriculum simulations.
        </p>
      </div>

      {phase === "checking" && (
        <div className="py-8 text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-clinical-teal" />
          <div className="space-y-1">
            <h3 className="font-brand text-lg font-bold text-foreground">
              Verifying your access token
            </h3>
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
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
                >
                  <span>Continue to Study Library</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-emerald-700/80">
                  Redirecting automatically in a moment...
                </p>
              </div>
            ) : (
              <Link
                href={`/sign-in?returnTo=${encodeURIComponent(safeDestination)}${ctx?.email ? `&email=${encodeURIComponent(ctx.email)}` : ""}`}
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
              <p className="text-xs leading-relaxed text-rose-800/90 dark:text-rose-300/90">
                {message}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1.5 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                ran.current = true;
                setPhase("form");
                setMessage("");
              }}
              className="flex-1 h-11 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
            >
              Enter Code Manually
            </button>
            <Link
              href="/forgot-password"
              className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-clinical-teal px-4 text-xs font-semibold text-white hover:bg-clinical-tealHover transition-all"
            >
              Request New Link
            </Link>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Verification Code
            </label>
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
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
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
            <span>Save & Access Study Sanctuary</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Return to{" "}
        <Link href="/sign-in" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
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
