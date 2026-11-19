import { NextRequest, NextResponse } from 'next/server';
import { extractSiteMetadataFromRequestHeaders, lexmaCastoRequest } from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { inferExamCategory, inferExamDeliveryMode, inferExamPathway } from '@/lib/api-client';
import type { StudySetDetailDto, StudySetCardDto, ExamLayoutPolicy, ExamLayout, DifficultyLevel } from '@/lib/api-types';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const trimmedId = (id || '').trim();

  if (!trimmedId) {
    return NextResponse.json(
      { success: false, message: 'Study set identifier is required.', errorCode: 'VALIDATION_ERROR' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const session = await getServerCastoSession();
  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/study-library/${trimmedId}`
  );

  // Authoritative single-exam lookup via Castoline `exams/list/current?identifier=...`
  const examCurrentPath = buildStrataEndpointPath(
    'examCurrent',
    { identifier: trimmedId },
    'current'
  );

  const examRes = await lexmaCastoRequest<{
    data?: Record<string, any> & { items?: Record<string, any>[] };
    items?: Record<string, any>[];
  }>(examCurrentPath, {
    method: 'GET',
    session,
    siteMeta,
  });

  const rawData = examRes.data?.data;
  const candidateItem =
    rawData && Array.isArray(rawData.items)
      ? rawData.items[0]
      : rawData && typeof rawData === 'object' && ('guidId' in rawData || 'id' in rawData)
        ? rawData
        : examRes.data?.items?.[0] ?? null;

  const rawItem =
    candidateItem &&
    (String(candidateItem.guidId ?? '').trim() === trimmedId ||
      String(candidateItem.id ?? '').trim() === trimmedId)
      ? candidateItem
      : null;

  if (!rawItem) {
    return NextResponse.json(
      {
        success: false,
        message: 'This examination could not be found in the published study library.',
        errorCode: 'NOT_FOUND',
      },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const totalQuestions = Number(rawItem.questionsCount ?? rawItem.totalQuestions ?? 0);
  const timeLimitMinutes = Number(rawItem.duration ?? rawItem.timeLimitMinutes ?? 0);
  const passingScorePercentage = Number(rawItem.passMark ?? rawItem.passingScorePercentage ?? 75);

  const cardDto: StudySetCardDto = {
    id: String(rawItem.guidId ?? rawItem.id ?? trimmedId),
    code: String(rawItem.code ?? rawItem.guidId ?? trimmedId),
    title: String(rawItem.title ?? rawItem.name ?? 'Published Examination Set'),
    description: String(
      rawItem.description ??
        'Published examination set retrieved directly from the authoritative assessment bank.'
    ),
    pathway: inferExamPathway(rawItem),
    category: inferExamCategory(rawItem),
    modeAllowed: inferExamDeliveryMode(rawItem),
    timeLimitMinutes: Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0 ? timeLimitMinutes : 60,
    passingScorePercentage: Number.isFinite(passingScorePercentage) ? passingScorePercentage : 75,
    totalQuestions: Number.isFinite(totalQuestions) && totalQuestions >= 0 ? totalQuestions : 0,
    school:
      typeof rawItem.schoolName === 'string' && rawItem.schoolName.trim()
        ? rawItem.schoolName.trim()
        : typeof rawItem.school === 'string' && rawItem.school.trim()
          ? rawItem.school.trim()
          : null,
    academicYear:
      typeof rawItem.year === 'number'
        ? rawItem.year
        : typeof rawItem.academicYear === 'number'
          ? rawItem.academicYear
          : null,
    season: typeof rawItem.season === 'string' && rawItem.season.trim() ? rawItem.season.trim() : null,
    subject:
      typeof rawItem.subjectName === 'string' && rawItem.subjectName.trim()
        ? rawItem.subjectName.trim()
        : typeof rawItem.subject === 'string' && rawItem.subject.trim()
          ? rawItem.subject.trim()
          : null,
    topic:
      typeof rawItem.topicName === 'string' && rawItem.topicName.trim()
        ? rawItem.topicName.trim()
        : typeof rawItem.topic === 'string' && rawItem.topic.trim()
          ? rawItem.topic.trim()
          : null,
    difficulty: (typeof rawItem.difficulty === 'string' && rawItem.difficulty.trim()
      ? rawItem.difficulty.trim()
      : null) as DifficultyLevel | null,
    allowedLayouts: (typeof rawItem.allowedLayouts === 'string' && rawItem.allowedLayouts && rawItem.allowedLayouts !== 'Any'
      ? rawItem.allowedLayouts
      : 'Both') as ExamLayoutPolicy,
    defaultLayout: (typeof rawItem.defaultLayout === 'string' && rawItem.defaultLayout && rawItem.defaultLayout !== 'Classic'
      ? rawItem.defaultLayout
      : 'Sequential') as ExamLayout,
    averageRating:
      typeof rawItem.averageRating === 'number'
        ? rawItem.averageRating
        : typeof rawItem.rating === 'number' && rawItem.rating > 0
          ? Number((rawItem.rating / 20).toFixed(1))
          : null,
    reviewCount: Number(rawItem.reviewCount ?? 0),
    isSaved: false,
  };

  const subjectsCovered = [rawItem.subjectName, rawItem.courseName, rawItem.programName]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const topicsCovered = [rawItem.topicName, rawItem.unitName, rawItem.lessonName]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const detailDto: StudySetDetailDto = {
    ...cardDto,
    instructions:
      typeof rawItem.instructions === 'string' && rawItem.instructions.trim()
        ? rawItem.instructions.trim()
        : 'Answer all questions carefully and within the allocated time using current clinical judgment standards.',
    learningObjectives:
      typeof rawItem.objectives === 'string' && rawItem.objectives.trim()
        ? rawItem.objectives
            .split(/\r?\n|;/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    subjectsCovered: Array.from(new Set(subjectsCovered)),
    topicsCovered: Array.from(new Set(topicsCovered)),
    questionTypesIncluded: [],
    reviews: [],
    canReview: false,
  };

  return NextResponse.json(
    {
      success: true,
      message: 'OK',
      data: detailDto,
    },
    { headers: NO_STORE_HEADERS }
  );
}
