import type { CastoSessionCredentials, OptionalSiteMetadata } from '@/lib/lexmacasto/headers';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import { buildSubscriptionEndpointPath } from '@/lib/lexmacasto/contracts';

export type SubscriptionMode = 'Exam' | 'Tutor' | 'Review';

export interface SubscriptionCheckResult {
  allowed: boolean;
  status: 'Active' | 'Expired' | 'Cancelled' | 'None' | 'Error';
  errorCode?:
    | 'NO_SUBSCRIPTION'
    | 'SUBSCRIPTION_EXPIRED'
    | 'SUBSCRIPTION_CANCELLED'
    | 'ENTITLEMENT_LACKING'
    | 'SERVICE_ERROR'
    | 'UNAUTHORIZED'
    | 'UNVERIFIED';
  reason?: string;
  planName?: string;
  expiresAt?: string | null;
  entitlements?: {
    tutor: boolean;
    exam: boolean;
    pathways: string[];
  };
}

interface UserSubRecord {
  subscriptionStatus?: string;
  subscriptionHasPaid?: string;
  validFrom?: string;
  validUntil?: string | null;
  expiresAt?: string | null;
  expiresAtUtc?: string | null;
  status?: string;
}

interface PackageRecord {
  id?: number | string;
  name?: string;
  target?: string;
  type?: string;
  terminalClusterTableName?: string;
  terminalClusterGuidId?: string;
  userSubscriptions?: UserSubRecord[];
  subscriptionItems?: Array<{
    name?: string;
    target?: string;
    type?: string;
    code?: string;
  }>;
}

/**
 * Normalizes status strings from backend
 */
