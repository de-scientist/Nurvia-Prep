import { NextRequest } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import type { CastoSessionCredentials } from '@/lib/lexmacasto/headers';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import { buildCurrentUserEndpointPath } from '@/lib/lexmacasto/contracts';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

interface CachedIdentity {
  baseUserId: string;
  guidId?: string;
  email?: string;
  role?: string;
  expiresAt: number;
}

const IDENTITY_TTL_MS = 60_000;
const globalIdentityCache = globalThis as typeof globalThis & {
  __nurviaLearnerIdentityCache?: Map<string, CachedIdentity>;
};

function getIdentityCache(): Map<string, CachedIdentity> {
  if (!globalIdentityCache.__nurviaLearnerIdentityCache) {
    globalIdentityCache.__nurviaLearnerIdentityCache = new Map();
  }
  return globalIdentityCache.__nurviaLearnerIdentityCache;
}

/**
 * Resolves the authoritative authenticated learner identity for exam attempts.
 * Prefers the backend user's canonical `guidId` / `id` (with short 60s TTL cache)
 * and falls back safely to `session.castoBadge` when unavailable.
 */
export async function resolveAttemptLearner(
  request: NextRequest
): Promise<{
  userId: string;
  guidId?: string;
  email?: string;
  role?: string;
  session: CastoSessionCredentials;
} | null> {
  const session = await getServerCastoSession();
  if (!session) {
    return null;
  }

  const cacheKey = `${session.castoBadge}:${session.castoLine.slice(-16)}`;
  const cache = getIdentityCache();
  const cached = cache.get(cacheKey);
  let resolved: CachedIdentity | undefined =
    cached && cached.expiresAt > Date.now() ? cached : undefined;

  if (!resolved) {
    let baseUserId = session.castoBadge;
    let guidId: string | undefined;
    let email: string | undefined;
    let role: string | undefined;

    try {
      const siteMeta = extractSiteMetadataFromRequestHeaders(
        request.headers,
        request.nextUrl.pathname || '/api/attempts'
      );
      const userRes = await lexmaCastoRequest<{
        data?: Record<string, unknown>;
        id?: string | number;
        guidId?: string;
        email?: string;
        role?: string;
        roles?: unknown[];
      }>(buildCurrentUserEndpointPath(), {
        method: 'GET',
        session,
        siteMeta,
      });

      if (userRes.ok && userRes.data) {
        const u = (userRes.data.data ?? userRes.data) as Record<string, unknown>;
        const rawGuid = u.guidId ?? u.userGuidId;
        const rawId = u.id;
        if (typeof rawGuid === 'string' && rawGuid.trim()) {
          guidId = rawGuid.trim();
          baseUserId = guidId;
        } else if (rawId !== undefined && rawId !== null && String(rawId).trim()) {
          baseUserId = String(rawId).trim();
        }
        if (typeof u.email === 'string') {
          email = u.email;
        }
        if (typeof u.role === 'string') {
          role = u.role;
        } else if (Array.isArray(u.roles) && u.roles.length > 0) {
          const firstRole = u.roles[0] as Record<string, unknown> | string;
          role =
            typeof firstRole === 'string'
              ? firstRole
              : typeof firstRole?.name === 'string'
                ? firstRole.name
                : undefined;
        }
      }
    } catch {
      // Fallback to session.castoBadge when backend profile check transiently fails
    }

    resolved = {
      baseUserId,
      guidId,
      email,
      role,
      expiresAt: Date.now() + IDENTITY_TTL_MS,
    };
    cache.set(cacheKey, resolved);
  }

  // Preserve test-partition isolation header for integration & security test suites
  const partition = request.headers.get('x-nurvia-test-partition');
  const userId = partition ? `${resolved.baseUserId}:${partition}` : resolved.baseUserId;

  return {
    userId,
    guidId: resolved.guidId,
    email: resolved.email,
    role: resolved.role,
    session,
  };
}
