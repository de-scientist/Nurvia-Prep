import { NextRequest, NextResponse } from 'next/server';
import type { ExamAttemptSummaryDto } from '@/lib/api-types';
import {
  inferExamCategory,
  inferExamDeliveryMode,
  inferExamPathway,
} from '@/lib/api-client';
import { attemptStore } from '@/lib/attempts/attempt-store';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { buildDurableAttemptId } from '@/lib/attempts/live-exam-loader';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
} from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';

interface LexmaCastoExamResultRaw {
  id?: string | number;
  guidId?: string;
  examId?: string | number;
  examGuidId?: string;
  attemptNumber?: number;
  title?: string;
  assessmentName?: string;
  programName?: string;
  courseName?: string;
  subjectName?: string;
  topicName?: string;
  type?: string;
  tag?: string;
  status?: string;
  isAttempted?: boolean;
  attemptedAt?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  score?: number;
  totalMarks?: number;
  passMark?: number;
  percentageScore?: number;
  grade?: string;
  passed?: boolean;
  timeTaken?: number;
  questionsCount?: number;
  totalAnswered?: number;
  totalCorrect?: number;
  totalWrong?: number;
  examDetail?: {
    allowReview?: boolean;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

function mapLexmaCastoResultToAttemptSummary(
  item: LexmaCastoExamResultRaw
): ExamAttemptSummaryDto | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const examId = String(item.examGuidId ?? item.examId ?? item.guidId ?? item.id ?? '').trim();
  if (!examId) {
    return null;
  }

  const attemptNumber =
    typeof item.attemptNumber === 'number' && item.attemptNumber > 0
      ? item.attemptNumber
      : 1;

  // Format canonical durable ID when examGuidId is available so clicking Review/Resume always rehydrates cleanly
  const attemptId = item.examGuidId
    ? buildDurableAttemptId(String(item.examGuidId).trim(), attemptNumber)
    : String(item.guidId ?? item.id ?? buildDurableAttemptId(examId, attemptNumber)).trim();

  let status = 'Submitted';
  if (
    typeof item.status === 'string' &&
    ['InProgress', 'Submitted', 'Graded', 'Expired'].includes(item.status)
  ) {
    status = item.status;
  } else if (item.reviewedAt || /complet|grad|finish/i.test(String(item.status ?? ''))) {
    status = 'Graded';
  } else if (item.isAttempted === false) {
    status = 'InProgress';
  }

  const sanitizeDate = (val: unknown): string | undefined => {
    if (typeof val === 'string' && val.trim() && !val.trim().startsWith('0001')) {
      return val.trim();
    }
    return undefined;
  };

  const startedAtUtc =
    sanitizeDate(item.attemptedAt) ||
    sanitizeDate(item.createdAt) ||
    new Date().toISOString();

  const submittedAtUtc =
    status === 'InProgress'
      ? undefined
      : sanitizeDate(item.reviewedAt) ||
        sanitizeDate(item.attemptedAt) ||
        sanitizeDate(item.updatedAt) ||
        undefined;

  const scorePercentage =
    typeof item.percentageScore === 'number'
      ? Math.round(item.percentageScore * 10) / 10
      : typeof item.score === 'number' && typeof item.totalMarks === 'number' && item.totalMarks > 0
        ? Math.round((item.score / item.totalMarks) * 1000) / 10
        : typeof item.score === 'number'
          ? Math.round(item.score * 10) / 10
          : undefined;

  const passingScorePercentage =
    typeof item.passMark === 'number' && item.passMark > 0 && item.passMark <= 100
      ? item.passMark
      : 75;

  const totalQuestions =
    typeof item.questionsCount === 'number' && item.questionsCount > 0
      ? item.questionsCount
      : typeof item.totalAnswered === 'number'
        ? item.totalAnswered
        : 0;

  const allowReview =
    typeof item.examDetail?.allowReview === 'boolean'
      ? item.examDetail.allowReview
      : undefined;

  const inferredDelivery = inferExamDeliveryMode(item as Record<string, unknown>);
  const canTutor =
    inferredDelivery === 'Tutor' ||
    inferredDelivery === 'Both' ||
    inferredDelivery === 'All';

  return {
    attemptId,
    examId,
    examTitle: String(item.title ?? item.assessmentName ?? 'Exam Attempt'),
    examCategory: inferExamCategory(item as Record<string, unknown>),
    pathway: inferExamPathway(item as Record<string, unknown>),
    status,
    startedAtUtc,
    ...(submittedAtUtc ? { submittedAtUtc } : {}),
    ...(scorePercentage !== undefined ? { scorePercentage } : {}),
    passingScorePercentage,
    ...(typeof item.passed === 'boolean'
      ? { passed: item.passed }
      : scorePercentage !== undefined
        ? { passed: scorePercentage >= passingScorePercentage }
        : {}),
    totalQuestions,
    ...(typeof item.totalCorrect === 'number' ? { totalCorrect: item.totalCorrect } : {}),
    ...(typeof item.totalWrong === 'number' ? { totalWrong: item.totalWrong } : {}),
    ...(typeof item.totalAnswered === 'number' ? { totalAnswered: item.totalAnswered } : {}),
    ...(typeof item.timeTaken === 'number' ? { timeSpentSeconds: item.timeTaken } : {}),
    attemptNumber,
    ...(allowReview !== undefined ? { allowReview, canReview: allowReview } : { canReview: false }),
    canTutor,
    ...(typeof item.subjectName === 'string' && item.subjectName ? { subjectName: item.subjectName } : {}),
    ...(typeof item.topicName === 'string' && item.topicName ? { topicName: item.topicName } : {}),
    ...(typeof item.grade === 'string' && item.grade ? { grade: item.grade } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const learner = await resolveAttemptLearner(request);
    if (!learner) {
      return NextResponse.json(
        { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const pageParam = Number(request.nextUrl.searchParams.get('page') || '1');
    const perPageParam = Number(request.nextUrl.searchParams.get('perPage') || '50');
    const fetchAll = request.nextUrl.searchParams.get('fetchAll') === 'true';

    const startPage = Number.isInteger(pageParam) && pageParam >= 1 && pageParam <= 10_000 ? pageParam : 1;
    const perPage = Number.isInteger(perPageParam) && perPageParam >= 1 && perPageParam <= 100 ? perPageParam : 50;

    const siteMeta = extractSiteMetadataFromRequestHeaders(
      request.headers,
      '/api/attempts/history'
    );

    const collectedRaw: LexmaCastoExamResultRaw[] = [];
    let page = startPage;
    const maxPages = fetchAll ? 20 : startPage;
    let totalPages = startPage;

    while (page <= maxPages && page <= totalPages) {
      const backendPath = buildStrataEndpointPath(
        'examResults',
        {
          dynamicPage: page,
          dynamicPerPage: fetchAll ? 100 : perPage,
          page,
          perPage: fetchAll ? 100 : perPage,
        },
        'relative'
      );

      const result = await lexmaCastoRequest<{
        data?: {
          results?: LexmaCastoExamResultRaw[];
          items?: LexmaCastoExamResultRaw[];
          totalPages?: number;
          skewTotalPages?: number;
        };
        results?: LexmaCastoExamResultRaw[];
        items?: LexmaCastoExamResultRaw[];
        totalPages?: number;
        skewTotalPages?: number;
      }>(backendPath, {
        method: 'GET',
        session: learner.session,
        siteMeta,
      });

      if (!result.ok) {
        if (page === startPage) {
          if (result.status === 401) {
            return NextResponse.json(
              {
                success: false,
                message: result.message,
                errorCode: result.errorCode,
                errors: result.errors,
              },
              { status: 401, headers: NO_STORE_HEADERS }
            );
          }
          const localAttempts = attemptStore.getHistory(learner.userId);
          if (localAttempts.length > 0) {
            return NextResponse.json(
              {
                success: true,
                message: 'OK',
                data: localAttempts,
              },
              { headers: NO_STORE_HEADERS }
            );
          }
          if (result.status === 404) {
            return NextResponse.json(
              {
                success: true,
                message: 'OK',
                data: [],
              },
              { headers: NO_STORE_HEADERS }
            );
          }
          return NextResponse.json(
            {
              success: false,
              message: result.message,
              errorCode: result.errorCode,
              errors: result.errors,
            },
            { status: result.status, headers: NO_STORE_HEADERS }
          );
        }
        break;
      }

      const rawList: unknown =
        (Array.isArray(result.data) ? result.data : undefined) ??
        result.data?.data?.results ??
        result.data?.data?.items ??
        result.data?.results ??
        result.data?.items ??
        [];

      if (Array.isArray(rawList) && rawList.length > 0) {
        collectedRaw.push(...(rawList as LexmaCastoExamResultRaw[]));
      }

      const reportedTotalPages = Number(
        result.data?.data?.totalPages ??
          result.data?.data?.skewTotalPages ??
          result.data?.totalPages ??
          result.data?.skewTotalPages ??
          1
      );
      if (fetchAll && Number.isFinite(reportedTotalPages) && reportedTotalPages >= 1) {
        totalPages = reportedTotalPages;
      }

      if (!fetchAll || !Array.isArray(rawList) || rawList.length === 0) {
        break;
      }
      page++;
    }

    const backendMapped = collectedRaw
      .map(mapLexmaCastoResultToAttemptSummary)
      .filter((item): item is ExamAttemptSummaryDto => item !== null);

    // Merge active in-session attempts not yet finalized in backend results, deduplicating by attemptId
    const localAttempts = attemptStore.getHistory(learner.userId);
    const byId = new Map<string, ExamAttemptSummaryDto>();
    for (const item of backendMapped) {
      byId.set(item.attemptId, item);
    }
    for (const local of localAttempts) {
      const existing = byId.get(local.attemptId);
      if (!existing) {
        byId.set(local.attemptId, local);
      } else if (existing.status === 'InProgress' && local.status === 'Graded') {
        // Preserve freshly graded local result until backend replication catches up
        byId.set(local.attemptId, local);
      }
    }

    const merged = Array.from(byId.values()).sort((a, b) => {
      const timeB = b.startedAtUtc ? new Date(b.startedAtUtc).getTime() : 0;
      const timeA = a.startedAtUtc ? new Date(a.startedAtUtc).getTime() : 0;
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    });

    return NextResponse.json(
      {
        success: true,
        message: 'OK',
        data: merged,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Unhandled error in /api/attempts/history:', error);
    try {
      const learner = await resolveAttemptLearner(request);
      if (learner) {
        const localAttempts = attemptStore.getHistory(learner.userId);
        return NextResponse.json(
          { success: true, message: 'OK', data: localAttempts },
          { headers: NO_STORE_HEADERS }
        );
      }
    } catch {
      // Ignore fallback resolution error
    }
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve attempt history.',
        errorCode: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
