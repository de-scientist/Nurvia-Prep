"use client";

import { useMemo, useState, useEffect } from "react";
import { useDistinctDominionSubscriptionItems } from "@/lib/hooks/nexus/subscription/items/distinct/useDistinctDominionSubscriptionItems";
import { dominionService } from "@/lib/services/nexus/dominion/dominionService";
import {
  subscriptionCart,
  buildActiveSubscriptionMessage,
  buildValidatedLearningContext,
  matchActiveSubscriptionForPackage,
} from "@/lib/subscriptions/cart-store";
import {
  normalizeBackendCatalogueRecord,
  evaluatePackageSelectionEligibility,
  isPermittedLearnerCataloguePackage,
  classifyPermittedCatalogueCategory,
  type PermittedSubscriptionCategory,
} from "@/lib/subscriptions/catalogue-normalizer";
import type { ActiveSubscriptionSummary } from "@/lib/subscriptions/entitlement-service";
import { feedback } from "@/lib/feedback/feedback-context";
import { cn } from "@/lib/utils";

interface SubscriptionItemProps {
  parentTableName: string;
  parentName: string;
  dashboardName: string;
  heading?: string;
  subheading?: string;
  perPage?: number;
  showSearch?: boolean;
  learningContext?: {
    returnTo?: string;
    requiredMode?: "Exam" | "Tutor" | "Review";
    examId?: string;
    pathway?: string;
    subject?: string;
    layout?: "Sequential" | "AllInOne";
    attemptId?: string;
  };
  onSubscribe?: (item: { guidId?: string; id: number; name: string }) => void;
}

