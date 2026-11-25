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
import type { ExamLayout } from '@/lib/api-types';
import { verifyLearnerEntitlement } from '@/lib/subscriptions/entitlement-service';

async function handleAutosave(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  try {
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

    if (learner.emailVerified === false) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email verification is required before persisting examination responses.',
          errorCode: 'UNVERIFIED_EMAIL',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { attemptId } = await context.params;
    const siteMeta = extractSiteMetadataFromRequestHeaders(
      request.headers,
      `/api/attempts/${attemptId}/responses`
    );

    const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta);
    if (!loaded.ok) {
      return NextResponse.json(
        { success: false, message: loaded.message, errorCode: loaded.errorCode },
        { status: loaded.status, headers: NO_STORE_HEADERS }
      );
    }

    const entitlement = await verifyLearnerEntitlement({
      session: learner.session,
      mode: loaded.attempt.deliveryMode === 'Tutor' ? 'Tutor' : 'Exam',
      pathway: loaded.attempt.pathway,
      siteMeta,
      isSuperadmin: learner.role === 'Superadmin',
      isEmailVerified: Boolean(learner.emailVerified),
    });

    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: entitlement.reason || 'Active subscription required to submit responses.',
          errorCode: entitlement.errorCode || 'ENTITLEMENT_LACKING',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.questionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'questionId is required in the payload.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const questionId = body.questionId.trim();
    const raw = loaded.attempt;
    const q = raw.questions.find((item) => item.id === questionId);
    if (!q) {
      return NextResponse.json(
        {
          success: false,
          message: 'Question does not belong to this exam attempt.',
          errorCode: 'INVALID_QUESTION',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const responseJson =
      body.responseJson !== undefined ? (body.responseJson as string | null) : null;
    const isFlagged = Boolean(body.isFlagged);
    const layoutMode: ExamLayout | null | undefined =
      body.layoutMode === 'AllInOne' || body.layoutMode === 'Sequential'
        ? body.layoutMode
        : undefined;

    const previousFlagged = Boolean(loaded.attempt.savedResponses[questionId]?.isFlagged);
    const previousLayout = loaded.attempt.layoutMode;

    const result = attemptStore.autosaveResponse(learner.userId, attemptId, {
      questionId,
      responseJson,
      isFlagged,
      layoutMode,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error,
          errorCode:
            result.status === 403
              ? 'FORBIDDEN'
              : result.status === 404
                ? 'NOT_FOUND'
                : 'CONFLICT',
        },
        { status: result.status, headers: NO_STORE_HEADERS }
      );
    }

    // Sync response, flag state, and layout changes durably to explicitbackend.com
    let backendSynced = false;
    let syncWarning: string | undefined;

    if (raw.examNumericId) {
      const syncTasks: Array<Promise<{ ok: boolean; status: number; message?: string }>> = [];

      const sectionGuidId =
        q.sectionGuidId ||
        raw.questions.find((item) => item.sectionGuidId)?.sectionGuidId ||
        '';
      const sectionId =
        q.sectionId ??
        raw.questions.find((item) => item.sectionId)?.sectionId ??
        0;

      if (q.numericId && body.responseJson !== undefined) {
        const answerVal = toStrataAnswerPayload(q, responseJson);
        if (answerVal !== null) {
          const submissionType = getStrataSubmissionType(q.questionType);
          syncTasks.push(
            lexmaCastoRequest(buildExamUpsertPath('user/answers'), {
              method: 'POST',
              session: learner.session,
              siteMeta,
              body: {
                examId: raw.examNumericId,
                examGuidId: raw.examId,
                sectionId,
                sectionGuidId,
                questionId: q.numericId,
                questionGuidId: q.guidId ?? q.id,
                answer: answerVal,
                submissionType,
                actionGroup: 'ExamAnswers',
                isDiy: false,
              },
            })
          );
        }
      }

      if (q.numericId && isFlagged !== previousFlagged) {
        syncTasks.push(
          lexmaCastoRequest(buildExamUpsertPath('question/actions'), {
            method: 'POST',
            session: learner.session,
            siteMeta,
            body: {
              examId: raw.examNumericId,
              examGuidId: raw.examId,
              sectionId,
              sectionGuidId,
              questionId: q.numericId,
              questionGuidId: q.guidId ?? q.id,
              actionValue: isFlagged ? 'flagged' : 'unflagged',
              value: isFlagged,
              submissionType: 'ActionQuestionFlag',
              actionGroup: 'QuestionActions',
              isDiy: false,
            },
          })
        );
      }

      if (layoutMode && layoutMode !== previousLayout) {
        syncTasks.push(
          lexmaCastoRequest(buildExamUpsertPath('preferences'), {
            method: 'POST',
            session: learner.session,
            siteMeta,
            body: {
              examId: raw.examNumericId,
              examGuidId: raw.examId,
              value: layoutMode,
              submissionType: 'ActionExamLayout',
              actionGroup: 'ExamPreferences',
              isDiy: false,
            },
          })
        );
      }

      if (syncTasks.length > 0) {
        const settled = await Promise.allSettled(syncTasks);
        const authFailure = settled.find(
          (s) => s.status === 'fulfilled' && (s.value.status === 401 || s.value.status === 403)
        );
        if (authFailure && authFailure.status === 'fulfilled') {
          return NextResponse.json(
            {
              success: false,
              message: authFailure.value.message || 'Backend session unauthorized for autosave.',
              errorCode: authFailure.value.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
            },
            { status: authFailure.value.status, headers: NO_STORE_HEADERS }
          );
        }
        backendSynced = settled.some((s) => s.status === 'fulfilled' && s.value.ok);
        if (!backendSynced) {
          syncWarning = 'Backend persistence did not confirm save. Please retry.';
          return NextResponse.json(
            {
              success: false,
              message: syncWarning,
              errorCode: 'BACKEND_SYNC_FAILED',
              data: {
                ...result.data,
                backendSynced: false,
                syncWarning,
              },
            },
            { status: 502, headers: NO_STORE_HEADERS }
          );
        }
      } else {
        backendSynced = true;
      }
    } else {
      syncWarning = 'Exam lacks numeric backend identifier; response stored in active session cache only.';
    }

    raw.isDurableBackendSynced = raw.isDurableBackendSynced || backendSynced;

    return NextResponse.json(
      {
        success: true,
        message: 'Response autosaved.',
        data: {
          ...result.data,
          backendSynced,
          ...(syncWarning ? { syncWarning } : {}),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error autosaving response.';
    console.error('Autosave unhandled error:', err);
    return NextResponse.json(
      { success: false, message, errorCode: 'AUTOSAVE_FAILED' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  return handleAutosave(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  return handleAutosave(request, context);
}
