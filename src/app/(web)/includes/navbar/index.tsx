"use client";

import React, { useState, useEffect, useRef, RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config/config";
import SeekModal from "@/components/common/modals/seek/SeekModal";
import { NurviaLogo } from "@/components/common/NurviaLogo";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { useRelativeStrataPrograms } from "@/lib/hooks/nexus/strata/learning/programs/relative/useRelativeStrataPrograms";
import { useThemeContext } from "@/lib/contexts/panel/layout/theme/PanelThemeContext";
import {
  Search,
  ChevronDown,
  X,
  Menu,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Info,
  HelpingHand,
  Mail,
  HelpCircle,
  Briefcase,
  MessageCircle,
  Heart,
  FileText,
  Shield,
  File,
  Users,
  Video,
  UsersRound,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  Compass,
  Stethoscope,
  GraduationCap,
} from "lucide-react";

const getIcon = (name: string) => {
  const icons: Record<string, React.ReactNode> = {
    info: <Info className="w-4 h-4" />,
    "helping-hand": <HelpingHand className="w-4 h-4" />,
    mail: <Mail className="w-4 h-4" />,
    "help-circle": <HelpCircle className="w-4 h-4" />,
    briefcase: <Briefcase className="w-4 h-4" />,
    "message-circle": <MessageCircle className="w-4 h-4" />,
    heart: <Heart className="w-4 h-4" />,
    "file-text": <FileText className="w-4 h-4" />,
    shield: <Shield className="w-4 h-4" />,
    file: <File className="w-4 h-4" />,
    users: <Users className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    "users-round": <UsersRound className="w-4 h-4" />,
  };
  return icons[name] || <File className="w-4 h-4" />;
};

const SEGMENT_DASHBOARD_MAP: Record<string, string> = {
  ATI_TEAS: "ati-teas",
  HESI_A2: "hesi-a2",
  PRE_NURSING: "pre-nursing",
  RN_NURSING: "rn-nursing",
  LPN_NURSING: "lpn-nursing",
  NCLEX_RN: "nclex-rn",
  NCLEX_PN: "nclex-pn",
  CERTIFICATION: "certification",
};

const DIRECT_NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Exams", href: "/exams" },
  { name: "Study", href: "/study" },
  { name: "Care Plans", href: "/care-plans" },
  { name: "Mark K.", href: "/mark-k" },
  { name: "Community", href: "/community" },
  { name: "FAQ", href: "/faq" },
  { name: "NCLEX", href: "/nclex" },
  { name: "TEAS", href: "/teas" },
];

const MORE_LINKS = [
  { name: "All Exam Tracks", href: "/pages/entrance", icon: "briefcase" },
  { name: "Resource Directory", href: "/pages/resources", icon: "file" },
  { name: "Advanced Search", href: "/pages/seek", icon: "help-circle" },
  { name: "About Us", href: "/pages/about-us", icon: "info" },
  { name: "How We Help", href: "/pages/documentation", icon: "helping-hand" },
  { name: "Contact Us", href: "/pages/contact-us", icon: "mail" },
  { name: "Frequently Asked Questions", href: "/pages/faqs", icon: "help-circle" },
  { name: "Reviews & Testimonials", href: "/pages/reviews", icon: "briefcase" },
  { name: "Our Values", href: "/pages/values", icon: "heart" },
  { name: "Our Team", href: "/pages/team", icon: "users" },
  { name: "Live Sessions", href: "/pages/live-sessions", icon: "video" },
  { name: "Social Study Groups", href: "/pages/social-groups", icon: "users-round" },
  { name: "Blog & Articles", href: "/pages/blogs", icon: "file-text" },
  { name: "Terms of Service", href: "/pages/terms-of-service", icon: "file-text" },
  { name: "Privacy Policy", href: "/pages/privacy-policy", icon: "shield" },
];

const FALLBACK_DASHBOARDS = [
  { name: "ATI TEAS Dashboard", slug: "ati-teas" },
  { name: "HESI A2 Dashboard", slug: "hesi-a2" },
  { name: "RN Nursing Dashboard", slug: "rn-nursing" },
  { name: "LPN Nursing Dashboard", slug: "lpn-nursing" },
  { name: "NCLEX-RN Dashboard", slug: "nclex-rn" },
  { name: "NCLEX-PN Dashboard", slug: "nclex-pn" },
];

