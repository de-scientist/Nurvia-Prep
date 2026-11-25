"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";
import { RotateCcw } from "lucide-react";

/**
 * Public routes that do not require an active session check before rendering.
 * Users navigating to these routes should never be blocked by a full-screen splash.
 */
function isPublicPath(pathname: string | null): boolean {
  if (!pathname || pathname === "/") return true;
  const publicPrefixes = [
    "/study-guides",
    "/pricing",
    "/about",
    "/terms",
    "/privacy",
    "/design-system",
    "/forum",
    "/qotd",
    "/groups",
    "/mentors",
    "/insights",
    "/nclex",
  ];
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Global splash overlay shown only while the initial session check is in flight.
 * Public routes are rendered immediately without waiting for session checks.
 * For protected destinations, children are protected underneath until authentication
 * settles as authenticated, unauthenticated, or error.
 */
export function AppInitializationSplash() {
  const { status } = useAuth();
  const pathname = usePathname();

  // Public pages remain instantly accessible
  if (isPublicPath(pathname)) {
    return null;
  }

  if (status !== "loading") return null;
  return <AppSplashScreen />;
}

export function AppSplashScreen() {
  const { refresh } = useAuth();
  const [slowNotice, setSlowNotice] = React.useState(false);
  const [canRetry, setCanRetry] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    const slowTimer = setTimeout(() => {
      setSlowNotice(true);
    }, 5000);

    const retryTimer = setTimeout(() => {
      setCanRetry(true);
    }, 10000);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
    };
  }, []);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    try {
      await refresh();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading QuizNurse Workspace"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center gap-6 text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 20 }}
          className="motion-reduce:transform-none"
        >
          <Logo size="lg" variant="full" withLink={false} />
        </motion.div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground-secondary">
            Advancing healthcare learning.
          </p>
          {slowNotice && (
            <p className="text-xs text-foreground-muted animate-in fade-in duration-300">
              Verifying your clinical session profile…
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-2"
          aria-hidden="true"
        >
          <div className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none" />
          <div
            className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.1s" }}
          />
          <div
            className="h-2 w-2 rounded-full bg-brand-teal animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: "0.2s" }}
          />
        </div>

        {canRetry && (
          <div className="mt-2 flex flex-col items-center gap-2 animate-in fade-in duration-300">
            <button
              type="button"
              onClick={() => void handleManualRetry()}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors disabled:opacity-60"
            >
              <RotateCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Retrying…" : "Retry verification"}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[11px] text-foreground-muted hover:underline"
            >
              Reload application
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