export default function SubscriptionItem({
  parentTableName,
  parentName,
  dashboardName,
  heading = "Exam Prep Plans",
  subheading,
  perPage = 50,
  showSearch = true,
  learningContext,
  onSubscribe,
}: SubscriptionItemProps) {
  const {
    filteredSubscriptionItems,
    subscriptionItemSearch,
    setSubscriptionItemSearch,
    skewTotal,
  } = useDistinctDominionSubscriptionItems({
    parentTableName,
    parentName,
    page: 1,
    perPage,
    sortDirection: "asc",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<number | null>(null);
  const [activeSubs, setActiveSubs] = useState<ActiveSubscriptionSummary[]>([]);

  const isAllowedProgram =
    parentName === "RN_NURSING" ||
    parentName === "LPN_NURSING" ||
    parentName === "RN" ||
    parentName === "PN_LPN";

  useEffect(() => {
    const fetchActiveSubs = async () => {
      try {
        const pathwayParam = encodeURIComponent(
          parentName.toUpperCase().includes("LPN") || parentName.toUpperCase().includes("PN")
            ? "PN_LPN"
            : "RN"
        );
        const modeParam = encodeURIComponent(learningContext?.requiredMode || "Exam");
        const res = await fetch(`/api/subscriptions/status?mode=${modeParam}&pathway=${pathwayParam}`, {
          headers: { "Cache-Control": "no-store" },
        });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.activeSubscriptions)) {
          setActiveSubs(data.activeSubscriptions as ActiveSubscriptionSummary[]);
        }
      } catch {
        // Non-fatal
      }
    };
    void fetchActiveSubs();
  }, [parentName, learningContext?.requiredMode]);

  const sortedItems = useMemo(() => {
    if (!isAllowedProgram) return [];
    const dedupedMap = new Map<string, (typeof filteredSubscriptionItems)[number]>();

    for (const item of filteredSubscriptionItems) {
      const cat = classifyPermittedCatalogueCategory({
        ...(item as unknown as Record<string, unknown>),
        parentName,
      });
      if (!cat) continue;
      const key = cat;
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, { ...item, name: cat });
      } else {
        if (existing.amount === undefined && item.amount !== undefined) {
          dedupedMap.set(key, { ...item, name: cat });
        }
      }
    }

    return Array.from(dedupedMap.values()).sort((a, b) => (a.cardNumber ?? 0) - (b.cardNumber ?? 0));
  }, [filteredSubscriptionItems, isAllowedProgram, parentName]);

  const handleSubscribe = async (item: (typeof sortedItems)[number]) => {
    const programCode =
      parentName.toUpperCase().includes("LPN") || parentName.toUpperCase().includes("PN") ? "PN_LPN" : "RN";
    const directActiveMatch = matchActiveSubscriptionForPackage(
      {
        id: item.id,
        guidId: item.guidId,
        name: item.name,
        programCode,
        permittedCategory: item.name as PermittedSubscriptionCategory,
      },
      activeSubs
    );

    if (directActiveMatch) {
      const toastMsg = buildActiveSubscriptionMessage(
        directActiveMatch.packageName,
        directActiveMatch.programName,
        directActiveMatch.expiresAt
      );
      feedback.info(toastMsg, "Active Subscription");
      return;
    }

    if (onSubscribe) {
      onSubscribe(item);
      return;
    }

    setErrorMessage(null);
    setSubscribingId(item.id);

    try {
      const normalized = normalizeBackendCatalogueRecord(
        { ...(item as unknown as Record<string, unknown>), parentName },
        "item"
      );

      if (!normalized || !isPermittedLearnerCataloguePackage(normalized)) {
        setErrorMessage("Only RN and LPN packages are eligible for subscription purchase.");
        setSubscribingId(null);
        return;
      }

      const pathwayParam = encodeURIComponent(programCode);
      const modeParam = encodeURIComponent(learningContext?.requiredMode || "Exam");
      const statusRes = await fetch(`/api/subscriptions/status?mode=${modeParam}&pathway=${pathwayParam}`, {
        headers: { "Cache-Control": "no-store" },
      });
      const statusData = await statusRes.json().catch(() => ({}));

      const liveSummaries: ActiveSubscriptionSummary[] = Array.isArray(statusData.activeSubscriptions)
        ? (statusData.activeSubscriptions as ActiveSubscriptionSummary[])
        : activeSubs;

      const liveActiveMatch = matchActiveSubscriptionForPackage(
        {
          id: item.id,
          guidId: item.guidId,
          name: item.name,
          programCode,
          permittedCategory: item.name as PermittedSubscriptionCategory,
        },
        liveSummaries
      );

      if (liveActiveMatch) {
        const toastMsg = buildActiveSubscriptionMessage(
          liveActiveMatch.packageName,
          liveActiveMatch.programName,
          liveActiveMatch.expiresAt
        );
        feedback.info(toastMsg, "Active Subscription");
        setSubscribingId(null);
        return;
      }

      if (normalized && liveSummaries.length > 0) {
        const check = evaluatePackageSelectionEligibility({
          selectedPackage: normalized,
          requiredMode: learningContext?.requiredMode || "Exam",
          activeSubscriptions: liveSummaries,
        });
        if (check.alreadyCovered && check.matchedActive) {
          const toastMsg = buildActiveSubscriptionMessage(
            check.matchedActive.packageName,
            check.matchedActive.programName,
            check.matchedActive.expiresAt
          );
          feedback.info(toastMsg, "Active Subscription");
          setSubscribingId(null);
          return;
        }
      } else if (statusRes.ok && statusData.allowed && statusData.status === "Active") {
        const programDisplayName =
          statusData.programName ||
          (programCode === "RN" ? "RN Nursing Exams" : "LPN Nursing Exams");

        const activePkgName = statusData.planName || item.name;
        const toastMsg = buildActiveSubscriptionMessage(activePkgName, programDisplayName, statusData.expiresAt);
        feedback.info(toastMsg, "Active Subscription");
        setSubscribingId(null);
        return;
      }

      const validatedCtx = buildValidatedLearningContext({
        returnTo: learningContext?.returnTo,
        requiredMode: learningContext?.requiredMode || "Exam",
        examId: learningContext?.examId,
        pathway: learningContext?.pathway || parentName,
        subject: learningContext?.subject,
        layout: learningContext?.layout,
        attemptId: learningContext?.attemptId,
      });

      subscriptionCart.add({
        id: item.id,
        guidId: item.guidId,
        packageSource: "item",
        name: item.name,
        amount: typeof item.amount === "number" ? item.amount : null,
        currency: item.currency || "USD",
        duration: item.duration,
        priceDuration: item.priceDuration,
        program: normalized?.programDisplayName || parentName,
        programCode: normalized?.programCode,
        pathway: validatedCtx.pathway || parentName,
        features: item.features ?? undefined,
        featuresList: normalized?.featuresList,
        description: item.description ?? undefined,
        entitlements: normalized?.entitlements,
        learningContext: validatedCtx,
      });

      const returnParams = new URLSearchParams({
        dashboard: dashboardName,
      });
      if (validatedCtx.returnTo) returnParams.set("returnTo", validatedCtx.returnTo);
      if (validatedCtx.requiredMode) returnParams.set("requiredMode", validatedCtx.requiredMode);
      if (validatedCtx.examId) returnParams.set("examId", validatedCtx.examId);
      if (validatedCtx.pathway) returnParams.set("pathway", validatedCtx.pathway);
      if (validatedCtx.subject) returnParams.set("subject", validatedCtx.subject);
      if (validatedCtx.layout) returnParams.set("layout", validatedCtx.layout);
      if (validatedCtx.attemptId) returnParams.set("attemptId", validatedCtx.attemptId);

      const returnUrl = `${window.location.origin}/pages/subscription/package?${returnParams.toString()}`;

      const result = await dominionService<{ redirectUrl?: string | null }>("SubscriptionPackage", "Store", {
        subscriptionItemId: item.id,
        subscriptionItemGuidId: item.guidId,
        returnUrl,
      });

      if (result?.error) {
        setErrorMessage(typeof result.error === "string" ? result.error : "Subscription failed ⚓");
        setSubscribingId(null);
        return;
      }

      const redirectUrl =
        (result as { redirectUrl?: string | null } | undefined)?.redirectUrl ||
        result?.data?.redirectUrl ||
        null;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to initiate subscription checkout.");
    } finally {
      setSubscribingId(null);
    }
  };

  const formatDuration = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return null;
    const num = Number(minutes);
    if (!Number.isFinite(num) || num <= 0) return null;
    const totalDays = num / (60 * 24);
    if (totalDays >= 28) {
      const months = Math.round(totalDays / 30);
      return `/ ${months} month${months !== 1 ? "s" : ""}`;
    }
    const days = Math.max(1, Math.round(totalDays));
    return `/ ${days} day${days !== 1 ? "s" : ""}`;
  };

  const formatAmount = (amount?: number, currency?: string | null) => {
    if (amount === undefined || amount === null) return null;
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency ?? "USD"} ${amount}`;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-2 py-2 sm:px-2">
      <div className="mb-4 text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{heading}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {subheading ??
            `Choose the Package that Fits your Prime Timeline. ${skewTotal} Plan${skewTotal !== 1 ? "s" : ""} Available.`}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-8 flex justify-center">
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-red-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="rounded p-1 text-black font-bold hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="mb-8 flex justify-center">
          <input
            type="text"
            value={subscriptionItemSearch}
            onChange={(e) => setSubscriptionItemSearch(e.target.value)}
            placeholder="Search plans…"
            className="w-full max-w-md rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm shadow-2xs focus:border-[#0A6265] focus:outline-none focus:ring-2 focus:ring-[#0A6265]/20"
          />
        </div>
      )}

      {sortedItems.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-8 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No Subscription Plans Currently Listed
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Plans for this track will appear here once published.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sortedItems.map((item) => {
          const style = item.style;
          const normalized = normalizeBackendCatalogueRecord(item as unknown as Record<string, unknown>, "item");

          const titleBg = style?.titleBackground ?? "#193B42";
          const titleColor = style?.titleColor ?? "#FFFFFF";
          const bodyGradient =
            style?.bodyGradientStart && style?.bodyGradientEnd
              ? `linear-gradient(${style.bodyGradientDirection ?? "to bottom"}, ${style.bodyGradientStart}, ${style.bodyGradientEnd})`
              : undefined;
          const programCode =
            parentName.toUpperCase().includes("LPN") || parentName.toUpperCase().includes("PN")
              ? "PN_LPN"
              : "RN";
          const activeMatch = matchActiveSubscriptionForPackage(
            {
              id: item.id,
              guidId: item.guidId,
              name: item.name,
              programCode,
              permittedCategory: item.name as PermittedSubscriptionCategory,
            },
            activeSubs
          );
          const isActive = Boolean(activeMatch);

          const descriptionColor = style?.descriptionColor ?? "#475569";
          const footerBg = isActive ? "rgba(16, 185, 129, 0.15)" : style?.footerButtonBackground ?? "#0A6265";
          const footerColor = isActive ? "#065f46" : style?.footerButtonColor ?? "#FFFFFF";
          const footerText = isActive
            ? "Active on Account"
            : subscribingId === item.id
              ? "Preparing Checkout…"
              : style?.footerButtonText || "Subscribe Now";

          const priceLabel = formatAmount(item.amount, item.currency);
          const durationLabel = formatDuration(item.priceDuration as unknown as number);

          return (
            <div
              key={item.name}
              className="relative flex flex-col transition-transform duration-200 hover:-translate-y-1 h-full"
            >
              {isActive ? (
                <div className="absolute right-2 -top-3 z-20 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide bg-emerald-600 text-white shadow-md">
                  ACTIVE SUBSCRIPTION
                </div>
              ) : style?.badgeName ? (
                <div
                  className="absolute right-2 -top-3 z-20 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-md"
                  style={{
                    background: style.badgeBackground ?? "#C58B43",
                    color: style.badgeColor ?? "#FFFFFF",
                    fontSize: style.badgeFontSize,
                  }}
                >
                  {style.badgeName}
                </div>
              ) : null}

              <div
                className="flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl"
                style={{ background: bodyGradient ?? "#FFFFFF" }}
              >
                <div className="flex items-center px-5 py-4" style={{ background: titleBg, color: titleColor }}>
                  <h3 className="pr-16 text-lg font-bold leading-snug" style={{ fontSize: style?.titleFontSize }}>
                    {item.name}
                  </h3>
                </div>

                <div className="flex flex-1 flex-col gap-3 px-5 py-3">
                  {priceLabel && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900">{priceLabel}</span>
                      {durationLabel && <span className="text-sm text-slate-500"> {durationLabel}</span>}
                    </div>
                  )}

                  {item.description && (
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: descriptionColor, fontSize: style?.descriptionFontSize }}
                    >
                      {item.description}
                    </p>
                  )}

                  {item.duration && <p className="text-sm text-slate-500">Access length: {item.duration}</p>}
                  {item.plan && <p className="text-sm text-slate-500">Plan: {item.plan}</p>}

                  {normalized && normalized.featuresList.length > 0 && (
                    <ul
                      className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1.5 text-xs text-slate-700"
                      style={{ fontSize: style?.bodyFontSize }}
                    >
                      {normalized.featuresList.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#0A6265] font-bold">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div
                  className="px-5 pb-5 pt-1 mt-auto"
                  onClick={(e) => {
                    if (isActive) {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleSubscribe(item);
                    }
                  }}
                >
                  <button
                    type="button"
                    disabled={isActive || subscribingId === item.id}
                    aria-disabled={isActive}
                    aria-label={
                      isActive
                        ? `Active on Account — You already have an active subscription to ${item.name}`
                        : `Subscribe to ${item.name}`
                    }
                    onClick={() => void handleSubscribe(item)}
                    className={cn(
                      "w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow transition-opacity",
                      isActive
                        ? "cursor-not-allowed border border-emerald-500/30 opacity-80"
                        : "hover:opacity-90 disabled:opacity-50"
                    )}
                    style={{
                      background: footerBg,
                      color: footerColor,
                      fontSize: style?.footerButtonFontSize,
                    }}
                  >
                    {footerText}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