export default function Navbar() {
  const { user } = useCurrentSystemUser();
  const { programs } = useRelativeStrataPrograms();
  const { theme, toggleTheme } = useThemeContext();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [seekOpen, setSeekOpen] = useState(false);

  const dropdownRefs: {
    more: RefObject<HTMLDivElement | null>;
    account: RefObject<HTMLDivElement | null>;
  } = {
    more: useRef<HTMLDivElement>(null),
    account: useRef<HTMLDivElement>(null),
  };

  const navbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSeekOpen((prev) => !prev);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [mobileMenuOpen]);

  const toggleDropdown = (name: string) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const isDark = theme.global === "dark";

  return (
    <>
      {/* Canonical NURVIA Top Announcement Banner */}
      <div className="bg-[#142B4A] dark:bg-[#0F2036] text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2 border-b border-white/10">
        <span className="inline-flex items-center gap-1 bg-[#0D9488]/25 text-teal-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
          <Sparkles className="w-3 h-3" /> NURVIA Education
        </span>
        <span className="hidden sm:inline">
          {APP_NAME} — Your Path to Nursing Confidence. Next-Gen NCLEX, ATI TEAS &amp; HESI A2 preparation.
        </span>
        <span className="sm:hidden">{APP_NAME} — Nursing Confidence</span>
      </div>

      {/* Main Sticky NURVIA Header */}
      <header
        ref={navbarRef}
        className={`sticky top-0 z-40 w-full transition-all duration-200 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md ${
          scrolled
            ? "border-b border-slate-200 dark:border-slate-800 shadow-xs"
            : "border-b border-slate-200/80 dark:border-slate-800/80"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">
          {/* Brand Logo & Wordmark */}
          <div onClick={() => setActiveDropdown(null)}>
            <NurviaLogo
              size="md"
              variant="full"
              label="NURVIA"
              subtitle="NURVIA-PREP"
            />
          </div>

          {/* Desktop Navigation — Direct NURVIA Links + Structured More Menu */}
          <nav
            className="hidden xl:flex items-center gap-1"
            aria-label="Main Navigation"
          >
            {DIRECT_NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    (pathname ? pathname.startsWith(item.href + "/") : false);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setActiveDropdown(null)}
                  className={`px-2.5 py-1.5 rounded-md text-xs lg:text-[13px] font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-[#0D9488] dark:text-teal-400 font-bold bg-[#0D9488]/10"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.name}
                </Link>
              );
            })}

            {/* More Dropdown */}
            <div className="relative" ref={dropdownRefs.more}>
              <button
                type="button"
                onClick={() => toggleDropdown("more")}
                onMouseEnter={() => setActiveDropdown("more")}
                aria-expanded={activeDropdown === "more"}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs lg:text-[13px] font-medium transition-colors ${
                  activeDropdown === "more"
                    ? "text-[#0D9488] bg-[#0D9488]/10 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>More</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeDropdown === "more" ? "rotate-180" : ""
                  }`}
                />
              </button>

              {activeDropdown === "more" && (
                <div
                  className="absolute right-0 top-full pt-2 z-50"
                  onMouseEnter={() => setActiveDropdown("more")}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <div className="w-72 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 shadow-xl">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Platform &amp; Resources
                    </div>
                    <ul className="space-y-0.5">
                      {MORE_LINKS.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#0D9488] transition-colors group"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488] group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                              {getIcon(item.icon)}
                            </span>
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Search Button (Ctrl+K) */}
            <button
              type="button"
              onClick={() => {
                setActiveDropdown(null);
                setSeekOpen(true);
              }}
              aria-label="Search exams and study resources (Ctrl+K)"
              title="Search (Ctrl+K)"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors hover:border-[#0D9488]/50 hover:text-slate-900 dark:hover:text-white"
            >
              <Search className="h-4 w-4 text-[#0D9488]" />
              <span className="hidden md:inline text-slate-500 dark:text-slate-400">Search…</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                Ctrl K
              </kbd>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => toggleTheme("global")}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-colors hover:border-[#0D9488]/50 hover:text-[#0D9488]"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Authenticated vs Unauthenticated Controls */}
            {!user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors hover:border-[#0D9488]/60 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0D9488] hover:bg-[#0F766E] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  href="/pages/entrance"
                  className="hidden lg:inline-flex h-9 items-center justify-center rounded-lg bg-[#142B4A] hover:bg-[#0F2036] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                >
                  Explore Exams
                </Link>
              </div>
            ) : (
              <div className="relative hidden sm:block" ref={dropdownRefs.account}>
                <button
                  type="button"
                  onClick={() => toggleDropdown("account")}
                  onMouseEnter={() => setActiveDropdown("account")}
                  aria-expanded={activeDropdown === "account"}
                  aria-haspopup="true"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#142B4A] hover:bg-[#0F2036] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  <span className="max-w-[110px] truncate">
                    {user.userName || "My Account"}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      activeDropdown === "account" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {activeDropdown === "account" && (
                  <div
                    className="absolute right-0 top-full pt-2 z-50"
                    onMouseEnter={() => setActiveDropdown("account")}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <div className="w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 shadow-xl">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.userName || "Learner Account"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {user.email || "Active Session"}
                        </p>
                      </div>

                      <div className="py-1.5">
                        <Link
                          href="/learner"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] mb-2 mx-1 shadow-xs transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            Common Dashboard
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Exam Workspaces &amp; Dashboards
                        </p>
                        <ul className="space-y-0.5 max-h-52 overflow-y-auto">
                          {programs.length > 0
                            ? programs.map((program) => {
                                const slug = SEGMENT_DASHBOARD_MAP[program.segment ?? ""];
                                if (!slug) return null;
                                return (
                                  <li key={program.guidId}>
                                    <Link
                                      href={`/dashboards/${slug}`}
                                      onClick={() => setActiveDropdown(null)}
                                      className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0D9488] transition-colors"
                                    >
                                      <span>{program.name}</span>
                                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    </Link>
                                  </li>
                                );
                              })
                            : FALLBACK_DASHBOARDS.map((d) => (
                                <li key={d.slug}>
                                  <Link
                                    href={`/dashboards/${d.slug}`}
                                    onClick={() => setActiveDropdown(null)}
                                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0D9488] transition-colors"
                                  >
                                    <span>{d.name}</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  </Link>
                                </li>
                              ))}
                        </ul>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-0.5">
                        <Link
                          href="/pages/actions"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Compass className="w-3.5 h-3.5 text-[#0D9488]" />
                          <span>Study Tracks Hub</span>
                        </Link>
                        <Link
                          href="/pages/contact-us"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Mail className="w-3.5 h-3.5 text-[#0D9488]" />
                          <span>Contact Support</span>
                        </Link>
                        <Link
                          href="/auth/logout"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="xl:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop and Slide-Over Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <NurviaLogo size="sm" variant="full" label="NURVIA" subtitle="NURVIA-PREP" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
                {DIRECT_NAV_ITEMS.map((item, idx) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        (pathname ? pathname.startsWith(item.href + "/") : false);

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#0D9488]/10 text-[#0D9488] font-bold"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-5 text-[11px] font-mono text-slate-400">
                          0{idx + 1}
                        </span>
                        <span>{item.name}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Link>
                  );
                })}

                <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    More Resources &amp; Support
                  </p>
                  {MORE_LINKS.slice(0, 8).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>{item.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </nav>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {!user ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0D9488] text-xs font-semibold text-white"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Sign Up
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/pages/entrance"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#142B4A] text-xs font-semibold text-white"
                  >
                    <GraduationCap className="w-4 h-4 text-[#2DD4BF]" />
                    Open Programme Dashboards
                  </Link>
                  <Link
                    href="/auth/logout"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-[#0D9488]" />
                  {APP_NAME} Platform
                </span>
                <Link
                  href="/explore"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#0D9488] font-semibold hover:underline"
                >
                  Directory
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <SeekModal open={seekOpen} onClose={() => setSeekOpen(false)} />
    </>
  );
}
