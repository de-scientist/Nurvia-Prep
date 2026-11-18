import { NextRequest, NextResponse } from 'next/server';
import { mentorsStore } from '@/lib/mentors/mentors-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const specialty = searchParams.get('specialty') || undefined;
  const search = searchParams.get('search') || undefined;
  const examTrack = searchParams.get('examTrack') || undefined;

  const mentors = mentorsStore.getMentors({ specialty, search, examTrack });

  return NextResponse.json(
    {
      success: true,
      message: 'Mentors retrieved successfully.',
      data: mentors,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
