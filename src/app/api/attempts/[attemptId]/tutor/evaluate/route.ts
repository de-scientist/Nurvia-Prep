import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
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

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}/tutor/evaluate`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  const isTerminal =
    loaded.attempt.status === 'Submitted' ||
    loaded.attempt.status === 'Graded' ||
    loaded.attempt.status === 'Expired';

  if (!isTerminal) {
    if (
      loaded.attempt.deliveryMode !== 'Tutor' ||
      (loaded.attempt.modePermissions && !loaded.attempt.modePermissions.canTutor)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            loaded.attempt.modePermissions?.tutorReason ||
            'Tutor evaluation is not enabled for this examination by backend policy.',
          errorCode: 'TUTOR_NOT_PERMITTED',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.questionId !== 'string' || typeof body.responseJson !== 'string') {
    return NextResponse.json(
      {
        success: false,
        message: 'questionId and responseJson are required.',
        errorCode: 'VALIDATION_ERROR',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const questionId = body.questionId.trim();
  const result = attemptStore.evaluateTutorAnswer(
    learner.userId,
    attemptId,
    questionId,
    body.responseJson
  );

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

  // Tutor evaluations must NOT use the examination ExamAnswers action group,
    // as that collides with ordinary examination response persistence and would
    // contaminate submitted answers, scores, and timestamps. Tutor state is
    // managed exclusively through the attempt store's tutorProgression and the
    // server-authoritative Tutor session endpoint.
    // Persisting to ExamAnswers is omitted for tutor evaluations.

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor evaluation completed.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
