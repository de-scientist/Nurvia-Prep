import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import { verifyLearnerEntitlement } from '@/lib/subscriptions/entitlement-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const learner = await resolveAttemptLearner(request);
  if (!learner) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (learner.emailVerified === false) {
    return NextResponse.json(
      {
        success: false,
        message: 'Email verification is required before accessing tutor sessions.',
        errorCode: 'UNVERIFIED_EMAIL',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}/tutor/session`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta, 'Tutor');
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  const entitlement = await verifyLearnerEntitlement({
    session: learner.session,
    mode: 'Tutor',
    pathway: loaded.attempt.pathway,
    siteMeta,
    isSuperadmin: learner.role === 'Superadmin',
    isEmailVerified: Boolean(learner.emailVerified),
  });

  if (!entitlement.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: entitlement.reason || 'Active subscription required to access Tutor Mode.',
        errorCode: entitlement.errorCode || 'ENTITLEMENT_LACKING',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const isTerminal =
    loaded.attempt.status === 'Submitted' ||
    loaded.attempt.status === 'Graded' ||
    loaded.attempt.status === 'Expired';

  if (!isTerminal) {
    if (loaded.attempt.modePermissions && !loaded.attempt.modePermissions.canTutor) {
      return NextResponse.json(
        {
          success: false,
          message:
            loaded.attempt.modePermissions?.tutorReason ||
            'Tutor session is not enabled for this examination by backend policy.',
          errorCode: 'TUTOR_NOT_PERMITTED',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    if (loaded.attempt.deliveryMode !== 'Tutor') {
      loaded.attempt.deliveryMode = 'Tutor';
    }
  } else if (loaded.attempt.allowReview === false) {
    return NextResponse.json(
      {
        success: false,
        message:
          loaded.attempt.modePermissions?.reviewReason ||
          'Tutor explanations are unavailable because answer review is withheld by this examination’s policy.',
        errorCode: 'TUTOR_REVIEW_WITHHELD',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const result = attemptStore.getTutorSession(learner.userId, attemptId);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.error,
        errorCode: result.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
      },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor session retrieved.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
