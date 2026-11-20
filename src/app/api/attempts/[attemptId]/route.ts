import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { ensureAttemptLoaded } from '@/lib/attempts/live-exam-loader';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const learner = await resolveAttemptLearner(request);
  if (!learner) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const { attemptId } = await context.params;
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/${attemptId}`
  );

  const modeParam = request.nextUrl.searchParams.get('mode');
  const preferredMode = modeParam === 'Tutor' ? 'Tutor' : modeParam === 'Exam' ? 'Exam' : undefined;
  const loaded = await ensureAttemptLoaded(learner, attemptId, siteMeta, preferredMode);
  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  // Submitted attempts cannot be resumed as active test sessions; callers load review
  if (loaded.attempt.status === 'Submitted' || loaded.attempt.status === 'Graded') {
    return NextResponse.json(
      {
        success: false,
        message: 'This examination attempt has already been submitted and graded.',
        errorCode: 'ATTEMPT_ALREADY_SUBMITTED',
      },
      { status: 409, headers: NO_STORE_HEADERS }
    );
  }

  const sanitized = attemptStore.sanitizeForActiveSession(loaded.attempt);

  return NextResponse.json(
    {
      success: true,
      message: 'Attempt state retrieved.',
      data: sanitized,
    },
    { headers: NO_STORE_HEADERS }
  );
}
