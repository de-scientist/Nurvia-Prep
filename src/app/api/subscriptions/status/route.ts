import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { resolveAttemptLearner, NO_STORE_HEADERS } from '@/lib/attempts/auth-helper';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import {
  verifyLearnerEntitlement,
  type SubscriptionMode,
} from '@/lib/subscriptions/entitlement-service';

export async function GET(request: NextRequest) {
  const session = await getServerCastoSession();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        status: 'None',
        allowed: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const learner = await resolveAttemptLearner(request);
  const isSuperadmin = learner?.role === 'Superadmin';
  const isEmailVerified = learner?.emailVerified !== false;

  const modeParam = request.nextUrl.searchParams.get('mode') || 'Exam';
  const mode: SubscriptionMode =
    modeParam === 'Tutor' ? 'Tutor' : modeParam === 'Review' ? 'Review' : 'Exam';
  const pathway = request.nextUrl.searchParams.get('pathway') || undefined;

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    '/api/subscriptions/status'
  );

  const check = await verifyLearnerEntitlement({
    session,
    mode,
    pathway,
    siteMeta,
    isSuperadmin,
    isEmailVerified,
  });

  return NextResponse.json(
    {
      success: check.allowed,
      status: check.status,
      allowed: check.allowed,
      errorCode: check.errorCode,
      message: check.reason || 'Subscription status resolved.',
      planName: check.planName,
      expiresAt: check.expiresAt,
      entitlements: check.entitlements,
    },
    {
      status: check.status === 'Error' ? 503 : 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
