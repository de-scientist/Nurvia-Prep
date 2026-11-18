"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/config/config";

function SubscriptionPackageCallbackContent() {
  const searchParams = useSearchParams();

  const provider = (searchParams.get("provider") ?? "").toLowerCase();
  const subscriptionId = searchParams.get("subscriptionId") ?? undefined;
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id") ?? undefined;
  const dashboard = searchParams.get("dashboard") || "ati-teas";

  const isCancel = status === "cancel";

  const completedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-6 py-16 bg-[#F8FAFC] dark:bg-[#0B1220]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-lg p-8 text-center">
        {isCancel ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl">⚠️</div>
            <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">Checkout Cancelled</h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">Your subscription was not completed. No charge was made.</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D9488]/10 text-2xl">🎉</div>
            <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">You&apos;re Almost There!</h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
              Thanks for subscribing to {APP_NAME}. Your subscription is being processed — this
              usually takes less than a minute, then you&apos;ll have full access.
            </p>
          </>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 space-y-1 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
          {provider && <p>Provider: <span className="font-semibold">{provider}</span></p>}
          {subscriptionId && <p>Subscription ID: <span className="font-mono">{subscriptionId}</span></p>}
          {sessionId && <p>Session: <span className="font-mono">{sessionId}</span></p>}
          {!isCancel && <p>Completed: {completedAt}</p>}
        </div>

        {!isCancel && (
          <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 p-4 text-left text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-[#0F172A] dark:text-white mb-1.5">What happens next</p>
            <ul className="list-disc pl-5 space-y-1 text-xs leading-relaxed">
              <li>A receipt has been sent to your registered email.</li>
              <li>Your plan activates automatically — no action needed from you.</li>
              <li>
                If your access hasn&apos;t updated in a few minutes, refresh your dashboard or{" "}
                <Link href="/pages/contact-us" className="text-[#0D9488] font-semibold hover:underline">
                  contact support
                </Link>{" "}
                with the Subscription ID above.
              </li>
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/dashboards/${dashboard}/vista/subscriptions/items`}
            className="rounded-xl bg-[#0D9488] text-white px-5 py-2.5 text-xs font-semibold hover:bg-[#0F766E] transition"
          >
            View Subscriptions
          </Link>

          <Link
            href={`/dashboards/${dashboard}`}
            className="rounded-xl bg-[#142B4A] text-white px-5 py-2.5 text-xs font-semibold hover:bg-[#1E3A5F] transition"
          >
            Go To Dashboard
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Back Home
          </Link>

          {isCancel && (
            <button
              onClick={() => history.back()}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function SubscriptionPackageCallbackFallback() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-6 py-16 bg-[#F8FAFC] dark:bg-[#0B1220]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-sm p-8 text-center">
        <p className="text-slate-500 text-sm">Loading your subscription status…</p>
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

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  Skewblanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────