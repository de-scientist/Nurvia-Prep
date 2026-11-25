"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, User, Mail, ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PhoneCountryInput } from "@/components/auth/phone-country-input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { RedirectScreen } from "@/components/shared/feedback";
import { nurviaApi } from "@/lib/api-client";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneNumber, type CountryCode } from "@/lib/phone";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "password"
  | "confirmation"
  | "agree";

function formatServerRegisterError(message?: string, errors?: string[], errorCode?: string): string {
  const combined = [message, ...(errors || [])].filter(Boolean).join(" ");
  if (errorCode === "CHALLENGE_REQUIRED" || /the challenge field is required|challenge.*required/i.test(combined)) {
    return "Account registration requires security verification challenge, which is currently being provisioned.";
  }
  if (errorCode === "CHALLENGE_REJECTED" || /deslizar|ultimatum\s+turmoil/i.test(combined)) {
    return "Registration security verification challenge could not be validated. Please refresh and try again.";
  }
  if (errorCode === "CHALLENGE_EXPIRED") {
    return "Your registration session has expired. Please refresh the page and submit again.";
  }
  if (Array.isArray(errors) && errors.length > 0 && errors[0] !== message) {
    return `${message || "Unable to create your account."} (${errors[0]})`;
  }
  return message || "We were unable to create your account right now. Please review your details and try again.";
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const { status, user } = useAuth();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phoneCountry, setPhoneCountry] = React.useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [signInHref, setSignInHref] = React.useState("/sign-in");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("returnTo");
    const track = params.get("track") || params.get("pathway");

    if (requested?.startsWith("/")) {
      try {
        const destination = new URL(requested, window.location.origin);
        if (
          destination.origin === window.location.origin &&
          !["/sign-in", "/sign-up", "/access-denied"].includes(destination.pathname)
        ) {
          if (track && !destination.searchParams.has("track") && !destination.searchParams.has("pathway")) {
            destination.searchParams.set("track", track);
          }
          setSignInHref(
            `/sign-in?returnTo=${encodeURIComponent(`${destination.pathname}${destination.search}${destination.hash}`)}`
          );
        }
      } catch {
        setSignInHref("/sign-in");
      }
    } else if (track) {
      setSignInHref(`/sign-in?returnTo=${encodeURIComponent(`/learner/library?track=${encodeURIComponent(track)}`)}`);
    }

    if (status === "authenticated" && user) {
      const targetDestination = requested?.startsWith("/")
        ? requested
        : track
          ? `/learner/library?track=${encodeURIComponent(track)}`
          : "/learner";
      router.replace(user.role === "Learner" ? targetDestination : "/access-denied");
    }
  }, [status, user, router]);

  const clearFieldError = React.useCallback((key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  function validateForm(): {
    errors: Partial<Record<FieldKey, string>>;
    normalizedPhone?: string;
  } {
    const errors: Partial<Record<FieldKey, string>> = {};

    if (name.trim().length < 2) {
      errors.name = "Please enter your full name (at least 2 characters).";
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Please provide a valid email address.";
    }

    const phoneResult = normalizePhoneNumber(phone, phoneCountry, { allowPossible: true });
    if (!phoneResult.valid || !phoneResult.e164) {
      errors.phone = phoneResult.error || "Please enter a valid mobile number.";
    }

    if (password.length < 12) {
      errors.password = "Your password must be at least 12 characters long.";
    }
    if (confirmation !== password) {
      errors.confirmation = "Passwords do not match.";
    }

    if (!agree) {
      errors.agree = "Please accept the Terms of Service and Privacy Policy to continue.";
    }

    return { errors, normalizedPhone: phoneResult.e164 };
  }

  async function handleGoogleSignUp() {
    if (submitting || socialLoading) return;
    setSocialLoading(true);
    setServerError(null);

    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const requested = params.get("returnTo");
      const track = params.get("track") || params.get("pathway");
      const target = requested?.startsWith("/") ? requested : track ? `/learner/library?track=${encodeURIComponent(track)}` : "/learner";

      await redirectToSocialProvider({
        provider: "google",
        context: "register",
        role: "Learner",
        dashboardName: "web",
        redirectPath: target,
      });
    } catch {
      setSocialLoading(false);
      setServerError("Unable to initiate Google registration. Please register with your email or try again shortly.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || socialLoading) return;

    setServerError(null);
    const { errors, normalizedPhone } = validateForm();
    if (Object.keys(errors).length > 0 || !normalizedPhone) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    const response = await nurviaApi.register({
      username: name.trim(),
      email: email.trim(),
      phone: normalizedPhone,
      password,
      passwordConfirmation: confirmation,
      loginMethod: "password",
      provider: "email",
      agree,
    });
    setSubmitting(false);

    if (!response.success) {
      setServerError(formatServerRegisterError(response.message, response.errors, response.errorCode));
      return;
    }

    // Automatically initiate email-verification process for new learner
    try {
      const userObj = response.data as Record<string, unknown> | undefined;
      const userGuidId = userObj && typeof userObj === "object" ? String(userObj.guidId || userObj.id || "") || undefined : undefined;
      void fetch("/api/auth/support/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          userGuidId,
          action: "resend-verification",
        }),
      });
    } catch {
      // Non-blocking dispatch
    }

    setSuccess(true);
  }

  if (status === "loading") {
    return (
      <RedirectScreen
        heading="Preparing your registration"
        description="Please wait while we connect securely with the QuizNurse learning gateway."
      />
    );
  }

  return (
    <AuthShell mode="sign-up">
      {/* Editorial Form Header */}
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Candidate Registration
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Begin your nursing journey
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Every great nurse was once a student with a dream, a question and the courage to begin. Your journey deserves a beautiful beginning.
        </p>
      </div>

      {success ? (
        <div
          role="status"
          className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-sm text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                Welcome to QuizNurse!
              </p>
              <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                Your account has been created. A verification message has been sent to{" "}
                <span className="font-semibold underline">{email}</span>. Confirm your email to unlock all practice sets and study metrics.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <Link
              href={signInHref}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinical-teal px-5 text-sm font-semibold text-white shadow-md transition-all hover:bg-clinical-tealHover"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Primary Google Registration Action */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={submitting || socialLoading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-clinical-teal/60 hover:bg-clinical-mist/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface dark:hover:bg-surface-muted"
          >
            <GoogleIcon className="h-5 w-5" />
            <span>{socialLoading ? "Connecting securely to Google..." : "Continue with Google"}</span>
          </button>

          <div className="relative flex items-center justify-center py-0.5">
            <div className="w-full border-t border-border" />
            <span className="relative bg-surface-elevated px-3 text-xs sm:text-[13px] font-medium text-foreground-muted whitespace-nowrap">
              or create account with email
            </span>
            <div className="w-full border-t border-border" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-2.5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Full name
              </label>
              <div className="relative">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                  }}
                  placeholder="Nurse Taylor, RN candidate"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-xl border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal",
                    fieldErrors.name ? "border-rose-500 focus-visible:ring-rose-500" : "border-border"
                  )}
                />
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
              {fieldErrors.name && (
                <p id="name-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
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
                  maxLength={320}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="taylor@nursing.edu"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-xl border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal",
                    fieldErrors.email ? "border-rose-500 focus-visible:ring-rose-500" : "border-border"
                  )}
                />
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Mobile Phone Number */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Mobile phone number
              </label>
              <PhoneCountryInput
                id="phone"
                value={phone}
                country={phoneCountry}
                onCountryChange={(code) => {
                  setPhoneCountry(code);
                  clearFieldError("phone");
                }}
                onChange={(val) => {
                  setPhone(val);
                  clearFieldError("phone");
                }}
                error={fieldErrors.phone}
              />
              {fieldErrors.phone ? (
                <p id="phone-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors.phone}
                </p>
              ) : (
                <p id="phone-hint" className="text-[11px] text-foreground-muted">
                  Used for account protection and high-priority examination alerts.
                </p>
              )}
            </div>

            {/* Passwords in 2 Columns on desktop */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    maxLength={256}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearFieldError("password");
                    }}
                    placeholder="Min 12 characters"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    className={cn(
                      "h-11 w-full rounded-xl border bg-background px-3.5 pr-10 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal",
                      fieldErrors.password ? "border-rose-500 focus-visible:ring-rose-500" : "border-border"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmation" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Confirm password
                </label>
                <input
                  id="confirmation"
                  name="confirmation"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  maxLength={256}
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    clearFieldError("confirmation");
                  }}
                  placeholder="Repeat password"
                  aria-invalid={Boolean(fieldErrors.confirmation)}
                  aria-describedby={fieldErrors.confirmation ? "confirmation-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-xl border bg-background px-3.5 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal",
                    fieldErrors.confirmation ? "border-rose-500 focus-visible:ring-rose-500" : "border-border"
                  )}
                />
                {fieldErrors.confirmation && (
                  <p id="confirmation-error" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    {fieldErrors.confirmation}
                  </p>
                )}
              </div>
            </div>

            {/* Terms Agreement Checkbox */}
            <div className="space-y-1 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  id="agree"
                  name="agree"
                  type="checkbox"
                  required
                  checked={agree}
                  onChange={(event) => {
                    setAgree(event.target.checked);
                    clearFieldError("agree");
                  }}
                  aria-invalid={Boolean(fieldErrors.agree)}
                  aria-describedby={fieldErrors.agree ? "agree-error" : undefined}
                  className="mt-0.5 h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <span className="text-xs leading-relaxed text-foreground-secondary">
                  I agree to the QuizNurse{" "}
                  <Link href="/terms" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.agree && (
                <p id="agree-error" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors.agree}
                </p>
              )}
            </div>

            {/* Server Error Alert */}
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span className="leading-snug">{serverError}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
              isLoading={submitting}
              disabled={submitting || socialLoading}
            >
              <span>Create Candidate Account</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Switch to Sign In */}
      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Already have a learner profile?{" "}
        <Link href={signInHref} className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
