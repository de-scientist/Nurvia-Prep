"use client";

import * as React from "react";
import {
  FeedbackAction,
  FeedbackCategory,
  FeedbackItem,
  mapHttpStatusToFeedback,
} from "./feedback-types";
import { ToastContainer } from "@/components/ui/toast";

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  title?: string;
  durationMs?: number;
  action?: FeedbackAction;
}

export interface FeedbackContextValue {
  showFeedback: (input: FeedbackInput) => string;
  dismissFeedback: (id: string) => void;
  clearAll: () => void;
  showSuccess: (message: string, title?: string, action?: FeedbackAction) => string;
  showError: (message: string, title?: string, action?: FeedbackAction) => string;
  showWarning: (message: string, title?: string, action?: FeedbackAction) => string;
  showInfo: (message: string, title?: string, action?: FeedbackAction) => string;
  showFromHttp: (
    statusCode: number | undefined,
    backendMessage?: string,
    featureName?: string
  ) => string;
  items: FeedbackItem[];
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

// Global imperative event bus for non-hook callers
type FeedbackListener = (input: FeedbackInput) => void;
const listeners = new Set<FeedbackListener>();

export const feedback = {
  show(input: FeedbackInput) {
    listeners.forEach((listener) => listener(input));
  },
  success(message: string, title: string = "Success", action?: FeedbackAction) {
    this.show({ category: "success", title, message, action });
  },
  error(message: string, title: string = "Error", action?: FeedbackAction) {
    this.show({ category: "error", title, message, action });
  },
  warn(message: string, title: string = "Warning", action?: FeedbackAction) {
    this.show({ category: "warning", title, message, action });
  },
  info(message: string, title: string = "Info", action?: FeedbackAction) {
    this.show({ category: "info", title, message, action });
  },
  fromHttp(statusCode: number | undefined, backendMessage?: string, featureName?: string) {
    const mapped = mapHttpStatusToFeedback(statusCode, backendMessage, featureName);
    this.show({
      category: mapped.category,
      title: mapped.title,
      message: mapped.message,
    });
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<FeedbackItem[]>([]);
  const recentDedupeRef = React.useRef<Map<string, number>>(new Map());

  const dismissFeedback = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setItems([]);
  }, []);

  const showFeedback = React.useCallback(
    (input: FeedbackInput): string => {
      const now = Date.now();
      const dedupeKey = `${input.category}:${input.message}`;
      const lastSeen = recentDedupeRef.current.get(dedupeKey);

      // Deduplicate if identical category + message triggered within 1500ms
      if (lastSeen && now - lastSeen < 1500) {
        return "";
      }
      recentDedupeRef.current.set(dedupeKey, now);

      const id = `fb-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const duration = input.durationMs ?? 4500;

      const newItem: FeedbackItem = {
        id,
        category: input.category,
        title: input.title,
        message: input.message,
        durationMs: duration,
        action: input.action,
        timestamp: now,
      };

      setItems((prev) => [newItem, ...prev.slice(0, 4)]); // max 5 concurrent toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissFeedback(id);
        }, duration);
      }

      return id;
    },
    [dismissFeedback]
  );

  React.useEffect(() => {
    const handleGlobalFeedback: FeedbackListener = (input) => {
      showFeedback(input);
    };
    listeners.add(handleGlobalFeedback);
    return () => {
      listeners.delete(handleGlobalFeedback);
    };
  }, [showFeedback]);

  const showSuccess = React.useCallback(
    (message: string, title?: string, action?: FeedbackAction) =>
      showFeedback({ category: "success", title: title || "Success", message, action }),
    [showFeedback]
  );

  const showError = React.useCallback(
    (message: string, title?: string, action?: FeedbackAction) =>
      showFeedback({ category: "error", title: title || "Error", message, action }),
    [showFeedback]
  );

  const showWarning = React.useCallback(
    (message: string, title?: string, action?: FeedbackAction) =>
      showFeedback({ category: "warning", title: title || "Warning", message, action }),
    [showFeedback]
  );

  const showInfo = React.useCallback(
    (message: string, title?: string, action?: FeedbackAction) =>
      showFeedback({ category: "info", title: title || "Info", message, action }),
    [showFeedback]
  );

  const showFromHttp = React.useCallback(
    (statusCode: number | undefined, backendMessage?: string, featureName?: string) => {
      const mapped = mapHttpStatusToFeedback(statusCode, backendMessage, featureName);
      return showFeedback({
        category: mapped.category,
        title: mapped.title,
        message: mapped.message,
      });
    },
    [showFeedback]
  );

  const value = React.useMemo(
    () => ({
      showFeedback,
      dismissFeedback,
      clearAll,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showFromHttp,
      items,
    }),
    [
      showFeedback,
      dismissFeedback,
      clearAll,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showFromHttp,
      items,
    ]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastContainer items={items} onDismiss={dismissFeedback} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a <FeedbackProvider>");
  }
  return context;
}
