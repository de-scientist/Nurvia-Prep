"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/config/config";
import {
  subscriptionCart,
  getSubscriptionCart,
  clearSubscriptionCart,
  clearAuthReturnContext,
  buildValidatedLearningContext,
} from "@/lib/subscriptions/cart-store";
import { useAuth } from "@/components/auth/auth-provider";
import { feedback } from "@/lib/feedback/feedback-context";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

type CallbackResolutionState =
  | "verifying"
  | "provisioned"
  | "pending"
  | "entitlement_lacking"
  | "cancelled"
  | "failed"
  | "expired";

function classifyInitialStatus(rawStatus?: string | null): CallbackResolutionState {
  const s = (rawStatus || "").trim().toLowerCase();
  if (s === "cancel" || s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "failed" || s === "failure" || s === "error" || s === "declined") return "failed";
  if (s === "expired" || s === "timeout") return "expired";
  return "verifying";
}

function SubscriptionPackageCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const provider = (searchParams.get("provider") ?? "").toLowerCase();
  const subscriptionId = searchParams.get("subscriptionId") ?? undefined;
  const rawStatus = searchParams.get("status");
  const sessionId = searchParams.get("session_id") ?? searchParams.get("reference") ?? searchParams.get("trxref") ?? undefined;

  const isCancel = rawStatus === "cancel" || rawStatus === "cancelled" || rawStatus === "canceled";

  // Recover and validate learning context from URL search params or persistent cart
  const urlReturnTo = searchParams.get("returnTo");
  const urlRequiredMode = searchParams.get("requiredMode");
  const urlPathway = searchParams.get("pathway");
  const urlSubject = searchParams.get("subject");
  const urlExamId = searchParams.get("examId");
  const urlLayout = searchParams.get("layout");
  const urlAttemptId = searchParams.get("attemptId");

  const [savedCart] = useState(() =>
    getSubscriptionCart(user ? { id: user.id, email: user.email } : null)
  );
  const storedCtx = savedCart?.learningContext;

  const validatedContext = useMemo(() => {
    return buildValidatedLearningContext({
      returnTo: urlReturnTo || storedCtx?.returnTo,
      requiredMode: urlRequiredMode || storedCtx?.requiredMode || "Exam",
      examId: urlExamId || storedCtx?.examId,
      pathway: urlPathway || storedCtx?.pathway || "RN",
      subject: urlSubject || storedCtx?.subject,
      layout: urlLayout || storedCtx?.layout,
      attemptId: urlAttemptId || storedCtx?.attemptId,
      ownerUserId: user?.id,
      ownerEmail: user?.email,
    });
  }, [
    urlReturnTo,
    urlRequiredMode,
    urlExamId,
    urlPathway,
    urlSubject,
    urlLayout,
    urlAttemptId,
    storedCtx,
    user?.id,
    user?.email,
  ]);

  const safeReturnTo = validatedContext.returnTo || null;
  const requiredMode = validatedContext.requiredMode;
  const pathway = validatedContext.pathway || "RN";
  const subject = validatedContext.subject;
  const examId = validatedContext.examId;

  const [resolutionState, setResolutionState] = useState<CallbackResolutionState>(() =>
    classifyInitialStatus(rawStatus)
  );
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [autoRedirectSeconds, setAutoRedirectSeconds] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const verifyBackendProvisioning = useCallback(
    async (options?: { maxPolls?: number; isManual?: boolean }) => {
      const maxPolls = options?.maxPolls ?? 5;
      if (options?.isManual) {
        setManualRefreshing(true);
      }
      setResolutionState("verifying");

      for (let attempt = 1; attempt <= maxPolls; attempt++) {
        try {
          setVerifyMessage(
            attempt === 1
              ? "Confirming payment and subscription provisioning with the backend…"
              : `Verifying subscription activation (${attempt}/${maxPolls})…`
          );

          const pathParam = pathway ? `&pathway=${encodeURIComponent(pathway)}` : "";
          const res = await fetch(
            `/api/subscriptions/status?mode=${encodeURIComponent(requiredMode)}${pathParam}`,
            { headers: { "Cache-Control": "no-store" } }
          );
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.status === "Active" && data.allowed === true) {
            // Confirm selected examination remains valid if examId is present
            let targetDestination = safeReturnTo;
            if (examId && targetDestination?.startsWith("/exam-session")) {
              try {
                const examRes = await fetch(`/api/study-library/${encodeURIComponent(examId)}`, {
                  headers: { "Cache-Control": "no-store" },
                });
                if (examRes.status === 404) {
                  targetDestination = `/learner/library?track=${encodeURIComponent(pathway)}`;
                }
              } catch {
                // Network glitch checking study set should not discard valid safeReturnTo
              }
            }

            const refKey = sessionId || subscriptionId || `${data.planName || "sub"}:${examId || "general"}`;
            const alreadyHandled = subscriptionCart.recordProvisionedReference(refKey);

            setActivePlanName(data.planName || savedCart?.name || "Active Subscription");
            setResolutionState("provisioned");
            setVerifyMessage("Subscription verified and provisioned! Returning to your examination…");

            clearSubscriptionCart();
            clearAuthReturnContext();

            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("nurvia:subscription-updated"));
            }

            if (!alreadyHandled) {
              feedback.success(
                `Your ${data.planName || "QuizNurse"} subscription is active! Launching ${requiredMode} Mode…`,
                "Subscription Activated"
              );
            }

            if (targetDestination) {
              setAutoRedirectSeconds(2);
            }
            setManualRefreshing(false);
            return;
          }

          if (res.ok && data.status === "Active" && data.allowed === false && data.errorCode === "ENTITLEMENT_LACKING") {
            setActivePlanName(data.planName || null);
            setResolutionState("entitlement_lacking");
            setVerifyMessage(
              data.message ||
                `Your active package does not cover ${requiredMode} Mode for the ${pathway.replace("_", " ")} program.`
            );
            setManualRefreshing(false);
            return;
          }

          if (attempt < maxPolls) {
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            setResolutionState("pending");
            setVerifyMessage(
              data.message && data.status === "Pending"
                ? data.message
                : "Payment verification is still in progress with the provider. Your cart and examination selection remain safely saved — click below to re-check provisioning status."
            );
          }
        } catch {
          if (attempt === maxPolls) {
            setResolutionState("pending");
            setVerifyMessage(
              "Unable to confirm subscription status right now due to a connection issue. Click Refresh Status to verify."
            );
          } else {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      setManualRefreshing(false);
    },
    [pathway, requiredMode, safeReturnTo, examId, sessionId, subscriptionId, savedCart?.name]
  );

  useEffect(() => {
    const initial = classifyInitialStatus(rawStatus);
    if (initial !== "verifying") {
      setResolutionState(initial);
      return;
    }
    void verifyBackendProvisioning({ maxPolls: 5 });
  }, [rawStatus, verifyBackendProvisioning]);

  // Automatic countdown redirection ONLY when backend confirmed entitlement (resolutionState === "provisioned")
  useEffect(() => {
    if (
      resolutionState !== "provisioned" ||
      autoRedirectSeconds === null ||
      autoRedirectSeconds <= 0 ||
      !safeReturnTo
    ) {
      return;
    }
    const t = setTimeout(() => {
      if (autoRedirectSeconds === 1) {
        router.push(safeReturnTo);
      } else {
        setAutoRedirectSeconds(autoRedirectSeconds - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [resolutionState, autoRedirectSeconds, router, safeReturnTo]);

  const retrySubscriptionUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (requiredMode) q.set("requiredMode", requiredMode);
    if (examId) q.set("examId", examId);
    if (pathway) q.set("pathway", pathway);
    if (subject) q.set("subject", subject);
    if (validatedContext.layout) q.set("layout", validatedContext.layout);
    if (validatedContext.attemptId) q.set("attemptId", validatedContext.attemptId);
    if (safeReturnTo) q.set("returnTo", safeReturnTo);
    return `/learner/subscription?${q.toString()}`;
  }, [requiredMode, examId, pathway, subject, validatedContext.layout, validatedContext.attemptId, safeReturnTo]);

  const completedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 sm:px-6 py-14 bg-background text-foreground">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-xl p-6 sm:p-8 text-center space-y-6">
        {/* Cancelled */}
        {(isCancel || resolutionState === "cancelled") && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C58B43]/15 text-[#C58B43]">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">Checkout Cancelled</h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Your checkout was cancelled before completion. No subscription has been activated.
              </p>
              {safeReturnTo && (
                <p className="text-xs text-[#0A6265] dark:text-teal-300 font-semibold pt-1">
                  Your selected package and {requiredMode} Mode examination have been preserved.
                </p>
              )}
            </div>
          </>
        )}

        {/* Failed or Expired */}
        {(resolutionState === "failed" || resolutionState === "expired") && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
              <XCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">
                {resolutionState === "expired" ? "Checkout Session Expired" : "Payment Could Not Be Completed"}
              </h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                {resolutionState === "expired"
                  ? "Your payment session expired before confirmation. Your cart and examination selection remain intact."
                  : "The payment provider reported an unsuccessful transaction. Your cart and examination context remain saved so you can try again."}
              </p>
            </div>
          </>
        )}

        {/* Verifying */}
        {resolutionState === "verifying" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A6265]/12 text-[#0A6265] dark:text-teal-300">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">Verifying Payment &amp; Provisioning</h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                {verifyMessage || "Confirming your authoritative subscription entitlement with QuizNurse…"}
              </p>
            </div>
          </>
        )}

        {/* Pending Provisioning */}
        {resolutionState === "pending" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C58B43]/15 text-[#C58B43]">
              <Clock className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">Provisioning in Progress</h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">{verifyMessage}</p>
            </div>
          </>
        )}

        {/* Entitlement Lacking */}
        {resolutionState === "entitlement_lacking" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C58B43]/15 text-[#C58B43]">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">Additional Entitlement Required</h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">{verifyMessage}</p>
            </div>
          </>
        )}

        {/* Provisioned & Confirmed */}
        {resolutionState === "provisioned" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-brand text-2xl font-bold text-foreground">Subscription Active!</h1>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                {verifyMessage ||
                  `Thank you for subscribing to ${APP_NAME}. Your curriculum entitlement has been verified.`}
              </p>
            </div>
          </>
        )}

        {/* Transaction & Learning Context Summary */}
        <div className="text-xs text-foreground-secondary space-y-1.5 rounded-xl bg-surface-muted/70 p-4 border border-border text-left">
          {activePlanName && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Verified Plan:</span>
              <span className="font-semibold text-foreground">{activePlanName}</span>
            </p>
          )}
          {pathway && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Curriculum Pathway:</span>
              <span className="font-semibold text-foreground">{pathway.replace("_", " ")}</span>
            </p>
          )}
          {requiredMode && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Selected Mode:</span>
              <span className="font-semibold text-[#0A6265] dark:text-teal-300">{requiredMode} Mode</span>
            </p>
          )}
          {subject && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Subject:</span>
              <span className="font-semibold text-foreground">{subject}</span>
            </p>
          )}
          {examId && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Examination ID:</span>
              <span className="font-mono text-foreground">{examId}</span>
            </p>
          )}
          {provider && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Payment Provider:</span>
              <span className="font-semibold uppercase text-foreground">{provider}</span>
            </p>
          )}
          {subscriptionId && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Subscription Ref:</span>
              <span className="font-mono text-foreground">{subscriptionId}</span>
            </p>
          )}
          {sessionId && (
            <p className="flex justify-between gap-2">
              <span className="text-foreground-muted">Transaction Ref:</span>
              <span className="font-mono text-foreground">{sessionId}</span>
            </p>
          )}
          {resolutionState === "provisioned" && (
            <p className="flex justify-between gap-2 pt-1.5 border-t border-border">
              <span className="text-foreground-muted">Verified At:</span>
              <span className="text-foreground">{completedAt}</span>
            </p>
          )}
        </div>

        {/* Continuation & Recovery Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          {resolutionState === "provisioned" && safeReturnTo && (
            <Link
              href={safeReturnTo}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A6265] hover:bg-[#193B42] text-white text-sm font-bold shadow-md transition-all"
            >
              <span>
                {autoRedirectSeconds
                  ? `Launching ${requiredMode} Mode (${autoRedirectSeconds}s)…`
                  : `Resume ${requiredMode} Mode Now`}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {resolutionState === "pending" && (
            <button
              type="button"
              disabled={manualRefreshing}
              onClick={() => void verifyBackendProvisioning({ maxPolls: 3, isManual: true })}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A6265] hover:bg-[#193B42] text-white text-sm font-bold shadow-md transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${manualRefreshing ? "animate-spin" : ""}`} />
              <span>{manualRefreshing ? "Checking Backend Status…" : "Refresh Provisioning Status"}</span>
            </button>
          )}

          {(resolutionState === "cancelled" ||
            resolutionState === "failed" ||
            resolutionState === "expired" ||
            resolutionState === "entitlement_lacking" ||
            resolutionState === "pending") && (
            <Link
              href={retrySubscriptionUrl}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0A6265] bg-[#F1F6F4] dark:bg-[#0A6265]/15 text-[#0A6265] dark:text-teal-300 hover:bg-[#0A6265] hover:text-white text-sm font-bold transition-all"
            >
              <span>Review Cart &amp; Try Again</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/learner/library"
              className="rounded-xl border border-border bg-surface text-foreground-secondary px-4 py-2 text-xs font-semibold hover:bg-surface-muted hover:text-foreground transition"
            >
              Study Library
            </Link>
            <Link
              href="/learner"
              className="rounded-xl border border-border bg-surface text-foreground-secondary px-4 py-2 text-xs font-semibold hover:bg-surface-muted hover:text-foreground transition"
            >
              Learner Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-border bg-surface text-foreground-secondary px-4 py-2 text-xs font-semibold hover:bg-surface-muted hover:text-foreground transition"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function SubscriptionPackageCallbackFallback() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-sm p-8 text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0A6265]" />
        <p className="text-foreground-secondary text-sm">Loading your subscription status…</p>
      </div>
    </main>
  );
}

export default function SubscriptionPackageCallbackPage() {
  return (
    <Suspense fallback={<SubscriptionPackageCallbackFallback />}>
      <SubscriptionPackageCallbackContent />
    </Suspense>
  );
}
