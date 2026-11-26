import type { CastoSessionCredentials, OptionalSiteMetadata } from '@/lib/lexmacasto/headers';
import { lexmaCastoRequest } from '@/lib/lexmacasto/client';
import { buildSubscriptionEndpointPath } from '@/lib/lexmacasto/contracts';

export type SubscriptionMode = 'Exam' | 'Tutor' | 'Review';

export interface ActiveSubscriptionSummary {
  packageId?: number | string;
  packageGuidId?: string;
  subscriptionId?: number | string;
  subscriptionGuidId?: string;
  packageName: string;
  programCode: 'RN' | 'PN_LPN' | 'ALL' | 'OTHER';
  programName: string;
  amount?: number | null;
  currency?: string | null;
  validFrom?: string | null;
  expiresAt?: string | null;
  grantsTutor: boolean;
  grantsExam: boolean;
  pathways: string[];
}

export interface SubscriptionCheckResult {
  allowed: boolean;
  status: 'Active' | 'Pending' | 'Expired' | 'Cancelled' | 'None' | 'Error';
  errorCode?:
    | 'NO_SUBSCRIPTION'
    | 'SUBSCRIPTION_PENDING'
    | 'SUBSCRIPTION_EXPIRED'
    | 'SUBSCRIPTION_CANCELLED'
    | 'ENTITLEMENT_LACKING'
    | 'SERVICE_ERROR'
    | 'UNAUTHORIZED'
    | 'UNVERIFIED';
  reason?: string;
  planName?: string;
  programName?: string;
  expiresAt?: string | null;
  entitlements?: {
    tutor: boolean;
    exam: boolean;
    pathways: string[];
  };
  activeSubscriptions?: ActiveSubscriptionSummary[];
}

interface UserSubRecord {
  subscriptionId?: number | string;
  subscriptionGuidId?: string;
  subscriptionStatus?: string;
  subscriptionHasPaid?: string;
  validFrom?: string;
  validUntil?: string | null;
  expiresAt?: string | null;
  expiresAtUtc?: string | null;
  status?: string;
}

export interface PackageRecord {
  id?: number | string;
  guidId?: string;
  name?: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  target?: string;
  type?: string;
  plan?: string | null;
  parentName?: string | null;
  terminalClusterId?: string | number | null;
  terminalClusterName?: string | null;
  terminalClusterSegmentName?: string | null;
  terminalClusterTableName?: string | null;
  terminalClusterGuidId?: string | null;
  userSubscriptions?: UserSubRecord[];
  subscriptionItems?: Array<{
    name?: string;
    target?: string;
    type?: string;
    code?: string;
    parentName?: string;
    terminalClusterName?: string;
    terminalClusterSegmentName?: string;
  }>;
}

function isWebsiteTargetToken(val?: string | null): boolean {
  return Boolean(val && /^WEBSITE_\d+$/i.test(val.trim()));
}

/**
 * Normalizes subscription status strings from backend
 */
export function normalizeSubStatus(
  statusRaw?: string | null,
  hasPaidRaw?: string | null
): 'Active' | 'Pending' | 'Expired' | 'Cancelled' | 'Inactive' {
  if (!statusRaw) return 'Inactive';
  const s = statusRaw.trim().toLowerCase();
  const paid = (hasPaidRaw || '').trim().toLowerCase();
  if (s === 'pending' || s === 'processing' || s === 'incomplete' || (s === 'active' && paid === 'pending')) {
    return 'Pending';
  }
  if (s === 'active' || s === 'current' || s === 'paid') return 'Active';
  if (s === 'expired' || s === 'past_due' || s === 'terminated') return 'Expired';
  if (s === 'cancelled' || s === 'canceled' || s === 'revoked') return 'Cancelled';
  return 'Inactive';
}

/**
 * Evaluates program/pathway and mode entitlements for a single backend package record.
 * Never assumes an RN package grants LPN access or vice versa unless explicitly universal.
 */
