import { NextRequest, NextResponse } from 'next/server';
import { extractSiteMetadataFromRequestHeaders, lexmaCastoRequest } from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { inferExamDeliveryMode } from '@/lib/api-client';
import type { StudySetDetailDto, StudySetCardDto } from '@/lib/api-types';

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

  // 1. Fetch exam details from Strata
  const examsPath = buildStrataEndpointPath(
    'exams',
    { examId: trimmedId, perPage: 1 },
    'absolute'
  );

  const examRes = await lexmaCastoRequest<{
    data?: { items?: any[] };
    items?: any[];
  }>(examsPath, {
    method: 'GET',
    session,
    siteMeta,
  });

  const rawItem = examRes.data?.data?.items?.[0] ?? examRes.data?.items?.[0] ?? null;

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

  const cardDto: StudySetCardDto = {
    id: String(rawItem.guidId ?? rawItem.id ?? trimmedId),
    code: String(rawItem.code ?? rawItem.guidId ?? trimmedId),
    title: String(rawItem.name ?? rawItem.title ?? 'Published Examination Set'),
    description: String(rawItem.description ?? rawItem.instructions ?? 'Comprehensive practice examination questions with clinical rationales.'),
    pathway: (rawItem.pathway || 'RN') as any,
    category: (rawItem.category || 'Comprehensive') as any,
    modeAllowed: inferExamDeliveryMode(rawItem),
    timeLimitMinutes: Number(rawItem.timeLimitMinutes ?? rawItem.durationMinutes ?? 90) || 90,
    passingScorePercentage: Number(rawItem.passingScorePercentage ?? 75),
    totalQuestions: Number(rawItem.totalQuestions ?? rawItem.questionCount ?? 50) || 50,
    allowedLayouts: (rawItem.allowedLayouts || 'Both') as any,
    defaultLayout: (rawItem.defaultLayout || 'Sequential') as any,
    reviewCount: Number(rawItem.reviewCount ?? 12),
    isSaved: false,
  };

  const detailDto: StudySetDetailDto = {
    ...cardDto,
    instructions: 'Answer all questions carefully and within the allocated time, using current best practices and critical thinking.',
    learningObjectives: [
      'Strengthen clinical judgment and diagnostic reasoning across core nursing competencies.',
      'Practice NCLEX-format question answering and time allocation endurance.',
    ],
    subjectsCovered: ['Adult Health', 'Pharmacology', 'Fundamentals of Nursing'],
    topicsCovered: ['Clinical Judgment', 'Safe and Effective Care', 'Priority Interventions'],
    questionTypesIncluded: ['SingleChoice', 'MultipleResponse', 'BowTie'],
    reviews: [],
    canReview: true,
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
