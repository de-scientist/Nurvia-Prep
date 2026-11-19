import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore, type StoredAttempt } from '@/lib/attempts/attempt-store';
import {
  buildDurableAttemptId,
  fetchLiveExamFromBackend,
} from '@/lib/attempts/live-exam-loader';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import { buildExamUpsertPath } from '@/lib/lexmacasto/contracts';
import { validateSameOriginRequest } from '@/lib/lexmacasto/session';
import type { ExamLayout } from '@/lib/api-types';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
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

  const { examId } = await context.params;
  const trimmedExamId = (examId || '').trim();
  if (!trimmedExamId) {
    return NextResponse.json(
      { success: false, message: 'Exam ID is required.', errorCode: 'VALIDATION_ERROR' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const body = await request.json().catch(() => ({}));
  const requestedDeliveryMode: 'Exam' | 'Tutor' =
    body?.deliveryMode === 'Tutor' ? 'Tutor' : 'Exam';
  const requestedLayout: ExamLayout | null =
    body?.layoutMode === 'AllInOne' || body?.layoutMode === 'Sequential'
      ? body.layoutMode
      : null;

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/start/${trimmedExamId}`
  );

  // Fetch authoritative live examination session (all paginated sections & questions)
  const loaded = await fetchLiveExamFromBackend({
    examId: trimmedExamId,
    session: learner.session,
    siteMeta,
    layoutMode: requestedLayout ?? 'Sequential',
    deliveryMode: requestedDeliveryMode,
  });

  if (!loaded.ok) {
    return NextResponse.json(
      {
        success: false,
        message: loaded.message,
        errorCode: loaded.errorCode,
      },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  // Enforce server-side authorization rules strictly
  if (requestedDeliveryMode === 'Tutor' && !loaded.modePermissions.canTutor) {
    return NextResponse.json(
      {
        success: false,
        message:
          loaded.modePermissions.tutorReason ||
          'Tutor mode is not permitted for this examination.',
        errorCode: 'TUTOR_NOT_PERMITTED',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  if (requestedDeliveryMode === 'Exam' && !loaded.modePermissions.canExam) {
    return NextResponse.json(
      {
        success: false,
        message:
          loaded.modePermissions.examReason ||
          'Timed Exam mode is not permitted for this resource.',
        errorCode: 'EXAM_NOT_PERMITTED',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // Resolve layout defaulting strictly to Sequential unless restricted by policy
  let layoutMode: ExamLayout = requestedLayout ?? 'Sequential';
  if (loaded.allowedLayouts === 'AllInOneOnly') {
    layoutMode = 'AllInOne';
  } else if (loaded.allowedLayouts === 'SequentialOnly') {
    layoutMode = 'Sequential';
  }

  const attemptId = buildDurableAttemptId(loaded.examId, loaded.attemptNumber);
  const startedAtUtc = new Date().toISOString();

  // Persist initial layout & mode preferences to explicitbackend.com when numeric exam ID exists
  let isDurableBackendSynced = false;
  if (loaded.examNumericId) {
    const prefPath = buildExamUpsertPath('preferences');
    const [layoutSync, modeSync] = await Promise.allSettled([
      lexmaCastoRequest(prefPath, {
        method: 'POST',
        session: learner.session,
        siteMeta,
        body: {
          examId: loaded.examNumericId,
          examGuidId: loaded.examId,
          value: layoutMode,
          submissionType: 'ActionExamLayout',
          actionGroup: 'ExamPreferences',
          isDiy: false,
        },
      }),
      lexmaCastoRequest(prefPath, {
        method: 'POST',
        session: learner.session,
        siteMeta,
        body: {
          examId: loaded.examNumericId,
          examGuidId: loaded.examId,
          value: requestedDeliveryMode,
          submissionType: 'ActionExamMode',
          actionGroup: 'ExamPreferences',
          isDiy: false,
        },
      }),
    ]);

    isDurableBackendSynced =
      (layoutSync.status === 'fulfilled' && layoutSync.value.ok) ||
      (modeSync.status === 'fulfilled' && modeSync.value.ok);
  }

  const storedAttempt: StoredAttempt = {
    attemptId,
    examId: loaded.examId,
    examNumericId: loaded.examNumericId,
    examTitle: loaded.examTitle,
    pathway: loaded.pathway,
    examCategory: loaded.examCategory,
    userId: learner.userId,
    deliveryMode: requestedDeliveryMode,
    layoutMode,
    allowedLayouts: loaded.allowedLayouts,
    timeLimitMinutes: loaded.timeLimitMinutes,
    remainingSeconds: loaded.timeLimitMinutes * 60,
    startedAtUtc,
    status: 'InProgress',
    allowReview: loaded.modePermissions.canReview,
    configuredQuestionCount: loaded.configuredQuestionCount,
    passingScorePercentage: loaded.passingScorePercentage,
    attemptNumber: loaded.attemptNumber,
    modePermissions: loaded.modePermissions,
    isDurableBackendSynced,
    integrityWarnings: loaded.integrityWarnings,
    questions: loaded.questions,
    savedResponses: loaded.savedResponses,
    tutorProgression: {},
  };

  attemptStore.setAttempt(storedAttempt);
  const sanitized = attemptStore.sanitizeForActiveSession(storedAttempt);

  return NextResponse.json(
    {
      success: true,
      message: 'Examination attempt started successfully.',
      data: sanitized,
    },
    { headers: NO_STORE_HEADERS }
  );
}