export function evaluatePackageRecordEntitlements(pkg: PackageRecord): {
  programCode: 'RN' | 'PN_LPN' | 'ALL' | 'OTHER';
  programName: string;
  grantsTutor: boolean;
  grantsExam: boolean;
  pathways: string[];
} {
  const rawTarget = isWebsiteTargetToken(pkg.target) ? '' : (pkg.target || '').trim();
  const clusterId = String(pkg.terminalClusterId ?? '').trim();
  const clusterSeg = (pkg.terminalClusterSegmentName || pkg.parentName || '').trim().toUpperCase();
  const clusterName = (pkg.terminalClusterName || '').trim();
  const pkgName = (pkg.name || '').trim();
  const pkgPlan = (pkg.plan || '').trim();
  const pkgType = (pkg.type || '').trim();

  const itemTokens = (pkg.subscriptionItems || [])
    .flatMap((it) => [
      it.name,
      isWebsiteTargetToken(it.target) ? '' : it.target,
      it.type,
      it.code,
      it.parentName,
      it.terminalClusterName,
      it.terminalClusterSegmentName,
    ])
    .filter(Boolean)
    .join(' ');

  const combinedLower = [rawTarget, clusterSeg, clusterName, pkgName, pkgPlan, pkgType, itemTokens]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Feature mode resolution
  const hasExplicitTutorOnly =
    /\btutor[\s-]*only\b/.test(combinedLower) ||
    (combinedLower.includes('tutor') && !combinedLower.includes('exam') && /\bmode\b/.test(combinedLower));
  const hasExplicitExamOnly =
    /\bexam[\s-]*only\b/.test(combinedLower) ||
    /\bbasic[\s-]*exam\b/.test(combinedLower) ||
    (combinedLower.includes('exam') && !combinedLower.includes('tutor') && /\bonly\b/.test(combinedLower));

  let grantsTutor = true;
  let grantsExam = true;
  if (hasExplicitTutorOnly && !hasExplicitExamOnly) {
    grantsTutor = true;
    grantsExam = false;
  } else if (hasExplicitExamOnly && !hasExplicitTutorOnly) {
    grantsExam = true;
    grantsTutor = false;
  }

  // Pathway / curriculum resolution
  const pathways = new Set<string>();

  // Administrative or test packages exclusion
  const isAdminOrTest = /\b(admin|internal|test[\s_-]*package|sandbox|developer|dev[\s_-]*plan)\b/i.test(
    combinedLower
  );
  if (isAdminOrTest) {
    return {
      programCode: 'OTHER',
      programName: clusterName || pkgName || 'Administrative Package',
      grantsTutor,
      grantsExam,
      pathways: [],
    };
  }

  // Exit-only packages exclusion (must not be displayed as standard RN or LPN packages)
  const isExitOnly =
    /\b(exit[\s_-]*only|exit[\s_-]*exam[\s_-]*only)\b/i.test(combinedLower) ||
    ((clusterSeg.includes('EXIT') || rawTarget.toUpperCase().includes('EXIT')) &&
      !clusterSeg.includes('RN_NURSING') &&
      !clusterSeg.includes('LPN_NURSING') &&
      !clusterSeg.includes('NCLEX'));

  if (isExitOnly) {
    const isRnExit = combinedLower.includes('rn');
    const isPnExit = combinedLower.includes('pn') || combinedLower.includes('lpn');
    if (isRnExit) pathways.add('RN_Exit');
    if (isPnExit) pathways.add('PN_Exit');
    return {
      programCode: 'OTHER',
      programName: isRnExit ? 'RN Exit Exam Only' : isPnExit ? 'LPN Exit Exam Only' : 'Exit Exam Only',
      grantsTutor,
      grantsExam,
      pathways: Array.from(pathways),
    };
  }

  const isExplicitUniversal =
    rawTarget.toLowerCase() === 'all' ||
    /\b(all[\s-]*programs|all[\s-]*tracks|universal|complete[\s-]*bundle|rn\s*(?:&|and|\+)\s*(?:lpn|pn))\b/i.test(
      combinedLower
    );

  const matchesLpn =
    clusterId === '6' ||
    clusterSeg.includes('LPN') ||
    clusterSeg.includes('PN') ||
    /\b(lpn|pn_lpn|pn[\s_-]*nursing|practical[\s_-]*nurs|nclex[\s_-]*pn)\b/i.test(combinedLower);

  // Match RN without matching "LPN" substring (not preceded by l/p)
  const matchesRn =
    clusterId === '9' ||
    clusterSeg === 'RN' ||
    clusterSeg === 'RN_NURSING' ||
    clusterSeg === 'NCLEX_RN' ||
    /\b(rn|rn_nursing|rn[\s_-]*nursing|registered[\s_-]*nurs|nclex[\s_-]*rn)\b/i.test(combinedLower);

  const matchesOtherSpecificTrack = /\b(ati[\s_-]*teas|teas|hesi[\s_-]*a2|pre[\s_-]*nursing|certification)\b/i.test(
    combinedLower
  );

  if (isExplicitUniversal || (matchesRn && matchesLpn)) {
    pathways.add('RN');
    pathways.add('PN_LPN');
    pathways.add('RN_Exit');
    pathways.add('PN_Exit');
    pathways.add('All');
    return {
      programCode: 'ALL',
      programName: clusterName || 'All Nursing Programs',
      grantsTutor,
      grantsExam,
      pathways: Array.from(pathways),
    };
  }

  if (matchesLpn && !matchesRn) {
    pathways.add('PN_LPN');
    pathways.add('PN_Exit');
    return {
      programCode: 'PN_LPN',
      programName: 'LPN Nursing Exams',
      grantsTutor,
      grantsExam,
      pathways: Array.from(pathways),
    };
  }

  if (matchesRn && !matchesLpn) {
    pathways.add('RN');
    pathways.add('RN_Exit');
    return {
      programCode: 'RN',
      programName: 'RN Nursing Exams',
      grantsTutor,
      grantsExam,
      pathways: Array.from(pathways),
    };
  }

  if (matchesOtherSpecificTrack) {
    if (combinedLower.includes('teas')) pathways.add('ATI_TEAS');
    if (combinedLower.includes('hesi')) pathways.add('HESI_A2');
    if (clusterSeg) pathways.add(clusterSeg);
    return {
      programCode: 'OTHER',
      programName: clusterName || pkgName || 'Specialized Program',
      grantsTutor,
      grantsExam,
      pathways: Array.from(pathways),
    };
  }

  // Unclassified packages whose program mapping cannot be established are marked as OTHER (Section 4.2)
  return {
    programCode: 'OTHER',
    programName: clusterName || pkgName || 'Unclassified Program',
    grantsTutor,
    grantsExam,
    pathways: [],
  };
}

