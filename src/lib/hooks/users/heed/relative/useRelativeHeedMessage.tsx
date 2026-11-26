'use client';

import { useEffect, useState, useCallback } from "react";
import {
  fetchRelativeSupportMessages,
  type ClientReadStatus,
  type SupportMessageItem,
} from "@/lib/services/auth/supportService";
import { HEED_STATUS_EVENT } from "@/lib/hooks/users/heed/status/useUpdateHeedMessageStatus";

export type HeedMessageItem = SupportMessageItem;

function extractSupportItems(raw: unknown): HeedMessageItem[] {
  if (Array.isArray(raw)) return raw as HeedMessageItem[];
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.items)) return rec.items as HeedMessageItem[];
    if (Array.isArray(rec.data)) return rec.data as HeedMessageItem[];
    if (rec.data && typeof rec.data === "object" && Array.isArray((rec.data as Record<string, unknown>).items)) {
      return (rec.data as Record<string, unknown>).items as HeedMessageItem[];
    }
  }
  return [];
}

export const useRelativeHeedMessage = ({
  items = 20,
  clientStatus = null,
  pollMs = 0,
  enabled = true,
}: {
  items?: number;
  clientStatus?: ClientReadStatus | null;
  pollMs?: number;
  enabled?: boolean;
} = {}) => {
  const [messages, setMessages] = useState<HeedMessageItem[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(
    async (search: string, isCancelled: () => boolean = () => false, silent = false) => {
      if (!enabled) {
        setMessages([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        if (!silent) {
          setIsLoading(true);
          setError(null);
        }

        const result = await fetchRelativeSupportMessages({
          dynamicItems: items,
          dynamicSearch: search,
          dynamicClientStatus: clientStatus ?? undefined,
        });

        if (isCancelled()) return;

        if (result?.error || result?.success === false) {
          throw new Error(result.error ?? result.message ?? "Failed to Fetch Messages ⚓");
        }

        setMessages(extractSupportItems(result?.data ?? result));
        setError(null);
      } catch (err) {
        if (isCancelled() || silent) return;
        setMessages([]);
        setError(err instanceof Error ? err.message : "Failed to Fetch Messages ⚓");
      } finally {
        if (!silent && !isCancelled()) setIsLoading(false);
      }
    },
    [items, clientStatus, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    void fetchMessages(messageSearch, isCancelled);

    const onChange = () => void fetchMessages(messageSearch, isCancelled, true);
    window.addEventListener(HEED_STATUS_EVENT, onChange);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) {
      timer = setInterval(onChange, pollMs);
      window.addEventListener("focus", onChange);
    }

    return () => {
      cancelled = true;
      window.removeEventListener(HEED_STATUS_EVENT, onChange);
      window.removeEventListener("focus", onChange);
      if (timer) clearInterval(timer);
    };
  }, [messageSearch, fetchMessages, pollMs, enabled]);

  const refetch = useCallback(() => fetchMessages(messageSearch), [fetchMessages, messageSearch]);

  return {
    messages,
    messageSearch,
    setMessageSearch,
    isLoading,
    error,
    refetch,
  };
};
