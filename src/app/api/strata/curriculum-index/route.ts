import { NextRequest, NextResponse } from 'next/server';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { getAuthorizedStudyLibraryIndex } from '@/lib/lexmacasto/study-library-index';
import { parseStrictProgramId } from '@/lib/study-library/curriculum-consolidation';

const CACHE_HEADERS = {
  'Cache-Control': 'private, no-store',
};

export async function GET(request: NextRequest) {
  const rawProgramId = request.nextUrl.searchParams.get('programId');
  let requestedProgramId: 6 | 9 | null = null;
  if (rawProgramId !== null && rawProgramId.trim() !== '') {
    requestedProgramId = parseStrictProgramId(rawProgramId);
    if (requestedProgramId === null) {
      return NextResponse.json(
        {
          success: false,
          message: 'Requested program is outside the authorized RN (9) and LPN (6) Study Library allowlist.',
          errorCode: 'FORBIDDEN',
        },
        { status: 403, headers: CACHE_HEADERS }
      );
    }
  }

  const session = await getServerCastoSession();
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    '/api/strata/curriculum-index'
  );

  const index = await getAuthorizedStudyLibraryIndex(siteMeta, session);

  if (!index.complete && index.subjects.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to retrieve the authorized RN/LPN curriculum from the backend.',
        errorCode: 'BACKEND_ERROR',
      },
      { status: 502, headers: CACHE_HEADERS }
    );
  }

  const programs = requestedProgramId
    ? index.programs.filter((p) => parseStrictProgramId(p.id) === requestedProgramId)
    : index.programs;

  const courses = requestedProgramId
    ? index.courses.filter((c) => parseStrictProgramId(c.programId) === requestedProgramId)
    : index.courses;

  const subjects = requestedProgramId
    ? index.subjects.filter((s) => parseStrictProgramId(s.programId) === requestedProgramId)
    : index.subjects;

  const allowedSubjectKeys = new Set(
    subjects.map((s) => String(s.guidId ?? s.id ?? '').trim().toLowerCase()).filter(Boolean)
  );

  const examsBySubjectGuid: Record<string, typeof index.allAuthorizedExams> = {};
  for (const [key, list] of Object.entries(index.examsBySubjectGuid)) {
    if (!requestedProgramId || allowedSubjectKeys.has(key.toLowerCase())) {
      examsBySubjectGuid[key] = list;
    }
  }

  return NextResponse.json(
    {
      success: true,
      message: 'OK',
      data: {
        complete: index.complete,
        fetchedAt: index.fetchedAt,
        programs,
        courses,
        subjects,
        examsBySubjectGuid,
        failedSubjectIds: index.failedSubjectIds,
      },
    },
    { headers: CACHE_HEADERS }
  );
}
