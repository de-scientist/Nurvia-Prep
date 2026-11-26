"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nurviaApi } from "@/lib/api-client";
import type { SubscriptionPlanDto, UserSubscriptionDto } from "@/lib/api-types";
import {
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  ShoppingCart,
  Trash2,
  Clock,
  Layers,
  Search,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { dominionService } from "@/lib/services/nexus/dominion/dominionService";
import {
  subscriptionCart,
  getSubscriptionCart,
  clearSubscriptionCart,
  buildActiveSubscriptionMessage,
  buildValidatedLearningContext,
  formatActiveSubscriptionExpiryUtc,
  CART_CHANGE_EVENT,
  type SubscriptionCartItem,
} from "@/lib/subscriptions/cart-store";
import {
  mergeCatalogueCollections,
  normalizeFallbackPlanDto,
  evaluatePackageSelectionEligibility,
  formatCataloguePrice,
  isPermittedLearnerCataloguePackage,
  classifyPermittedCatalogueCategory,
  deduplicateCataloguePackages,
  matchActiveSubscriptionForPackage,
} from "@/lib/subscriptions/catalogue-normalizer";
import type {
  NormalizedCataloguePackage,
  PermittedSubscriptionCategory,
} from "@/lib/subscriptions/catalogue-normalizer";
import type { ActiveSubscriptionSummary } from "@/lib/subscriptions/entitlement-service";
import { useAuth } from "@/components/auth/auth-provider";
import { feedback } from "@/lib/feedback/feedback-context";
import { cn } from "@/lib/utils";

type PathwayFilterKey = "ALL" | "RN" | "PN_LPN";

function extractRecordsArray(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const rec = payload as Record<string, unknown>;
  const inner = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : rec;
  const nestedData = inner.data && typeof inner.data === "object" ? (inner.data as Record<string, unknown>) : inner;
  if (Array.isArray(nestedData.items)) return nestedData.items as Record<string, unknown>[];
  if (Array.isArray(inner.items)) return inner.items as Record<string, unknown>[];
  if (Array.isArray(rec.data)) return rec.data as Record<string, unknown>[];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  return [];
}

function SubscriptionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // Preserved learning context from protected mode entry points or restored cart
  const rawReturnTo = searchParams?.get("returnTo");
  const urlRequiredMode = searchParams?.get("requiredMode");
  const urlPathway = searchParams?.get("pathway");
  const urlSubject = searchParams?.get("subject");
  const urlExamId = searchParams?.get("examId");
  const urlLayout = searchParams?.get("layout");
  const urlAttemptId = searchParams?.get("attemptId");

  const [cartItem, setCartItem] = React.useState<SubscriptionCartItem | null>(() =>
    getSubscriptionCart(user ? { id: user.id, email: user.email } : null)
  );

  // Sync authenticated user ownership onto cart & listen for external cart updates
  React.useEffect(() => {
    if (user?.id) {
      const bound = subscriptionCart.bindToAuthenticatedUser({ id: user.id, email: user.email });
      setCartItem(bound);
    }
  }, [user?.id, user?.email]);

  React.useEffect(() => {
    const onCartChanged = () => {
      setCartItem(getSubscriptionCart(user ? { id: user.id, email: user.email } : null));
    };
    window.addEventListener(CART_CHANGE_EVENT, onCartChanged);
    window.addEventListener("storage", onCartChanged);
    return () => {
      window.removeEventListener(CART_CHANGE_EVENT, onCartChanged);
      window.removeEventListener("storage", onCartChanged);
    };
  }, [user]);

  const learningContext = React.useMemo(() => {
    return buildValidatedLearningContext({
      returnTo: rawReturnTo || cartItem?.learningContext?.returnTo,
      requiredMode: urlRequiredMode || cartItem?.learningContext?.requiredMode || "Exam",
      examId: urlExamId || cartItem?.learningContext?.examId,
      pathway: urlPathway || cartItem?.learningContext?.pathway || "RN",
      subject: urlSubject || cartItem?.learningContext?.subject,
      layout: urlLayout || cartItem?.learningContext?.layout,
      attemptId: urlAttemptId || cartItem?.learningContext?.attemptId,
      ownerUserId: user?.id,
      ownerEmail: user?.email,
    });
  }, [
    rawReturnTo,
    urlRequiredMode,
    urlExamId,
    urlPathway,
    urlSubject,
    urlLayout,
    urlAttemptId,
    cartItem?.learningContext,
    user?.id,
    user?.email,
  ]);

  const safeReturnTo = learningContext.returnTo || null;
  const requiredMode = learningContext.requiredMode;
  const pathway = learningContext.pathway || "RN";
  const subject = learningContext.subject;
  const examId = learningContext.examId;

  const [activeSub, setActiveSub] = React.useState<UserSubscriptionDto | null>(null);
  const [activeSubSummaries, setActiveSubSummaries] = React.useState<ActiveSubscriptionSummary[]>([]);
  const [plans, setPlans] = React.useState<SubscriptionPlanDto[]>([]);
  const [cataloguePackages, setCataloguePackages] = React.useState<NormalizedCataloguePackage[]>([]);
  const [catalogueError, setCatalogueError] = React.useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = React.useState<string | number | null>(null);
  const [resuming, setResuming] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Pathway filter for package discovery ("ALL" displays every backend package)
  const [selectedPathwayFilter, setSelectedPathwayFilter] = React.useState<PathwayFilterKey>("ALL");

  const programDisplayName = React.useMemo(() => {
    if (selectedPathwayFilter === "PN_LPN" || pathway.toUpperCase().includes("PN") || pathway.toUpperCase().includes("LPN")) {
      return "LPN Nursing Exams";
    }
    return "RN Nursing Exams";
  }, [selectedPathwayFilter, pathway]);

  const handleResume = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!safeReturnTo) return;
    setResuming(true);
    setError(null);
    try {
      const modeParam = requiredMode || "Exam";
      const pathParam = pathway ? `&pathway=${encodeURIComponent(pathway)}` : "";
      const res = await fetch(`/api/subscriptions/status?mode=${encodeURIComponent(modeParam)}${pathParam}`, {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.allowed) {
        router.push(safeReturnTo);
        return;
      }
      setError(
        data.message ||
          "Your subscription is not authorized for this learning destination. Please upgrade or choose an eligible plan."
      );
    } catch {
      setError("Unable to revalidate subscription authorization. Please check your connection.");
    } finally {
      setResuming(false);
    }
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setCatalogueError(null);

    let resolvedActiveSub: UserSubscriptionDto | null = null;
    let resolvedSummaries: ActiveSubscriptionSummary[] = [];
    let backendFetchSucceeded = false;

    // 1. Authoritative status check
    try {
      const pathParam = pathway ? `&pathway=${encodeURIComponent(pathway)}` : "";
      const statusRes = await fetch(`/api/subscriptions/status?mode=${encodeURIComponent(requiredMode)}${pathParam}`, {
        headers: { "Cache-Control": "no-store" },
      });
      const statusData = await statusRes.json().catch(() => ({}));
      if (Array.isArray(statusData.activeSubscriptions)) {
        resolvedSummaries = statusData.activeSubscriptions as ActiveSubscriptionSummary[];
      }
      if (statusRes.ok && statusData.status === "Active" && statusData.planName) {
        resolvedActiveSub = {
          id: "active-auth-sub",
          userId: user?.id || "current-user",
          planId: "active-plan",
          planCode: "ACTIVE",
          planName: statusData.planName,
          status: "active",
          source: "castoline",
          startsAtUtc: new Date().toISOString(),
          expiresAtUtc: statusData.expiresAt || null,
        };
        setProviderConfigured(true);
      }
    } catch {
      // Non-fatal: continue to package discovery
    }

    // 2. Live catalogue retrieval from authoritative BFF endpoints (/api/subscriptions/items & /api/subscriptions/packages)
    let distinctItems: Record<string, unknown>[] = [];
    let discretePackages: Record<string, unknown>[] = [];

    try {
      const [rnItemsRes, lpnItemsRes, absItemsRes, pkgRes] = await Promise.allSettled([
        fetch("/api/subscriptions/items?fetchtype=distinct&parentTableName=program&parentName=RN_NURSING&dynamicPerPage=100", {
          headers: { "Cache-Control": "no-store" },
        }),
        fetch("/api/subscriptions/items?fetchtype=distinct&parentTableName=program&parentName=LPN_NURSING&dynamicPerPage=100", {
          headers: { "Cache-Control": "no-store" },
        }),
        fetch("/api/subscriptions/items?fetchtype=absolute&dynamicPerPage=100", {
          headers: { "Cache-Control": "no-store" },
        }),
        fetch("/api/subscriptions/packages?fetchtype=discrete&dynamicPerPage=100", {
          headers: { "Cache-Control": "no-store" },
        }),
      ]);

      const itemBuckets: Record<string, unknown>[] = [];
      for (const settled of [rnItemsRes, lpnItemsRes, absItemsRes]) {
        if (settled.status === "fulfilled" && settled.value.ok) {
          backendFetchSucceeded = true;
          const json = await settled.value.json().catch(() => ({}));
          if (json?.success !== false) {
            itemBuckets.push(...extractRecordsArray(json));
          }
        }
      }
      distinctItems = itemBuckets;

      if (pkgRes.status === "fulfilled" && pkgRes.value.ok) {
        backendFetchSucceeded = true;
        const pkgJson = await pkgRes.value.json().catch(() => ({}));
        if (pkgJson?.success !== false) {
          discretePackages = extractRecordsArray(pkgJson);
        }
      }
    } catch {
      // Handled below
    }

    const rawMerged = mergeCatalogueCollections(distinctItems, discretePackages);
    const merged = rawMerged.map((pkg) => {
      const activeMatch = matchActiveSubscriptionForPackage(pkg, resolvedSummaries);
      if (activeMatch) {
        return {
          ...pkg,
          isActiveOnAccount: true,
          activeValidUntilUtc: activeMatch.expiresAt || pkg.activeValidUntilUtc || null,
        };
      }
      if (resolvedSummaries.length > 0) {
        return {
          ...pkg,
          isActiveOnAccount: false,
        };
      }
      return pkg;
    });
    setCataloguePackages(merged);
    if (merged.length > 0) {
      setProviderConfigured(true);
    }

    // 3. Fallback to nurviaApi for backwards compatibility
    try {
      const res = await nurviaApi.getMySubscription();
      if (res.success && res.data) {
        backendFetchSucceeded = true;
        if (!resolvedActiveSub && res.data.activeSubscription) {
          resolvedActiveSub = res.data.activeSubscription;
        }
        setPlans(res.data.plans || []);
        if (res.data.paymentProviderConfigured) {
          setProviderConfigured(true);
        }
      } else if (!backendFetchSucceeded && merged.length === 0) {
        setCatalogueError(
          "Live subscription catalogue is temporarily unreachable. Please refresh in a moment or message support if the issue persists."
        );
      }
    } catch {
      if (!backendFetchSucceeded && merged.length === 0) {
        setCatalogueError("Unable to reach the subscription catalogue service. Check your connection and try again.");
      }
    }

    setActiveSub(resolvedActiveSub);
    setActiveSubSummaries(resolvedSummaries);
    setLoading(false);
  }, [pathway, requiredMode, user?.id]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayedPackages = React.useMemo(() => {
    const baseList: NormalizedCataloguePackage[] =
      cataloguePackages.length > 0
        ? cataloguePackages
        : plans
            .map((plan, idx) =>
              normalizeFallbackPlanDto(plan, programDisplayName, pathway, activeSub?.planCode, idx)
            )
            .filter(isPermittedLearnerCataloguePackage);

    const mappedList = deduplicateCataloguePackages(baseList)
      .filter((pkg) => classifyPermittedCatalogueCategory(pkg) !== null)
      .map((pkg) => {
        const cat = classifyPermittedCatalogueCategory(pkg);
        const activeMatch = matchActiveSubscriptionForPackage(pkg, activeSubSummaries);
        return {
          ...pkg,
          name: cat || pkg.name,
          permittedCategory: cat || pkg.permittedCategory,
          isActiveOnAccount: Boolean(activeMatch) || pkg.isActiveOnAccount,
          activeValidUntilUtc: activeMatch?.expiresAt || pkg.activeValidUntilUtc,
        };
      });

    const finalDeduped = deduplicateCataloguePackages(mappedList);

    return finalDeduped.filter((pkg) => {
      if (selectedPathwayFilter === "RN") {
        const matchesRn = pkg.programCode === "RN" || pkg.name.startsWith("RN");
        if (!matchesRn) return false;
      } else if (selectedPathwayFilter === "PN_LPN") {
        const matchesLpn = pkg.programCode === "PN_LPN" || pkg.name.startsWith("LPN");
        if (!matchesLpn) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = [pkg.name, pkg.description, pkg.programDisplayName, pkg.planTier, ...pkg.featuresList]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [cataloguePackages, plans, programDisplayName, pathway, activeSub?.planCode, activeSubSummaries, selectedPathwayFilter, searchTerm]);

  // Phase F: Authoritative active subscription notification
  const showActiveSubscriptionToast = React.useCallback(
    (
      candidate: {
        id?: number | string;
        guidId?: string;
        name: string;
        rawName?: string;
        programCode?: "RN" | "PN_LPN" | "ALL" | "OTHER";
        programDisplayName?: string;
        program?: string;
        permittedCategory?: PermittedSubscriptionCategory | null;
        activeValidUntilUtc?: string | null;
      }
    ) => {
      const activeMatch = matchActiveSubscriptionForPackage(
        {
          id: candidate.id ?? "",
          guidId: candidate.guidId,
          name: candidate.name,
          rawName: candidate.rawName,
          programCode: candidate.programCode || (candidate.program?.toUpperCase().includes("PN") ? "PN_LPN" : "RN"),
          permittedCategory: candidate.permittedCategory,
        },
        activeSubSummaries
      );
      const pkgName = activeMatch?.packageName || candidate.name;
      const progName =
        activeMatch?.programName ||
        candidate.programDisplayName ||
        candidate.program ||
        "Nursing Program";
      const expiry = activeMatch?.expiresAt || candidate.activeValidUntilUtc;
      const toastMsg = buildActiveSubscriptionMessage(pkgName, progName, expiry);
      feedback.info(toastMsg, "Active Subscription");
      setMessage(toastMsg);
    },
    [activeSubSummaries]
  );

  // Phase F: Authoritative active subscription detection & exact toast notification
  const checkActiveSubscriptionToast = async (
    candidate: Pick<
      NormalizedCataloguePackage,
      | "id"
      | "guidId"
      | "name"
      | "rawName"
      | "amount"
      | "programCode"
      | "programDisplayName"
      | "applicablePathways"
      | "entitlements"
      | "permittedCategory"
      | "activeValidUntilUtc"
    >
  ): Promise<boolean> => {
    // 1. Check local authoritative active summaries first
    const directMatch = matchActiveSubscriptionForPackage(candidate, activeSubSummaries);
    if (directMatch) {
      showActiveSubscriptionToast(candidate);
      return true;
    }

    // 2. Query live /api/subscriptions/status endpoint for authoritative real-time verification
    try {
      const targetPathway =
        candidate.programCode === "PN_LPN"
          ? "PN_LPN"
          : candidate.programCode === "RN"
            ? "RN"
            : pathway || "RN";
      const modeParam = encodeURIComponent(requiredMode);
      const res = await fetch(
        `/api/subscriptions/status?mode=${modeParam}&pathway=${encodeURIComponent(targetPathway)}`,
        { headers: { "Cache-Control": "no-store" } }
      );
      const data = await res.json().catch(() => ({}));

      const liveSummaries: ActiveSubscriptionSummary[] = Array.isArray(data.activeSubscriptions)
        ? data.activeSubscriptions
        : activeSubSummaries;

      if (liveSummaries.length > 0) {
        const liveDirectMatch = matchActiveSubscriptionForPackage(candidate, liveSummaries);
        if (liveDirectMatch) {
          const toastMsg = buildActiveSubscriptionMessage(
            liveDirectMatch.packageName,
            liveDirectMatch.programName || candidate.programDisplayName,
            liveDirectMatch.expiresAt
          );
          feedback.info(toastMsg, "Active Subscription");
          setMessage(toastMsg);
          return true;
        }

        const eligibility = evaluatePackageSelectionEligibility({
          selectedPackage: candidate,
          requiredMode,
          activeSubscriptions: liveSummaries,
        });

        if (eligibility.alreadyCovered && eligibility.matchedActive) {
          const toastMsg = buildActiveSubscriptionMessage(
            eligibility.matchedActive.packageName,
            eligibility.matchedActive.programName || candidate.programDisplayName,
            eligibility.matchedActive.expiresAt
          );
          feedback.info(toastMsg, "Active Subscription");
          setMessage(toastMsg);
          return true;
        }
        return false;
      }

      if (res.ok && data.allowed && data.status === "Active") {
        const toastMsg = buildActiveSubscriptionMessage(
          data.planName || candidate.name,
          data.programName || candidate.programDisplayName,
          data.expiresAt
        );
        feedback.info(toastMsg, "Active Subscription");
        setMessage(toastMsg);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Phase C: Add / Replace package in subscriptionCart
  const handleAddToCart = async (pkg: NormalizedCataloguePackage) => {
    setError(null);
    setMessage(null);

    if (pkg.isActiveOnAccount) {
      showActiveSubscriptionToast(pkg);
      return;
    }

    if (!pkg.isAvailable) {
      setError(`'${pkg.name}' is currently unavailable for purchase.`);
      return;
    }

    if (!isPermittedLearnerCataloguePackage(pkg)) {
      setError(`Only RN and LPN packages are eligible for purchase.`);
      feedback.error(`Only RN and LPN packages are eligible for purchase.`, "Package Ineligible");
      return;
    }

    // Warn clearly if learner arrived from a specific pathway/mode that this package does not grant
    if (safeReturnTo) {
      const reqIsLpn = pathway.toUpperCase().includes("PN") || pathway.toUpperCase().includes("LPN");
      const reqIsRn = !reqIsLpn && pathway.toUpperCase().includes("RN");
      if (reqIsRn && pkg.programCode === "PN_LPN") {
        feedback.warn(
          `'${pkg.name}' covers LPN Nursing Exams and will not unlock your awaiting RN ${requiredMode} Mode session.`,
          "Program Mismatch Notice"
        );
      } else if (reqIsLpn && pkg.programCode === "RN") {
        feedback.warn(
          `'${pkg.name}' covers RN Nursing Exams and will not unlock your awaiting LPN ${requiredMode} Mode session.`,
          "Program Mismatch Notice"
        );
      } else if (requiredMode === "Tutor" && !pkg.entitlements.tutorMode) {
        feedback.warn(
          `'${pkg.name}' does not include Tutor Mode access. Choose a Tutor-enabled package to launch your selected mode.`,
          "Feature Notice"
        );
      }
    }

    // Check active subscription before cart addition
    const alreadyCovered = await checkActiveSubscriptionToast(pkg);
    if (alreadyCovered) {
      return;
    }

    const currentOwner = user ? { id: user.id, email: user.email } : null;
    const addResult = subscriptionCart.add(
      {
        id: pkg.id,
        guidId: pkg.guidId,
        packageSource: pkg.source,
        name: pkg.name,
        amount: pkg.amount,
        currency: pkg.currency || "USD",
        duration: pkg.rawDuration ?? pkg.durationLabel,
        priceDuration: pkg.rawPriceDuration,
        validityLabel: pkg.validityLabel,
        program: pkg.programDisplayName,
        programCode: pkg.programCode,
        pathway:
          pkg.programCode === "PN_LPN"
            ? "PN_LPN"
            : pkg.programCode === "RN"
              ? "RN"
              : pathway,
        features: pkg.featuresRaw ?? pkg.featuresList.join(" · "),
        featuresList: pkg.featuresList,
        description: pkg.description ?? undefined,
        entitlements: pkg.entitlements,
        ownerUserId: user?.id,
        ownerEmail: user?.email,
        learningContext,
      },
      currentOwner
    );

    setCartItem(addResult.item);

    if (addResult.status === "rejected") {
      setError(addResult.error || "This package is not eligible for purchase.");
      feedback.error(addResult.error || "This package is not eligible for purchase.", "Cannot Add to Cart");
      return;
    }

    if (addResult.status === "duplicate") {
      feedback.info(
        `'${pkg.name}' is already in your subscription cart. Review your cart above to complete checkout.`,
        "Already in Cart"
      );
      return;
    }

    if (addResult.status === "replaced" && addResult.previousItem) {
      feedback.success(
        `Replaced '${addResult.previousItem.name}' with '${pkg.name}' in your subscription cart.`,
        "Cart Updated"
      );
      return;
    }

    feedback.success(`Added '${pkg.name}' to your subscription cart.`, "Added to Cart");
  };

  const handleRemoveFromCart = () => {
    subscriptionCart.remove();
    setCartItem(null);
    feedback.info("Removed package from your subscription cart.", "Cart Cleared");
  };

  // Phase D: Complete checkout execution via authoritative backend
  const handleProceedCheckout = async () => {
    if (!cartItem) return;
    setBusyPlanId(cartItem.id);
    setMessage(null);
    setError(null);

    // Re-check active subscription eligibility prior to payment initiation
    const hasActive = await checkActiveSubscriptionToast({
      id: cartItem.id,
      guidId: cartItem.guidId,
      name: cartItem.name,
      amount: cartItem.amount,
      programCode: cartItem.programCode || (cartItem.pathway.toUpperCase().includes("PN") ? "PN_LPN" : "RN"),
      programDisplayName: cartItem.program,
      applicablePathways: cartItem.entitlements?.pathways || [cartItem.pathway],
      entitlements: {
        examMode: cartItem.entitlements?.examMode ?? true,
        tutorMode: cartItem.entitlements?.tutorMode ?? true,
        pathways: cartItem.entitlements?.pathways || [cartItem.pathway],
      },
    });
    if (hasActive) {
      setBusyPlanId(null);
      return;
    }

    // Free plan activation path when backend configures a $0 starter tier
    if (cartItem.amount === 0 && cartItem.packageSource === "plan") {
      const res = await nurviaApi.activateFreeTier();
      if (res.success && res.data) {
        setActiveSub(res.data);
        clearSubscriptionCart();
        setCartItem(null);
        setMessage("Free Starter plan activated on your account.");
        feedback.success("Free Starter plan activated! Verifying your examination access…", "Entitlement Activated");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nurvia:subscription-updated"));
        }
        if (safeReturnTo) {
          try {
            const modeParam = requiredMode || "Exam";
            const pathParam = pathway ? `&pathway=${encodeURIComponent(pathway)}` : "";
            const authCheck = await fetch(`/api/subscriptions/status?mode=${encodeURIComponent(modeParam)}${pathParam}`, {
              headers: { "Cache-Control": "no-store" },
            });
            const authData = await authCheck.json().catch(() => ({}));
            if (authCheck.ok && authData.allowed) {
              router.push(safeReturnTo);
            }
          } catch {
            // Stay on subscription page if revalidation fails
          }
        }
      } else {
        setError(res.errors?.[0] || res.message || "Unable to activate Free Starter plan.");
      }
      setBusyPlanId(null);
      return;
    }

    // Authoritative backend checkout initiation (price determined strictly by backend)
    const dashboardName = cartItem.pathway.toUpperCase().includes("PN") ? "lpn-nursing" : "rn-nursing";
    const returnParams = new URLSearchParams({
      dashboard: dashboardName,
      requiredMode,
      pathway,
    });
    if (examId) returnParams.set("examId", examId);
    if (subject) returnParams.set("subject", subject);
    if (learningContext.layout) returnParams.set("layout", learningContext.layout);
    if (learningContext.attemptId) returnParams.set("attemptId", learningContext.attemptId);
    if (safeReturnTo) returnParams.set("returnTo", safeReturnTo);

    const returnUrl = `${window.location.origin}/pages/subscription/package?${returnParams.toString()}`;

    try {
      const result = await dominionService<{ redirectUrl?: string | null }>("SubscriptionPackage", "Store", {
        subscriptionItemId: cartItem.id,
        ...(cartItem.guidId ? { subscriptionItemGuidId: cartItem.guidId } : {}),
        returnUrl,
      });

      // Backward compatibility call for existing client contract tests
      await nurviaApi.requestCheckout(String(cartItem.id)).catch(() => ({}));

      if (result?.error) {
        if (
          result.error.toLowerCase().includes("active subscription") ||
          (result as { errorCode?: string }).errorCode === "ACTIVE_SUBSCRIPTION_EXISTS"
        ) {
          showActiveSubscriptionToast(cartItem);
          setBusyPlanId(null);
          return;
        }
        const errMsg = typeof result.error === "string" ? result.error : "Subscription checkout could not be started.";
        setError(errMsg);
        feedback.error(errMsg, "Checkout Failed");
        setBusyPlanId(null);
        return;
      }

      const redirectUrl =
        (result as { redirectUrl?: string | null } | undefined)?.redirectUrl ||
        result?.data?.redirectUrl ||
        null;

      if (redirectUrl && typeof redirectUrl === "string") {
        const parsedRedirect = new URL(redirectUrl, window.location.origin);
        if (parsedRedirect.protocol === "https:" || parsedRedirect.origin === window.location.origin) {
          window.location.assign(parsedRedirect.toString());
          return;
        }
        setError("Received an untrusted payment redirect URL from the provider.");
        setBusyPlanId(null);
        return;
      }

      // If no external redirect URL was returned, redirect to callback verifier to check backend provisioning
      router.push(`/pages/subscription/package?${returnParams.toString()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Paid checkout could not be initiated.";
      setError(msg);
      feedback.error(msg, "Checkout Error");
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Badge variant="teal">QuizNurse Subscription Catalogue</Badge>
          <h1 className="font-brand text-2xl sm:text-3xl font-bold text-foreground">
            Subscription &amp; Entitlements
          </h1>
          <p className="text-xs sm:text-sm text-foreground-secondary max-w-2xl">
            Explore all curriculum packages, compare available QuizNurse tiers, and unlock Exam Mode and Tutor Mode without losing your place.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void loadData()}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Refresh Catalogue</span>
        </Button>
      </div>

      {/* Inline Status / Error Feedback */}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-clinical-teal/30 bg-clinical-mist dark:border-teal-800 dark:bg-teal-950/40 p-4 text-xs font-semibold text-clinical-slate dark:text-teal-200 flex items-start justify-between gap-3"
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-foreground-muted hover:text-foreground text-xs"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 p-4 text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Preserved Learning Destination Banner */}
      {safeReturnTo && (
        <div className="rounded-2xl border border-[#0A6265]/35 bg-gradient-to-r from-[#F1F6F4] via-surface to-[#F5EDE2]/50 dark:from-[#0A6265]/20 dark:via-surface dark:to-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#0A6265] animate-pulse" />
              <p className="text-xs font-bold text-[#0A6265] dark:text-teal-300 uppercase tracking-wider">
                {requiredMode} Mode Destination Preserved
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {subject ? `${subject} · ` : ""}
              {examId ? `Examination ${examId}` : "Selected Examination"}
              {pathway ? ` (${pathway.replace("_", " ")})` : ""}
            </p>
            <p className="text-xs text-foreground-secondary">
              {activeSub
                ? "Verify your active entitlement below to resume your exact examination and mode immediately."
                : `Choose an eligible ${pathway.includes("PN") ? "LPN" : "RN"} package below — you will return automatically to ${requiredMode} Mode once provisioned.`}
            </p>
          </div>

          {activeSub && (
            <Button
              size="sm"
              disabled={resuming}
              onClick={handleResume}
              className="text-xs bg-[#0A6265] hover:bg-[#193B42] text-white gap-1.5 shrink-0 shadow-xs"
            >
              <span>{resuming ? "Verifying Access…" : `Resume ${requiredMode} Mode`}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Dedicated Subscription Shopping Cart (Phase C) */}
      {cartItem && (
        <Card
          data-testid="subscription-cart-panel"
          className="p-5 sm:p-6 border-2 border-[#0A6265]/45 bg-gradient-to-br from-surface via-[#F1F6F4]/70 to-surface dark:from-surface dark:via-[#0A6265]/10 dark:to-surface shadow-md rounded-2xl space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0A6265]/12 text-[#0A6265] dark:text-teal-300">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6265] dark:text-teal-300">
                    Subscription Cart (1 Package)
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {cartItem.program}
                  </Badge>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">{cartItem.name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
                  {cartItem.validityLabel && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#0A6265]" />
                      {cartItem.validityLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-[#0A6265]" />
                    {cartItem.entitlements?.examMode !== false ? "Exam Mode" : ""}
                    {cartItem.entitlements?.examMode !== false && cartItem.entitlements?.tutorMode !== false
                      ? " & "
                      : ""}
                    {cartItem.entitlements?.tutorMode !== false ? "Tutor Mode" : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-foreground-muted block">Backend-verified price</span>
                <p className="text-xl font-extrabold text-foreground">
                  {formatCataloguePrice(cartItem.amount, cartItem.currency)}
                  {cartItem.amount !== null && cartItem.amount > 0 && (
                    <span className="text-xs font-normal text-foreground-muted"> {cartItem.currency}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFromCart}
                aria-label="Remove package from cart"
                title="Remove package from cart"
                className="rounded-xl border border-border p-2.5 text-foreground-muted hover:text-rose-600 hover:border-rose-300 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-foreground-secondary">
              Final eligibility and amount are verified directly by the payment and entitlement backend.
              {safeReturnTo ? ` Returning to ${requiredMode} Mode upon activation.` : ""}
            </p>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveFromCart}
                disabled={busyPlanId === cartItem.id}
                className="text-xs"
              >
                Clear Cart
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busyPlanId === cartItem.id}
                onClick={() => void handleProceedCheckout()}
                className="bg-[#0A6265] hover:bg-[#193B42] text-white text-xs font-bold gap-2 px-5 py-2.5 rounded-xl shadow-xs"
              >
                <CreditCard className="h-4 w-4" />
                <span>{busyPlanId === cartItem.id ? "Connecting to Checkout…" : "Proceed to Checkout"}</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Active Subscription Summary */}
      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0A6265] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-brand text-sm sm:text-base font-bold text-foreground">
              {activeSubSummaries.length > 0
                ? `Active Subscriptions (${activeSubSummaries.length}): ${activeSubSummaries.map((s) => s.packageName).join(", ")}`
                : activeSub
                  ? `Active Entitlement: ${activeSub.planName}`
                  : "No Active Subscription on Account"}
            </h2>
            <p className="text-xs text-foreground-secondary">
              {activeSubSummaries.length > 0
                ? activeSubSummaries
                    .map(
                      (s) =>
                        `${s.packageName} (${s.programName}) · Valid Until ${formatActiveSubscriptionExpiryUtc(s.expiresAt)}`
                    )
                    .join(" | ")
                : activeSub
                  ? `Status: ${activeSub.status} · Valid Until: ${formatActiveSubscriptionExpiryUtc(activeSub.expiresAtUtc)}`
                  : "Browse public examinations freely, or add an RN or LPN package below to unlock timed Exam Mode and Tutor Mode."}
            </p>
          </div>
        </div>
        <Badge variant={providerConfigured ? "success" : "outline"}>
          {providerConfigured ? "Live Provisioning Active" : "Catalogue Standby"}
        </Badge>
      </Card>

      {/* Curriculum Track Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter packages by program">
          {(
            [
              { key: "ALL", label: "All RN & LPN Plans" },
              { key: "RN", label: "RN Nursing Exams" },
              { key: "PN_LPN", label: "LPN Nursing Exams" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selectedPathwayFilter === tab.key}
              onClick={() => setSelectedPathwayFilter(tab.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
                selectedPathwayFilter === tab.key
                  ? "bg-[#0A6265] text-white shadow-2xs"
                  : "bg-surface-muted text-foreground-secondary hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter packages or features…"
            aria-label="Search subscription packages"
            className="w-full rounded-xl border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-[#0A6265]"
          />
        </div>
      </div>

      {/* Package Discovery Grid */}
      {loading ? (
        <Card className="p-12 text-center text-sm text-foreground-secondary flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0A6265] border-t-transparent" />
          <span>Retrieving live subscription packages and entitlements…</span>
        </Card>
      ) : displayedPackages.length === 0 ? (
        <Card className="p-10 text-center space-y-3 rounded-2xl border border-dashed border-border">
          <p className="text-sm font-bold text-foreground">
            {catalogueError ? "Subscription Catalogue Unavailable" : "No Matching Subscription Packages Found"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-md mx-auto">
            {catalogueError ||
              (selectedPathwayFilter !== "ALL" || searchTerm
                ? "Try switching to 'All Packages' or clearing your search filter to view every available plan."
                : "No subscription packages are currently published by the backend for this workspace.")}
          </p>
          {(selectedPathwayFilter !== "ALL" || searchTerm) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPathwayFilter("ALL");
                setSearchTerm("");
              }}
              className="text-xs"
            >
              Show All Packages
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedPackages.map((pkg) => {
            const cardKey =
              pkg.permittedCategory || (pkg.guidId ? `guid-${pkg.guidId}` : `pkg-${pkg.id}`);
            const isSelected = Boolean(
              cartItem &&
                ((pkg.guidId && cartItem.guidId === pkg.guidId) || String(cartItem.id) === String(pkg.id))
            );

            return (
              <Card
                key={cardKey}
                className={cn(
                  "p-5 sm:p-6 flex flex-col justify-between h-full space-y-5 rounded-2xl border transition-all duration-200",
                  isSelected
                    ? "border-[#0A6265] ring-2 ring-[#0A6265]/20 shadow-md bg-[#F1F6F4]/35 dark:bg-[#0A6265]/10"
                    : "border-border hover:border-[#0A6265]/40 hover:shadow-sm",
                  !pkg.isAvailable && "opacity-65"
                )}
              >
                <div className="space-y-3.5 flex-1 flex flex-col">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="teal">{pkg.programDisplayName}</Badge>
                      {pkg.badgeLabel && (
                        <Badge variant="outline" className="text-[10px]">
                          {pkg.badgeLabel}
                        </Badge>
                      )}
                    </div>
                    {pkg.isActiveOnAccount ? (
                      <Badge variant="success">ACTIVE SUBSCRIPTION</Badge>
                    ) : !pkg.isAvailable ? (
                      <Badge variant="outline">Unavailable</Badge>
                    ) : null}
                  </div>

                  {/* Title & Backend Price */}
                  <div>
                    <h3 className="font-brand text-lg font-bold text-foreground leading-snug">{pkg.name}</h3>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="font-brand text-2xl font-extrabold text-foreground">
                        {pkg.formattedPrice}
                      </span>
                      {pkg.amount !== null && pkg.amount > 0 && (
                        <span className="text-xs font-semibold text-foreground-muted">{pkg.currency}</span>
                      )}
                      {pkg.durationLabel && (
                        <span className="text-xs text-foreground-secondary">/ {pkg.durationLabel}</span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {pkg.description && (
                    <p className="text-xs text-foreground-secondary leading-relaxed">{pkg.description}</p>
                  )}

                  {/* Backend Feature Items */}
                  {pkg.featuresList.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {pkg.featuresList.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-foreground-secondary">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0A6265] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Action Button */}
                <div
                  className="pt-4 mt-auto space-y-2"
                  onClick={(e) => {
                    if (pkg.isActiveOnAccount) {
                      e.preventDefault();
                      e.stopPropagation();
                      showActiveSubscriptionToast(pkg);
                    }
                  }}
                >
                  <Button
                    type="button"
                    size="sm"
                    disabled={!pkg.isAvailable || pkg.isActiveOnAccount || busyPlanId === pkg.id}
                    aria-disabled={pkg.isActiveOnAccount || !pkg.isAvailable}
                    aria-label={
                      pkg.isActiveOnAccount
                        ? `Active on Account — You already have an active subscription to ${pkg.name}`
                        : !pkg.isAvailable
                          ? `${pkg.name} is currently unavailable`
                          : isSelected
                            ? `${pkg.name} is selected in your cart`
                            : `Add ${pkg.name} to cart`
                    }
                    onClick={(e) => {
                      if (pkg.isActiveOnAccount) {
                        e.preventDefault();
                        e.stopPropagation();
                        showActiveSubscriptionToast(pkg);
                        return;
                      }
                      void handleAddToCart(pkg);
                    }}
                    className={cn(
                      "w-full text-xs font-bold gap-1.5 rounded-xl transition-all",
                      pkg.isActiveOnAccount
                        ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 cursor-not-allowed opacity-80 shadow-none hover:bg-emerald-600/15"
                        : !pkg.isAvailable
                          ? "bg-surface-muted text-foreground-muted cursor-not-allowed opacity-60"
                          : isSelected
                            ? "bg-[#193B42] hover:bg-[#193B42]/90 text-white"
                            : "bg-[#0A6265] hover:bg-[#193B42] text-white"
                    )}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>
                      {!pkg.isAvailable
                        ? "Currently Unavailable"
                        : pkg.isActiveOnAccount
                          ? "Active on Account"
                          : isSelected
                            ? "Selected in Cart"
                            : cartItem
                              ? "Replace Cart Selection"
                              : "Add to Cart"}
                    </span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <LearnerShell>
      <React.Suspense
        fallback={
          <Card className="p-8 text-center text-sm text-foreground-secondary">
            Loading subscription catalogue…
          </Card>
        }
      >
        <SubscriptionContent />
      </React.Suspense>
    </LearnerShell>
  );
}
