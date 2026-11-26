"use client";

import { isPermittedLearnerCataloguePackage, classifyPermittedCatalogueCategory } from "./catalogue-normalizer";

export type LearnerProtectedMode = "Exam" | "Tutor";
export type LearnerSessionMode = "Exam" | "Tutor" | "Review";
export type LearnerExamLayout = "Sequential" | "AllInOne";

export interface ValidatedLearningContext {
  returnTo?: string;
  requiredMode: LearnerSessionMode;
  examId?: string;
  pathway?: string;
  subject?: string;
  layout?: LearnerExamLayout;
  attemptId?: string;
  ownerUserId?: string;
  ownerEmail?: string;
  createdAtUtc?: string;
  expiresAtUtc?: string;
}

export interface SubscriptionCartItem {
  id: number | string;
  guidId?: string;
  packageSource?: "item" | "package" | "plan";
  name: string;
  amount: number | null;
  currency: string;
  priceAuthority: "backend";
  duration?: string | null;
  priceDuration?: number | string | null;
  validityLabel?: string | null;
  program: string;
  programCode?: "RN" | "PN_LPN" | "ALL" | "OTHER";
  pathway: string;
  features?: string;
  featuresList?: string[];
  description?: string;
  entitlements?: {
    examMode: boolean;
    tutorMode: boolean;
    pathways?: string[];
  };
  ownerUserId?: string;
  ownerEmail?: string;
  addedAtUtc?: string;
  expiresAtUtc?: string;
  learningContext?: ValidatedLearningContext;
}

export const CART_STORAGE_KEY = "quiznurse_subscription_cart";
export const AUTH_RETURN_CONTEXT_KEY = "quiznurse_auth_return_context";
export const PROCESSED_CHECKOUT_REFS_KEY = "quiznurse_processed_checkout_refs";
export const CART_CHANGE_EVENT = "quiznurse:cart-updated";

const DEFAULT_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ALLOWED_PATHWAYS = new Set([
  "RN",
  "PN_LPN",
  "RN_Exit",
  "PN_Exit",
  "RN_NURSING",
  "LPN_NURSING",
  "ATI_TEAS",
  "HESI_A2",
  "All",
]);

const DISALLOWED_AUTH_PATHS = new Set([
  "/sign-in",
  "/sign-up",
  "/auth/login",
  "/auth/register",
  "/auth/logout",
  "/auth/social/complete",
  "/access-denied",
]);

const ALLOWED_INTERNAL_ROUTE_PREFIXES = [
  "/exam-session",
  "/learner",
  "/exams",
  "/study",
  "/pages/subscription",
  "/pages/heed",
  "/qotd",
  "/care-plans",
  "/mark-k",
  "/nclex",
  "/teas",
  "/community",
  "/faq",
];

const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function sanitizeExamIdentifier(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed)) return undefined;
  if (trimmed.includes("..")) return undefined;
  return trimmed;
}

export function sanitizeLearningMode(
  raw?: string | null,
  fallback: LearnerSessionMode = "Exam"
): LearnerSessionMode {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "Exam" || trimmed === "Tutor" || trimmed === "Review") {
    return trimmed;
  }
  return fallback;
}

export function sanitizeExamLayout(raw?: string | null): LearnerExamLayout | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "Sequential" || trimmed === "AllInOne") return trimmed;
  return undefined;
}

