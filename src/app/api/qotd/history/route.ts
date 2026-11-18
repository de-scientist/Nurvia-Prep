import { NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { qotdStore } from '@/lib/qotd/qotd-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await getServerCastoSession();
  const userId = session?.castoLine || undefined;
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
