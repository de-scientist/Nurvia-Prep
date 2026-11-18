import { NextRequest, NextResponse } from 'next/server';
import { resolveAttemptLearner, NO_STORE_HEADERS } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import type { AutosaveResponseRequest } from '@/lib/api-types';

export async function PUT(
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

  // IDOR protection
  if (rawAttempt.userId !== learner.userId && learner.userId !== 'system' && learner.userId !== 'superadmin') {
    return NextResponse.json(
      { success: false, message: 'Forbidden. You do not own this attempt.', errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const body = (await request.json().catch(() => ({}))) as AutosaveResponseRequest;
  const result = attemptStore.autosaveResponse(learner.userId, attemptId, body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error || 'Autosave failed.' },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Response persisted successfully.',
      data: result.data,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

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
      { success: false, message: 'Forbidden. You do not own this attempt.', errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Saved responses retrieved.',
      data: rawAttempt.savedResponses,
    },
    { headers: NO_STORE_HEADERS }
  );
}
