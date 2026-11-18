import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { groupsStore } from '@/lib/groups/groups-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerCastoSession();
  const userId = session?.castoLine || undefined;

  const group = groupsStore.getGroupById(id, userId);
  if (!group) {
    return NextResponse.json(
      {
        success: false,
        message: 'Study group not found.',
        errorCode: 'NOT_FOUND',
      },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Study group retrieved successfully.',
      data: group,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
