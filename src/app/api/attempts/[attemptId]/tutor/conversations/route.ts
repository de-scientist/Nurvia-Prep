import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { getTutorConversationForAttempt } from '@/lib/attempts/tutor-service';
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

  const questionId = request.nextUrl.searchParams.get('questionId')?.trim() || '';
  if (!questionId) {
    return NextResponse.json(
      {
        success: false,
        message: 'questionId query parameter is required.',
        errorCode: 'VALIDATION_ERROR',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}/tutor/conversations`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  const res = getTutorConversationForAttempt(loaded.attempt, learner.userId, questionId);
  if (!res.ok) {
    return NextResponse.json(
      { success: false, message: res.message, errorCode: res.errorCode },
      { status: res.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor conversation retrieved.',
      data: res.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
