import { NextRequest, NextResponse } from 'next/server';
import { extractSiteMetadataFromRequestHeaders, lexmaCastoRequest } from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { inferExamCategory, inferExamDeliveryMode, inferExamPathway } from '@/lib/api-client';
import type { StudySetDetailDto, StudySetCardDto, ExamLayoutPolicy, ExamLayout, DifficultyLevel } from '@/lib/api-types';
import {
  getAuthorizedStudyLibraryIndex,
  verifyAuthorizedStudySetExam,
} from '@/lib/lexmacasto/study-library-index';

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
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required to access examination details.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const learner = await resolveAttemptLearner(request);
  if (learner && learner.emailVerified === false) {
    return NextResponse.json(
      {
        success: false,
        message: 'Email verification is required before accessing examination details.',
        errorCode: 'UNVERIFIED_EMAIL',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }
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

  const index = await getAuthorizedStudyLibraryIndex(siteMeta, session);
  const verification = verifyAuthorizedStudySetExam(rawItem, index);
  if (!verification.authorized || !verification.enriched) {
    return NextResponse.json(
      {
        success: false,
        message: 'This examination is not available in the published Study Library.',
        errorCode: 'NOT_FOUND',
      },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const verifiedItem = verification.enriched;

  const totalQuestions = Number(verifiedItem.questionsCount ?? verifiedItem.totalQuestions ?? 0);
  const timeLimitMinutes = Number(verifiedItem.duration ?? verifiedItem.timeLimitMinutes ?? 0);
  const passingScorePercentage = Number(verifiedItem.passMark ?? verifiedItem.passingScorePercentage ?? 75);

  const cardDto: StudySetCardDto = {
    id: String(verifiedItem.guidId ?? verifiedItem.id ?? trimmedId),
    code: String(verifiedItem.code ?? verifiedItem.guidId ?? trimmedId),
    title: String(verifiedItem.title ?? verifiedItem.name ?? 'Published Examination Set'),
    description: String(
      verifiedItem.description ??
        'Published examination set retrieved directly from the authoritative assessment bank.'
    ),
    pathway: inferExamPathway(verifiedItem),
    category: inferExamCategory(verifiedItem),
    modeAllowed: inferExamDeliveryMode(verifiedItem),
    timeLimitMinutes: Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0 ? timeLimitMinutes : 60,
    passingScorePercentage: Number.isFinite(passingScorePercentage) ? passingScorePercentage : 75,
    totalQuestions: Number.isFinite(totalQuestions) && totalQuestions >= 0 ? totalQuestions : 0,
    programId: typeof verifiedItem.programId === 'number' ? verifiedItem.programId : null,
    programName: typeof verifiedItem.programName === 'string' ? verifiedItem.programName : null,
    courseId:
      typeof verifiedItem.courseId === 'number' || typeof verifiedItem.courseId === 'string'
        ? verifiedItem.courseId
        : null,
    courseName: typeof verifiedItem.courseName === 'string' ? verifiedItem.courseName : null,
    subjectId:
      typeof verifiedItem.subjectId === 'number' || typeof verifiedItem.subjectId === 'string'
        ? verifiedItem.subjectId
        : null,
    subjectGuidId:
      typeof verifiedItem.subjectGuidId === 'string' ? verifiedItem.subjectGuidId : null,
    school:
      typeof verifiedItem.schoolName === 'string' && verifiedItem.schoolName.trim()
        ? verifiedItem.schoolName.trim()
        : typeof verifiedItem.school === 'string' && verifiedItem.school.trim()
          ? verifiedItem.school.trim()
          : null,
    academicYear:
      typeof verifiedItem.year === 'number'
        ? verifiedItem.year
        : typeof verifiedItem.academicYear === 'number'
          ? verifiedItem.academicYear
          : null,
    season:
      typeof verifiedItem.season === 'string' && verifiedItem.season.trim()
        ? verifiedItem.season.trim()
        : null,
    subject:
      typeof verifiedItem.subjectName === 'string' && verifiedItem.subjectName.trim()
        ? verifiedItem.subjectName.trim()
        : typeof verifiedItem.subject === 'string' && verifiedItem.subject.trim()
          ? verifiedItem.subject.trim()
          : null,
    topic:
      typeof verifiedItem.topicName === 'string' && verifiedItem.topicName.trim()
        ? verifiedItem.topicName.trim()
        : typeof verifiedItem.topic === 'string' && verifiedItem.topic.trim()
          ? verifiedItem.topic.trim()
          : null,
    difficulty: (typeof verifiedItem.difficulty === 'string' && verifiedItem.difficulty.trim()
      ? verifiedItem.difficulty.trim()
      : null) as DifficultyLevel | null,
    allowedLayouts: (typeof verifiedItem.allowedLayouts === 'string' && verifiedItem.allowedLayouts && verifiedItem.allowedLayouts !== 'Any'
      ? verifiedItem.allowedLayouts
      : 'Both') as ExamLayoutPolicy,
    defaultLayout: (typeof verifiedItem.defaultLayout === 'string' && verifiedItem.defaultLayout && verifiedItem.defaultLayout !== 'Classic'
      ? verifiedItem.defaultLayout
      : 'Sequential') as ExamLayout,
    averageRating:
      typeof verifiedItem.averageRating === 'number'
        ? verifiedItem.averageRating
        : typeof verifiedItem.rating === 'number' && verifiedItem.rating > 0
          ? Number((verifiedItem.rating / 20).toFixed(1))
          : null,
    reviewCount: Number(verifiedItem.reviewCount ?? 0),
    isSaved: false,
    isNew:
      typeof verifiedItem.isNew === 'boolean'
        ? verifiedItem.isNew
        : typeof verifiedItem.is_new === 'boolean'
          ? verifiedItem.is_new
          : typeof verifiedItem.isNewExam === 'boolean'
            ? verifiedItem.isNewExam
            : String(verifiedItem.badge || verifiedItem.tag || '').trim().toUpperCase() === 'NEW',
  };

  const subjectsCovered = [verifiedItem.subjectName, verifiedItem.courseName, verifiedItem.programName]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const topicsCovered = [verifiedItem.topicName, verifiedItem.unitName, verifiedItem.lessonName]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const detailDto: StudySetDetailDto = {
    ...cardDto,
    instructions:
      typeof verifiedItem.instructions === 'string' && verifiedItem.instructions.trim()
        ? verifiedItem.instructions.trim()
        : 'Answer all questions carefully and within the allocated time using current clinical judgment standards.',
    learningObjectives:
      typeof verifiedItem.objectives === 'string' && verifiedItem.objectives.trim()
        ? verifiedItem.objectives
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
