import { NextRequest, NextResponse } from 'next/server';
import { communityStore } from '@/lib/community/community-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const post = communityStore.getPostById(id);

  if (!post) {
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
      message: 'Community post retrieved successfully.',
      data: post,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