export function doesPathwaySetGrant(grantedPathways: Iterable<string>, requestedPathway?: string): boolean {
  if (!requestedPathway || requestedPathway === 'All') return true;
  const set = new Set(grantedPathways);
  if (set.has('All')) return true;
  const norm = requestedPathway.trim().toUpperCase();
  if (set.has(norm)) return true;
  if ((norm === 'RN' || norm === 'RN_EXIT' || norm === 'RN_NURSING') && set.has('RN')) return true;
  if ((norm === 'PN_LPN' || norm === 'PN_EXIT' || norm === 'LPN' || norm === 'PN' || norm === 'LPN_NURSING') && set.has('PN_LPN')) {
    return true;
  }
  return false;
}

/**
 * Evaluates a list of backend package records against a requested mode and pathway.
 * Pure function exported for deterministic server verification and unit testing.
 */
export function evaluatePackagesForLearner(
  itemsRaw: PackageRecord[],
  options: { mode: SubscriptionMode; pathway?: string; nowMs?: number }
): SubscriptionCheckResult {
  const nowMs = options.nowMs ?? Date.now();

  let hasPendingSub = false;
  let hasExpiredSub = false;
  let hasCancelledSub = false;

  const activeSubscriptions: ActiveSubscriptionSummary[] = [];

  for (const pkg of itemsRaw) {
    const userSubs = Array.isArray(pkg.userSubscriptions) ? pkg.userSubscriptions : [];
    const evaluated = evaluatePackageRecordEntitlements(pkg);

    for (const sub of userSubs) {
      const status = normalizeSubStatus(sub.subscriptionStatus || sub.status, sub.subscriptionHasPaid);
      const validUntil = sub.validUntil || sub.expiresAt || sub.expiresAtUtc || null;
      const parsedExpiry = validUntil ? new Date(validUntil).getTime() : NaN;
      const isDateExpired = Number.isFinite(parsedExpiry) ? parsedExpiry < nowMs : false;

      if (status === 'Active' && !isDateExpired) {
        activeSubscriptions.push({
          packageId: pkg.id,
          packageGuidId: pkg.guidId,
          subscriptionId: sub.subscriptionId,
          subscriptionGuidId: sub.subscriptionGuidId,
          packageName: pkg.name || 'Active Plan',
          programCode: evaluated.programCode,
          programName: evaluated.programName,
          amount: typeof pkg.amount === 'number' ? pkg.amount : null,
          currency: pkg.currency || 'USD',
          validFrom: sub.validFrom || null,
          expiresAt: validUntil,
          grantsTutor: evaluated.grantsTutor,
          grantsExam: evaluated.grantsExam,
          pathways: evaluated.pathways,
        });
      } else if (status === 'Pending' && !isDateExpired) {
        hasPendingSub = true;
      } else if (isDateExpired || status === 'Expired') {
        hasExpiredSub = true;
      } else if (status === 'Cancelled') {
        hasCancelledSub = true;
      }
    }
  }

  if (activeSubscriptions.length === 0) {
    if (hasPendingSub) {
      return {
        allowed: false,
        status: 'Pending',
        errorCode: 'SUBSCRIPTION_PENDING',
        reason: 'Your subscription payment is currently pending confirmation and provisioning.',
        activeSubscriptions: [],
      };
    }
    if (hasExpiredSub) {
      return {
        allowed: false,
        status: 'Expired',
        errorCode: 'SUBSCRIPTION_EXPIRED',
        reason: 'Your subscription has expired. Please renew your subscription to continue.',
        activeSubscriptions: [],
      };
    }
    if (hasCancelledSub) {
      return {
        allowed: false,
        status: 'Cancelled',
        errorCode: 'SUBSCRIPTION_CANCELLED',
        reason: 'Your subscription has been cancelled. Please resubscribe to continue.',
        activeSubscriptions: [],
      };
    }
    return {
      allowed: false,
      status: 'None',
      errorCode: 'NO_SUBSCRIPTION',
      reason: 'An active subscription is required to access Tutor and Exam Mode.',
      activeSubscriptions: [],
    };
  }

  // Aggregate entitlements across active subscriptions, preferring one that matches both pathway & mode
  const pathwayMatchingSubs = activeSubscriptions.filter((s) =>
    doesPathwaySetGrant(s.pathways, options.pathway)
  );

  const allGrantedPathways = Array.from(new Set(activeSubscriptions.flatMap((s) => s.pathways)));
  const anyGrantsTutor = activeSubscriptions.some((s) => s.grantsTutor);
  const anyGrantsExam = activeSubscriptions.some((s) => s.grantsExam);

  if (options.pathway && options.pathway !== 'All' && pathwayMatchingSubs.length === 0) {
    const primary = activeSubscriptions[0];
    return {
      allowed: false,
      status: 'Active',
      errorCode: 'ENTITLEMENT_LACKING',
      reason: `Your active plan (${primary.packageName}) does not include access to the ${options.pathway.replace('_', ' ')} curriculum. Please select an eligible plan for this program.`,
      planName: primary.packageName,
      programName: primary.programName,
      expiresAt: primary.expiresAt,
      entitlements: {
        tutor: anyGrantsTutor,
        exam: anyGrantsExam,
        pathways: allGrantedPathways,
      },
      activeSubscriptions,
    };
  }

  const candidateSubs = pathwayMatchingSubs.length > 0 ? pathwayMatchingSubs : activeSubscriptions;
  const fullyMatchingSub = candidateSubs.find((s) => {
    if (options.mode === 'Tutor') return s.grantsTutor;
    if (options.mode === 'Exam') return s.grantsExam;
    return true;
  });

  if (!fullyMatchingSub) {
    const primary = candidateSubs[0];
    const modeLabel = options.mode === 'Tutor' ? 'Tutor Mode' : 'Timed Exam Mode';
    return {
      allowed: false,
      status: 'Active',
      errorCode: 'ENTITLEMENT_LACKING',
      reason: `Your active plan (${primary.packageName}) does not include access to ${modeLabel}. Please upgrade your subscription.`,
      planName: primary.packageName,
      programName: primary.programName,
      expiresAt: primary.expiresAt,
      entitlements: {
        tutor: candidateSubs.some((s) => s.grantsTutor),
        exam: candidateSubs.some((s) => s.grantsExam),
        pathways: allGrantedPathways,
      },
      activeSubscriptions,
    };
  }

  return {
    allowed: true,
    status: 'Active',
    planName: fullyMatchingSub.packageName,
    programName: fullyMatchingSub.programName,
    expiresAt: fullyMatchingSub.expiresAt,
    entitlements: {
      tutor: candidateSubs.some((s) => s.grantsTutor),
      exam: candidateSubs.some((s) => s.grantsExam),
      pathways: allGrantedPathways,
    },
    activeSubscriptions,
  };
}

