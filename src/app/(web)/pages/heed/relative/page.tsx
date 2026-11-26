"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCheck,
  Clock,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Star,
  Headset,
  Search,
  LogIn,
  ArrowLeft,
} from "lucide-react";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { useRelativeHeedMessage } from "@/lib/hooks/users/heed/relative/useRelativeHeedMessage";
import { useUpdateHeedMessageStatus } from "@/lib/hooks/users/heed/status/useUpdateHeedMessageStatus";
import type { ClientReadStatus } from "@/lib/services/auth/supportService";
import HeedReplyBox from "../partials/HeedReplyBox";
import { categoryTone, timeAgo } from "../partials/heedFormat";

const DEFAULT_PER_PAGE = 10;

type Filter = "All" | ClientReadStatus;
const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "All", label: "All", icon: <Inbox className="h-3.5 w-3.5" /> },
  { key: "Unread", label: "Unread", icon: <Mail className="h-3.5 w-3.5" /> },
  { key: "Later", label: "Later", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "Starred", label: "Starred", icon: <Star className="h-3.5 w-3.5" /> },
];

function StatusBadge({ status }: { status?: string | null }) {
  const classes =
    status === "Resolved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
      : status === "Responded"
        ? "bg-[#D6E9E3] text-[#193B42] dark:bg-teal-950/60 dark:text-teal-300"
        : "bg-[#F5EDE2] text-[#193B42] dark:bg-amber-950/60 dark:text-amber-300";
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${classes}`}>
      {status || "Open"}
    </span>
  );
}

const getVisiblePages = (current: number, total: number, windowSize = 2) => {
  const pages: (number | "ellipsis")[] = [];
  const start = Math.max(2, current - windowSize);
  const end = Math.min(total - 1, current + windowSize);
  pages.push(1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("ellipsis");
  if (total > 1) pages.push(total);
  return pages;
};

export default function RelativeHeedMessagesPage() {
  const optionalAuth = useOptionalAuth();
  const { user: sysUser, loading: sysLoading } = useCurrentSystemUser();
  const isAuthenticated = Boolean(
    sysUser || (optionalAuth?.status === "authenticated" && optionalAuth?.user)
  );
  const authChecking = optionalAuth?.status === "loading" || sysLoading;

  const [statusFilter, setStatusFilter] = useState<Filter>("All");

  const { messages: rawMessages, setMessageSearch, isLoading, error, refetch } = useRelativeHeedMessage({
    items: 100,
    clientStatus: null,
    enabled: isAuthenticated,
  });
  const { updateStatus, isUpdating, error: updateError } = useUpdateHeedMessageStatus();

  const [searchInput, setSearchInput] = useState("");
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (isAuthenticated) {
        setMessageSearch(searchInput.trim());
      }
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, isAuthenticated, setMessageSearch]);

  const counts = useMemo(
    () => ({
      All: rawMessages.length,
      Unread: rawMessages.filter((m) => m.clientReadStatus === "Unread").length,
      Later: rawMessages.filter((m) => m.clientReadStatus === "Later").length,
      Starred: rawMessages.filter((m) => m.clientReadStatus === "Starred").length,
    }),
    [rawMessages]
  );

  const messages = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return rawMessages.filter((m) => {
      if (statusFilter !== "All" && m.clientReadStatus !== statusFilter) return false;
      if (q) {
        const hay = [m.title, m.message, m.response, m.category, m.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rawMessages, statusFilter, searchInput]);

  useEffect(() => {
    setSelected((prev) => {
      const next = prev.filter((id) => messages.some((m) => m.guidId === id));
      return next.length === prev.length ? prev : next;
    });
  }, [messages]);

  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(
    () => messages.slice((safePage - 1) * perPage, safePage * perPage),
    [messages, safePage, perPage]
  );

  const unreadIds = useMemo(
    () => rawMessages.filter((m) => m.clientReadStatus === "Unread").map((m) => m.guidId),
    [rawMessages]
  );

  const allPageSelected = pageItems.length > 0 && pageItems.every((m) => selected.includes(m.guidId));

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const togglePageSelection = () =>
    setSelected(allPageSelected ? [] : pageItems.map((m) => m.guidId));

  const apply = async (ids: string[], status: ClientReadStatus) => {
    const ok = await updateStatus(ids, status);
    if (ok) {
      setSelected([]);
      await refetch();
    }
  };

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-foreground-secondary transition hover:border-[#0A6265] hover:text-[#0A6265] disabled:opacity-40";

  return (
    <main className="min-h-screen bg-background px-4 pb-14 pt-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/learner"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary hover:text-[#0A6265]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Workspace</span>
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-[#0A6265]/30 bg-gradient-to-r from-[#F1F6F4] via-surface to-[#F5EDE2]/60 dark:from-[#193B42]/50 dark:via-surface dark:to-surface px-6 py-5 text-center shadow-xs space-y-1.5">
          <h1 className="font-brand text-2xl font-extrabold md:text-3xl text-foreground">
            Message Support Inbox
          </h1>
          <p className="text-xs sm:text-sm text-foreground-secondary">
            Conversations with our support team
          </p>
          {isAuthenticated && (
            <div className="pt-1">
              {unreadIds.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A6265] px-3 py-0.5 text-xs font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {unreadIds.length} unread conversation{unreadIds.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#D6E9E3]/80 dark:bg-slate-800 px-3 py-0.5 text-xs font-semibold text-[#193B42] dark:text-teal-200">
                  {counts.All > 0 ? "All caught up" : "Ready to assist"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Guest Authentication Gate for Protected Inbox */}
        {!authChecking && !isAuthenticated ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4 shadow-xs">
            <Inbox className="mx-auto h-10 w-10 text-[#0A6265]" />
            <div className="space-y-1">
              <h2 className="font-brand text-lg font-bold text-foreground">
                Sign In to Access Your Support Inbox
              </h2>
              <p className="text-xs sm:text-sm text-foreground-secondary max-w-md mx-auto">
                To protect learner privacy, viewing past support conversations and replies requires signing in to your QuizNurse account.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link
                href={`/sign-in?returnTo=${encodeURIComponent("/pages/heed/relative")}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0A6265] hover:bg-[#193B42] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In to View Inbox</span>
              </Link>
              <Link
                href="/auth/support"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                <span>Submit Guest Inquiry</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* New conversation */}
            <HeedReplyBox onSent={() => void refetch()} />

            {/* Filters + search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap rounded-2xl border border-border bg-surface-muted/60 p-1 gap-1">
                {FILTERS.map((f) => {
                  const count = counts[f.key as keyof typeof counts] ?? 0;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(f.key);
                        setCurrentPage(1);
                        setSelected([]);
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                        statusFilter === f.key
                          ? "bg-[#0A6265] text-white shadow-2xs"
                          : "text-foreground-secondary hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      {f.icon}
                      <span>
                        {f.label}
                        {count > 0 ? ` (${count})` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search conversations…"
                  aria-label="Search conversations"
                  className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                />
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePageSelection}
                    disabled={pageItems.length === 0}
                    className="rounded border-border text-[#0A6265] focus:ring-[#0A6265]"
                  />
                  Select page
                </label>

                <select
                  aria-label="Items per page"
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>

                <span className="text-xs font-semibold text-foreground-secondary">
                  Showing {pageItems.length} of {total}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {unreadIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void apply(unreadIds, "Read")}
                    disabled={isUpdating}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-[#0A6265] disabled:opacity-40"
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-[#0A6265]" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-[#0A6265] disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#0A6265]" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Bulk bar */}
            {selected.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#0A6265]/40 bg-[#F1F6F4] dark:bg-teal-950/30 px-4 py-2.5 text-xs font-bold text-foreground shadow-2xs">
                <span>{selected.length} selected</span>
                <button
                  type="button"
                  onClick={() => void apply(selected, "Read")}
                  disabled={isUpdating}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 hover:border-[#0A6265] disabled:opacity-40"
                >
                  <MailOpen className="h-3 w-3" />
                  Read
                </button>
                <button
                  type="button"
                  onClick={() => void apply(selected, "Unread")}
                  disabled={isUpdating}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 hover:border-[#0A6265] disabled:opacity-40"
                >
                  <Mail className="h-3 w-3" />
                  Unread
                </button>
                <button
                  type="button"
                  onClick={() => void apply(selected, "Later")}
                  disabled={isUpdating}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 hover:border-[#0A6265] disabled:opacity-40"
                >
                  <Clock className="h-3 w-3" />
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => void apply(selected, "Starred")}
                  disabled={isUpdating}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 hover:border-[#0A6265] disabled:opacity-40"
                >
                  <Star className="h-3 w-3" />
                  Star
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="ml-auto rounded-full border border-border bg-surface px-3 py-1 hover:bg-surface-muted"
                >
                  Clear
                </button>
              </div>
            )}

            {(error || updateError) && (
              <div
                role="alert"
                className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200"
              >
                {error ?? updateError}
              </div>
            )}

            {/* Skeletons */}
            {!error && isLoading && rawMessages.length === 0 && (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                    <div className="h-11 w-11 rounded-full bg-surface-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-surface-muted" />
                      <div className="h-3 w-2/3 rounded bg-surface-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!error && !isLoading && messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-14 text-center">
                <Inbox className="h-10 w-10 text-foreground-muted" />
                <p className="text-sm font-bold text-foreground">
                  {statusFilter === "All"
                    ? "No support conversations found"
                    : `No ${statusFilter.toLowerCase()} conversations`}
                </p>
                <p className="text-xs text-foreground-secondary">
                  Start a new conversation above and our team will respond directly here.
                </p>
              </div>
            )}

            {/* Conversation cards */}
            <div className="space-y-2.5">
              {pageItems.map((m) => {
                const isUnread = m.clientReadStatus === "Unread";
                const isStarred = m.clientReadStatus === "Starred";
                const isLater = m.clientReadStatus === "Later";
                const isSelected = selected.includes(m.guidId);

                return (
                  <div
                    key={m.guidId}
                    className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition duration-200 hover:shadow-sm ${
                      isSelected
                        ? "border-[#0A6265] bg-[#F1F6F4] dark:bg-teal-950/30"
                        : isUnread
                          ? "border-[#0A6265]/45 bg-[#F1F6F4]/55 dark:bg-teal-950/20"
                          : "border-border bg-surface hover:border-[#0A6265]/35"
                    }`}
                  >
                    {isUnread && <span className="absolute inset-y-0 left-0 w-1 bg-[#0A6265]" />}

                    <input
                      type="checkbox"
                      className="shrink-0 rounded border-border text-[#0A6265]"
                      checked={isSelected}
                      onChange={() => toggleSelect(m.guidId)}
                      aria-label="Select conversation"
                    />

                    <Link
                      href={`/pages/heed/current?id=${encodeURIComponent(m.guidId)}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-extrabold text-white shadow-2xs ${categoryTone(m.category)}`}
                        >
                          {(m.title?.[0] ?? "S").toUpperCase()}
                        </div>
                        {isUnread && (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-[#0A6265]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2
                            className={`truncate text-sm md:text-base text-foreground ${
                              isUnread ? "font-extrabold" : "font-semibold"
                            }`}
                          >
                            {m.title || `Inquiry: ${m.category}`}
                          </h2>
                          {isStarred && <Star className="h-3.5 w-3.5 shrink-0 fill-[#C58B43] text-[#C58B43]" />}
                          {isLater && <Clock className="h-3.5 w-3.5 shrink-0 text-[#C58B43]" />}
                          <span
                            className={`ml-auto shrink-0 text-[11px] ${
                              isUnread ? "font-bold text-[#0A6265]" : "text-foreground-muted"
                            }`}
                          >
                            {timeAgo(m.respondedAt ?? m.updatedAt ?? m.createdAt)}
                          </span>
                        </div>

                        <p className="mt-0.5 line-clamp-2 text-xs md:text-sm text-foreground-secondary">
                          {m.response ? (
                            <>
                              <Headset className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-[#0A6265]" />
                              <span className="font-semibold text-[#0A6265] dark:text-teal-300">Support: </span>
                              {m.response}
                            </>
                          ) : (
                            m.message
                          )}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={m.status} />
                          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[10px] font-semibold text-foreground-secondary">
                            {m.category}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void apply([m.guidId], isStarred ? "Read" : "Starred")}
                        disabled={isUpdating}
                        title={isStarred ? "Remove star" : "Star"}
                        aria-label={isStarred ? "Remove star" : "Star"}
                        className={iconBtn}
                      >
                        <Star className={`h-4 w-4 ${isStarred ? "fill-[#C58B43] text-[#C58B43]" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void apply([m.guidId], isLater ? "Read" : "Later")}
                        disabled={isUpdating}
                        title={isLater ? "Remove from later" : "Mark for later"}
                        aria-label={isLater ? "Remove from later" : "Mark for later"}
                        className={iconBtn}
                      >
                        <Clock className={`h-4 w-4 ${isLater ? "text-[#C58B43]" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void apply([m.guidId], isUnread ? "Read" : "Unread")}
                        disabled={isUpdating}
                        title={isUnread ? "Mark as read" : "Mark as unread"}
                        aria-label={isUnread ? "Mark as read" : "Mark as unread"}
                        className={iconBtn}
                      >
                        {isUnread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                  className="rounded-xl border border-border bg-surface px-4 py-1.5 text-xs font-bold text-foreground transition hover:border-[#0A6265] disabled:opacity-40"
                >
                  Prior
                </button>

                {getVisiblePages(safePage, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`ellipsis-${i}`} className="select-none px-2 text-xs text-foreground-muted">
                      …
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`h-8 w-8 rounded-xl border text-xs font-bold transition ${
                        p === safePage
                          ? "border-[#0A6265] bg-[#0A6265] text-white shadow-2xs"
                          : "border-border bg-surface text-foreground hover:border-[#0A6265]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                  className="rounded-xl border border-border bg-surface px-4 py-1.5 text-xs font-bold text-foreground transition hover:border-[#0A6265] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
