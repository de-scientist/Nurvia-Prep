import { NextRequest, NextResponse } from 'next/server';
import { searchGlobalContent } from '@/lib/search/search-service';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || request.nextUrl.searchParams.get('query') || '';
  const type = request.nextUrl.searchParams.get('type') || undefined;

  const result = await searchGlobalContent(q, type);

  return NextResponse.json(
    {
      success: true,
      message: 'Search completed successfully.',
      data: result,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
