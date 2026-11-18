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

  // IDOR protection: cannot access another learner's private attempt
  if (rawAttempt.userId !== learner.userId && learner.userId !== 'system' && learner.userId !== 'superadmin') {
    return NextResponse.json(
      { success: false, message: 'Forbidden. You do not own this attempt.', errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const sanitized = attemptStore.sanitizeForActiveSession(rawAttempt);

  return NextResponse.json(
    {
      success: true,
      message: 'Active attempt loaded.',
      data: sanitized,
    },
    { headers: NO_STORE_HEADERS }
  );
}
