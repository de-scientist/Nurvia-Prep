import { NextRequest, NextResponse } from 'next/server';
import { resolveAttemptLearner, NO_STORE_HEADERS } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import type { TutorStage } from '@/lib/api-types';

export async function POST(
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

  const { attemptId } = await context.params;
  const rawAttempt = attemptStore.getRawAttempt(attemptId);

  if (!rawAttempt) {
    return NextResponse.json(
      { success: false, message: 'Attempt not found.', errorCode: 'NOT_FOUND' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (rawAttempt.userId !== learner.userId && learner.userId !== 'system' && learner.userId !== 'superadmin') {
    return NextResponse.json(
      { success: false, message: 'Forbidden.', errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const body = await request.json().catch(() => ({}));
  const questionId = String(body.questionId || '');
  const stage = (body.stage || 'FirstHint') as TutorStage;

  const result = attemptStore.getTutorHint(learner.userId, attemptId, questionId, stage);

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error || 'Failed to load hint.' },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Hint generated.',
      data: result.data,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
