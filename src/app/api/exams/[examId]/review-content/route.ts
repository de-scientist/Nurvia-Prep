import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE_HEADERS, resolveAttemptLearner } from '@/lib/attempts/auth-helper';
import { fetchLiveExamFromBackend } from '@/lib/attempts/live-exam-loader';
import {
  isResponseAnswered,
  scoreCanonicalQuestion,
  wasCanonicalOptionSelected,
} from '@/lib/attempts/strata-answer-adapter';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import type { ExamReviewContentDto, ReviewQuestionDto } from '@/lib/api-types';

/**
 * Authoritative direct Review Mode content endpoint.
 * Loads all pages of the exam from `exams/list/live` and strictly enforces
 * backend `allowReview` permission before releasing answer keys or rationales.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  const learner = await resolveAttemptLearner(request);
  if (!learner) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const { examId } = await context.params;
  const trimmedExamId = (examId || '').trim();
  if (!trimmedExamId) {
    return NextResponse.json(
      { success: false, message: 'Exam ID is required.', errorCode: 'VALIDATION_ERROR' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/exams/${trimmedExamId}/review-content`
  );

  const loaded = await fetchLiveExamFromBackend({
    examId: trimmedExamId,
    session: learner.session,
    siteMeta,
    layoutMode: 'AllInOne',
    deliveryMode: 'Review',
  });

  if (!loaded.ok) {
    return NextResponse.json(
      { success: false, message: loaded.message, errorCode: loaded.errorCode },
      { status: loaded.status, headers: NO_STORE_HEADERS }
    );
  }

  if (!loaded.modePermissions.canReview) {
    return NextResponse.json(
      {
        success: false,
        message:
          loaded.modePermissions.reviewReason ||
          'Review mode is disabled by this examination’s backend configuration.',
        errorCode: 'REVIEW_NOT_PERMITTED',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const reviewQuestions: ReviewQuestionDto[] = loaded.questions.map((q) => {
    const saved = loaded.savedResponses[q.id];
    const learnerResponse = saved?.responseJson ?? undefined;
    const isAnswered = isResponseAnswered(learnerResponse);
    const scored = scoreCanonicalQuestion(q, learnerResponse);
    return {
      questionId: q.id,
      numericId: q.numericId,
      guidId: q.guidId,
      sectionId: q.sectionId,
      sectionGuidId: q.sectionGuidId,
      sectionName: q.sectionName,
      orderIndex: q.orderIndex,
      stem: q.stem,
      metaStem: q.metaStem,
      instructions: q.instructions,
      questionType: q.questionType,
      cognitiveSkill: q.cognitiveSkill,
      clientNeedCategory: q.clientNeedCategory,
      generalRationale: q.generalRationale,
      learnerResponse,
      isCorrect: isAnswered ? scored.isCorrect : false,
      isPartiallyCorrect: isAnswered ? scored.isPartiallyCorrect : false,
      isUnanswered: !isAnswered,
      pointsAwarded: isAnswered ? scored.pointsAwarded : 0,
      maxPoints: scored.maxPoints,
      options: q.options.map((opt) => ({
        id: opt.id,
        numericId: opt.numericId,
        optionIndex: opt.optionIndex,
        optionText: opt.optionText,
        description: opt.description,
        data: opt.data,
        label: opt.label,
        order: opt.order,
        link: opt.link,
        isCorrect: opt.isCorrect,
        specificRationale: opt.specificRationale,
        wasSelected:
          wasCanonicalOptionSelected(opt.id, learnerResponse) ||
          (opt.numericId !== undefined &&
            wasCanonicalOptionSelected(String(opt.numericId), learnerResponse)),
      })),
      exhibits: q.exhibits,
      media: q.media,
      matrix: q.matrix,
      blankSelectPassage: q.blankSelectPassage,
      highlightPassage: q.highlightPassage,
      correctAnswerMeta: q.correctAnswerMeta,
      contentIntegrityError: q.contentIntegrityError,
    };
  });

  const payload: ExamReviewContentDto = {
    examId: loaded.examId,
    examTitle: loaded.examTitle,
    pathway: loaded.pathway,
    category: loaded.examCategory,
    instructions: loaded.instructions,
    timeLimitMinutes: loaded.timeLimitMinutes,
    configuredQuestionCount: loaded.configuredQuestionCount,
    loadedQuestionCount: loaded.loadedQuestionCount,
    modePermissions: loaded.modePermissions,
    reviewReleased: true,
    questions: reviewQuestions,
  };

  return NextResponse.json(
    {
      success: true,
      message: 'Review mode content retrieved.',
      data: payload,
    },
    { headers: NO_STORE_HEADERS }
  );
}
