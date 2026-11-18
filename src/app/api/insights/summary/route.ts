import { NextResponse } from 'next/server';
import { insightsStore } from '@/lib/insights/insights-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  const summary = insightsStore.getSummary();
  return NextResponse.json(
    {
      success: true,
      message: 'Community examination outcome insights retrieved.',
      data: summary,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