export function sanitizePathwayIdentifier(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (ALLOWED_PATHWAYS.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  if (upper === "LPN" || upper === "PN") return "PN_LPN";
  if (upper === "RN_EXIT") return "RN_Exit";
  if (upper === "PN_EXIT" || upper === "LPN_EXIT") return "PN_Exit";
  if (ALLOWED_PATHWAYS.has(upper)) return upper;
  return undefined;
}

export function sanitizeSubjectLabel(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const cleaned = raw.replace(/[\r\n\0<>]/g, "").trim().slice(0, 160);
  return cleaned || undefined;
}

/**
 * Strictly validates an internal QuizNurse destination URL against open redirects,
 * disallowed auth loops, and malformed examination parameters.
 */
export function sanitizeInternalDestination(
  rawUrl?: string | null,
  fallbackContext?: {
    examId?: string | null;
    mode?: string | null;
    layout?: string | null;
    attemptId?: string | null;
  }
): string | null {
  const buildFromFallback = (): string | null => {
    const safeExam = sanitizeExamIdentifier(fallbackContext?.examId);
    const safeAttempt = sanitizeExamIdentifier(fallbackContext?.attemptId);
    if (!safeExam && !safeAttempt) return null;
    const safeMode = sanitizeLearningMode(fallbackContext?.mode, "Exam");
    const safeLayout =
      sanitizeExamLayout(fallbackContext?.layout) ||
      (safeMode === "Review" ? "AllInOne" : "Sequential");
    const qs = new URLSearchParams();
    if (safeExam) qs.set("examId", safeExam);
    qs.set("mode", safeMode);
    qs.set("layout", safeLayout);
    if (safeAttempt) qs.set("attemptId", safeAttempt);
    return `/exam-session?${qs.toString()}`;
  };

  if (!rawUrl || typeof rawUrl !== "string") {
    return buildFromFallback();
  }

  const trimmed = rawUrl.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    /[\r\n\0]/.test(trimmed)
  ) {
    return buildFromFallback();
  }

  try {
    const parsed = new URL(trimmed, "https://quiznurse.com");
    if (parsed.origin !== "https://quiznurse.com") {
      return buildFromFallback();
    }
    if (DISALLOWED_AUTH_PATHS.has(parsed.pathname)) {
      return buildFromFallback();
    }

    const isAllowedRoute =
      parsed.pathname === "/" ||
      ALLOWED_INTERNAL_ROUTE_PREFIXES.some(
        (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
      );

    if (!isAllowedRoute) {
      return buildFromFallback();
    }

    // Extra validation for /exam-session parameters
    if (parsed.pathname === "/exam-session") {
      const rawExamId = parsed.searchParams.get("examId");
      const rawAttemptId = parsed.searchParams.get("attemptId");
      const safeExamId = sanitizeExamIdentifier(rawExamId);
      const safeAttemptId = sanitizeExamIdentifier(rawAttemptId);

      if (rawExamId !== null && !safeExamId) {
        return null; // Reject tampered examId
      }
      if (rawAttemptId !== null && !safeAttemptId) {
        return null; // Reject tampered attemptId
      }
      if (!safeExamId && !safeAttemptId) {
        return buildFromFallback();
      }

      const rawMode = parsed.searchParams.get("mode");
      if (rawMode && !["Exam", "Tutor", "Review", "Preview"].includes(rawMode)) {
        return null; // Reject invalid mode
      }
      const mode = sanitizeLearningMode(rawMode || fallbackContext?.mode, "Exam");

      const rawLayout = parsed.searchParams.get("layout");
      if (rawLayout && !["Sequential", "AllInOne"].includes(rawLayout)) {
        return null; // Reject invalid layout
      }
      const layout =
        sanitizeExamLayout(rawLayout || fallbackContext?.layout) ||
        (mode === "Review" ? "AllInOne" : "Sequential");

      const cleanParams = new URLSearchParams();
      if (safeExamId) cleanParams.set("examId", safeExamId);
      cleanParams.set("mode", mode);
      cleanParams.set("layout", layout);
      if (safeAttemptId) cleanParams.set("attemptId", safeAttemptId);
      return `/exam-session?${cleanParams.toString()}`;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return buildFromFallback();
  }
}

export function buildValidatedLearningContext(input?: {
  returnTo?: string | null;
  requiredMode?: string | null;
  examId?: string | null;
  pathway?: string | null;
  subject?: string | null;
  layout?: string | null;
  attemptId?: string | null;
  ownerUserId?: string | null;
  ownerEmail?: string | null;
  ttlMs?: number;
}): ValidatedLearningContext {
  const examId = sanitizeExamIdentifier(input?.examId);
  const attemptId = sanitizeExamIdentifier(input?.attemptId);
  const requiredMode = sanitizeLearningMode(input?.requiredMode, "Exam");

  // Extract layout/examId/attemptId from returnTo if not explicitly passed
  let parsedLayout = sanitizeExamLayout(input?.layout);
  let parsedExamId = examId;
  let parsedAttemptId = attemptId;
  let parsedMode = requiredMode;

  if (input?.returnTo && input.returnTo.startsWith("/") && !input.returnTo.startsWith("//")) {
    try {
      const u = new URL(input.returnTo, "https://quiznurse.com");
      if (u.pathname === "/exam-session") {
        parsedExamId = parsedExamId || sanitizeExamIdentifier(u.searchParams.get("examId"));
        parsedAttemptId = parsedAttemptId || sanitizeExamIdentifier(u.searchParams.get("attemptId"));
        parsedLayout = parsedLayout || sanitizeExamLayout(u.searchParams.get("layout"));
        if (!input?.requiredMode && u.searchParams.get("mode")) {
          parsedMode = sanitizeLearningMode(u.searchParams.get("mode"), "Exam");
        }
      } else if (u.pathname === "/learner/subscription") {
        parsedExamId = parsedExamId || sanitizeExamIdentifier(u.searchParams.get("examId"));
        if (!input?.requiredMode && u.searchParams.get("requiredMode")) {
          parsedMode = sanitizeLearningMode(u.searchParams.get("requiredMode"), "Exam");
        }
      }
    } catch {
      // Ignore malformed URL
    }
  }

  const safeReturn = sanitizeInternalDestination(input?.returnTo, {
    examId: parsedExamId,
    mode: parsedMode,
    layout: parsedLayout,
    attemptId: parsedAttemptId,
  });

  const now = Date.now();
  const ttl = input?.ttlMs ?? DEFAULT_CONTEXT_TTL_MS;

  return {
    returnTo: safeReturn || undefined,
    requiredMode: parsedMode,
    examId: parsedExamId,
    pathway: sanitizePathwayIdentifier(input?.pathway) || "RN",
    subject: sanitizeSubjectLabel(input?.subject),
    layout: parsedLayout || (parsedMode === "Review" ? "AllInOne" : "Sequential"),
    attemptId: parsedAttemptId,
    ownerUserId: input?.ownerUserId?.trim() || undefined,
    ownerEmail: input?.ownerEmail?.trim().toLowerCase() || undefined,
    createdAtUtc: new Date(now).toISOString(),
    expiresAtUtc: new Date(now + ttl).toISOString(),
  };
}

export function isContextValidForUser(
  ctx: { expiresAtUtc?: string; ownerUserId?: string; ownerEmail?: string } | null | undefined,
  user?: { id?: string | null; email?: string | null } | null,
  nowMs: number = Date.now()
): boolean {
  if (!ctx) return false;
  if (ctx.expiresAtUtc) {
    const exp = new Date(ctx.expiresAtUtc).getTime();
    if (Number.isFinite(exp) && exp < nowMs) {
      return false;
    }
  }
  if (user?.id && ctx.ownerUserId && ctx.ownerUserId !== user.id) {
    return false;
  }
  if (
    user?.email &&
    ctx.ownerEmail &&
    ctx.ownerEmail.toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return false;
  }
  return true;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveAuthReturnContext(ctx: ValidatedLearningContext | null): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (!ctx || !ctx.returnTo) {
      storage.removeItem(AUTH_RETURN_CONTEXT_KEY);
      return;
    }
    storage.setItem(AUTH_RETURN_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // Ignore storage quota errors
  }
}

export function getAuthReturnContext(
  user?: { id?: string | null; email?: string | null } | null
): ValidatedLearningContext | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_RETURN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ValidatedLearningContext;
    if (!isContextValidForUser(parsed, user)) {
      storage.removeItem(AUTH_RETURN_CONTEXT_KEY);
      return null;
    }
    const safeReturnTo = sanitizeInternalDestination(parsed.returnTo, {
      examId: parsed.examId,
      mode: parsed.requiredMode,
      layout: parsed.layout,
      attemptId: parsed.attemptId,
    });
    if (!safeReturnTo) {
      storage.removeItem(AUTH_RETURN_CONTEXT_KEY);
      return null;
    }
    return { ...parsed, returnTo: safeReturnTo };
  } catch {
    return null;
  }
}

