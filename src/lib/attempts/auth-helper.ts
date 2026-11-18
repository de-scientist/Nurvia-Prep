import { NextRequest } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import type { CastoSessionCredentials } from '@/lib/lexmacasto/headers';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

/**
 * Resolves the authenticated learner identity for exam attempts.
 * Returns the stable user ID and session credentials, or null if unauthenticated.
 */
export async function resolveAttemptLearner(
  request: NextRequest
): Promise<{ userId: string; session: CastoSessionCredentials } | null> {
  const session = await getServerCastoSession();
  if (!session) {
    return null;
  }

  // Use the session's castoBadge as the stable user identifier.
  // In test environments, also check partition header if present to ensure test isolation.
  const partition = request.headers.get('x-nurvia-test-partition');
  const userId = partition ? `${session.castoBadge}:${partition}` : session.castoBadge;

  return { userId, session };
}
