"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * RouteTransitionBar provides an intelligent, non-intrusive progress indicator
 * across App Router navigation. It mounts globally at the top of the viewport.
 * If navigation is instantaneous (< 120ms), it never flashes.
 * If navigation takes longer, it smoothly renders a slim brand-teal bar.
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

  // Complete any active navigation when pathname or searchParams change
  React.useEffect(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isNavigating) {
      setProgress(100);
      finishTimerRef.current = setTimeout(() => {
        setVisible(false);
        setIsNavigating(false);
        setProgress(0);
      }, 250);
    }

    return () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intercept internal link clicks to initiate transition feedback
  React.useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      // Ignore external, download, anchor hash, or new tab links
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || targetAttr === "_blank") {
        return;
      }

      // If clicking the current path without param changes, ignore
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (href === currentUrl) return;

      // Debounce start so fast / instant navigations do not flash
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = setTimeout(() => {
        setIsNavigating(true);
        setVisible(true);
        setProgress(25);

        intervalRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 85) return prev;
            return prev + Math.floor(Math.random() * 10) + 5;
          });
        }, 180);
      }, 120);
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
        className="h-full bg-brand-teal shadow-[0_0_8px_rgba(13,148,136,0.5)] transition-all duration-200 ease-out motion-reduce:duration-0"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