/**
 * Verifies whether a learner has a valid active subscription and required feature entitlement.
 * Enforces fail-closed security: any unexpected error denies access.
 */
export async function verifyLearnerEntitlement(options: {
  session: CastoSessionCredentials | null;
  mode: SubscriptionMode;
  pathway?: string;
  siteMeta?: OptionalSiteMetadata | Record<string, string>;
  isSuperadmin?: boolean;
  isEmailVerified?: boolean;
}): Promise<SubscriptionCheckResult> {
  // 1. Superadmin override
  if (options.isSuperadmin) {
    return {
      allowed: true,
      status: 'Active',
      planName: 'Superadmin Entitlement',
      programName: 'All Nursing Programs',
      entitlements: {
        tutor: true,
        exam: true,
        pathways: ['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit', 'All'],
      },
      activeSubscriptions: [],
    };
  }

  // 2. Authentication requirement
  if (!options.session) {
    return {
      allowed: false,
      status: 'None',
      errorCode: 'UNAUTHORIZED',
      reason: 'Authentication is required to access this feature.',
    };
  }

  // 3. Email verification requirement
  if (options.isEmailVerified === false) {
    return {
      allowed: false,
      status: 'None',
      errorCode: 'UNVERIFIED',
      reason: 'Email verification is required before accessing learning modes.',
    };
  }

  // 4. Query authoritative subscription packages from backend
  try {
    const targetPath = buildSubscriptionEndpointPath('packages', 'discrete', {
      dynamicPage: 1,
      dynamicPerPage: 100,
    });
    const result = await lexmaCastoRequest<Record<string, unknown>>(targetPath, {
      method: 'GET',
      session: options.session,
      siteMeta: options.siteMeta,
    });

    if (!result.ok) {
      return {
        allowed: false,
        status: 'Error',
        errorCode: 'SERVICE_ERROR',
        reason: 'Unable to verify subscription status with authorization service.',
      };
    }

    const payload = (result.data?.data ?? result.data) as Record<string, unknown> | undefined;
    const itemsRaw = Array.isArray(payload?.items)
      ? (payload.items as PackageRecord[])
      : Array.isArray(result.data)
        ? (result.data as PackageRecord[])
        : [];

    return evaluatePackagesForLearner(itemsRaw, {
      mode: options.mode,
      pathway: options.pathway,
    });
  } catch {
    return {
      allowed: false,
      status: 'Error',
      errorCode: 'SERVICE_ERROR',
      reason: 'Failed to complete subscription check. Service unavailable.',
    };
  }
}
