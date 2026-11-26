import {
  evaluatePackageRecordEntitlements,
  doesPathwaySetGrant,
  normalizeSubStatus,
  type ActiveSubscriptionSummary,
  type PackageRecord,
  type SubscriptionMode,
} from "./entitlement-service";
import type { SubscriptionPlanDto } from "@/lib/api-types";

export const PERMITTED_SUBSCRIPTION_CATEGORIES = [
  "LPN STANDARD",
  "LPN PREMIUM",
  "LPN DELUXE",
  "RN STANDARD",
  "RN PREMIUM",
  "RN DELUXE",
] as const;

export type PermittedSubscriptionCategory = (typeof PERMITTED_SUBSCRIPTION_CATEGORIES)[number];

export interface NormalizedCataloguePackage {
  id: number | string;
  guidId?: string;
  source: "item" | "package" | "plan";
  name: string;
  rawName?: string;
  permittedCategory?: PermittedSubscriptionCategory | null;
  amount: number | null;
  currency: string;
  formattedPrice: string;
  durationLabel: string | null;
  validityLabel: string | null;
  rawDuration?: string | null;
  rawPriceDuration?: string | number | null;
  programCode: "RN" | "PN_LPN" | "ALL" | "OTHER";
  programDisplayName: string;
  applicablePathways: string[];
  planTier?: string | null;
  description?: string | null;
  featuresRaw?: string | null;
  featuresList: string[];
  examAccessLabel: string;
  entitlements: {
    examMode: boolean;
    tutorMode: boolean;
    pathways: string[];
  };
  isFeatured: boolean;
  isAvailable: boolean;
  isActiveOnAccount: boolean;
  activeValidUntilUtc?: string | null;
  badgeLabel?: string | null;
  cardOrder: number;
}

