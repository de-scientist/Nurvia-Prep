"use client";

import * as React from "react";
import { PageLoader } from "@/components/shared/feedback";

export default function DashboardPreloader({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid artificial full-screen flashes; once mounted on client, render immediately.
  if (!mounted) {
    return (
      <PageLoader
        fullscreen
        message="Loading NURVIA Workspace…"
      />
    );
  }

  return <>{children}</>;
}
