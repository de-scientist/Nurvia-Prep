import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';

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

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}/review`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta, 'Review');
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  const result = attemptStore.getAttemptReview(learner.userId, attemptId);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.error,
        errorCode:
          result.status === 403
            ? 'FORBIDDEN'
            : result.status === 409
              ? 'ATTEMPT_NOT_SUBMITTED'
              : 'NOT_FOUND',
      },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: result.data?.reviewReleased
        ? 'Graded examination review retrieved.'
        : 'Graded attempt summary retrieved; detailed answer key review is disabled by exam policy.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
