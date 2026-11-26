"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Clock, Headset, Mail, MailOpen, Star } from "lucide-react";
import { useCurrentHeedMessage } from "@/lib/hooks/users/heed/current/useCurrentHeedMessage";
import { useUpdateHeedMessageStatus } from "@/lib/hooks/users/heed/status/useUpdateHeedMessageStatus";
import HeedReplyBox from "../partials/HeedReplyBox";
import { categoryTone, formatDay, formatTime } from "../partials/heedFormat";

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {children}
    </span>
  );
}

function DaySeparator({ value }: { value?: string | null }) {
  const label = formatDay(value);
  if (!label) return null;
  return (
    <div className="my-2 flex justify-center">
      <span className="rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold text-foreground-secondary">
        {label}
      </span>
    </div>
  );
}

function SupportAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#193B42] text-white shadow-2xs">
      <Headset className="h-4 w-4" />
    </div>
  );
}

type LocalReply = { id: number; text: string; sentAt: string };

function CurrentHeedMessageView() {
  const searchParams = useSearchParams();
  const identifier = searchParams.get("id");

  const { message, isLoading, error } = useCurrentHeedMessage(identifier);
  const { updateStatus, isUpdating, error: updateError } = useUpdateHeedMessageStatus();

  const [localReplies, setLocalReplies] = useState<LocalReply[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const autoMarkedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!message) return;
    if (autoMarkedFor.current === message.guidId) return;
    autoMarkedFor.current = message.guidId;
    if (message.clientReadStatus === "Unread") {
      void updateStatus([message.guidId], "Read");
    }
  }, [message, updateStatus]);

  useEffect(() => {
    if (localReplies.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [localReplies.length]);

  const isStarred = message?.clientReadStatus === "Starred";
  const isLater = message?.clientReadStatus === "Later";
  const isUnread = message?.clientReadStatus === "Unread";
  const hasReply = !!message?.response;

  const statusTone =
    message?.status === "Resolved"
      ? "bg-emerald-100 text-emerald-800"
      : message?.status === "Responded"
        ? "bg-[#D6E9E3] text-[#193B42]"
        : "bg-[#F5EDE2] text-[#193B42]";

  const actionBtn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground-secondary transition hover:border-[#0A6265] hover:text-[#0A6265] disabled:opacity-40";

  return (
    <main className="min-h-screen bg-background px-4 pb-12 pt-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/pages/heed/relative"
              aria-label="Back to messages"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground-secondary transition hover:border-[#0A6265] hover:text-[#0A6265]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            {message ? (
              <>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${categoryTone(message.category)}`}
                >
                  {(message.title?.[0] ?? "S").toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="font-brand truncate text-base font-bold md:text-lg text-foreground">
                    {message.title}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone}>{message.status}</Badge>
                    <Badge tone="bg-surface-muted text-foreground-secondary">{message.category}</Badge>
                    {message.priority && (
                      <Badge tone="bg-[#F1F6F4] text-[#0A6265]">{message.priority}</Badge>
                    )}
                    {isStarred && <Badge tone="bg-[#F5EDE2] text-[#C58B43]">★ Starred</Badge>}
                    {isLater && <Badge tone="bg-[#F5EDE2] text-[#C58B43]">Later</Badge>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void updateStatus([message.guidId], isStarred ? "Read" : "Starred")}
                    disabled={isUpdating}
                    title={isStarred ? "Remove star" : "Star"}
                    className={actionBtn}
                  >
                    <Star className={`h-4 w-4 ${isStarred ? "fill-[#C58B43] text-[#C58B43]" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStatus([message.guidId], isLater ? "Read" : "Later")}
                    disabled={isUpdating}
                    title={isLater ? "Remove from later" : "Mark for later"}
                    className={actionBtn}
                  >
                    <Clock className={`h-4 w-4 ${isLater ? "text-[#C58B43]" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStatus([message.guidId], isUnread ? "Read" : "Unread")}
                    disabled={isUpdating}
                    title={isUnread ? "Mark as read" : "Mark as unread"}
                    className={actionBtn}
                  >
                    {isUnread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </button>
                </div>
              </>
            ) : (
              <h1 className="font-brand text-base font-bold text-foreground">Support Conversation</h1>
            )}
          </div>

          {updateError && <p className="mt-2 text-xs text-rose-600">{updateError}</p>}
        </div>

        {/* States */}
        {isLoading && (
          <div className="space-y-3 py-6">
            <div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-surface-muted" />
            <div className="h-20 w-3/4 animate-pulse rounded-2xl bg-surface-muted" />
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-4 py-6 text-center text-sm text-rose-800 dark:text-rose-200 space-y-3">
            <p>{error}</p>
            <Link
              href="/pages/heed/relative"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A6265] px-4 py-2 text-xs font-bold text-white"
            >
              Return to Support Inbox
            </Link>
          </div>
        )}

        {/* Conversation Thread */}
        {!isLoading && !error && message && (
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-6 shadow-xs">
            <DaySeparator value={message.createdAt} />

            {/* Learner Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[75%]">
                <p className="mb-1 mr-2 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
                  Your Message
                </p>
                <div className="rounded-2xl rounded-tr-sm bg-[#0A6265] px-4 py-3 text-white shadow-xs">
                  <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-teal-100">
                    <span>{formatTime(message.createdAt)}</span>
                    {hasReply ? (
                      <CheckCheck className="h-3.5 w-3.5 text-teal-200" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
                {(message.email || message.phone) && (
                  <p className="mr-2 mt-1 text-right text-[10px] text-foreground-muted">
                    {[message.email, message.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {/* Support Team Message */}
            {hasReply && <DaySeparator value={message.respondedAt} />}

            <div className="flex items-end gap-2.5">
              <SupportAvatar />
              <div className="max-w-[85%] md:max-w-[75%]">
                <p className="mb-1 ml-2 text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
                  QuizNurse Support Team
                </p>

                {hasReply ? (
                  <div className="rounded-2xl rounded-tl-sm border border-[#0A6265]/30 bg-[#F1F6F4] dark:bg-teal-950/30 px-4 py-3 text-foreground shadow-xs">
                    <p className="whitespace-pre-wrap break-words text-sm">{message.response}</p>
                    <div className="mt-1.5 text-right text-[10px] text-foreground-muted">
                      {formatTime(message.respondedAt)}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-surface-muted/60 px-4 py-3">
                    <span className="text-xs text-foreground-secondary">
                      Our clinical support team is reviewing your inquiry.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Session Follow-up Replies */}
            {localReplies.map((r) => (
              <div key={r.id} className="flex justify-end">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="rounded-2xl rounded-tr-sm bg-[#0A6265] px-4 py-3 text-white shadow-xs">
                    <p className="whitespace-pre-wrap break-words text-sm">{r.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-teal-100">
                      <span>{formatTime(r.sentAt)}</span>
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {localReplies.length > 0 && (
              <p className="text-center text-[11px] text-foreground-muted">
                Your follow-up reply has been delivered to our support team.
              </p>
            )}

            <div ref={bottomRef} />

            {/* Reply Composer */}
            <div className="sticky bottom-3 rounded-2xl border border-border bg-background p-3.5 shadow-md">
              <p className="mb-2 ml-1 text-[11px] font-bold uppercase tracking-wide text-foreground-secondary">
                Reply To Our Team
              </p>
              <HeedReplyBox
                parent={message}
                onSent={(text, sentAt) =>
                  setLocalReplies((prev) => [...prev, { id: Date.now(), text, sentAt }])
                }
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function CurrentHeedMessagePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-20 text-center text-foreground-secondary">Loading conversation…</div>}>
      <CurrentHeedMessageView />
    </Suspense>
  );
}
