import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { qotdStore } from '@/lib/qotd/qotd-store';

export async function GET(request: NextRequest) {
  const learner = await resolveAttemptLearner(request);
  const anonId = request.headers.get('x-nurvia-qotd-anon')?.trim();
  const userId = learner?.userId ?? (anonId ? `anon:${anonId}` : undefined);

  const question = qotdStore.getTodayQuestion(userId);

  return NextResponse.json(
    {
      success: true,
      message: 'Question of the day retrieved successfully.',
      data: question,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
