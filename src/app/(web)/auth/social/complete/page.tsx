"use client";

import { useEffect } from "react";
import { writeAuthSessionCookies } from "@/lib/utils/sessions/generateSystemUserSessionCookies";

export default function SocialCompletePage() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const badge = p.get("badge");
    const line = p.get("line");
    const error = p.get("error");
    let next = p.get("next") || "/pages/entrance";
    if (!next.startsWith("/") || next.startsWith("//")) next = "/pages/entrance";

    if (error || !badge || !line) {
      document.cookie = `socialError=${encodeURIComponent(error || "Social sign-in failed.")}; path=/; max-age=30`;
      window.location.replace("/auth/login");
      return;
    }

    writeAuthSessionCookies(badge, line);
    window.location.replace(next); // full reload on /pages/entrance
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] p-8">
      <p className="text-center text-sm font-semibold text-[#142B4A] dark:text-slate-200">Completing sign-in…</p>
    </div>
  );
}