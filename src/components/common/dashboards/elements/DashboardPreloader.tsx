"use client";

import { useEffect, useState } from "react";

export default function DashboardPreloader({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setReady(true);
    });

    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0B1220]"
        aria-live="polite"
      >
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-[#0D9488] dark:border-slate-800 dark:border-t-[#2DD4BF]" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
          Loading Nurvia-Prep Workspace…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
