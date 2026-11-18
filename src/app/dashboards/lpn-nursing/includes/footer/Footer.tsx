"use client";

import { useThemeContext } from "@/lib/contexts/panel/layout/theme/PanelThemeContext";
import { useLeftSidebar } from "@/lib/contexts/panel/layout/includes/sidebar/LeftSidebarContext";
import { useRightSidebar } from "@/lib/contexts/panel/layout/includes/sidebar/RightSidebarContext";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/config";
import Annex from "@/app/(web)/auth/modals/Annex";

const FOOTER_LINKS = [
  { href: "/pages/privacy-policy", label: "Privacy Policy" },
  { href: "/pages/terms-of-service", label: "Terms of Service" },
  { href: "/pages/contact-us", label: "Contact Us" },
  { href: "/pages/documentation", label: "Documentation" },
];

export default function Footer() {
  const [annexOpen, setAnnexOpen] = useState(false);
  const { theme } = useThemeContext();
  const leftSidebar = useLeftSidebar();
  const rightSidebar = useRightSidebar();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []);

  const effectiveFooterTheme = theme.footer === "system" ? theme.global : theme.footer;
  const isLightFooter = effectiveFooterTheme === "light";

  const getSidebarWidth = (sidebar: { isClosed: boolean; isOpened: boolean }) => {
    if (!isClient) return 0;
    if (sidebar.isClosed) return 0;
    if (sidebar.isOpened) return 256;
    return 80;
  };

  const leftWidth = getSidebarWidth(leftSidebar);
  const rightWidth = getSidebarWidth(rightSidebar);

  const hoverColor = isLightFooter ? "hover:text-[#0D9488]" : "hover:text-[#2DD4BF]";

  return (
    <footer
      className="transition-all duration-300 ease-in-out border-t border-slate-200 dark:border-slate-800 text-sm"
      style={{
        marginLeft: leftWidth,
        marginRight: rightWidth,
        width: `calc(100% - ${leftWidth + rightWidth}px)`,
        backgroundColor: "var(--footer-bg)",
        color: "var(--text-color)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
          <span className="text-center opacity-70 md:text-left">
            &copy; {new Date().getFullYear()} {APP_NAME} (NURVIA). All rights reserved.
          </span>

          <button
            type="button"
            onClick={() => setAnnexOpen(true)}
            className="flex items-center gap-2 text-xs opacity-75 transition hover:text-[#0D9488] hover:opacity-100"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0D9488] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0D9488]" />
            </span>
            Powered By {APP_NAME} Team
          </button>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          >
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap opacity-80 transition hover:opacity-100 ${hoverColor}`}
              >
                {label}
              </Link>
            ))}
          </nav>

        </div>
      </div>
      
      <Annex isOpen={annexOpen} onClose={() => setAnnexOpen(false)} />

    </footer>
  );
}