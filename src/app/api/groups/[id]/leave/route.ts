import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { groupsStore } from '@/lib/groups/groups-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerCastoSession();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        message: 'Sign in to manage study group membership.',
        errorCode: 'UNAUTHORIZED',
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const { id } = await context.params;
  const userId = session.castoLine;
  const result = groupsStore.leaveGroup(userId, id);

  return NextResponse.json(
    {
      success: result.success,
      message: result.message,
      data: result.group,
    },
    { status: result.success ? 200 : 400, headers: NO_STORE_HEADERS }
  );
}
