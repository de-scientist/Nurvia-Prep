import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { qotdStore } from '@/lib/qotd/qotd-store';

export async function GET(request: NextRequest) {
  const learner = await resolveAttemptLearner(request);
  const anonId = request.headers.get('x-nurvia-qotd-anon')?.trim();
  const userId = learner?.userId ?? (anonId ? `anon:${anonId}` : undefined);

  const history = qotdStore.getHistory(userId);

  return NextResponse.json(
    {
      success: true,
      message: 'Question of the day history retrieved.',
      data: history,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