export function clearAuthReturnContext(): void {
  saveAuthReturnContext(null);
}

export interface AddToCartResult {
  status: "added" | "replaced" | "duplicate" | "rejected";
  item: SubscriptionCartItem;
  previousItem?: SubscriptionCartItem | null;
  error?: string;
}

function isSamePackageIdentity(
  a: { id: number | string; guidId?: string; name?: string; programCode?: string; pathway?: string } | null | undefined,
  b: { id: number | string; guidId?: string; name?: string; programCode?: string; pathway?: string } | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.guidId && b.guidId && a.guidId.trim().toLowerCase() === b.guidId.trim().toLowerCase()) return true;
  if (a.id !== undefined && b.id !== undefined && String(a.id).trim() === String(b.id).trim()) return true;
  const aCat = classifyPermittedCatalogueCategory(a as Record<string, unknown>);
  const bCat = classifyPermittedCatalogueCategory(b as Record<string, unknown>);
  if (aCat && bCat && aCat === bCat) return true;
  if (a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) {
    const aProg = a.programCode || (a.pathway?.toUpperCase().includes("PN") ? "PN_LPN" : "RN");
    const bProg = b.programCode || (b.pathway?.toUpperCase().includes("PN") ? "PN_LPN" : "RN");
    return aProg === bProg;
  }
  return false;
}

