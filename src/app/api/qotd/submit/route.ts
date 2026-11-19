import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { validateSameOriginRequest } from '@/lib/lexmacasto/session';
import { qotdStore } from '@/lib/qotd/qotd-store';
import type { SubmitQotdAnswerRequest } from '@/lib/api-types';

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json(
      {
        success: false,
        message: csrf.reason,
        errorCode: 'CSRF_REJECTED',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as SubmitQotdAnswerRequest;
    if (!body || !body.questionId || !body.selectedOptionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Question ID and selected option ID are required.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const learner = await resolveAttemptLearner(request);
    const anonId = request.headers.get('x-nurvia-qotd-anon')?.trim();
    const userId = learner?.userId || (anonId ? `anon:${anonId}` : 'anonymous-learner');

    const result = qotdStore.submitAnswer(userId, body.questionId, body.selectedOptionId);
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid question or option ID.',
          errorCode: 'NOT_FOUND',
        },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.isCorrect
          ? 'Correct! Clinical rationale revealed.'
          : 'Incorrect. Review the clinical rationale below.',
        data: result,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to evaluate answer submission.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
