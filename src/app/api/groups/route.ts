import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { groupsStore } from '@/lib/groups/groups-store';
import type { CreateStudyGroupRequest } from '@/lib/api-types';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const examTrack = searchParams.get('examTrack') || undefined;
  const search = searchParams.get('search') || undefined;

  const session = await getServerCastoSession();
  const userId = session?.castoLine || undefined;

  const groups = groupsStore.getGroups({ examTrack, search, userId });

  return NextResponse.json(
    {
      success: true,
      message: 'Study groups retrieved successfully.',
      data: groups,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerCastoSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sign in to create a study group.',
          errorCode: 'UNAUTHORIZED',
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = (await request.json()) as CreateStudyGroupRequest;
    if (!body || !body.title?.trim() || !body.examTrack || !body.meetingCadence || !body.timezone) {
      return NextResponse.json(
        {
          success: false,
          message: 'Title, exam track, meeting cadence, and timezone are required.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const userId = session.castoLine;
    const creatorName = `Nurse_${session.castoLine.slice(0, 6)}`;

    const group = groupsStore.createGroup(userId, creatorName, body);

    return NextResponse.json(
      {
        success: true,
        message: 'Study group created successfully.',
        data: group,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to create study group.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
