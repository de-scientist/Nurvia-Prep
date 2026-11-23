import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { checkTutorPracticeForAttempt } from '@/lib/attempts/tutor-service';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import { validateSameOriginRequest } from '@/lib/lexmacasto/session';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, message: csrf.reason, errorCode: 'CSRF_REJECTED' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const learner = await resolveAttemptLearner(request);
  if (!learner) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.questionId !== 'string' ||
    !body.questionId.trim() ||
    typeof body.practiceQuestionId !== 'string' ||
    !body.practiceQuestionId.trim() ||
    typeof body.responseJson !== 'string'
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'questionId, practiceQuestionId, and responseJson are required.',
        errorCode: 'VALIDATION_ERROR',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}/tutor/practice-check`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  const res = checkTutorPracticeForAttempt(loaded.attempt, learner.userId, {
    questionId: body.questionId.trim(),
    practiceQuestionId: body.practiceQuestionId.trim(),
    responseJson: body.responseJson,
  });

  if (!res.ok) {
    return NextResponse.json(
      { success: false, message: res.message, errorCode: res.errorCode },
      { status: res.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Practice answer checked (isolated from your examination attempt).',
      data: res.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
