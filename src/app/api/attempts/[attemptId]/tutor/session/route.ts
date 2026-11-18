import { NextRequest, NextResponse } from 'next/server';
import { resolveAttemptLearner, NO_STORE_HEADERS } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';

export async function GET(
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

  const result = attemptStore.getTutorSession(learner.userId, attemptId);

  return NextResponse.json(
    {
      success: true,
      message: 'Tutor session loaded.',
      data: result.data,
    },
    { headers: NO_STORE_HEADERS }
  );
}
