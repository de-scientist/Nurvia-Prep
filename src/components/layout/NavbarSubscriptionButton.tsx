"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export interface SubscriptionStatusData {
  success: boolean;
  status: "Active" | "Expired" | "Cancelled" | "None" | "Error";
  allowed: boolean;
  planName?: string;
  expiresAt?: string | null;
}

export function NavbarSubscriptionButton() {
  const { status: authStatus, user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [subData, setSubData] = React.useState<SubscriptionStatusData | null>(null);

  const fetchStatus = React.useCallback(async () => {
    if (authStatus === "loading") {
      return;
    }

    if (authStatus !== "authenticated" || !user) {
      setLoading(false);
      setSubData(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions/status", {
        headers: { "Cache-Control": "no-store" },
      });
      const data: SubscriptionStatusData = await res.json().catch(() => ({
        success: false,
        status: "Error" as const,
        allowed: false,
      }));
      setSubData(data);
    } catch {
      setSubData({
        success: false,
        status: "Error",
        allowed: false,
      });
    } finally {
      setLoading(false);
    }
  }, [authStatus, user]);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Revalidate status on custom events, focus, visibility change, and storage updates
  React.useEffect(() => {
    const handleUpdate = () => {
      void fetchStatus();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchStatus();
      }
    };

    window.addEventListener("nurvia:subscription-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("nurvia:subscription-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [fetchStatus]);

  // Display loading skeleton while validating auth or subscription status
  if (authStatus === "loading" || (authStatus === "authenticated" && loading)) {
    return (
      <div
        data-testid="navbar-subscription-loading"
        className="h-8 w-20 sm:w-24 rounded-lg bg-surface-muted/80 animate-pulse border border-border/40 shrink-0"
        aria-hidden="true"
      />
    );
  }

  const isActive = Boolean(
    subData &&
    subData.success !== false &&
    subData.status === "Active" &&
    subData.allowed === true
  );

  // Active state: displayed when backend confirms learner has an active, eligible subscription
  if (isActive) {
    return (
      <Link
        href="/learner/subscription"
        data-testid="navbar-subscription-active"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
        )}
        aria-label={`Subscription status: Active (${subData?.planName || "Active Plan"}). Manage your subscription.`}
        title={`Active Plan: ${subData?.planName || "Current Subscription"}`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate">Active</span>
      </Link>
    );
  }

  // Subscribe state: displayed when learner does not have an active eligible subscription
  return (
    <Link
      href="/learner/subscription"
      data-testid="navbar-subscription-subscribe"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/40 bg-brand-teal/10 hover:bg-brand-teal hover:text-white dark:bg-brand-teal/20 dark:hover:bg-brand-teal px-2.5 py-1.5 text-xs font-semibold text-brand-teal dark:text-teal-300 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal shrink-0"
      )}
      aria-label="Subscription status: Inactive. Click to view subscription plans."
      title="Unlock full examination and AI tutor access"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>Subscribe</span>
    </Link>
  );
}
