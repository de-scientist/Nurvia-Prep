import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { mentorsStore } from '@/lib/mentors/mentors-store';
import type { MentorSessionRequestDto } from '@/lib/api-types';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    const session = await getServerCastoSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sign in to request mentorship guidance.',
          errorCode: 'UNAUTHORIZED',
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = (await request.json()) as MentorSessionRequestDto;
    if (!body || !body.mentorId || !body.topic?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Mentor, topic, and message are required.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const userId = session.castoLine;
    const result = mentorsStore.requestSession(userId, body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errorCode: 'NOT_FOUND',
        },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: { requestId: result.requestId },
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to submit mentorship request.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