export function formatCataloguePrice(amount?: number | null, currency?: string | null): string {
  if (amount === undefined || amount === null || !Number.isFinite(Number(amount))) {
    return "See Details";
  }
  const num = Number(amount);
  if (num === 0) return "Free";
  const curr = (currency || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${curr} ${num.toFixed(2)}`;
  }
}

export function formatMinutesDurationLabel(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const totalMinutes = Number(raw);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  const totalDays = totalMinutes / (60 * 24);
  if (totalDays >= 360) {
    const years = Math.round(totalDays / 365);
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  if (totalDays >= 28) {
    const months = Math.round(totalDays / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  if (totalDays >= 1) {
    const days = Math.round(totalDays);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = Math.max(1, Math.round(totalMinutes / 60));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Safely extracts clean human-readable feature bullet items from backend HTML or delimited text
 * without exposing raw HTML injection vectors.
 */
export function parsePackageFeatures(rawFeatures?: string | string[] | null): string[] {
  if (!rawFeatures) return [];
  if (Array.isArray(rawFeatures)) {
    return rawFeatures.map((f) => String(f).trim()).filter(Boolean);
  }
  const str = String(rawFeatures).trim();
  if (!str) return [];

  // Extract <li>...</li> items first if HTML list
  const liMatches = Array.from(str.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) =>
    m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  );
  if (liMatches.length > 0) {
    return liMatches.filter(Boolean);
  }

  // Strip block tags into newlines, strip remaining tags
  const plain = str
    .replace(/<\/(p|div|br|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .split(/\r?\n|•|·/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (plain.length > 1) return plain;
  if (plain.length === 1 && plain[0].includes(",") && plain[0].length < 240) {
    return plain[0].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return plain;
}

export function normalizeBackendCatalogueRecord(
  raw: Record<string, unknown>,
  source: "item" | "package",
  index = 0
): NormalizedCataloguePackage | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id as number | string | undefined;
  const guidId = typeof raw.guidId === "string" ? raw.guidId.trim() : undefined;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if ((id === undefined || id === null || id === "") && !guidId) return null;
  if (!name) return null;

  const rawAmount = raw.amount ?? raw.planPrice;
  const amount =
    rawAmount !== undefined && rawAmount !== null && rawAmount !== "" && Number.isFinite(Number(rawAmount))
      ? Number(rawAmount)
      : null;
  const currency = typeof raw.currency === "string" && raw.currency.trim() ? raw.currency.trim().toUpperCase() : "USD";

  const pkgEval = evaluatePackageRecordEntitlements(raw as unknown as PackageRecord);

  const rawPriceDuration = (raw.priceDuration as string | number | null | undefined) ?? null;
  const rawDuration = typeof raw.duration === "string" && raw.duration.trim() ? raw.duration.trim() : null;
  const minutesLabel = formatMinutesDurationLabel(rawPriceDuration);
  const durationLabel = minutesLabel || rawDuration || null;
  const validityLabel =
    rawDuration && minutesLabel && rawDuration.toLowerCase() !== minutesLabel.toLowerCase()
      ? `${rawDuration} (${minutesLabel} billing cycle)`
      : durationLabel
        ? `${durationLabel} access validity`
        : null;

  const featuresRaw = typeof raw.features === "string" ? raw.features : null;
  const featuresList = parsePackageFeatures(featuresRaw);

  const rawStatus = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  const styleObj = raw.style && typeof raw.style === "object" ? (raw.style as Record<string, unknown>) : undefined;
  const styleVisible = styleObj?.visibility !== false;
  const isAvailable =
    styleVisible &&
    rawStatus !== "inactive" &&
    rawStatus !== "archived" &&
    rawStatus !== "disabled" &&
    rawStatus !== "unavailable";

  // Check active userSubscriptions if attached
  const userSubs = Array.isArray(raw.userSubscriptions)
    ? (raw.userSubscriptions as Array<Record<string, unknown>>)
    : [];
  let isActiveOnAccount = false;
  let activeValidUntilUtc: string | null = null;
  for (const sub of userSubs) {
    const normStatus = normalizeSubStatus(
      (sub.subscriptionStatus as string | undefined) || (sub.status as string | undefined),
      sub.subscriptionHasPaid as string | undefined
    );
    const validUntil =
      (sub.validUntil as string | null | undefined) ||
      (sub.expiresAt as string | null | undefined) ||
      (sub.expiresAtUtc as string | null | undefined) ||
      null;
    const expired = validUntil ? new Date(validUntil).getTime() < Date.now() : false;
    if (normStatus === "Active" && !expired) {
      isActiveOnAccount = true;
      activeValidUntilUtc = validUntil;
      break;
    }
  }

  const permittedCategory =
    classifyPermittedCatalogueCategory({
      ...(raw as Record<string, unknown>),
      id: id ?? guidId,
      name,
      programCode: pkgEval.programCode,
      parentName: (raw.parentName as string) || (raw.terminalClusterSegmentName as string),
    }) || null;

  const modeParts: string[] = [];
  if (pkgEval.grantsExam) modeParts.push("Exam Mode");
  if (pkgEval.grantsTutor) modeParts.push("Tutor Mode");
  const examAccessLabel =
    modeParts.length > 0
      ? `${modeParts.join(" & ")} · ${pkgEval.programName}`
      : pkgEval.programName;

  return {
    id: id ?? guidId!,
    guidId,
    source,
    name,
    rawName: name,
    permittedCategory,
    amount,
    currency,
    formattedPrice: formatCataloguePrice(amount, currency),
    durationLabel,
    validityLabel,
    rawDuration,
    rawPriceDuration,
    programCode: pkgEval.programCode,
    programDisplayName: pkgEval.programName,
    applicablePathways: pkgEval.pathways,
    planTier: typeof raw.plan === "string" && raw.plan.trim() ? raw.plan.trim() : typeof raw.type === "string" ? raw.type.trim() : null,
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
    featuresRaw,
    featuresList,
    examAccessLabel,
    entitlements: {
      examMode: pkgEval.grantsExam,
      tutorMode: pkgEval.grantsTutor,
      pathways: pkgEval.pathways,
    },
    isFeatured: Boolean(raw.isFeatured),
    isAvailable,
    isActiveOnAccount,
    activeValidUntilUtc,
    badgeLabel: typeof styleObj?.badgeName === "string" ? styleObj.badgeName : null,
    cardOrder: typeof raw.cardNumber === "number" ? raw.cardNumber : index,
  };
}

export function normalizeFallbackPlanDto(
  plan: SubscriptionPlanDto,
  programDisplayName: string,
  pathway: string,
  activePlanCode?: string | null,
  index = 0
): NormalizedCataloguePackage {
  const pkgEval = evaluatePackageRecordEntitlements({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    target: pathway,
  });
  const permittedCategory =
    classifyPermittedCatalogueCategory({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      target: pathway,
      programCode: pkgEval.programCode,
      code: plan.code,
    }) || null;
  return {
    id: plan.id,
    source: "plan",
    name: plan.name,
    rawName: plan.name,
    permittedCategory,
    amount: plan.monthlyPriceUsd,
    currency: "USD",
    formattedPrice: formatCataloguePrice(plan.monthlyPriceUsd, "USD"),
    durationLabel: plan.billingInterval || null,
    validityLabel: plan.billingInterval ? `${plan.billingInterval} billing cycle` : null,
    rawDuration: plan.billingInterval,
    programCode: pkgEval.programCode,
    programDisplayName: programDisplayName || pkgEval.programName,
    applicablePathways: pkgEval.pathways,
    planTier: plan.code,
    description: plan.description,
    featuresList: parsePackageFeatures(plan.features),
    examAccessLabel: `Exam Mode & Tutor Mode · ${programDisplayName || pkgEval.programName}`,
    entitlements: {
      examMode: true,
      tutorMode: true,
      pathways: pkgEval.pathways,
    },
    isFeatured: false,
    isAvailable: plan.isActive !== false,
    isActiveOnAccount: Boolean(activePlanCode && activePlanCode === plan.code),
    cardOrder: index,
  };
}

export function isPermittedLearnerCataloguePackage(
  pkg: NormalizedCataloguePackage | PackageRecord | Record<string, unknown> | null | undefined
): boolean {
  if (!pkg || typeof pkg !== "object") return false;

  const rawObj = pkg as Record<string, unknown>;
  const nameStr = String(rawObj.name || "").toLowerCase();
  const descStr = String(rawObj.description || "").toLowerCase();
  const targetStr = String(rawObj.target || "").toLowerCase();
  const parentNameStr = String(rawObj.parentName || "").toUpperCase();
  const clusterSegStr = String(rawObj.terminalClusterSegmentName || "").toUpperCase();
  const pathwayStr = String(rawObj.pathway || "").toUpperCase();
  const programStr = String(rawObj.program || "").toUpperCase();
  const combinedText = `${nameStr} ${descStr} ${targetStr} ${parentNameStr} ${clusterSegStr} ${pathwayStr} ${programStr}`;

  // 1. Exclude administrative, internal, or test packages
  if (/\b(admin|internal|test[\s_-]*package|sandbox|developer|dev[\s_-]*plan)\b/i.test(combinedText)) {
    return false;
  }

  // 2. Exclude exit-only packages
  if (
    /\b(exit[\s_-]*only|exit[\s_-]*exam[\s_-]*only)\b/i.test(combinedText) ||
    ((parentNameStr.includes("EXIT") || clusterSegStr.includes("EXIT") || targetStr.includes("exit")) &&
      !parentNameStr.includes("RN_NURSING") &&
      !parentNameStr.includes("LPN_NURSING") &&
      !combinedText.includes("nclex"))
  ) {
    return false;
  }

  // 3. Exclude other examination pathways (TEAS, HESI A2, certification, etc.)
  if (/\b(ati[\s_-]*teas|teas|hesi[\s_-]*a2|pre[\s_-]*nursing|certification)\b/i.test(combinedText)) {
    return false;
  }

  // 4. If already normalized or cart item
  if ("programCode" in rawObj && typeof rawObj.programCode === "string") {
    const code = rawObj.programCode;
    if (code !== "RN" && code !== "PN_LPN") {
      return false;
    }
    return true;
  }

  // Check pathway or program string explicitly if present
  if (
    pathwayStr === "RN" ||
    pathwayStr === "PN_LPN" ||
    pathwayStr === "RN_NURSING" ||
    pathwayStr === "LPN_NURSING" ||
    programStr.includes("RN NURSING") ||
    programStr.includes("LPN NURSING")
  ) {
    return true;
  }

  // 5. If raw backend record, evaluate with evaluatePackageRecordEntitlements
  const evaluated = evaluatePackageRecordEntitlements(pkg as PackageRecord);
  if (evaluated.programCode !== "RN" && evaluated.programCode !== "PN_LPN") {
    return false;
  }
  return evaluated.pathways.some((p) => p === "RN" || p === "PN_LPN");
}

/**
 * Authoritatively classifies an authentic backend package record into one of the six permitted
 * learner catalogue categories:
 * - LPN STANDARD, LPN PREMIUM, LPN DELUXE
 * - RN STANDARD, RN PREMIUM, RN DELUXE
 * Returns null if the package cannot be reliably classified into one of the 6 permitted categories.
 */
export function classifyPermittedCatalogueCategory(
  pkg: NormalizedCataloguePackage | PackageRecord | Record<string, unknown> | null | undefined
): PermittedSubscriptionCategory | null {
  if (!pkg || typeof pkg !== "object") return null;

  if (!isPermittedLearnerCataloguePackage(pkg)) return null;

  const raw = pkg as Record<string, unknown>;
  const nameStr = String(raw.name || "").trim().toUpperCase();
  const planTierStr = String(raw.planTier || "").trim().toUpperCase();
  const planStr = String(raw.plan || "").trim().toUpperCase();
  const typeStr = String(raw.type || "").trim().toUpperCase();
  const codeStr = String(raw.code || "").trim().toUpperCase();
  const parentNameStr = String(raw.parentName || "").trim().toUpperCase();
  const clusterSegStr = String(raw.terminalClusterSegmentName || "").trim().toUpperCase();
  const clusterId = String(raw.terminalClusterId || "");
  const targetStr = String(raw.target || "").trim().toUpperCase();
  const programCode = String(raw.programCode || "").trim().toUpperCase();

  let program: "RN" | "LPN" | null = null;
  const isExplicitLpn =
    programCode === "PN_LPN" ||
    parentNameStr === "LPN_NURSING" ||
    parentNameStr === "PN_LPN" ||
    clusterSegStr === "LPN_NURSING" ||
    clusterSegStr === "PN_LPN" ||
    clusterId === "6" ||
    targetStr === "PN_LPN" ||
    targetStr === "LPN" ||
    /\b(LPN|PN)\b/.test(nameStr);

  const isExplicitRn =
    programCode === "RN" ||
    parentNameStr === "RN_NURSING" ||
    parentNameStr === "RN" ||
    clusterSegStr === "RN_NURSING" ||
    clusterSegStr === "RN" ||
    clusterId === "9" ||
    targetStr === "RN" ||
    (/\bRN\b/.test(nameStr) && !/\b(LPN|PN)\b/.test(nameStr));

  if (isExplicitLpn && !isExplicitRn) {
    program = "LPN";
  } else if (isExplicitRn && !isExplicitLpn) {
    program = "RN";
  } else if (parentNameStr.includes("LPN") || parentNameStr.includes("PN")) {
    program = "LPN";
  } else if (parentNameStr.includes("RN")) {
    program = "RN";
  }

  if (!program) return null;

  // Direct exact match
  if (nameStr === `${program} STANDARD`) return `${program} STANDARD`;
  if (nameStr === `${program} PREMIUM`) return `${program} PREMIUM`;
  if (nameStr === `${program} DELUXE`) return `${program} DELUXE`;

  // Tier tokens
  const allTierTokens = `${planTierStr} ${planStr} ${typeStr} ${codeStr} ${nameStr}`;
  const cardNum = Number(raw.cardNumber);

  let tier: "STANDARD" | "PREMIUM" | "DELUXE" | null = null;
  if (/\bDELUXE\b/i.test(allTierTokens)) {
    tier = "DELUXE";
  } else if (/\b(PREMIUM|PRO|PLUS|ADVANCED|MASTERY)\b/i.test(allTierTokens)) {
    tier = "PREMIUM";
  } else if (/\b(STANDARD|BASIC|STARTER|ESSENTIALS|CORE)\b/i.test(allTierTokens)) {
    tier = "STANDARD";
  } else if (cardNum === 3) {
    tier = "DELUXE";
  } else if (cardNum === 2) {
    tier = "PREMIUM";
  } else if (cardNum === 1) {
    tier = "STANDARD";
  }

  if (!tier) return null;

  return `${program} ${tier}` as PermittedSubscriptionCategory;
}

/**
 * Authoritatively determines whether a catalogue package corresponds to an active
 * subscription confirmed by the backend /api/subscriptions/status response.
 * Strictly verifies package and program identity without title similarity assumptions.
 */
export function matchActiveSubscriptionForPackage(
  pkg: Pick<
    NormalizedCataloguePackage,
    "id" | "guidId" | "name" | "rawName" | "programCode" | "permittedCategory"
  >,
  activeSubscriptions: ActiveSubscriptionSummary[]
): ActiveSubscriptionSummary | null {
  if (!activeSubscriptions || activeSubscriptions.length === 0) return null;

  for (const sub of activeSubscriptions) {
    // 1. Explicit GUID match
    if (
      pkg.guidId &&
      sub.packageGuidId &&
      pkg.guidId.trim().toLowerCase() === sub.packageGuidId.trim().toLowerCase()
    ) {
      return sub;
    }
    // 2. Numeric or string backend ID match
    if (
      pkg.id !== undefined &&
      pkg.id !== null &&
      sub.packageId !== undefined &&
      sub.packageId !== null &&
      String(pkg.id).trim() === String(sub.packageId).trim()
    ) {
      return sub;
    }
    // 3. Exact Canonical Category match (e.g. "RN STANDARD" strictly matches "RN STANDARD", never "RN DELUXE")
    const pkgCat =
      pkg.permittedCategory ||
      classifyPermittedCatalogueCategory(pkg as unknown as Record<string, unknown>);
    const subCat = classifyPermittedCatalogueCategory({
      name: sub.packageName,
      programCode: sub.programCode,
      parentName: sub.programName,
    });
    if (pkgCat && subCat && pkgCat === subCat) {
      return sub;
    }
    // 4. Exact normalized name and program code match
    if (
      pkg.programCode === sub.programCode &&
      (pkg.name.trim().toLowerCase() === sub.packageName.trim().toLowerCase() ||
        (pkg.rawName && pkg.rawName.trim().toLowerCase() === sub.packageName.trim().toLowerCase()))
    ) {
      return sub;
    }
  }

  return null;
}

/**
 * Authoritatively deduplicates a collection of normalized catalogue packages.
 * Guarantees that:
 * 1. Each genuine package appears exactly once.
 * 2. Packages sharing guidId, id within the same program, or matching permittedCategory are merged.
 * 3. Authoritative pricing, features, currency, duration, and userSubscriptions active state are preserved.
 * 4. Stable ordering (by cardOrder / canonical tier) is maintained.
 */
export function deduplicateCataloguePackages(
  packages: NormalizedCataloguePackage[]
): NormalizedCataloguePackage[] {
  const deduped: NormalizedCataloguePackage[] = [];
  const keyToIndex = new Map<string, number>();

  const getPackageKeys = (pkg: NormalizedCataloguePackage): string[] => {
    const keys: string[] = [];
    if (pkg.guidId) {
      keys.push(`guid:${pkg.guidId.trim().toLowerCase()}`);
    }
    if (pkg.permittedCategory) {
      keys.push(`cat:${pkg.permittedCategory.trim().toUpperCase()}`);
    }
    if (pkg.id !== undefined && pkg.id !== null && pkg.id !== "") {
      keys.push(`id:${String(pkg.id).trim()}:${pkg.programCode}`);
    }
    if (pkg.name) {
      keys.push(`name:${pkg.name.trim().toLowerCase()}:${pkg.programCode}`);
    }
    if (pkg.rawName && pkg.rawName !== pkg.name) {
      keys.push(`name:${pkg.rawName.trim().toLowerCase()}:${pkg.programCode}`);
    }
    return keys;
  };

  for (const pkg of packages) {
    if (!pkg) continue;
    const keys = getPackageKeys(pkg);
    let existingIndex: number | undefined;

    for (const k of keys) {
      if (keyToIndex.has(k)) {
        existingIndex = keyToIndex.get(k);
        break;
      }
    }

    if (existingIndex !== undefined) {
      const existing = deduped[existingIndex];
      // Merge records, preserving the most complete and authoritative fields
      const preferExistingPrice = existing.amount !== null && existing.amount !== undefined;
      const candidateHasPrice = pkg.amount !== null && pkg.amount !== undefined;
      const resolvedAmount = preferExistingPrice ? existing.amount : candidateHasPrice ? pkg.amount : null;
      const resolvedPrice = preferExistingPrice ? existing.formattedPrice : candidateHasPrice ? pkg.formattedPrice : existing.formattedPrice;
      const resolvedCurrency = preferExistingPrice ? existing.currency : candidateHasPrice ? pkg.currency : existing.currency;

      const mergedFeatures =
        existing.featuresList.length >= pkg.featuresList.length
          ? existing.featuresList
          : pkg.featuresList;

      const merged: NormalizedCataloguePackage = {
        ...existing,
        // Prefer item source over package for card styling and metadata
        source: existing.source === "item" ? existing.source : pkg.source,
        guidId: existing.guidId || pkg.guidId,
        rawName: existing.rawName || pkg.rawName,
        permittedCategory: existing.permittedCategory || pkg.permittedCategory,
        name: existing.name || pkg.name,
        amount: resolvedAmount,
        formattedPrice: resolvedPrice,
        currency: resolvedCurrency,
        durationLabel: existing.durationLabel || pkg.durationLabel,
        validityLabel: existing.validityLabel || pkg.validityLabel,
        rawDuration: existing.rawDuration || pkg.rawDuration,
        rawPriceDuration: existing.rawPriceDuration ?? pkg.rawPriceDuration,
        featuresList: mergedFeatures,
        featuresRaw: existing.featuresRaw || pkg.featuresRaw,
        description: existing.description || pkg.description,
        isFeatured: existing.isFeatured || pkg.isFeatured,
        isAvailable: existing.isAvailable && pkg.isAvailable,
        isActiveOnAccount: existing.isActiveOnAccount || pkg.isActiveOnAccount,
        activeValidUntilUtc: pkg.activeValidUntilUtc || existing.activeValidUntilUtc,
        badgeLabel: existing.badgeLabel || pkg.badgeLabel,
        cardOrder: Math.min(existing.cardOrder, pkg.cardOrder),
      };

      deduped[existingIndex] = merged;
      for (const k of keys) {
        keyToIndex.set(k, existingIndex);
      }
      for (const k of getPackageKeys(existing)) {
        keyToIndex.set(k, existingIndex);
      }
    } else {
      const newIndex = deduped.length;
      deduped.push({ ...pkg });
      for (const k of keys) {
        keyToIndex.set(k, newIndex);
      }
    }
  }

  // Canonical ordering: cardOrder ascending, or permittedCategory standard order
  const categoryOrderMap: Record<string, number> = {
    "RN STANDARD": 10,
    "RN PREMIUM": 20,
    "RN DELUXE": 30,
    "LPN STANDARD": 40,
    "LPN PREMIUM": 50,
    "LPN DELUXE": 60,
  };

  return deduped.sort((a, b) => {
    if (a.cardOrder !== b.cardOrder) {
      return a.cardOrder - b.cardOrder;
    }
    const orderA = a.permittedCategory ? categoryOrderMap[a.permittedCategory] ?? 99 : 99;
    const orderB = b.permittedCategory ? categoryOrderMap[b.permittedCategory] ?? 99 : 99;
    return orderA - orderB;
  });
}

export function mergeCatalogueCollections(
  distinctItems: Record<string, unknown>[],
  discretePackages: Record<string, unknown>[]
): NormalizedCataloguePackage[] {
  const normalizedItems: NormalizedCataloguePackage[] = [];
  distinctItems.forEach((raw, idx) => {
    const norm = normalizeBackendCatalogueRecord(raw, "item", idx);
    if (norm && isPermittedLearnerCataloguePackage(norm)) {
      normalizedItems.push(norm);
    }
  });

  const normalizedPackages: NormalizedCataloguePackage[] = [];
  discretePackages.forEach((raw, idx) => {
    const norm = normalizeBackendCatalogueRecord(raw, "package", distinctItems.length + idx);
    if (norm && isPermittedLearnerCataloguePackage(norm)) {
      normalizedPackages.push(norm);
    }
  });

  // Deduplicate items first, then merge packages into items
  return deduplicateCataloguePackages([...normalizedItems, ...normalizedPackages]);
}

/**
 * Evaluates whether selecting a package is blocked as an already-covered duplicate purchase
 * (triggering the required Phase F active subscription toast) or allowed as a new purchase /
 * different-program purchase / legitimate upgrade.
 */
export function evaluatePackageSelectionEligibility(options: {
  selectedPackage: Pick<
    NormalizedCataloguePackage,
    "id" | "guidId" | "name" | "amount" | "programCode" | "programDisplayName" | "applicablePathways" | "entitlements" | "permittedCategory"
  >;
  requiredMode: SubscriptionMode;
  activeSubscriptions: ActiveSubscriptionSummary[];
}): {
  alreadyCovered: boolean;
  isUpgrade: boolean;
  matchedActive?: ActiveSubscriptionSummary;
} {
  const { selectedPackage, requiredMode, activeSubscriptions } = options;
  if (!activeSubscriptions || activeSubscriptions.length === 0) {
    return { alreadyCovered: false, isUpgrade: false };
  }

  // Direct check for exact active package match first
  const exactActiveMatch = matchActiveSubscriptionForPackage(selectedPackage, activeSubscriptions);
  if (exactActiveMatch) {
    return {
      alreadyCovered: true,
      isUpgrade: false,
      matchedActive: exactActiveMatch,
    };
  }

  const targetPathway =
    selectedPackage.programCode === "PN_LPN"
      ? "PN_LPN"
      : selectedPackage.programCode === "RN"
        ? "RN"
        : selectedPackage.applicablePathways[0] || "All";

  // Find an active subscription that already covers the selected package's program
  const coveringProgramSubs = activeSubscriptions.filter((sub) => {
    if (selectedPackage.programCode === "ALL") {
      // Selecting an All-Programs bundle is an upgrade if existing sub only covers single program
      return sub.programCode === "ALL" || sub.pathways.includes("All");
    }
    return doesPathwaySetGrant(sub.pathways, targetPathway);
  });

  if (coveringProgramSubs.length === 0) {
    // Learner's active subscription is for a DIFFERENT program (e.g. owns RN, buying LPN, or owns RN, upgrading to All-Programs)
    const isAllBundleUpgrade = selectedPackage.programCode === "ALL" && activeSubscriptions.length > 0;
    return { alreadyCovered: false, isUpgrade: isAllBundleUpgrade };
  }

  // Check whether existing covering subscription also grants the features of the selected package / requiredMode
  for (const active of coveringProgramSubs) {
    const coversRequiredMode =
      requiredMode === "Tutor"
        ? active.grantsTutor
        : requiredMode === "Exam"
          ? active.grantsExam
          : true;

    const selectedAddsTutor = selectedPackage.entitlements.tutorMode && !active.grantsTutor;
    const selectedAddsExam = selectedPackage.entitlements.examMode && !active.grantsExam;

    if (selectedAddsTutor || selectedAddsExam) {
      return { alreadyCovered: false, isUpgrade: true };
    }

    // Legitimate higher-tier upgrade check: if selected package is a distinct package with strictly higher backend price
    const isSamePkg =
      (selectedPackage.guidId && active.packageGuidId && selectedPackage.guidId === active.packageGuidId) ||
      (active.packageId !== undefined && String(selectedPackage.id) === String(active.packageId)) ||
      selectedPackage.name.trim().toLowerCase() === active.packageName.trim().toLowerCase();

    if (
      !isSamePkg &&
      typeof selectedPackage.amount === "number" &&
      typeof active.amount === "number" &&
      selectedPackage.amount > active.amount
    ) {
      return { alreadyCovered: false, isUpgrade: true };
    }

    if (coversRequiredMode) {
      return {
        alreadyCovered: true,
        isUpgrade: false,
        matchedActive: active,
      };
    }
  }

  return { alreadyCovered: false, isUpgrade: true };
}
