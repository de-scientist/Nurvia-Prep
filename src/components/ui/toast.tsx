"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  FileQuestion,
  Hourglass,
  Info,
  Lock,
  SearchX,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { FeedbackCategory, FeedbackItem } from "@/lib/feedback/feedback-types";

interface ToastProps {
  item: FeedbackItem;
  onDismiss: (id: string) => void;
}

function getCategoryConfig(category: FeedbackCategory) {
  switch (category) {
    case "success":
      return {
        icon: CheckCircle2,
        bg: "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        ariaRole: "status",
      };
    case "partial_success":
      return {
        icon: CheckCheck,
        bg: "bg-teal-50 dark:bg-teal-950/80 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-100",
        iconColor: "text-teal-600 dark:text-teal-400",
        ariaRole: "status",
      };
    case "warning":
    case "conflict":
    case "temporary_issue":
      return {
        icon: AlertTriangle,
        bg: "bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
        iconColor: "text-amber-600 dark:text-amber-400",
        ariaRole: "alert",
      };
    case "coming_soon":
      return {
        icon: Sparkles,
        bg: "bg-violet-50 dark:bg-violet-950/80 border-violet-200 dark:border-violet-800 text-violet-900 dark:text-violet-100",
        iconColor: "text-violet-600 dark:text-violet-400",
        ariaRole: "status",
      };
    case "authentication_required":
      return {
        icon: Lock,
        bg: "bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
        iconColor: "text-amber-600 dark:text-amber-400",
        ariaRole: "alert",
      };
    case "permission_denied":
      return {
        icon: ShieldAlert,
        bg: "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100",
        iconColor: "text-rose-600 dark:text-rose-400",
        ariaRole: "alert",
      };
    case "not_found":
      return {
        icon: SearchX,
        bg: "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100",
        iconColor: "text-slate-600 dark:text-slate-400",
        ariaRole: "status",
      };
    case "unsupported_format":
      return {
        icon: FileQuestion,
        bg: "bg-purple-50 dark:bg-purple-950/80 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100",
        iconColor: "text-purple-600 dark:text-purple-400",
        ariaRole: "status",
      };
    case "rate_limited":
      return {
        icon: Hourglass,
        bg: "bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100",
        iconColor: "text-orange-600 dark:text-orange-400",
        ariaRole: "alert",
      };
    case "maintenance":
      return {
        icon: Wrench,
        bg: "bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100",
        iconColor: "text-blue-600 dark:text-blue-400",
        ariaRole: "status",
      };
    case "validation_error":
    case "error":
    default:
      return {
        icon: AlertCircle,
        bg: "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100",
        iconColor: "text-red-600 dark:text-red-400",
        ariaRole: "alert",
      };
    case "info":
      return {
        icon: Info,
        bg: "bg-sky-50 dark:bg-sky-950/80 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100",
        iconColor: "text-sky-600 dark:text-sky-400",
        ariaRole: "status",
      };
  }
}

export function ToastItemView({ item, onDismiss }: ToastProps) {
  const config = getCategoryConfig(item.category);
  const Icon = config.icon;

  return (
    <div
      role={config.ariaRole}
      aria-live={config.ariaRole === "alert" ? "assertive" : "polite"}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${config.bg}`}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Icon className={`h-5 w-5 ${config.iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        {item.title && (
          <h4 className="text-sm font-semibold tracking-tight mb-0.5">
            {item.title}
          </h4>
        )}
        <p className="text-xs leading-relaxed text-inherit opacity-90 break-words">
          {item.message}
        </p>

        {item.action && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
              className="inline-flex items-center rounded-lg bg-foreground/10 px-2.5 py-1 text-xs font-medium hover:bg-foreground/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.action.label}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 -mr-1 -mt-1 rounded-lg p-1.5 opacity-60 hover:opacity-100 transition-opacity hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer({
  items,
  onDismiss,
}: {
  items: FeedbackItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2.5 max-w-md w-[calc(100%-2rem)] pointer-events-none"
    >
      {items.map((item) => (
        <ToastItemView key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
