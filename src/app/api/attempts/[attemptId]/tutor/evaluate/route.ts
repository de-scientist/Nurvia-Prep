import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import {
  getStrataSubmissionType,
  toStrataAnswerPayload,
} from '@/lib/attempts/strata-answer-adapter';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import { buildExamUpsertPath } from '@/lib/lexmacasto/contracts';
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

  if (loaded.attempt.deliveryMode !== 'Tutor' && !loaded.attempt.modePermissions?.canTutor) {
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

  // Persist evaluated response durably to explicitbackend.com when numeric IDs exist
  const raw = loaded.attempt;
  const q = raw.questions.find((item) => item.id === questionId);
  if (raw.examNumericId && q?.numericId) {
    const answerVal = toStrataAnswerPayload(q, body.responseJson);
    if (answerVal !== null) {
      lexmaCastoRequest(buildExamUpsertPath('user/answers'), {
        method: 'POST',
        session: learner.session,
        siteMeta,
        body: {
          examId: raw.examNumericId,
          examGuidId: raw.examId,
          sectionId: q.sectionId ?? 0,
          sectionGuidId: q.sectionGuidId ?? '',
          questionId: q.numericId,
          questionGuidId: q.guidId ?? q.id,
          answer: answerVal,
          submissionType: getStrataSubmissionType(q.questionType),
          actionGroup: 'ExamAnswers',
          isDiy: false,
        },
      }).catch(() => undefined);
    }
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor evaluation completed.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
