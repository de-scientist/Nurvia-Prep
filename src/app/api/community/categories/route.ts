import { NextResponse } from 'next/server';
import { communityStore } from '@/lib/community/community-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  const groups = communityStore.getCategoryGroups();
  return NextResponse.json(
    {
      success: true,
      message: 'Community category groups retrieved successfully.',
      data: groups,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
