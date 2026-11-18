import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { qotdStore } from '@/lib/qotd/qotd-store';
import type { SubmitQotdAnswerRequest } from '@/lib/api-types';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
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

    const session = await getServerCastoSession();
    const userId = session?.castoLine || 'anonymous-learner';

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
        message: result.isCorrect ? 'Correct! High-yield rationale revealed.' : 'Incorrect. Review the clinical rationale below.',
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