export function getSubscriptionCart(
  currentUser?: { id?: string | null; email?: string | null } | null
): SubscriptionCartItem | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubscriptionCartItem;
    if (!parsed || typeof parsed !== "object" || parsed.id === undefined || !parsed.name) {
      storage.removeItem(CART_STORAGE_KEY);
      return null;
    }
    if (!isContextValidForUser(parsed, currentUser)) {
      storage.removeItem(CART_STORAGE_KEY);
      return null;
    }
    if (parsed.learningContext && !isContextValidForUser(parsed.learningContext, currentUser)) {
      parsed.learningContext = undefined;
    } else if (parsed.learningContext?.returnTo) {
      const sanitized = sanitizeInternalDestination(parsed.learningContext.returnTo, {
        examId: parsed.learningContext.examId,
        mode: parsed.learningContext.requiredMode,
        layout: parsed.learningContext.layout,
        attemptId: parsed.learningContext.attemptId,
      });
      parsed.learningContext.returnTo = sanitized || undefined;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSubscriptionCart(item: SubscriptionCartItem | null): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (item) {
      const now = Date.now();
      const normalized: SubscriptionCartItem = {
        ...item,
        priceAuthority: "backend",
        addedAtUtc: item.addedAtUtc || new Date(now).toISOString(),
        expiresAtUtc: item.expiresAtUtc || new Date(now + DEFAULT_CONTEXT_TTL_MS).toISOString(),
      };
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: normalized }));
      }
    } else {
      storage.removeItem(CART_STORAGE_KEY);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: null }));
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

export function clearSubscriptionCart(): void {
  saveSubscriptionCart(null);
}

