"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  RefreshCw,
  Search,
  MessageSquarePlus,
  MessageSquareText,
  Send,
  Star,
  Clock,
  Mail,
  MailOpen,
  Inbox,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Headphones,
  LogIn,
} from "lucide-react";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import {
  useRelativeHeedMessage,
  type HeedMessageItem,
} from "@/lib/hooks/users/heed/relative/useRelativeHeedMessage";
import {
  useUpdateHeedMessageStatus,
  HEED_STATUS_EVENT,
} from "@/lib/hooks/users/heed/status/useUpdateHeedMessageStatus";
import {
  submitSupportIssue,
  type ClientReadStatus,
} from "@/lib/services/auth/supportService";
import { feedback } from "@/lib/feedback/feedback-context";
import { cn } from "@/lib/utils";

export const SUPPORT_CATEGORIES = [
  "Exam or Technical Issue",
  "Payment / Billing Issue",
  "Unable To Access Account",
  "Account Recovery Problem",
  "Something Else",
] as const;

export type SupportFilterTab = "All" | "Unread" | "Later" | "Starred";

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function StatusBadge({ status }: { status?: string | null }) {
  const norm = (status || "").toLowerCase();
  const classes =
    norm === "resolved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/40"
      : norm === "responded"
        ? "bg-[#D6E9E3] text-[#193B42] dark:bg-teal-950/60 dark:text-teal-300 border-[#0A6265]/30"
        : "bg-[#F5EDE2] text-[#193B42] dark:bg-amber-950/60 dark:text-amber-300 border-[#C58B43]/40";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        classes
      )}
    >
      {status || "Open"}
    </span>
  );
}

export function filterAndSearchSupportConversations(
  items: HeedMessageItem[],
  filter: SupportFilterTab,
  query: string
): HeedMessageItem[] {
  const trimmed = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== "All" && item.clientReadStatus !== filter) {
      return false;
    }
    if (trimmed) {
      const hay = [item.title, item.message, item.response, item.category, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(trimmed)) {
        return false;
      }
    }
    return true;
  });
}

