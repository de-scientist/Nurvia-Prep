import { NextRequest, NextResponse } from 'next/server';
import { resolveAttemptLearner, NO_STORE_HEADERS } from '@/lib/attempts/auth-helper';
import { attemptStore, type StoredAttemptQuestion, type StoredAttempt } from '@/lib/attempts/attempt-store';
import { extractSiteMetadataFromRequestHeaders, lexmaCastoRequest } from '@/lib/lexmacasto/client';
import { buildStrataEndpointPath } from '@/lib/lexmacasto/contracts';
import { extractQuestionOptions, cleanWordHtml } from '@/lib/content/html-normalizer';
import type { QuestionType, CognitiveSkill, ClientNeedCategory, ExamLayout, ExhibitType } from '@/lib/api-types';

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const deliveryMode: 'Exam' | 'Tutor' = body?.deliveryMode === 'Tutor' ? 'Tutor' : 'Exam';
  const layoutMode: ExamLayout = body?.layoutMode || 'Sequential';

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/attempts/start/${trimmedExamId}`
  );

  // 1. Fetch questions from Strata
  const questionsPath = buildStrataEndpointPath(
    'questions',
    { examId: trimmedExamId, perPage: 50 },
    'absolute'
  );

  const questionsRes = await lexmaCastoRequest<{
    data?: { items?: any[] };
    items?: any[];
  }>(questionsPath, {
    method: 'GET',
    session: learner.session,
    siteMeta,
  });

  const rawQuestions = questionsRes.data?.data?.items ?? questionsRes.data?.items ?? [];

  // 2. Fetch study set details from Strata
  const examsPath = buildStrataEndpointPath(
    'exams',
    { examId: trimmedExamId, perPage: 1 },
    'absolute'
  );

  const examRes = await lexmaCastoRequest<{
    data?: { items?: any[] };
    items?: any[];
  }>(examsPath, {
    method: 'GET',
    session: learner.session,
    siteMeta,
  });

  const examItem = examRes.data?.data?.items?.[0] ?? examRes.data?.items?.[0] ?? {};
  const examTitle = String(examItem.name ?? examItem.title ?? 'NURVIA Examination');
  const durationMinutes = Number(examItem.timeLimitMinutes ?? examItem.durationMinutes ?? 90) || 90;

  // 3. Map questions with robust option extraction and Word HTML cleanup
  const mappedQuestions: StoredAttemptQuestion[] = (
    Array.isArray(rawQuestions) && rawQuestions.length > 0
      ? rawQuestions
      : [
          // Fallback question when bank returns 0 questions for this specific ID
          {
            guidId: `q-${trimmedExamId}-1`,
            orderIndex: 1,
            questionText: 'A nurse is preparing to administer digoxin to an adult client with heart failure. Which clinical assessment is essential prior to administration?',
            type: 'SingleChoice',
            explanation: 'Digoxin is a cardiac glycoside with positive inotropic effects. Apical pulse must be counted for a full minute; hold for HR < 60 bpm.',
            questionOptions: [
              { id: 1, option: 'A', answerContent: 'Auscultate the apical pulse rate for one full minute.', isCorrect: true, specificRationale: 'Digoxin slows AV node conduction. Assess apical pulse for 60 seconds.' },
              { id: 2, option: 'B', answerContent: 'Check serum blood glucose level.', isCorrect: false, specificRationale: 'Glucose monitoring is not directly affected by digoxin.' },
              { id: 3, option: 'C', answerContent: 'Measure bilateral pupillary reflexes.', isCorrect: false, specificRationale: 'Neurological pupillary assessment is unrelated.' },
              { id: 4, option: 'D', answerContent: 'Inspect lower extremities for pitting edema only.', isCorrect: false, specificRationale: 'Edema is an indicator of heart failure severity, but apical pulse is mandatory before giving digoxin.' },
            ],
          },
          {
            guidId: `q-${trimmedExamId}-2`,
            orderIndex: 2,
            questionText: 'A nurse is caring for a client receiving lithium carbonate. Which findings indicate early lithium toxicity? (Select all that apply.)',
            type: 'MultipleResponse',
            explanation: 'Early lithium toxicity (serum level 1.5–2.0 mEq/L) typically manifests with gastrointestinal distress, fine hand tremors, slurred speech, and muscle weakness.',
            questionOptions: [
              { id: 1, option: 'A', answerContent: 'Nausea, vomiting, and diarrhea', isCorrect: true, specificRationale: 'Gastrointestinal distress is a classic early sign of toxicity.' },
              { id: 2, option: 'B', answerContent: 'Fine hand tremors becoming coarse', isCorrect: true, specificRationale: 'Tremor progression indicates advancing toxic levels.' },
              { id: 3, option: 'C', answerContent: 'Slurred speech and muscle weakness', isCorrect: true, specificRationale: 'Neurological impairment and muscle weakness are hallmark signs.' },
              { id: 4, option: 'D', answerContent: 'Hyperglycemia and ketoacidosis', isCorrect: false, specificRationale: 'Lithium does not cause diabetic ketoacidosis.' },
            ],
          },
        ]
  ).map((q: any, idx: number) => {
    const rawStem = String(q.questionText || q.metaQuestionText || `Question ${idx + 1}`);
    const cleanedStem = cleanWordHtml(rawStem);
    const extractedOptions = extractQuestionOptions(q);

    const exhibits = Array.isArray(q.exhibits)
      ? q.exhibits.map((ex: any, eIdx: number) => ({
          id: String(ex.guidId ?? ex.id ?? `exh-${eIdx + 1}`),
          type: (ex.type ?? 'NursesNotes') as ExhibitType,
          title: String(ex.title ?? ex.name ?? `Exhibit ${eIdx + 1}`),
          content: String(ex.content ?? ex.description ?? ''),
          displayOrder: eIdx + 1,
        }))
      : [];

    return {
      id: String(q.guidId ?? q.id ?? `q-${idx + 1}`),
      orderIndex: idx + 1,
      stem: cleanedStem,
      questionType: (typeof q.type === 'string' && q.type ? q.type : 'SingleChoice') as QuestionType,
      cognitiveSkill: 'Application' as CognitiveSkill,
      clientNeedCategory: 'SafeAndEffectiveCareEnvironment' as ClientNeedCategory,
      options: extractedOptions.map((opt, oIdx) => ({
        id: opt.id,
        optionIndex: opt.optionIndex ?? oIdx + 1,
        optionText: opt.optionText,
        displayOrder: opt.displayOrder ?? oIdx + 1,
        isCorrect: Boolean(opt.isCorrect),
        specificRationale: opt.specificRationale,
      })),
      exhibits,
      generalRationale: cleanWordHtml(String(q.explanation || q.hint || 'Adheres to standard clinical nursing protocols.')),
      hint: q.hint ? String(q.hint) : undefined,
    };
  });

  const attemptId = attemptStore.createAttemptId(trimmedExamId);
  const startedAtUtc = new Date().toISOString();

  const storedAttempt: StoredAttempt = {
    attemptId,
    examId: trimmedExamId,
    examTitle,
    userId: learner.userId,
    deliveryMode,
    layoutMode,
    allowedLayouts: 'Both',
    timeLimitMinutes: durationMinutes,
    remainingSeconds: durationMinutes * 60,
    startedAtUtc,
    status: 'InProgress',
    allowReview: Boolean(examItem.allowReview ?? true),
    questions: mappedQuestions,
    savedResponses: {},
    tutorProgression: {},
  };

  attemptStore.setAttempt(storedAttempt);

  const sanitized = attemptStore.sanitizeForActiveSession(storedAttempt);

  return NextResponse.json(
    {
      success: true,
      message: 'Examination attempt started successfully.',
      data: sanitized,
    },
    { headers: NO_STORE_HEADERS }
  );
}
