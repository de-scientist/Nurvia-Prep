import { NextRequest, NextResponse } from 'next/server';
import { communityStore } from '@/lib/community/community-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const reason = body?.reason || 'Flagged for moderation';

    const ok = communityStore.reportPost(id, reason);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'Post not found.',
          errorCode: 'NOT_FOUND',
        },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you. The post has been flagged for moderation review to preserve clinical integrity and safety.',
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to flag post.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
