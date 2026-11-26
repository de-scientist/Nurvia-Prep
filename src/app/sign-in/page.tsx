"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { RedirectScreen } from "@/components/shared/feedback/RedirectScreen";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";
import {
  sanitizeInternalDestination,
  getAuthReturnContext,
  saveAuthReturnContext,
  clearAuthReturnContext,
  subscriptionCart,
  buildValidatedLearningContext,
} from "@/lib/subscriptions/cart-store";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultDestination(role: string) {
  if (role === "Learner") return "/learner";
  if (["Author", "Reviewer", "Publisher", "Administrator", "Superadmin"].includes(role)) {
    return "/admin";
  }
  return "/access-denied";
}

function safeReturnTo() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("returnTo") || params.get("redirectPath") || params.get("next");
  const track = params.get("track") || params.get("pathway");

  const cleanRequested = sanitizeInternalDestination(requested);
  if (cleanRequested) {
    try {
      const destination = new URL(cleanRequested, window.location.origin);
      if (track && !destination.searchParams.has("track") && !destination.searchParams.has("pathway")) {
        destination.searchParams.set("track", track);
      }
      return `${destination.pathname}${destination.search}${destination.hash}`;
    } catch {
      return cleanRequested;
    }
  }

  const storedCtx = getAuthReturnContext();
  if (storedCtx?.returnTo) {
    return storedCtx.returnTo;
  }

  if (track) return `/learner/library?track=${encodeURIComponent(track)}`;
  return null;
}

function formatServerLoginError(errorCode?: string, message?: string): string {
  switch (errorCode) {
    case "CHALLENGE_REQUIRED":
      return "A verification challenge is required by the security service. Please contact our support team.";
    case "CHALLENGE_REJECTED":
      return "Sign-in challenge was rejected by the security service. Please refresh and try again.";
    case "CHALLENGE_EXPIRED":
      return "Your sign-in verification session expired. Please enter your credentials again.";
    case "INVALID_CREDENTIALS":
      return message || "We couldn't find an account matching that email and password. Please double-check your entries or reset your password.";
    case "BACKEND_ERROR":
    case "NETWORK_ERROR":
    case "TIMEOUT":
      return message || "Our authentication service is momentarily unreachable. Please take a breath and try again shortly.";
    default:
      return message || "Unable to sign in. Please check your credentials and try again.";
  }
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

export default function SignInPage() {
  const router = useRouter();
  const { status, user, signIn } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const completedSignIn = React.useRef(false);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
      if (match) {
        setError(decodeURIComponent(match[1]));
        document.cookie = "socialError=; path=/; max-age=0";
      }
    }
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const prefillEmail = sp.get("email");
      if (prefillEmail && !email) {
        setEmail(prefillEmail);
      }
      const urlReturn = sanitizeInternalDestination(
        sp.get("returnTo") || sp.get("redirectPath") || sp.get("next")
      );
      if (urlReturn) {
        saveAuthReturnContext(
          buildValidatedLearningContext({
            returnTo: urlReturn,
            ownerEmail: prefillEmail || undefined,
          })
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (status === "authenticated" && user && !completedSignIn.current) {
      router.replace(safeReturnTo() || defaultDestination(user.role));
    }
  }, [status, user, router]);

  if (status === "loading") {
    return (
      <RedirectScreen
        heading="Opening your clinical workspace"
        description="Please wait while we verify your credentials and prepare your study environment."
      />
    );
  }

  async function handleGoogleSignIn() {
    if (submitting || socialLoading) return;
    setSocialLoading(true);
    setError(null);

    try {
      const returnTarget = safeReturnTo() || "/learner";
      await redirectToSocialProvider({
        provider: "google",
        context: "login",
        role: "Learner",
        dashboardName: "web",
        redirectPath: returnTarget,
      });
    } catch {
      setSocialLoading(false);
      setError("Unable to initiate Google sign-in. Please try again or use your email and password.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || socialLoading) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please provide a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setSubmitting(true);
    const response = await signIn({
      email: trimmedEmail,
      password,
      loginMethod: "password",
      LoginProvider: "email",
      rememberMe,
    });
    setSubmitting(false);

    if (!response.success || !response.data) {
      setError(formatServerLoginError(response.errorCode, response.message));
      return;
    }

    completedSignIn.current = true;
    subscriptionCart.bindToAuthenticatedUser({
      id: response.data.id,
      email: response.data.email,
    });
    const dest = safeReturnTo() || defaultDestination(response.data.role);
    if (response.data.emailVerified !== false) {
      clearAuthReturnContext();
    }
    router.replace(dest);
  }

  return (
    <AuthShell mode="sign-in">
      {/* Editorial Form Header */}
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Candidate Sign-In
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back to QuizNurse
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          The pages may be many, and the road may be long. But every lesson learned makes your purpose stronger. Welcome back. Your next chapter is waiting.
        </p>
      </div>

      {status === "error" && !error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>We couldn’t reach your study session. Please verify your connection and try again.</span>
        </div>
      )}

      {/* Google Authentication */}
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || socialLoading}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-clinical-teal/60 hover:bg-clinical-mist/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface dark:hover:bg-surface-muted"
        >
          <GoogleIcon className="h-5 w-5" />
          <span>{socialLoading ? "Connecting securely to Google..." : "Continue with Google"}</span>
        </button>

        <div className="relative flex items-center justify-center py-0.5">
          <div className="w-full border-t border-border" />
          <span className="relative bg-surface-elevated px-3 text-xs sm:text-[13px] font-medium text-foreground-muted whitespace-nowrap">
            or sign in with email
          </span>
          <div className="w-full border-t border-border" />
        </div>
      </div>

      {/* Primary Credentials Form */}
      <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3">
        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
            Email address
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="candidate@nursing.edu"
              className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal focus-visible:border-clinical-teal"
            />
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-clinical-teal underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal focus-visible:border-clinical-teal"
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
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal focus-visible:ring-2 focus-visible:ring-clinical-teal"
            />
            <span className="text-xs text-foreground-secondary">
              Keep me signed in on this device
            </span>
          </label>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Primary Action Button */}
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
          isLoading={submitting}
          disabled={submitting || socialLoading}
        >
          <span>Sign In to Study Workspace</span>
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>

      {/* Switch to Registration */}
      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        New to QuizNurse?{" "}
        <Link
          href={
            typeof window !== "undefined" && window.location.search
              ? `/sign-up${window.location.search}`
              : "/sign-up"
          }
          className="font-semibold text-clinical-teal underline-offset-4 hover:underline"
        >
          Create your learner account
        </Link>
      </p>
    </AuthShell>
  );
}
