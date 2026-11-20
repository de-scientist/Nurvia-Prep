"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * RouteTransitionBar provides an intelligent, non-intrusive progress indicator
 * across App Router navigation. It mounts globally at the top of the viewport.
 * If navigation is instantaneous (< 120ms), it never flashes.
 * If navigation takes longer, it smoothly renders a slim brand-teal bar.
 * 
 * - Detects eligible internal anchor clicks only.
 * - Ignores external links, downloads, new-tab modifier-clicks, middle-clicks,
 *   hash-only navigation, disabled anchors, and the current URL.
 * - Debounces start (120ms) to prevent flashing during fast navigation.
 * - Shows a slim progress bar that animates deterministically from 0% to 100%.
 * - Hides when the destination pathname or search parameters change.
 * - Handles rapid consecutive navigations without stale indicators.
 * - Respects reduced-motion preferences via CSS.
 * - Accessible: role="progressbar" with aria labels, non-interactive.
 */

export function RouteTransitionBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isNavigating, setIsNavigating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  const startTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // ── Complete any active navigation when pathname or searchParams change ──────────
  React.useEffect(() => {
    // Clear any active timers first
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }

    // If a navigation was in progress, mark it complete and hide the bar
    if (isNavigating) {
      setProgress(100);
      // Brief delay then hide so the user sees the bar reach 100%
      finishTimerRef.current = setTimeout(() => {
        setVisible(false);
        setIsNavigating(false);
        setProgress(0);
      }, 200);
    }
  }, [pathname, searchParams]); // Depends on URL changes to detect navigation completion

  // ── Intercept internal link clicks to initiate transition feedback ───────────────
  React.useEffect(() => {
    const isModifiedClick = (event: MouseEvent) => {
      return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    };

    const handleDocumentMouseDown = (event: MouseEvent) => {
      // Ignore modifier-clicks, middle-clicks, right-clicks
      if (isModifiedClick(event)) return;
      if (event.button === 1) return; // middle mouse button
      if (event.button === 2) return; // secondary (right) mouse button

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      // Prevent if not a left-button click on the anchor
      if (event.button !== 0) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      // Ignore external links (absolute URL starting with protocol, but not same-origin)
      if (!href) return;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        // Same-origin links are OK; external ones are not.
        // Heuristic: if the hostname differs from current, treat as external.
        try {
          const currentHost = new URL(window.location.href).host;
          const anchorHost = new URL(href).host;
          if (anchorHost !== currentHost) return;
        } catch {
          // If URL parsing fails, skip this link
          return;
        }
      }

      // Ignore download links (common filename extensions)
      const downloadPattern = /\.(pdf|doc|docx|xls|xlsx|csv|zip|rar|exe|dmg|psd|ai|ppt|pptx)$/i;
      if (downloadPattern.test(href)) return;

      // Ignore anchor hash-only navigation (same-page links)
      if (href.startsWith("#")) return;

      // Ignore new-tab target
      if (targetAttr === "_blank") return;

      // Ignore mailto, tel, and other non-HTTP protocols
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:")) return;

      // Ignore the current URL (no navigational benefit)
      const currentPath = window.location.pathname + window.location.search;
      if (href === currentPath) return;

      // Ignore disabled anchors
      if (anchor.getAttribute("disabled") !== null) return;

      // Debounce start so fast / instant navigations do not flash
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = setTimeout(() => {
        setIsNavigating(true);
        setVisible(true);
        setProgress(0);
      }, 120);
    };

    const handleDocumentMouseUp = (_event: MouseEvent) => {
      // No-op; the mousedown handler initiates the navigation feedback.
      // The mouseup ensures the click intent is registered even if the
      // pointer leaves the anchor briefly.
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    document.addEventListener("mouseup", handleDocumentMouseUp, true);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
      document.removeEventListener("mouseup", handleDocumentMouseUp, true);
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Dependency array is empty — effects set up/clean up once per mount

  // ── Deterministic progress animation ─────────────────────────────────────────
  // Progress animates from 0% to 100% over ~1000ms using deterministic steps.
  // No random values are used. The interval clears once progress reaches 100%.
  React.useEffect(() => {
    if (!isNavigating || visible === false) return;

    // Clear any existing interval to prevent overlaps
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    let progressStep = 0;
    const maxProgress = 100;
    const stepDelay = 80; // ms per step
    const totalDuration = stepDelay * 20; // ~1600ms total (20 steps * 80ms)

    intervalRef.current = setInterval(() => {
      progressStep += 10;
      if (progressStep >= maxProgress) {
        setProgress(maxProgress);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Navigation considered complete after progress reaches 100%
        setIsNavigating(false);
        setVisible(false);
        setProgress(0);
      } else {
        setProgress(progressStep);
      }
    }, stepDelay);

    // Cleanup on unmount or if navigation state changes mid-animation
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isNavigating, visible]); // Re-run if navigation starts/stops

  // ── When not visible, render nothing ─────────────────────────────────────────
  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Navigating route"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-brand-teal shadow-[0_0_8px_rgba(13,148,136,0.5)] transition-all duration-300 ease-out motion-reduce:duration-0"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}