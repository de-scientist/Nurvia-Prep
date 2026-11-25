import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import {
  buildExamUpsertPath,
  buildStrataEndpointPath,
} from '@/lib/lexmacasto/contracts';
import { validateSameOriginRequest } from '@/lib/lexmacasto/session';
import { verifyLearnerEntitlement } from '@/lib/subscriptions/entitlement-service';

export async function POST(
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
          message: 'Email verification is required before submitting an examination.',
          errorCode: 'UNVERIFIED_EMAIL',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { attemptId } = await context.params;
    const siteMeta = extractSiteMetadataFromRequestHeaders(
      request.headers,
      `/api/attempts/${attemptId}/submit`
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
          message: entitlement.reason || 'Active subscription required to submit attempt.',
          errorCode: entitlement.errorCode || 'ENTITLEMENT_LACKING',
        },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const wasAlreadyTerminal =
      loaded.attempt.status === 'Submitted' || loaded.attempt.status === 'Graded';

    const result = attemptStore.submitAttempt(learner.userId, attemptId);
    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Failed to submit attempt.',
          errorCode: result.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
        },
        { status: result.status, headers: NO_STORE_HEADERS }
      );
    }

    // Never re-submit an already-completed backend attempt to the remote lifecycle endpoint
    if (wasAlreadyTerminal) {
      return NextResponse.json(
        {
          success: true,
          message: 'Examination submitted and graded successfully.',
          data: result.data,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const raw = loaded.attempt;
    const graded = { ...result.data };

    // Submit exam lifecycle durably to explicitbackend.com & reconcile authoritative score
    if (raw.examNumericId) {
      try {
        const lifecycleRes = await lexmaCastoRequest(buildExamUpsertPath('lifecycle'), {
          method: 'POST',
          session: learner.session,
          siteMeta,
          body: {
            examId: raw.examNumericId,
            examGuidId: raw.examId,
            status: 'Completed',
            reason: 'Learner submitted examination in QuizNurse',
            submissionType: 'ActionExamSubmit',
            actionGroup: 'ExamLifecycle',
            isDiy: false,
          },
        });

        if (lifecycleRes.ok) {
          const distinctPath = buildStrataEndpointPath(
            'examResultsDistinct',
            { identifier: raw.examId, dynamicPage: 1, dynamicPerPage: 10 },
            'distinct'
          );
          const backendResultRes = await lexmaCastoRequest<{
            data?: { items?: Record<string, unknown>[]; results?: Record<string, unknown>[] };
            items?: Record<string, unknown>[];
          }>(distinctPath, {
            method: 'GET',
            session: learner.session,
            siteMeta,
          });

          if (backendResultRes.ok) {
            const list =
              backendResultRes.data?.data?.items ??
              backendResultRes.data?.data?.results ??
              backendResultRes.data?.items ??
              [];
            const matching = Array.isArray(list)
              ? list.find((item) => {
                  if (!raw.attemptNumber) return true;
                  const num = Number(item.attemptNumber);
                  if (!Number.isFinite(num)) return true;
                  return (num > 0 ? num : 1) === raw.attemptNumber || num + 1 === raw.attemptNumber;
                }) ?? (list.length === 1 ? list[0] : undefined)
              : undefined;

            if (matching && typeof matching.percentageScore === 'number') {
              graded.scorePercentage = Math.round(matching.percentageScore);
              if (typeof matching.passed === 'boolean') {
                graded.passed = matching.passed;
              }
              if (typeof matching.passMark === 'number' && matching.passMark > 0 && matching.passMark <= 100) {
                graded.passingScorePercentage = matching.passMark;
                if (typeof matching.passed !== 'boolean') {
                  graded.passed = graded.scorePercentage >= matching.passMark;
                }
              }
              if (typeof matching.totalCorrect === 'number') graded.correctQuestions = matching.totalCorrect;
              if (typeof matching.totalWrong === 'number') graded.totalWrong = matching.totalWrong;
              if (typeof matching.totalAnswered === 'number') graded.totalAnswered = matching.totalAnswered;
              if (typeof matching.timeTaken === 'number' && matching.timeTaken > 0) {
                graded.timeSpentSeconds = matching.timeTaken;
              }
              if (typeof matching.grade === 'string' && matching.grade) {
                graded.grade = matching.grade;
              }
              const detail = matching.examDetail as Record<string, unknown> | undefined;
              if (
                detail &&
                (detail.withholdReview === true || detail.reviewReleased === false)
              ) {
                graded.reviewReleased = false;
                graded.reviewQuestions = [];
              }
              raw.result = graded;
            }
          }
        }
      } catch {
        // Keep locally computed deterministic result if authoritative reconciliation fails transiently
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Examination submitted and graded successfully.',
        data: graded,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error submitting examination.';
    console.error('Submit unhandled error:', err);
    return NextResponse.json(
      { success: false, message, errorCode: 'SUBMIT_FAILED' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
