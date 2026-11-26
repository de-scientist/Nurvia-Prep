"use client";

import { useEffect, useState } from "react";
import { clearAuthSessionCookies } from "@/lib/utils/sessions/generateSystemUserSessionCookies";
import {
  sanitizeInternalDestination,
  getAuthReturnContext,
  clearAuthReturnContext,
  subscriptionCart,
  getSubscriptionCart,
} from "@/lib/subscriptions/cart-store";

function formatSocialErrorMessage(rawError?: string | null): string {
  if (!rawError) {
    return "Google sign-in was cancelled or could not be completed. Your selected examination has been preserved.";
  }
  const lower = rawError.toLowerCase();
  if (lower.includes("access_denied") || lower.includes("cancel")) {
    return "Google sign-in was cancelled. You can try again or continue with your email and password.";
  }
  if (lower.includes("state") || lower.includes("expired")) {
    return "Your Google sign-in session expired. Please initiate Google sign-in again.";
  }
  if (lower.includes("link") || lower.includes("conflict") || lower.includes("already")) {
    return "An account with this email already exists under another sign-in method. Please sign in with your password or recover your account.";
  }
  return rawError;
}

export default function SocialCompletePage() {
  const [statusText, setStatusText] = useState("Completing secure Google authentication…");

  useEffect(() => {
    async function completeSession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(window.location.search);

      const badge = (hashParams.get("badge") || searchParams.get("badge") || "").trim();
      const line = (hashParams.get("line") || searchParams.get("line") || "").trim();
      const error = hashParams.get("error") || searchParams.get("error");
      const rawNext =
        hashParams.get("next") ||
        searchParams.get("next") ||
        hashParams.get("returnTo") ||
        searchParams.get("returnTo") ||
        hashParams.get("redirectPath") ||
        searchParams.get("redirectPath");

      // Immediately scrub sensitive hash/query tokens from browser URL history
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        // Ignore history state errors
      }

      // Never expose raw session credentials in browser-accessible cookies
      clearAuthSessionCookies();

      // Resolve validated destination: URL param -> stored pre-OAuth context -> cart context -> /learner
      const urlSafeNext = sanitizeInternalDestination(rawNext);
      const storedCtx = getAuthReturnContext();
      const storedCart = getSubscriptionCart();
      const cartSafeNext = storedCart?.learningContext?.returnTo
        ? sanitizeInternalDestination(storedCart.learningContext.returnTo)
        : null;

      const safeNext = urlSafeNext || storedCtx?.returnTo || cartSafeNext || "/learner";

      if (error || !badge || !line) {
        const errorMsg = formatSocialErrorMessage(error);
        document.cookie = `socialError=${encodeURIComponent(errorMsg)}; path=/; max-age=45; SameSite=Lax`;
        const failureDestination = `/sign-in${
          safeNext && safeNext !== "/learner" ? `?returnTo=${encodeURIComponent(safeNext)}` : ""
        }`;
        window.location.replace(failureDestination);
        return;
      }

      try {
        setStatusText("Establishing secure server session…");
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badge,
            line,
            dashboardName: "web",
            rememberMe: true,
          }),
          credentials: "include",
        });

        const sessionPayload = await res.json().catch(() => ({}));

        if (!res.ok || sessionPayload.success === false) {
          const rejectMsg =
            sessionPayload.message ||
            "Google authentication could not be verified by the security service. Please sign in again.";
          document.cookie = `socialError=${encodeURIComponent(rejectMsg)}; path=/; max-age=45; SameSite=Lax`;
          const failureDestination = `/sign-in${
            safeNext && safeNext !== "/learner" ? `?returnTo=${encodeURIComponent(safeNext)}` : ""
          }`;
          window.location.replace(failureDestination);
          return;
        }

        const verifiedUser = sessionPayload.data as
          | { id?: string; email?: string; role?: string; emailVerified?: boolean }
          | undefined;

        if (verifiedUser?.id) {
          subscriptionCart.bindToAuthenticatedUser({
            id: verifiedUser.id,
            email: verifiedUser.email,
          });
        }

        // Apply email verification requirement if backend indicates unverified account
        if (verifiedUser && verifiedUser.emailVerified === false) {
          setStatusText("Redirecting to candidate email verification…");
          const verifyUrl = `/auth/validate?reason=verification${
            verifiedUser.email ? `&email=${encodeURIComponent(verifiedUser.email)}` : ""
          }&returnTo=${encodeURIComponent(safeNext)}`;
          window.location.replace(verifyUrl);
          return;
        }

        clearAuthReturnContext();
        setStatusText("Returning to your study session…");
        window.location.replace(safeNext);
      } catch (err) {
        console.error("Failed to establish server session after social authentication:", err);
        const netMsg = "Network error while establishing your secure session. Please try again.";
        document.cookie = `socialError=${encodeURIComponent(netMsg)}; path=/; max-age=45; SameSite=Lax`;
        const failureDestination = `/sign-in${
          safeNext && safeNext !== "/learner" ? `?returnTo=${encodeURIComponent(safeNext)}` : ""
        }`;
        window.location.replace(failureDestination);
      }
    }

    void completeSession();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-background p-8">
      <div className="text-center space-y-2.5">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0A6265] border-t-transparent" />
        <p className="text-sm font-semibold text-foreground">{statusText}</p>
      </div>
    </div>
  );
}
