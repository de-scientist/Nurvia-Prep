import { NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { qotdStore } from '@/lib/qotd/qotd-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await getServerCastoSession();
  const userId = session?.castoLine || undefined;
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
