import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { communityStore } from '@/lib/community/community-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body || !body.content?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Reply content cannot be empty.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const session = await getServerCastoSession();
    const authorName = session ? `Nurse_${session.castoLine.slice(0, 6)}` : 'Nurse_Peer';

    const reply = communityStore.addReply(id, authorName, body.content);
    if (!reply) {
      return NextResponse.json(
        {
          success: false,
          message: 'Community post not found.',
          errorCode: 'NOT_FOUND',
        },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Reply submitted successfully.',
        data: reply,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to submit reply.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