export function NavbarSupportMessaging() {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const optionalAuth = useOptionalAuth();
  const authUser = optionalAuth?.user ?? null;
  const authStatus = optionalAuth?.status ?? "unauthenticated";
  const { user: sysUser } = useCurrentSystemUser();

  const currentUser = React.useMemo(() => {
    if (sysUser) {
      return {
        email: sysUser.email,
        userName: sysUser.userName,
        guidId: sysUser.guidId,
        phone: sysUser.phones?.find((p) => p.isPrimary)?.phoneNumber || "",
      };
    }
    if (authUser && authStatus === "authenticated") {
      return {
        email: authUser.email,
        userName: authUser.name,
        guidId: authUser.id,
        phone: "",
      };
    }
    return null;
  }, [sysUser, authUser, authStatus]);

  const isAuthenticated = Boolean(currentUser);

  const [activeTab, setActiveTab] = React.useState<SupportFilterTab>("All");
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Authoritative conversation dataset (only queried when authenticated to prevent guest 401 errors)
  const {
    messages: allMessages,
    isLoading,
    error,
    refetch,
    setMessageSearch,
  } = useRelativeHeedMessage({
    items: 100,
    clientStatus: null,
    pollMs: isOpen && isAuthenticated ? 30_000 : 0,
    enabled: isAuthenticated,
  });

  const { updateStatus, isUpdating } = useUpdateHeedMessageStatus();

  React.useEffect(() => {
    if (isAuthenticated) {
      setMessageSearch(debouncedSearch);
    }
  }, [debouncedSearch, isAuthenticated, setMessageSearch]);

  // Composer state for starting a new conversation
  const [showComposer, setShowComposer] = React.useState(false);
  const [composerSubject, setComposerSubject] = React.useState("");
  const [composerCategory, setComposerCategory] = React.useState<string>(SUPPORT_CATEGORIES[0]);
  const [composerMessage, setComposerMessage] = React.useState("");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [composerError, setComposerError] = React.useState<string | null>(null);
  const [composerSuccess, setComposerSuccess] = React.useState<string | null>(null);

  // Active detail view for opening a conversation thread
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [sendingReply, setSendingReply] = React.useState(false);
  const [replyFeedback, setReplyFeedback] = React.useState<string | null>(null);

  const selectedConversation = React.useMemo(
    () =>
      selectedConversationId
        ? allMessages.find((m) => (m.guidId || String(m.id)) === selectedConversationId) ?? null
        : null,
    [allMessages, selectedConversationId]
  );

  // Close popup when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key and restore focus to trigger
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Derived conversation counts independent of currently selected filter tab
  const counts = React.useMemo(() => {
    return {
      All: allMessages.length,
      Unread: allMessages.filter((m) => m.clientReadStatus === "Unread").length,
      Later: allMessages.filter((m) => m.clientReadStatus === "Later").length,
      Starred: allMessages.filter((m) => m.clientReadStatus === "Starred").length,
    };
  }, [allMessages]);

  const unreadCount = counts.Unread;

  const visibleMessages = React.useMemo(
    () => filterAndSearchSupportConversations(allMessages, activeTab, debouncedSearch),
    [allMessages, activeTab, debouncedSearch]
  );

  const inboxStatusLabel = React.useMemo(() => {
    if (!isAuthenticated) return "Support Desk";
    if (isLoading && allMessages.length === 0) return "Syncing…";
    if (error && allMessages.length === 0) return "Unavailable";
    if (unreadCount > 0) return `${unreadCount} unread`;
    if (counts.All > 0) return "All caught up";
    return "0 conversations";
  }, [isAuthenticated, isLoading, error, allMessages.length, unreadCount, counts.All]);

  const currentReturnHref = React.useMemo(() => {
    const dest = pathname && pathname.startsWith("/") ? pathname : "/";
    return `/sign-in?returnTo=${encodeURIComponent(dest)}`;
  }, [pathname]);

  const handleStartNew = () => {
    setSelectedConversationId(null);
    setShowComposer(true);
    setComposerError(null);
    setComposerSuccess(null);
  };

  const handleSendNewMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setComposerError(null);
    setComposerSuccess(null);

    const text = composerMessage.trim();
    if (text.length < 10) {
      setComposerError("Please enter at least 10 characters to describe your inquiry.");
      return;
    }

    const email = (currentUser?.email || guestEmail).trim();
    if (!email || !email.includes("@")) {
      setComposerError("A valid email address is required so our support team can reply.");
      return;
    }

    const cleanSubject = composerSubject.trim();
    const formattedBody = cleanSubject ? `[Subject: ${cleanSubject}]\n\n${text}` : text;
    const resolvedPhone = (currentUser?.phone || guestPhone).trim() || "+10000000000";

    setSubmitting(true);
    try {
      const res = await submitSupportIssue({
        ...(currentUser?.guidId ? { userGuidId: currentUser.guidId } : {}),
        email,
        phone: resolvedPhone,
        category: composerCategory,
        ...(cleanSubject ? { title: cleanSubject } : {}),
        message: formattedBody,
      });

      if (res?.error || res?.success === false) {
        throw new Error(res.error ?? res.message ?? "Unable to submit message. Please try again.");
      }

      const confirmMsg = "Your message has been sent to our support team.";
      setComposerSuccess(confirmMsg);
      feedback.success(confirmMsg, "Message Sent");
      setComposerSubject("");
      setComposerMessage("");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HEED_STATUS_EVENT));
      }

      if (isAuthenticated) {
        await refetch();
      }

      setTimeout(() => {
        setShowComposer(false);
        setComposerSuccess(null);
      }, 1200);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to send support inquiry.";
      setComposerError(errMsg);
      feedback.error(errMsg, "Support Submission Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStar = async (item: HeedMessageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: ClientReadStatus = item.clientReadStatus === "Starred" ? "Read" : "Starred";
    const ok = await updateStatus([item.guidId], nextStatus);
    if (ok) await refetch();
  };

  const handleToggleLater = async (item: HeedMessageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: ClientReadStatus = item.clientReadStatus === "Later" ? "Read" : "Later";
    const ok = await updateStatus([item.guidId], nextStatus);
    if (ok) await refetch();
  };

  const handleToggleRead = async (item: HeedMessageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: ClientReadStatus = item.clientReadStatus === "Unread" ? "Read" : "Unread";
    const ok = await updateStatus([item.guidId], nextStatus);
    if (ok) await refetch();
  };

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || sendingReply) return;
    if (replyText.trim().length < 10) {
      setReplyFeedback("Please enter at least 10 characters for your reply.");
      return;
    }

    setSendingReply(true);
    setReplyFeedback(null);

    try {
      const email = selectedConversation.email || currentUser?.email || "";
      const phone = selectedConversation.phone || currentUser?.phone || "+10000000000";
      const cleanReply = replyText.trim();
      const body = `[Reply to "${selectedConversation.title}" · Ref ${selectedConversation.guidId}]\n\n${cleanReply}`;

      const res = await submitSupportIssue({
        ...(currentUser?.guidId ? { userGuidId: currentUser.guidId } : {}),
        email,
        phone,
        category: selectedConversation.category || "Exam or Technical Issue",
        message: body,
      });

      if (res?.error || res?.success === false) {
        throw new Error(res.error ?? res.message ?? "Failed to send reply.");
      }

      setReplyFeedback("Reply delivered to support.");
      feedback.success("Follow-up reply delivered to support.", "Reply Sent");
      setReplyText("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HEED_STATUS_EVENT));
      }
      await refetch();
      setTimeout(() => setReplyFeedback(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reply.";
      setReplyFeedback(msg);
      feedback.error(msg, "Reply Failed");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        data-testid="navbar-support-messaging-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setShowComposer(false);
          setSelectedConversationId(null);
        }}
        aria-label={unreadCount > 0 ? `Message Support (${unreadCount} unread)` : "Message Support"}
        title="Message Support"
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6265]",
          isOpen
            ? "border-[#0A6265] bg-[#0A6265]/12 text-[#0A6265] dark:text-teal-300 shadow-2xs"
            : "border-border bg-surface text-foreground-secondary hover:border-[#0A6265]/60 hover:text-[#0A6265] dark:hover:text-teal-300"
        )}
      >
        <MessageSquareText className="h-4 w-4" />
        {isAuthenticated && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0A6265] px-1 text-[9px] font-bold text-white shadow-2xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Responsive Support Popover / Mobile Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Message Support"
          className="fixed inset-x-2.5 top-15 z-50 mx-auto max-w-md sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[420px] rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col text-foreground max-h-[84vh] sm:max-h-[620px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-[#F1F6F4] via-surface to-[#F5EDE2]/50 dark:from-[#193B42]/50 dark:via-surface dark:to-surface px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0A6265]/12 text-[#0A6265] dark:text-teal-300">
                <Headphones className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground truncate">Message Support</h2>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                      unreadCount > 0
                        ? "bg-[#0A6265] text-white"
                        : "bg-[#D6E9E3]/70 dark:bg-slate-800 text-[#193B42] dark:text-teal-200"
                    )}
                  >
                    {inboxStatusLabel}
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary truncate">
                  Conversations with our support team
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isLoading}
                  aria-label="Refresh conversations"
                  title="Refresh conversations"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-muted hover:text-foreground transition disabled:opacity-40"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-[#0A6265]")} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close support interface"
                title="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Subheader / Controls */}
          <div className="p-3 bg-surface-muted/40 border-b border-border space-y-2.5">
            {!showComposer && !selectedConversation && (
              <button
                type="button"
                onClick={handleStartNew}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A6265] hover:bg-[#193B42] text-white py-2.5 px-3 text-xs font-bold shadow-2xs transition-colors"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>Start A New Conversation</span>
              </button>
            )}

            {/* Filters & Search when authenticated and browsing list */}
            {isAuthenticated && !showComposer && !selectedConversation && (
              <>
                <div
                  role="tablist"
                  aria-label="Conversation filters"
                  className="grid grid-cols-4 gap-1 rounded-xl bg-surface-muted p-1"
                >
                  {(["All", "Unread", "Later", "Starred"] as SupportFilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-lg py-1.5 px-1 text-[11px] font-bold transition text-center truncate",
                        activeTab === tab
                          ? "bg-surface text-[#0A6265] dark:text-teal-300 shadow-2xs"
                          : "text-foreground-secondary hover:text-foreground"
                      )}
                    >
                      {tab}
                      {counts[tab] > 0 ? ` (${counts[tab]})` : ""}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search conversations by subject or content…"
                    aria-label="Search support conversations"
                    className="w-full rounded-xl border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                  />
                </div>
              </>
            )}

            {/* Back button when composing or viewing thread */}
            {(showComposer || selectedConversation) && (
              <button
                type="button"
                onClick={() => {
                  setShowComposer(false);
                  setSelectedConversationId(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A6265] dark:text-teal-300 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>
                  {isAuthenticated ? `Back to Conversations (${counts.All})` : "Back to Support Desk"}
                </span>
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[240px] max-h-[380px]">
            {/* VIEW 1: Composer for New Conversation */}
            {showComposer && (
              <form onSubmit={handleSendNewMessage} className="space-y-3 pt-0.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                    Support Category
                  </label>
                  <select
                    value={composerCategory}
                    onChange={(e) => setComposerCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                  >
                    {SUPPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={composerSubject}
                    onChange={(e) => setComposerSubject(e.target.value)}
                    placeholder="Brief summary of your question…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                  />
                </div>

                {!isAuthenticated && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                        Your Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@nursing.edu"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-secondary mb-1">
                    Your Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={composerMessage}
                    onChange={(e) => setComposerMessage(e.target.value)}
                    placeholder="Describe your technical inquiry, subscription question, or examination issue…"
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                  />
                  <span className="text-[10px] text-foreground-muted">
                    At least 10 characters ({composerMessage.trim().length}/10).
                  </span>
                </div>

                {composerError && (
                  <div
                    role="alert"
                    className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 text-xs text-rose-800 dark:text-rose-200"
                  >
                    {composerError}
                  </div>
                )}
                {composerSuccess && (
                  <div
                    role="status"
                    className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{composerSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6265] hover:bg-[#193B42] text-white py-2.5 px-4 text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting Inquiry…</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send to Support</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* VIEW 2: Conversation Details & Replies */}
            {selectedConversation && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6265] dark:text-teal-300">
                        {selectedConversation.category || "General Support"}
                      </span>
                      <h3 className="text-xs font-bold text-foreground mt-0.5">
                        {selectedConversation.title || `Inquiry #${selectedConversation.id}`}
                      </h3>
                    </div>
                    <StatusBadge status={selectedConversation.status} />
                  </div>
                  <p className="text-xs text-foreground-secondary whitespace-pre-wrap leading-relaxed">
                    {selectedConversation.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-foreground-muted">
                      Submitted {formatShortDate(selectedConversation.createdAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => void handleToggleRead(selectedConversation, e)}
                        title={
                          selectedConversation.clientReadStatus === "Unread"
                            ? "Mark as Read"
                            : "Mark as Unread"
                        }
                        className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground"
                      >
                        {selectedConversation.clientReadStatus === "Unread" ? (
                          <MailOpen className="h-3.5 w-3.5" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => void handleToggleLater(selectedConversation, e)}
                        title={
                          selectedConversation.clientReadStatus === "Later"
                            ? "Remove from Later"
                            : "Move to Later"
                        }
                        className={cn(
                          "rounded-lg p-1.5",
                          selectedConversation.clientReadStatus === "Later"
                            ? "text-[#C58B43]"
                            : "text-foreground-muted hover:bg-surface hover:text-foreground"
                        )}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => void handleToggleStar(selectedConversation, e)}
                        title={
                          selectedConversation.clientReadStatus === "Starred" ? "Unstar" : "Star"
                        }
                        className={cn(
                          "rounded-lg p-1.5",
                          selectedConversation.clientReadStatus === "Starred"
                            ? "text-[#C58B43] fill-[#C58B43]"
                            : "text-foreground-muted hover:bg-surface hover:text-foreground"
                        )}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Support Response */}
                {selectedConversation.response ? (
                  <div className="rounded-xl border border-[#0A6265]/30 bg-[#F1F6F4] dark:bg-teal-950/30 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#0A6265] dark:text-teal-300">
                      <span>QuizNurse Support Team</span>
                      <span className="text-[10px] text-foreground-muted font-normal">
                        {formatShortDate(selectedConversation.respondedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {selectedConversation.response}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-3 text-center">
                    <p className="text-xs text-foreground-secondary">
                      Our support team is reviewing this conversation and will reply shortly.
                    </p>
                  </div>
                )}

                {/* Reply Composer */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a follow-up reply (min 10 characters)…"
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
                  />
                  {replyFeedback && (
                    <p className="text-xs font-medium text-[#0A6265] dark:text-teal-300">
                      {replyFeedback}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={sendingReply || !replyText.trim()}
                      onClick={() => void handleSendReply()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#193B42] hover:bg-[#0A6265] text-white py-2 text-xs font-semibold disabled:opacity-40 transition"
                    >
                      <Send className="h-3 w-3" />
                      <span>{sendingReply ? "Sending…" : "Send Reply"}</span>
                    </button>
                    <Link
                      href={`/pages/heed/current?id=${encodeURIComponent(selectedConversation.guidId)}`}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground-secondary hover:text-foreground hover:bg-surface-muted"
                    >
                      Open Thread
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: Guest Prompt or Authenticated Conversation List */}
            {!showComposer && !selectedConversation && (
              <>
                {!isAuthenticated ? (
                  <div className="py-6 px-2 text-center space-y-3">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F6F4] text-[#0A6265]">
                      <Headphones className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">
                        Need assistance from our team?
                      </p>
                      <p className="text-[11px] text-foreground-secondary leading-relaxed max-w-xs mx-auto">
                        Click <strong>Start A New Conversation</strong> above to reach support right away, or sign in to view your saved support inbox and replies.
                      </p>
                    </div>
                    <Link
                      href={currentReturnHref}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0A6265]/40 bg-[#F1F6F4] px-4 py-2 text-xs font-bold text-[#0A6265] hover:bg-[#0A6265] hover:text-white transition"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Sign In to View Past Conversations</span>
                    </Link>
                  </div>
                ) : isLoading && allMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0A6265]" />
                    <p className="text-xs text-foreground-secondary">Loading your conversations…</p>
                  </div>
                ) : error && allMessages.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <AlertCircle className="mx-auto h-6 w-6 text-rose-500" />
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{error}</p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="text-xs text-[#0A6265] dark:text-teal-300 font-bold hover:underline"
                    >
                      Try Again
                    </button>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      {debouncedSearch
                        ? "No matching conversations found"
                        : `No conversations in ${activeTab}`}
                    </p>
                    <p className="text-[11px] text-foreground-muted max-w-xs mx-auto">
                      {debouncedSearch
                        ? "Try clearing your search or switching conversation filters."
                        : activeTab === "All"
                          ? "You have no support threads yet. Click 'Start A New Conversation' above whenever you need help."
                          : `No conversations are currently marked as ${activeTab}.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleMessages.map((item) => {
                      const isUnread = item.clientReadStatus === "Unread";
                      const isStarred = item.clientReadStatus === "Starred";
                      const isLater = item.clientReadStatus === "Later";
                      const keyId = item.guidId || String(item.id);

                      return (
                        <div
                          key={keyId}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedConversationId(keyId);
                              if (isUnread) {
                                void updateStatus([item.guidId], "Read").then(() => refetch());
                              }
                            }
                          }}
                          onClick={() => {
                            setSelectedConversationId(keyId);
                            if (isUnread) {
                              void updateStatus([item.guidId], "Read").then(() => refetch());
                            }
                          }}
                          className={cn(
                            "group relative rounded-xl border p-3 transition-all cursor-pointer hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6265]",
                            isUnread
                              ? "border-[#0A6265]/45 bg-[#F1F6F4]/60 dark:bg-teal-950/25"
                              : "border-border bg-surface hover:border-[#0A6265]/35"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {isUnread && (
                                <span
                                  aria-label="Unread"
                                  className="mt-1 h-2 w-2 rounded-full bg-[#0A6265] shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4
                                    className={cn(
                                      "text-xs text-foreground truncate",
                                      isUnread ? "font-extrabold" : "font-bold"
                                    )}
                                  >
                                    {item.title || `Inquiry: ${item.category}`}
                                  </h4>
                                  {isStarred && (
                                    <Star className="h-3 w-3 shrink-0 fill-[#C58B43] text-[#C58B43]" />
                                  )}
                                  {isLater && <Clock className="h-3 w-3 shrink-0 text-[#C58B43]" />}
                                </div>
                                <p className="text-[11px] text-foreground-secondary line-clamp-2 mt-0.5">
                                  {item.response ? `Support: ${item.response}` : item.message}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] text-foreground-muted shrink-0">
                              {formatShortDate(item.respondedAt || item.updatedAt || item.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <StatusBadge status={item.status} />
                              {item.category && (
                                <span className="text-[10px] text-foreground-muted truncate max-w-[135px]">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={(e) => void handleToggleRead(item, e)}
                                aria-label={isUnread ? "Mark as Read" : "Mark as Unread"}
                                title={isUnread ? "Mark as Read" : "Mark as Unread"}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                              >
                                {isUnread ? (
                                  <MailOpen className="h-3.5 w-3.5" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={(e) => void handleToggleLater(item, e)}
                                aria-label={isLater ? "Remove from Later" : "Move to Later"}
                                title={isLater ? "Remove from Later" : "Move to Later"}
                                className={cn(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                                  isLater
                                    ? "text-[#C58B43]"
                                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                                )}
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={(e) => void handleToggleStar(item, e)}
                                aria-label={isStarred ? "Unstar" : "Star"}
                                title={isStarred ? "Unstar" : "Star"}
                                className={cn(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                                  isStarred
                                    ? "text-[#C58B43] fill-[#C58B43]"
                                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                                )}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer: Open Full Inbox Page */}
          <div className="border-t border-border bg-surface-muted/50 p-2.5 text-center">
            <Link
              href={
                isAuthenticated
                  ? "/pages/heed/relative"
                  : `/sign-in?returnTo=${encodeURIComponent("/pages/heed/relative")}`
              }
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#0A6265] dark:text-teal-300 hover:underline transition"
            >
              <span>Open Full Inbox Page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