function normalizeSubStatus(statusRaw?: string | null): 'Active' | 'Expired' | 'Cancelled' | 'Inactive' {
  if (!statusRaw) return 'Inactive';
  const s = statusRaw.trim().toLowerCase();
  if (s === 'active' || s === 'current' || s === 'paid') return 'Active';
  if (s === 'expired' || s === 'past_due' || s === 'terminated') return 'Expired';
  if (s === 'cancelled' || s === 'canceled' || s === 'revoked') return 'Cancelled';
  return 'Inactive';
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
      entitlements: {
        tutor: true,
        exam: true,
        pathways: ['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit', 'All'],
      },
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
    const targetPath = buildSubscriptionEndpointPath('packages', 'discrete');
    const result = await lexmaCastoRequest<Record<string, unknown>>(targetPath, {
      method: 'GET',
      session: options.session,
      siteMeta: options.siteMeta,
    });

    if (!result.ok) {
      // Backend returned error - fail closed
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

    let hasActiveSub = false;
    let hasExpiredSub = false;
    let hasCancelledSub = false;
    let matchedPlanName: string | undefined;
    let activeExpiresAt: string | null = null;

    let grantsTutor = false;
    let grantsExam = false;
    const grantedPathways = new Set<string>();

    for (const pkg of itemsRaw) {
      const userSubs = Array.isArray(pkg.userSubscriptions) ? pkg.userSubscriptions : [];
      for (const sub of userSubs) {
        const status = normalizeSubStatus(sub.subscriptionStatus || sub.status);
        const validUntil = sub.validUntil || sub.expiresAt || sub.expiresAtUtc;
        const isDateExpired = validUntil ? new Date(validUntil).getTime() < Date.now() : false;

        if (status === 'Active' && !isDateExpired) {
          hasActiveSub = true;
          matchedPlanName = pkg.name || matchedPlanName || 'Active Plan';
          activeExpiresAt = validUntil || null;

          // Check package feature targets
          const pkgTarget = (pkg.target || '').toLowerCase();
          const pkgName = (pkg.name || '').toLowerCase();
          const pkgType = (pkg.type || '').toLowerCase();

          // Standard subscription packages generally include both exam and tutor
          // unless explicitly segmented
          const isTutorSpecific = pkgTarget.includes('tutor') || pkgName.includes('tutor');
          const isExamSpecific = pkgTarget.includes('exam') || pkgName.includes('exam');

          if (isTutorSpecific) {
            grantsTutor = true;
          } else if (isExamSpecific) {
            grantsExam = true;
          } else {
            // General learning plan covers both
            grantsTutor = true;
            grantsExam = true;
          }

          // Check pathway restrictions
          if (pkgTarget.includes('rn') || pkgName.includes('rn')) {
            grantedPathways.add('RN');
            grantedPathways.add('RN_Exit');
          }
          if (pkgTarget.includes('pn') || pkgTarget.includes('lpn') || pkgName.includes('pn') || pkgName.includes('lpn')) {
            grantedPathways.add('PN_LPN');
            grantedPathways.add('PN_Exit');
          }
          if (!pkgTarget || pkgTarget === 'all' || pkgName.includes('all') || pkgName.includes('comprehensive')) {
            grantedPathways.add('RN');
            grantedPathways.add('PN_LPN');
            grantedPathways.add('RN_Exit');
            grantedPathways.add('PN_Exit');
            grantedPathways.add('All');
          }

          // Check sub-items inside package
          if (Array.isArray(pkg.subscriptionItems)) {
            for (const item of pkg.subscriptionItems) {
              const itemTarget = (item.target || item.name || '').toLowerCase();
              if (itemTarget.includes('tutor')) grantsTutor = true;
              if (itemTarget.includes('exam')) grantsExam = true;
              if (itemTarget.includes('rn')) grantedPathways.add('RN');
              if (itemTarget.includes('pn') || itemTarget.includes('lpn')) grantedPathways.add('PN_LPN');
            }
          }
        } else if (isDateExpired || status === 'Expired') {
          hasExpiredSub = true;
        } else if (status === 'Cancelled') {
          hasCancelledSub = true;
        }
      }
    }

    // Default universal grant for any active generic plan if no pathway filter was specified
    if (hasActiveSub && grantedPathways.size === 0) {
      grantedPathways.add('RN');
      grantedPathways.add('PN_LPN');
      grantedPathways.add('RN_Exit');
      grantedPathways.add('PN_Exit');
      grantedPathways.add('All');
    }

    if (!hasActiveSub) {
      if (hasExpiredSub) {
        return {
          allowed: false,
          status: 'Expired',
          errorCode: 'SUBSCRIPTION_EXPIRED',
          reason: 'Your subscription has expired. Please renew your subscription to continue.',
        };
      }
      if (hasCancelledSub) {
        return {
          allowed: false,
          status: 'Cancelled',
          errorCode: 'SUBSCRIPTION_CANCELLED',
          reason: 'Your subscription has been cancelled. Please resubscribe to continue.',
        };
      }
      return {
        allowed: false,
        status: 'None',
        errorCode: 'NO_SUBSCRIPTION',
        reason: 'An active subscription is required to access Tutor and Exam Mode.',
      };
    }

    // Check feature entitlement
    if (options.mode === 'Tutor' && !grantsTutor) {
      return {
        allowed: false,
        status: 'Active',
        errorCode: 'ENTITLEMENT_LACKING',
        reason: 'Your active plan does not include access to Tutor Mode. Please upgrade your subscription.',
        planName: matchedPlanName,
        expiresAt: activeExpiresAt,
      };
    }

    if (options.mode === 'Exam' && !grantsExam) {
      return {
        allowed: false,
        status: 'Active',
        errorCode: 'ENTITLEMENT_LACKING',
        reason: 'Your active plan does not include access to Timed Exam Mode. Please upgrade your subscription.',
        planName: matchedPlanName,
        expiresAt: activeExpiresAt,
      };
    }

    // Check pathway entitlement if specific pathway requested
    if (options.pathway && options.pathway !== 'All' && grantedPathways.size > 0) {
      const normalizedReqPathway = options.pathway.toUpperCase();
      const hasPathway =
        grantedPathways.has('All') ||
        grantedPathways.has(normalizedReqPathway) ||
        (normalizedReqPathway.includes('RN') && grantedPathways.has('RN')) ||
        ((normalizedReqPathway.includes('PN') || normalizedReqPathway.includes('LPN')) && grantedPathways.has('PN_LPN'));

      if (!hasPathway) {
        return {
          allowed: false,
          status: 'Active',
          errorCode: 'ENTITLEMENT_LACKING',
          reason: `Your active plan does not include access to the ${options.pathway} curriculum. Please upgrade your subscription.`,
          planName: matchedPlanName,
          expiresAt: activeExpiresAt,
        };
      }
    }

    return {
      allowed: true,
      status: 'Active',
      planName: matchedPlanName,
      expiresAt: activeExpiresAt,
      entitlements: {
        tutor: grantsTutor,
        exam: grantsExam,
        pathways: Array.from(grantedPathways),
      },
    };
  } catch (err) {
    // Fail closed on any exception
    return {
      allowed: false,
      status: 'Error',
      errorCode: 'SERVICE_ERROR',
      reason: 'Failed to complete subscription check. Service unavailable.',
    };
  }
}