export const subscriptionCart = {
  get: getSubscriptionCart,

  hasDuplicate(
    candidate: { id: number | string; guidId?: string },
    currentUser?: { id?: string | null; email?: string | null } | null
  ): boolean {
    const existing = getSubscriptionCart(currentUser);
    return isSamePackageIdentity(existing, candidate);
  },

  add(
    itemInput: Omit<SubscriptionCartItem, "priceAuthority"> & { priceAuthority?: "backend" },
    currentUser?: { id?: string | null; email?: string | null } | null
  ): AddToCartResult {
    if (!isPermittedLearnerCataloguePackage(itemInput)) {
      const existing = getSubscriptionCart(currentUser);
      return {
        status: "rejected",
        item: existing || ({ ...itemInput, priceAuthority: "backend" } as SubscriptionCartItem),
        previousItem: existing,
        error: "Only RN and LPN packages are eligible for addition to the subscription cart.",
      };
    }

    const existing = getSubscriptionCart(currentUser);

    // Reject adding an already-active subscription to the cart
    if ((itemInput as { isActiveOnAccount?: boolean }).isActiveOnAccount) {
      return {
        status: "rejected",
        item: existing || ({ ...itemInput, priceAuthority: "backend" } as SubscriptionCartItem),
        previousItem: existing,
        error: `You already have an active subscription to '${itemInput.name}'.`,
      };
    }
    if (existing && isSamePackageIdentity(existing, itemInput)) {
      // Update learning context if newly supplied while preventing duplicate cart item
      if (itemInput.learningContext) {
        const updated: SubscriptionCartItem = {
          ...existing,
          learningContext: itemInput.learningContext,
        };
        saveSubscriptionCart(updated);
        return { status: "duplicate", item: updated, previousItem: existing };
      }
      return { status: "duplicate", item: existing, previousItem: existing };
    }

    const now = Date.now();
    const normalizedId =
      typeof itemInput.id === "number"
        ? itemInput.id
        : /^\d+$/.test(String(itemInput.id).trim())
          ? Number(String(itemInput.id).trim())
          : String(itemInput.id).trim();

    const preservedContext = itemInput.learningContext || existing?.learningContext;
    const nextItem: SubscriptionCartItem = {
      ...itemInput,
      id: normalizedId,
      priceAuthority: "backend",
      ownerUserId: itemInput.ownerUserId || currentUser?.id || existing?.ownerUserId || undefined,
      ownerEmail:
        itemInput.ownerEmail ||
        currentUser?.email?.trim().toLowerCase() ||
        existing?.ownerEmail ||
        undefined,
      addedAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + DEFAULT_CONTEXT_TTL_MS).toISOString(),
      learningContext: preservedContext,
    };

    saveSubscriptionCart(nextItem);
    return {
      status: existing ? "replaced" : "added",
      item: nextItem,
      previousItem: existing,
    };
  },

  replace(
    itemInput: Omit<SubscriptionCartItem, "priceAuthority"> & { priceAuthority?: "backend" },
    currentUser?: { id?: string | null; email?: string | null } | null
  ): SubscriptionCartItem {
    clearSubscriptionCart();
    return this.add(itemInput, currentUser).item;
  },

  remove(): void {
    clearSubscriptionCart();
  },

  clear(): void {
    clearSubscriptionCart();
  },

  bindToAuthenticatedUser(user: { id: string; email?: string | null }): SubscriptionCartItem | null {
    const existing = getSubscriptionCart(user);
    if (!existing) return null;
    if (existing.ownerUserId === user.id) return existing;
    const bound: SubscriptionCartItem = {
      ...existing,
      ownerUserId: user.id,
      ownerEmail: user.email?.trim().toLowerCase() || existing.ownerEmail,
      learningContext: existing.learningContext
        ? {
            ...existing.learningContext,
            ownerUserId: user.id,
            ownerEmail: user.email?.trim().toLowerCase() || existing.learningContext.ownerEmail,
          }
        : undefined,
    };
    saveSubscriptionCart(bound);
    return bound;
  },

  recordProvisionedReference(refKey?: string | null): boolean {
    if (!refKey) return false;
    const storage = getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem(PROCESSED_CHECKOUT_REFS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (list.includes(refKey)) return true; // already processed
      const next = [refKey, ...list].slice(0, 25);
      storage.setItem(PROCESSED_CHECKOUT_REFS_KEY, JSON.stringify(next));
      return false;
    } catch {
      return false;
    }
  },
};

/**
 * Formats an authoritative backend expiry timestamp into strict UTC format:
 * "31 May 2027, 00:00 UTC"
 * Never fabricates a dummy future date when expiry is missing or indefinite.
 */
export function formatActiveSubscriptionExpiryUtc(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "Indefinite Validity (UTC)";
  const d = typeof dateInput === "string" || dateInput instanceof Date ? new Date(dateInput) : null;
  if (!d || isNaN(d.getTime())) return "Indefinite Validity (UTC)";

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");

  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}

/**
 * Builds the exact active subscription toast required by Phase F:
 * "You Already Have An Active Subscription To 'RN DELUXE' For The program 'RN Nursing Exams' — It Is Valid Until 31 May 2027, 00:00 UTC ⚓"
 */
export function buildActiveSubscriptionMessage(
  packageName: string,
  programName: string,
  expiryDateUtc?: string | Date | null
): string {
  if (expiryDateUtc) {
    const d = typeof expiryDateUtc === "string" || expiryDateUtc instanceof Date ? new Date(expiryDateUtc) : null;
    if (d && !isNaN(d.getTime())) {
      const formattedExpiry = formatActiveSubscriptionExpiryUtc(d);
      return `You Already Have An Active Subscription To '${packageName}' For The program '${programName}' — It Is Valid Until ${formattedExpiry} ⚓`;
    }
  }
  return `You Already Have An Active Subscription To '${packageName}' For The program '${programName}' — Active on Account ⚓`;
}
