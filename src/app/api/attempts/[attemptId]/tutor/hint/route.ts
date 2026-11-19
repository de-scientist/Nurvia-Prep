import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import { validateSameOriginRequest } from '@/lib/lexmacasto/session';
import type { TutorStage } from '@/lib/api-types';

const ALLOWED_STAGES: TutorStage[] = ['FirstHint', 'GuidedReasoning', 'ExplainConcept'];

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
    `/api/attempts/${attemptId}/tutor/hint`
  );

  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  // Enforce Tutor permission strictly server-side
  if (loaded.attempt.deliveryMode !== 'Tutor' && !loaded.attempt.modePermissions?.canTutor) {
    return NextResponse.json(
      {
        success: false,
        message:
          loaded.attempt.modePermissions?.tutorReason ||
          'Tutor mode is not enabled for this examination by backend policy.',
        errorCode: 'TUTOR_NOT_PERMITTED',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.questionId !== 'string' || !ALLOWED_STAGES.includes(body.stage)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Valid questionId and Tutor stage are required.',
        errorCode: 'VALIDATION_ERROR',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const result = attemptStore.getTutorHint(
    learner.userId,
    attemptId,
    body.questionId.trim(),
    body.stage
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

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor hint generated.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
