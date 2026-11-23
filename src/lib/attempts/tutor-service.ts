/**
 * NURVIA-PREP — Authoritative Contextual Tutor Service
 *
 * Delivers structured, clinically accurate, question-grounded tutoring tied to an
 * existing examination attempt without ever mutating submitted answers, scoring,
 * lifecycle status, or submission timestamps.
 *
 * Architecture & Privacy:
 * - Tier 1 (if configured via NURVIA_AI_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY):
 *   Uses server-side LLM with a minimal, anonymized clinical question payload.
 *   Never exposes API keys to the client and never fabricates AI provenance.
 * - Tier 2 (authoritative deterministic fallback): Grounded Clinical Study Coach
 *   that decodes every canonical NURVIA/Strata question type, contrasts learner vs
 *   authoritative answers, extracts official rationales/distractor explanations,
 *   and offers isolated same-attempt practice items.
 */

import type {
  TutorActionType,
  TutorAssistRequestDto,
  TutorAssistResponseDto,
  TutorConversationMessageDto,
  TutorPracticeCheckRequestDto,
  TutorPracticeCheckResponseDto,
  TutorPracticePromptDto,
  TutorStructuredSectionDto,
} from '../api-types';
import type { StoredAttempt, StoredAttemptQuestion } from './attempt-store';
import {
  isResponseAnswered,
  resolveNormalizedQuestionType,
  scoreCanonicalQuestion,
} from './strata-answer-core.mjs';

export const MAX_TUTOR_MESSAGES_PER_QUESTION = 30;
export const MAX_CUSTOM_MESSAGE_LENGTH = 1200;

export const OFFICIAL_TUTOR_DISCLAIMER =
  'Tutor guidance is a supplemental clinical learning aid generated to deepen understanding. It is separate from the official examination bank rationale and never alters your submitted answers or authoritative score.';

const VALID_TUTOR_ACTIONS = new Set<TutorActionType>([
  'explain_question',
  'why_my_answer_incorrect',
  'why_correct_better',
  'explain_each_option',
  'teach_concept',
  'similar_practice',
  'summarize_takeaway',
  'custom_question',
]);

const KEY_REVEALING_ACTIONS = new Set<TutorActionType>([
  'why_my_answer_incorrect',
  'why_correct_better',
  'explain_each_option',
]);

const ACTION_PROMPTS: Record<Exclude<TutorActionType, 'custom_question'>, string> = {
  explain_question: 'Break down what this question is asking and highlight key clinical cues.',
  why_my_answer_incorrect: 'Explain why my submitted answer was incorrect or partially correct.',
  why_correct_better: 'Compare why the authoritative answer is clinically superior.',
  explain_each_option: 'Walk through every answer choice and explain why distractors are wrong.',
  teach_concept: 'Teach the underlying nursing concept and clinical reasoning principles.',
  similar_practice: 'Give me an isolated follow-up practice item on a related concept.',
  summarize_takeaway: 'Summarize the high-yield exam takeaway I should remember.',
};

export interface TutorAuthResult {
  ok: true;
  question: StoredAttemptQuestion;
  questionNumber: number;
  terminal: boolean;
  keysReleased: boolean;
}

export interface TutorAuthError {
  ok: false;
  status: number;
  errorCode: string;
  message: string;
}

export function isValidTutorAction(value: unknown): value is TutorActionType {
  return typeof value === 'string' && VALID_TUTOR_ACTIONS.has(value as TutorActionType);
}

export function stripClinicalHtml(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function resolveAiProviderConfig(): {
  configured: boolean;
  provider: 'openai' | 'gemini' | 'none';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
} {
  const nurviaKey = process.env.NURVIA_AI_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (nurviaKey || openAiKey) {
    return {
      configured: true,
      provider: 'openai',
      apiKey: nurviaKey || openAiKey,
      model: process.env.NURVIA_AI_MODEL?.trim() || 'gpt-4o-mini',
      baseUrl: (process.env.NURVIA_AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    };
  }
  if (geminiKey) {
    return {
      configured: true,
      provider: 'gemini',
      apiKey: geminiKey,
      model: process.env.NURVIA_GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
    };
  }
  return { configured: false, provider: 'none' };
}

export function authorizeTutorAccess(
  attempt: StoredAttempt,
  userId: string,
  questionId: string,
  action?: TutorActionType
): TutorAuthResult | TutorAuthError {
  if (attempt.userId !== userId && userId !== 'system' && userId !== 'superadmin') {
    return {
      ok: false,
      status: 403,
      errorCode: 'FORBIDDEN',
      message: 'Forbidden: you do not have permission to access Tutor for this attempt.',
    };
  }

  const qIdx = attempt.questions.findIndex((item) => item.id === questionId);
  if (qIdx === -1) {
    return {
      ok: false,
      status: 404,
      errorCode: 'QUESTION_NOT_FOUND',
      message: 'Question was not found inside this examination attempt.',
    };
  }

  const question = attempt.questions[qIdx];
  const terminal =
    attempt.status === 'Submitted' || attempt.status === 'Graded' || attempt.status === 'Expired';

  if (!terminal && attempt.deliveryMode === 'Exam') {
    return {
      ok: false,
      status: 403,
      errorCode: 'TUTOR_LOCKED_DURING_ACTIVE_EXAM',
      message:
        'Tutor assistance is locked while an Examination is actively in progress in Exam mode. Submit your examination to unlock Review & Tutor.',
    };
  }

  if (!terminal && attempt.modePermissions && !attempt.modePermissions.canTutor) {
    return {
      ok: false,
      status: 403,
      errorCode: 'TUTOR_NOT_PERMITTED',
      message:
        attempt.modePermissions.tutorReason ||
        'Tutor mode is disabled for active attempts on this examination by backend policy.',
    };
  }

  if (terminal && attempt.allowReview === false) {
    return {
      ok: false,
      status: 403,
      errorCode: 'TUTOR_REVIEW_WITHHELD',
      message:
        attempt.modePermissions?.reviewReason ||
        'Tutor explanations are unavailable because answer review is withheld by this examination’s policy.',
    };
  }

  const tutorEvaluated = Boolean(attempt.tutorProgression?.[questionId]?.evaluated);
  const keysReleased = (terminal && attempt.allowReview !== false) || (!terminal && attempt.deliveryMode === 'Tutor' && tutorEvaluated);

  if (!terminal && attempt.deliveryMode === 'Tutor' && !tutorEvaluated && action && KEY_REVEALING_ACTIONS.has(action)) {
    return {
      ok: false,
      status: 409,
      errorCode: 'EVALUATE_FIRST',
      message:
        'Submit or check your answer in Tutor Mode first before viewing option correctness or answer comparisons for this question.',
    };
  }

  return {
    ok: true,
    question,
    questionNumber: qIdx + 1,
    terminal,
    keysReleased,
  };
}

interface DecodedAnswerSummary {
  questionTypeNormalized: string;
  learnerSummary: string;
  authoritativeSummary: string;
  optionBreakdown: Array<{
    label: string;
    text: string;
    isCorrect: boolean;
    wasSelected: boolean;
    rationale: string;
  }>;
  matrixBreakdown: Array<{
    prompt: string;
    correctColumns: string[];
    selectedColumns: string[];
    explanation: string;
  }>;
}

function safeParseJson(raw?: string | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function decodeQuestionAnswers(
  q: StoredAttemptQuestion,
  learnerResponse?: string | null,
  keysReleased = true
): DecodedAnswerSummary {
  const normalizedType = resolveNormalizedQuestionType(q.questionType);
  const parsed = safeParseJson(learnerResponse);
  const answered = isResponseAnswered(learnerResponse);

  const optionById = new Map<string, StoredAttemptQuestion['options'][number]>();
  for (const opt of q.options) {
    optionById.set(opt.id, opt);
    if (opt.numericId !== undefined) optionById.set(String(opt.numericId), opt);
  }

  const describeOpt = (opt: StoredAttemptQuestion['options'][number], idx?: number): string => {
    const text = stripClinicalHtml(opt.optionText) || stripClinicalHtml(opt.description) || stripClinicalHtml(opt.label) || `Option ${opt.optionIndex + 1}`;
    const letter = typeof idx === 'number' && idx < 26 ? String.fromCharCode(65 + idx) : String(opt.optionIndex + 1);
    return `${letter}. ${text}`;
  };

  // Detect selected option IDs across canonical payload schemas
  const selectedIdSet = new Set<string>();
  const addId = (val: unknown) => {
    if (typeof val === 'string' && val.trim()) selectedIdSet.add(val.trim());
    else if (typeof val === 'number') selectedIdSet.add(String(val));
  };

  if (parsed) {
    addId(parsed.SelectedOptionId);
    addId(parsed.SelectedMediaId);
    const arrKeys = ['SelectedOptionIds', 'selectedOptionIds', 'SelectedMediaIds', 'OrderedOptionIds'];
    for (const k of arrKeys) {
      if (Array.isArray(parsed[k])) {
        (parsed[k] as unknown[]).forEach(addId);
      }
    }
    const cellId = parsed.SelectedCellId;
    if (cellId) addId(cellId);
    if (Array.isArray(parsed.SelectedCellIds)) {
      (parsed.SelectedCellIds as unknown[]).forEach(addId);
    }
  }

  let learnerSummary = answered ? 'Submitted response recorded.' : 'No response submitted (Unanswered).';
  if (parsed) {
    if (typeof parsed.BooleanResponse === 'boolean') {
      learnerSummary = parsed.BooleanResponse ? 'True' : 'False';
    } else if (typeof parsed.SelectedBoolean === 'boolean') {
      learnerSummary = parsed.SelectedBoolean ? 'True' : 'False';
    } else if (parsed.NumericResponse !== undefined && parsed.NumericResponse !== null && String(parsed.NumericResponse).trim() !== '') {
      learnerSummary = String(parsed.NumericResponse).trim();
    } else if (typeof parsed.TextResponse === 'string' && parsed.TextResponse.trim()) {
      learnerSummary = parsed.TextResponse.trim();
    } else if (typeof parsed.ShortAnswer === 'string' && parsed.ShortAnswer.trim()) {
      learnerSummary = parsed.ShortAnswer.trim();
    } else if (typeof parsed.ExtendedResponse === 'string' && parsed.ExtendedResponse.trim()) {
      learnerSummary = parsed.ExtendedResponse.trim();
    } else if (Array.isArray(parsed.OrderedOptionIds) && parsed.OrderedOptionIds.length > 0) {
      const items = (parsed.OrderedOptionIds as unknown[]).map((id, i) => {
        const match = optionById.get(String(id));
        return `${i + 1}) ${match ? stripClinicalHtml(match.optionText) : String(id)}`;
      });
      learnerSummary = items.join(' -> ');
    } else if (parsed.OrderingNumbers && typeof parsed.OrderingNumbers === 'object') {
      const entries = Object.entries(parsed.OrderingNumbers as Record<string, string>)
        .map(([id, rank]) => ({ id, rank: Number(rank) }))
        .filter((x) => Number.isFinite(x.rank))
        .sort((a, b) => a.rank - b.rank)
        .map((x) => {
          const match = optionById.get(x.id);
          return `#${x.rank} ${match ? stripClinicalHtml(match.optionText) : x.id}`;
        });
      if (entries.length > 0) learnerSummary = entries.join(' -> ');
    } else if ((parsed.Pairs || parsed.pairs || parsed.MatchedPairs) && typeof (parsed.Pairs || parsed.pairs || parsed.MatchedPairs) === 'object') {
      const pairsObj = (parsed.Pairs || parsed.pairs || parsed.MatchedPairs) as Record<string, string>;
      const pairs = Object.entries(pairsObj).map(([leftId, rightVal]) => {
        const leftOpt = optionById.get(leftId);
        return `${leftOpt ? stripClinicalHtml(leftOpt.optionText) : leftId} -> ${stripClinicalHtml(String(rightVal))}`;
      });
      if (pairs.length > 0) learnerSummary = pairs.join('; ');
    } else if ((parsed.BlankSelections || parsed.blankSelections || parsed.BlankFills || parsed.blankFills || parsed.Blanks) && typeof (parsed.BlankSelections || parsed.blankSelections || parsed.BlankFills || parsed.blankFills || parsed.Blanks) === 'object') {
      const blanksObj = (parsed.BlankSelections || parsed.blankSelections || parsed.BlankFills || parsed.blankFills || parsed.Blanks) as Record<string, string>;
      const entries = Object.entries(blanksObj).map(([k, v]) => {
        const opt = optionById.get(String(v));
        return `${k}: ${opt ? stripClinicalHtml(opt.optionText) : stripClinicalHtml(String(v))}`;
      });
      if (entries.length > 0) learnerSummary = entries.join('; ');
    } else if ((parsed.TrueFalseMap || parsed.trueFalseMap || parsed.MultipleTrueFalse) && typeof (parsed.TrueFalseMap || parsed.trueFalseMap || parsed.MultipleTrueFalse) === 'object') {
      const tfObj = (parsed.TrueFalseMap || parsed.trueFalseMap || parsed.MultipleTrueFalse) as Record<string, unknown>;
      const entries = Object.entries(tfObj).map(([id, val]) => {
        const opt = optionById.get(id);
        const label = typeof val === 'boolean' ? (val ? 'True' : 'False') : String(val);
        return `${opt ? stripClinicalHtml(opt.optionText) : id}: ${label}`;
      });
      if (entries.length > 0) learnerSummary = entries.join('; ');
    } else if (parsed.Actions || parsed.Condition || parsed.Parameters || parsed.actions || parsed.condition || parsed.parameters || (parsed.BowTie && typeof parsed.BowTie === 'object')) {
      const bt = (parsed.BowTie && typeof parsed.BowTie === 'object' ? parsed.BowTie : parsed) as Record<string, unknown>;
      const toText = (id: unknown) => {
        const opt = optionById.get(String(id ?? ''));
        return opt ? stripClinicalHtml(opt.optionText) : String(id ?? '');
      };
      const rawActions = bt.Actions ?? bt.actions;
      const rawParams = bt.Parameters ?? bt.parameters;
      const rawCond = bt.Condition ?? bt.condition;
      const actions = Array.isArray(rawActions) ? rawActions.map(toText).filter(Boolean) : [];
      const params = Array.isArray(rawParams) ? rawParams.map(toText).filter(Boolean) : [];
      const cond = rawCond ? toText(rawCond) : '';
      learnerSummary = `Condition: ${cond || 'None'} | Actions: ${actions.join(', ') || 'None'} | Parameters: ${params.join(', ') || 'None'}`;
    } else if ((parsed.Buckets || parsed.buckets) && typeof (parsed.Buckets || parsed.buckets) === 'object') {
      const bucketsObj = (parsed.Buckets || parsed.buckets) as Record<string, string>;
      const entries = Object.entries(bucketsObj)
        .filter(([, b]) => Boolean(String(b ?? '').trim()))
        .map(([itemId, b]) => {
          const item = optionById.get(itemId);
          return `${item ? stripClinicalHtml(item.optionText) : itemId} -> Category ${b}`;
        });
      if (entries.length > 0) learnerSummary = entries.join('; ');
    } else if (Array.isArray(parsed.DropZones) && parsed.DropZones.length > 0) {
      const entries = (parsed.DropZones as Array<Record<string, unknown>>).map((dz) => {
        const item = optionById.get(String(dz.itemId ?? dz.optionId ?? ''));
        const zone = String(dz.zoneId ?? dz.zone ?? 'Zone');
        return `${item ? stripClinicalHtml(item.optionText) : String(dz.itemId ?? '')} -> ${zone}`;
      });
      learnerSummary = entries.join('; ');
    } else if (Array.isArray(parsed.Hotspots) && parsed.Hotspots.length > 0) {
      learnerSummary = `${parsed.Hotspots.length} hotspot coordinate(s) placed on exhibit`;
    } else if (Array.isArray(parsed.HighlightedSegments) && parsed.HighlightedSegments.length > 0) {
      learnerSummary = (parsed.HighlightedSegments as unknown[]).map((s) => `"${stripClinicalHtml(String(s))}"`).join(', ');
    } else if (selectedIdSet.size > 0 && q.matrix) {
      const cellTexts: string[] = [];
      for (const cell of q.matrix.cells) {
        if (selectedIdSet.has(cell.id) || (cell.numericId !== undefined && selectedIdSet.has(String(cell.numericId)))) {
          const r = q.matrix.rowHeaders[cell.rowIndex] ?? `Row ${cell.rowIndex + 1}`;
          const c = q.matrix.columnHeaders[cell.columnIndex] ?? `Col ${cell.columnIndex + 1}`;
          cellTexts.push(`${stripClinicalHtml(r)}: ${stripClinicalHtml(c)}`);
        }
      }
      if (cellTexts.length > 0) learnerSummary = cellTexts.join('; ');
    } else if (selectedIdSet.size > 0) {
      const matched = q.options
        .map((opt, idx) =>
          selectedIdSet.has(opt.id) || (opt.numericId !== undefined && selectedIdSet.has(String(opt.numericId)))
            ? describeOpt(opt, idx)
            : null
        )
        .filter((x): x is string => Boolean(x));
      if (matched.length > 0) learnerSummary = matched.join(' | ');
    }
  }

  let authoritativeSummary = 'Withheld until answer evaluation or examination review release.';
  if (keysReleased) {
    const correctOpts = q.options
      .map((opt, idx) => (opt.isCorrect ? describeOpt(opt, idx) : null))
      .filter((x): x is string => Boolean(x));

    if (q.matrix) {
      const rowSummaries: string[] = [];
      for (let r = 0; r < q.matrix.rowCount; r += 1) {
        const correctCols = q.matrix.cells
          .filter((c) => c.rowIndex === r && c.isCorrect)
          .map((c) => stripClinicalHtml(q.matrix?.columnHeaders[c.columnIndex] ?? `Column ${c.columnIndex + 1}`));
        if (correctCols.length > 0) {
          rowSummaries.push(`${stripClinicalHtml(q.matrix.rowHeaders[r] ?? `Row ${r + 1}`)}: ${correctCols.join(', ')}`);
        }
      }
      authoritativeSummary = rowSummaries.length > 0 ? rowSummaries.join('; ') : 'See authoritative matrix grid.';
    } else if (q.correctAnswerMeta?.expectedNumeric) {
      authoritativeSummary = q.correctAnswerMeta.expectedNumeric;
    } else if (q.correctAnswerMeta?.correctBlanks && Object.keys(q.correctAnswerMeta.correctBlanks).length > 0) {
      authoritativeSummary = Object.entries(q.correctAnswerMeta.correctBlanks)
        .map(([k, v]) => {
          const opt = optionById.get(String(v));
          return `${k}: ${opt ? stripClinicalHtml(opt.optionText) : stripClinicalHtml(String(v))}`;
        })
        .join('; ');
    } else if (q.correctAnswerMeta?.correctMatches && Object.keys(q.correctAnswerMeta.correctMatches).length > 0) {
      authoritativeSummary = Object.entries(q.correctAnswerMeta.correctMatches)
        .map(([k, v]) => {
          const opt = optionById.get(k);
          return `${opt ? stripClinicalHtml(opt.optionText) : k} -> ${stripClinicalHtml(String(v))}`;
        })
        .join('; ');
    } else if (q.correctAnswerMeta?.correctOrderIds && q.correctAnswerMeta.correctOrderIds.length > 0) {
      authoritativeSummary = q.correctAnswerMeta.correctOrderIds
        .map((id, i) => {
          const opt = optionById.get(id);
          return `${i + 1}) ${opt ? stripClinicalHtml(opt.optionText) : id}`;
        })
        .join(' -> ');
    } else if (q.correctAnswerMeta?.modelAnswerHtml) {
      authoritativeSummary = stripClinicalHtml(q.correctAnswerMeta.modelAnswerHtml);
    } else if (correctOpts.length > 0) {
      authoritativeSummary = correctOpts.join(' | ');
    } else if (q.generalRationale) {
      authoritativeSummary = stripClinicalHtml(q.generalRationale);
    } else {
      authoritativeSummary = 'Refer to the official examination bank rationale.';
    }
  }

  const optionBreakdown = q.options.map((opt, idx) => {
    const letter = idx < 26 ? String.fromCharCode(65 + idx) : String(idx + 1);
    const wasSelected =
      selectedIdSet.has(opt.id) || (opt.numericId !== undefined && selectedIdSet.has(String(opt.numericId)));
    return {
      label: `Option ${letter}`,
      text: stripClinicalHtml(opt.optionText) || stripClinicalHtml(opt.description) || stripClinicalHtml(opt.label) || `Option ${letter}`,
      isCorrect: keysReleased ? Boolean(opt.isCorrect) : false,
      wasSelected,
      rationale: keysReleased ? stripClinicalHtml(opt.specificRationale) : '',
    };
  });

  const matrixBreakdown: DecodedAnswerSummary['matrixBreakdown'] = [];
  if (q.matrix && keysReleased) {
    for (let r = 0; r < q.matrix.rowCount; r += 1) {
      const cells = q.matrix.cells.filter((c) => c.rowIndex === r);
      const correctColumns = cells
        .filter((c) => c.isCorrect)
        .map((c) => stripClinicalHtml(q.matrix?.columnHeaders[c.columnIndex] ?? `Column ${c.columnIndex + 1}`));
      const selectedColumns = cells
        .filter((c) => selectedIdSet.has(c.id) || (c.numericId !== undefined && selectedIdSet.has(String(c.numericId))))
        .map((c) => stripClinicalHtml(q.matrix?.columnHeaders[c.columnIndex] ?? `Column ${c.columnIndex + 1}`));
      const explanation = cells
        .map((c) => stripClinicalHtml(c.explanation))
        .filter(Boolean)
        .join(' ');
      matrixBreakdown.push({
        prompt: stripClinicalHtml(q.matrix.rowHeaders[r] ?? `Row ${r + 1}`),
        correctColumns,
        selectedColumns,
        explanation,
      });
    }
  }

  return {
    questionTypeNormalized: normalizedType.baseType,
    learnerSummary,
    authoritativeSummary,
    optionBreakdown,
    matrixBreakdown,
  };
}

function selectSimilarPracticeItem(
  attempt: StoredAttempt,
  currentQuestion: StoredAttemptQuestion,
  terminal: boolean
): TutorPracticePromptDto | null {
  const candidates = attempt.questions.filter(
    (q) =>
      q.id !== currentQuestion.id &&
      (terminal || Boolean(attempt.tutorProgression?.[q.id]?.evaluated))
  );
  if (candidates.length === 0) return null;

  const scoreMatch = (candidate: StoredAttemptQuestion): number => {
    let rank = 0;
    if (candidate.clientNeedCategory && candidate.clientNeedCategory === currentQuestion.clientNeedCategory) rank += 4;
    if (candidate.sectionName && candidate.sectionName === currentQuestion.sectionName) rank += 3;
    if (candidate.cognitiveSkill && candidate.cognitiveSkill === currentQuestion.cognitiveSkill) rank += 2;
    if (candidate.options.length >= 2) rank += 1;
    return rank;
  };

  const sorted = [...candidates].sort((a, b) => scoreMatch(b) - scoreMatch(a));
  // Prefer an item with standard selectable options for reliable standalone isolated check
  const chosen =
    sorted.find((q) => q.options.length >= 2 && !q.matrix && !q.contentIntegrityError) ?? sorted[0];

  if (!chosen) return null;

  return {
    practiceId: chosen.id,
    sourceQuestionId: currentQuestion.id,
    stem: chosen.stem,
    questionType: chosen.questionType,
    options: chosen.options.map((o) => ({
      id: o.id,
      optionText: o.optionText || o.description || o.label || 'Choice',
    })),
    instructions: chosen.instructions,
    isIsolatedPractice: true,
  };
}

function buildGroundedCoachResponse(params: {
  attempt: StoredAttempt;
  question: StoredAttemptQuestion;
  questionNumber: number;
  action: TutorActionType;
  userMessage?: string;
  learnerResponse?: string | null;
  keysReleased: boolean;
  terminal: boolean;
}): {
  content: string;
  sections: TutorStructuredSectionDto[];
  practicePrompt?: TutorPracticePromptDto | null;
} {
  const { attempt, question, questionNumber, action, userMessage, learnerResponse, keysReleased, terminal } = params;
  const decoded = decodeQuestionAnswers(question, learnerResponse, keysReleased);
  const scored = keysReleased
    ? scoreCanonicalQuestion(question, learnerResponse ?? undefined)
    : { isCorrect: false, isPartiallyCorrect: false, isAnswered: isResponseAnswered(learnerResponse), pointsAwarded: 0, maxPoints: 1 };

  const cleanStem = stripClinicalHtml(question.stem);
  const cleanRationale = keysReleased ? stripClinicalHtml(question.generalRationale) : '';
  const exhibitsSummary = question.exhibits
    ?.map((ex) => `${ex.title}: ${stripClinicalHtml(ex.content).slice(0, 260)}`)
    .filter(Boolean)
    .join('\n');
  const pathway = attempt.pathway || 'Nursing';
  const subjectContext =
    (question.sectionName && question.sectionName.trim()) ||
    (attempt.subjectName && attempt.subjectName.trim()) ||
    String(question.clientNeedCategory || 'Clinical Judgment');
  const objectiveText =
    question.learningObjectives && question.learningObjectives.length > 0
      ? question.learningObjectives.join('; ')
      : attempt.learningObjectives && attempt.learningObjectives.length > 0
        ? attempt.learningObjectives.join('; ')
        : '';

  const sections: TutorStructuredSectionDto[] = [];
  let practicePrompt: TutorPracticePromptDto | null = null;

  if (action === 'explain_question') {
    sections.push({
      stepNumber: 1,
      heading: 'What This Question Is Testing',
      body: `Question #${questionNumber} (${subjectContext} · ${String(question.cognitiveSkill || 'Clinical Reasoning')} · ${pathway}) asks you to evaluate the following clinical scenario:\n\n${cleanStem}`,
    });
    if (exhibitsSummary) {
      sections.push({
        stepNumber: 2,
        heading: 'Key Clinical Data & Exhibits',
        body: exhibitsSummary,
      });
    }
    sections.push({
      stepNumber: exhibitsSummary ? 3 : 2,
      heading: 'How to Approach This Item Type',
      body: `${question.instructions ? `${stripClinicalHtml(question.instructions)}\n\n` : ''}Focus first on patient safety, immediate physiological stability (ABC / Maslow priorities), and what action or clinical judgment directly addresses the primary cue in the stem.`,
    });
    if (objectiveText) {
      sections.push({
        stepNumber: sections.length + 1,
        heading: 'Target Learning Objective',
        body: objectiveText,
      });
    }
  } else if (action === 'why_my_answer_incorrect') {
    if (!scored.isAnswered) {
      sections.push({
        stepNumber: 1,
        heading: 'Why No Credit Was Earned',
        body: `Question #${questionNumber} has no recorded response (Unanswered). Unanswered items receive 0 out of ${scored.maxPoints} points.`,
      });
    } else if (scored.isCorrect) {
      sections.push({
        stepNumber: 1,
        heading: 'Your Answer Was Correct',
        body: `You answered: ${decoded.learnerSummary}. You earned full credit (${scored.pointsAwarded}/${scored.maxPoints}).`,
      });
    } else if (scored.isPartiallyCorrect) {
      sections.push({
        stepNumber: 1,
        heading: 'Partial Credit Analysis',
        body: `Your response (${decoded.learnerSummary}) earned partial credit (${scored.pointsAwarded}/${scored.maxPoints}). Some correct elements were included, while either a key correct component was missed or an inappropriate distractor was chosen.`,
      });
    } else {
      sections.push({
        stepNumber: 1,
        heading: 'Mismatch Between Your Answer and Clinical Priority',
        body: `Your submitted answer: ${decoded.learnerSummary}\nAuthoritative answer: ${decoded.authoritativeSummary}`,
      });
    }

    const selectedDistractors = decoded.optionBreakdown.filter((o) => o.wasSelected && !o.isCorrect);
    if (selectedDistractors.length > 0) {
      sections.push({
        stepNumber: 2,
        heading: 'Why Selected Distractor(s) Fell Short',
        body: selectedDistractors
          .map((d) =>
            d.rationale
              ? `• ${d.label} ("${d.text}"): ${d.rationale}`
              : `• ${d.label} ("${d.text}"): Does not address the highest clinical priority or conflicts with the stem findings.`
          )
          .join('\n'),
      });
    }

    sections.push({
      stepNumber: sections.length + 1,
      heading: 'Clinical Correction',
      body:
        cleanRationale ||
        `Compare your selection against the authoritative answer (${decoded.authoritativeSummary}). Re-read the stem cues to spot what changed the priority order.`,
    });
  } else if (action === 'why_correct_better') {
    sections.push({
      stepNumber: 1,
      heading: 'Authoritative Answer vs Your Submission',
      body: `Authoritative answer: ${decoded.authoritativeSummary}\nYour submitted response: ${decoded.learnerSummary}`,
    });
    const correctRationales = decoded.optionBreakdown
      .filter((o) => o.isCorrect && o.rationale)
      .map((o) => `• ${o.label} ("${o.text}"): ${o.rationale}`);
    sections.push({
      stepNumber: 2,
      heading: 'Why the Correct Option Is Clinically Superior',
      body:
        correctRationales.length > 0
          ? `${correctRationales.join('\n')}${cleanRationale ? `\n\nOfficial summary: ${cleanRationale}` : ''}`
          : cleanRationale ||
            `The authoritative option (${decoded.authoritativeSummary}) directly resolves the immediate clinical cue and safeguards patient safety without unnecessary delay.`,
    });
    sections.push({
      stepNumber: 3,
      heading: 'Reasoning Framework',
      body: `In ${pathway} clinical judgment (${String(question.cognitiveSkill || 'Priority Setting')}), prefer options that act directly on unstable cues, prevent acute deterioration, or verify critical parameters before delegating or delaying care.`,
    });
  } else if (action === 'explain_each_option') {
    if (decoded.optionBreakdown.length > 0) {
      sections.push({
        stepNumber: 1,
        heading: 'Option-by-Option Clinical Breakdown',
        body: decoded.optionBreakdown
          .map((o) => {
            const statusTag = o.isCorrect ? 'CORRECT' : 'INCORRECT';
            const selectedTag = o.wasSelected ? ' · YOUR CHOICE' : '';
            const why =
              o.rationale ||
              (o.isCorrect
                ? 'Supported by the official clinical rationale for this stem.'
                : 'Distractor: either incomplete, out of priority sequence, or contraindicated here.');
            return `• [${statusTag}${selectedTag}] ${o.label}: ${o.text}\n  Reasoning: ${why}`;
          })
          .join('\n\n'),
      });
    } else if (decoded.matrixBreakdown.length > 0) {
      sections.push({
        stepNumber: 1,
        heading: 'Matrix Row-by-Row Breakdown',
        body: decoded.matrixBreakdown
          .map((row, idx) => {
            return `• Row ${idx + 1} (${row.prompt})\n  Authoritative: ${row.correctColumns.join(', ') || 'See key'} | Your selection: ${row.selectedColumns.join(', ') || 'None'}${row.explanation ? `\n  Note: ${row.explanation}` : ''}`;
          })
          .join('\n\n'),
      });
    } else {
      sections.push({
        stepNumber: 1,
        heading: 'Response Breakdown',
        body: `Your response: ${decoded.learnerSummary}\nAuthoritative response: ${decoded.authoritativeSummary}${cleanRationale ? `\n\nRationale: ${cleanRationale}` : ''}`,
      });
    }
  } else if (action === 'teach_concept') {
    sections.push({
      stepNumber: 1,
      heading: `Core Nursing Concept — ${subjectContext}`,
      body: `${cleanRationale || 'This item evaluates safe, evidence-based prioritization under the NCSBN Clinical Judgment Measurement Model.'}${objectiveText ? `\n\nLearning Objectives: ${objectiveText}` : ''}`,
    });
    sections.push({
      stepNumber: 2,
      heading: 'Key Decision Rules & Pattern Recognition',
      body: `• Client Need Area: ${String(question.clientNeedCategory || subjectContext)}\n• Cognitive Skill: ${String(question.cognitiveSkill || 'Analyze Cues / Take Action')}\n• Pathway Focus: ${pathway}${question.prerequisites ? `\n• Prerequisite Knowledge: ${stripClinicalHtml(question.prerequisites)}` : ''}`,
    });
    if (question.resources) {
      sections.push({
        stepNumber: 3,
        heading: 'Reference Guidance',
        body: stripClinicalHtml(question.resources),
      });
    }
  } else if (action === 'similar_practice') {
    practicePrompt = selectSimilarPracticeItem(attempt, question, terminal);
    if (practicePrompt) {
      sections.push({
        stepNumber: 1,
        heading: 'Isolated Follow-Up Practice Question',
        body: `Try this related question from "${attempt.examTitle}". Checking your answer below tests your understanding separately — it never alters your submitted attempt score.`,
      });
    } else {
      sections.push({
        stepNumber: 1,
        heading: 'Self-Check Reasoning Drill',
        body: terminal
          ? `This attempt contains only Question #${questionNumber}, so no separate bank question exists inside this attempt. Re-test yourself mentally: if the patient in this stem suddenly developed worsening vital signs or an acute contraindication, which action would become unsafe first, and which monitoring parameter confirms your intervention worked?`
          : `No previously evaluated question is available yet in this active Tutor session to use as a follow-up drill without revealing unevaluated attempt items. Evaluate additional questions or submit your session first, or try a reasoning self-check: if a priority vital sign changed acutely here, which action would become unsafe first?`,
      });
    }
  } else if (action === 'summarize_takeaway') {
    const conciseRationale = cleanRationale
      ? cleanRationale.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
      : `Prioritize ${decoded.authoritativeSummary}.`;
    sections.push({
      stepNumber: 1,
      heading: 'High-Yield Exam Takeaway',
      body: `Rule of Thumb (${subjectContext}): ${conciseRationale}`,
    });
    sections.push({
      stepNumber: 2,
      heading: 'Watch Out For Next Time',
      body: scored.isCorrect
        ? 'You identified the priority correctly — maintain this cue-to-action check under timed exam conditions.'
        : `Compare why "${decoded.learnerSummary}" felt plausible versus why "${decoded.authoritativeSummary}" protects the patient first.`,
    });
  } else {
    // custom_question
    const cleanAsk = (userMessage ?? '').trim();
    sections.push({
      stepNumber: 1,
      heading: 'Direct Response to Your Question',
      body: `Regarding "${cleanAsk}" on Question #${questionNumber} (${subjectContext}):\n\n${
        keysReleased
          ? `Your submitted answer was: ${decoded.learnerSummary}\nAuthoritative answer: ${decoded.authoritativeSummary}`
          : 'You are in active Tutor practice before evaluating this item, so answer keys remain concealed while we reason through the stem together.'
      }`,
    });
    sections.push({
      stepNumber: 2,
      heading: 'Clinical Reasoning & Rationale',
      body:
        cleanRationale ||
        `Anchor your decision to the clinical cues in the stem: ${cleanStem.slice(0, 240)}${cleanStem.length > 240 ? '...' : ''}`,
    });
    if (keysReleased && decoded.optionBreakdown.length > 0) {
      const relevant = decoded.optionBreakdown
        .filter((o) => o.isCorrect || o.wasSelected)
        .map((o) => `• ${o.label} (${o.isCorrect ? 'Correct' : 'Your Selection'}): ${o.rationale || o.text}`)
        .join('\n');
      if (relevant) {
        sections.push({
          stepNumber: 3,
          heading: 'Key Choice Comparison',
          body: relevant,
        });
      }
    }
  }

  const content = sections
    .map((s) => (s.stepNumber ? `${s.stepNumber}. ${s.heading}\n${s.body}` : `${s.heading}\n${s.body}`))
    .join('\n\n');

  return { content, sections, practicePrompt };
}

async function tryOptionalLlmTutor(params: {
  attempt: StoredAttempt;
  question: StoredAttemptQuestion;
  questionNumber: number;
  action: TutorActionType;
  userMessage?: string;
  learnerResponse?: string | null;
  keysReleased: boolean;
}): Promise<{ content: string; sections: TutorStructuredSectionDto[]; providerLabel: string } | null> {
  const cfg = resolveAiProviderConfig();
  if (!cfg.configured || !cfg.apiKey) return null;

  const decoded = decodeQuestionAnswers(params.question, params.learnerResponse, params.keysReleased);
  const systemPrompt =
    'You are the NURVIA Prep Clinical Nursing Tutor. Give accurate, concise, evidence-based NCLEX/nursing education reasoning grounded ONLY in the clinical question context provided. Never invent scores or change attempt records. Return clear numbered educational sections.';

  const sanitizedUserPrompt = [
    `Pathway: ${params.attempt.pathway || 'Nursing'} | Subject: ${params.question.sectionName || params.attempt.subjectName || 'Clinical Nursing'}`,
    `Question #${params.questionNumber} (${params.question.questionType}): ${stripClinicalHtml(params.question.stem)}`,
    params.question.options.length > 0
      ? `Options:\n${decoded.optionBreakdown.map((o) => `${o.label}: ${o.text}${params.keysReleased ? ` [${o.isCorrect ? 'CORRECT' : 'DISTRACTOR'}] ${o.rationale}` : ''}`).join('\n')}`
      : '',
    `Learner Submitted Response: ${decoded.learnerSummary}`,
    params.keysReleased ? `Authoritative Answer: ${decoded.authoritativeSummary}` : 'Answer keys are withheld before active Tutor evaluation.',
    params.keysReleased && params.question.generalRationale
      ? `Official Rationale: ${stripClinicalHtml(params.question.generalRationale)}`
      : '',
    `Action Requested: ${params.action}`,
    params.userMessage ? `Learner Question: ${params.userMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    if (cfg.provider === 'openai' && cfg.baseUrl) {
      const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.3,
          max_tokens: 800,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sanitizedUserPrompt },
          ],
        }),
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) return null;
      return {
        content: text,
        sections: [{ stepNumber: 1, heading: 'AI Tutor Clinical Guidance', body: text }],
        providerLabel: `AI Tutor (${cfg.model})`,
      };
    }

    if (cfg.provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model || 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${sanitizedUserPrompt}` }],
            },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) return null;
      return {
        content: text,
        sections: [{ stepNumber: 1, heading: 'AI Tutor Clinical Guidance', body: text }],
        providerLabel: `AI Tutor (${cfg.model})`,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function getTutorConversationForAttempt(
  attempt: StoredAttempt,
  userId: string,
  questionId: string
):
  | {
      ok: true;
      status: 200;
      data: {
        attemptId: string;
        questionId: string;
        conversation: TutorConversationMessageDto[];
        aiProviderConfigured: boolean;
        disclosureNotice: string;
        remainingTurns: number;
      };
    }
  | TutorAuthError {
  const auth = authorizeTutorAccess(attempt, userId, questionId);
  if (!auth.ok) return auth;

  const conversation = [...(attempt.tutorConversations?.[questionId] ?? [])];
  const aiCfg = resolveAiProviderConfig();
  return {
    ok: true,
    status: 200,
    data: {
      attemptId: attempt.attemptId,
      questionId,
      conversation,
      aiProviderConfigured: aiCfg.configured,
      disclosureNotice: OFFICIAL_TUTOR_DISCLAIMER,
      remainingTurns: Math.max(0, Math.floor((MAX_TUTOR_MESSAGES_PER_QUESTION - conversation.length) / 2)),
    },
  };
}

export async function generateTutorAssistForAttempt(
  attempt: StoredAttempt,
  userId: string,
  req: TutorAssistRequestDto
): Promise<
  | { ok: true; status: 200; data: TutorAssistResponseDto }
  | TutorAuthError
> {
  if (!isValidTutorAction(req.action)) {
    return {
      ok: false,
      status: 400,
      errorCode: 'INVALID_TUTOR_ACTION',
      message: 'Unsupported Tutor action requested.',
    };
  }

  const trimmedMsg = typeof req.userMessage === 'string' ? req.userMessage.trim() : '';
  if (req.action === 'custom_question' && !trimmedMsg) {
    return {
      ok: false,
      status: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Please enter a specific question for Tutor assistance.',
    };
  }
  if (trimmedMsg.length > MAX_CUSTOM_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      errorCode: 'MESSAGE_TOO_LONG',
      message: `Questions to Tutor must be ${MAX_CUSTOM_MESSAGE_LENGTH} characters or fewer.`,
    };
  }

  const auth = authorizeTutorAccess(attempt, userId, req.questionId, req.action);
  if (!auth.ok) return auth;

  if (!attempt.tutorConversations) attempt.tutorConversations = {};
  if (!attempt.tutorConversations[req.questionId]) attempt.tutorConversations[req.questionId] = [];

  const conv = attempt.tutorConversations[req.questionId];
  if (conv.length >= MAX_TUTOR_MESSAGES_PER_QUESTION) {
    return {
      ok: false,
      status: 429,
      errorCode: 'TUTOR_TURN_LIMIT_REACHED',
      message:
        'You have reached the maximum number of Tutor exchanges for this question in this session. Review another question or reset your study focus.',
    };
  }

  const learnerResponse =
    attempt.savedResponses[req.questionId]?.responseJson ??
    attempt.tutorProgression?.[req.questionId]?.responseJson ??
    null;

  const learnerPromptText =
    req.action === 'custom_question'
      ? trimmedMsg
      : ACTION_PROMPTS[req.action];

  const now = new Date().toISOString();
  const learnerEntry: TutorConversationMessageDto = {
    id: `tut-u-${Date.now()}-${conv.length + 1}`,
    role: 'learner',
    action: req.action,
    content: learnerPromptText,
    source: 'grounded_clinical_coach',
    providerLabel: 'Learner Question',
    isAiGenerated: false,
    officialDisclaimer: OFFICIAL_TUTOR_DISCLAIMER,
    createdAtUtc: now,
  };

  // Optional LLM enhancement only when configured and NOT a bank-item practice pull
  const aiCfg = resolveAiProviderConfig();
  const llmResult =
    req.action !== 'similar_practice' && aiCfg.configured
      ? await tryOptionalLlmTutor({
          attempt,
          question: auth.question,
          questionNumber: auth.questionNumber,
          action: req.action,
          userMessage: trimmedMsg || learnerPromptText,
          learnerResponse,
          keysReleased: auth.keysReleased,
        })
      : null;

  const deterministic = buildGroundedCoachResponse({
    attempt,
    question: auth.question,
    questionNumber: auth.questionNumber,
    action: req.action,
    userMessage: trimmedMsg || learnerPromptText,
    learnerResponse,
    keysReleased: auth.keysReleased,
    terminal: auth.terminal,
  });

  const tutorEntry: TutorConversationMessageDto = {
    id: `tut-a-${Date.now()}-${conv.length + 2}`,
    role: 'tutor',
    action: req.action,
    content: llmResult ? llmResult.content : deterministic.content,
    sections: llmResult ? llmResult.sections : deterministic.sections,
    practicePrompt: deterministic.practicePrompt ?? null,
    source: llmResult ? 'ai_llm' : 'grounded_clinical_coach',
    providerLabel: llmResult ? llmResult.providerLabel : 'NURVIA Grounded Clinical Coach',
    isAiGenerated: Boolean(llmResult),
    officialDisclaimer: OFFICIAL_TUTOR_DISCLAIMER,
    createdAtUtc: new Date().toISOString(),
  };

  conv.push(learnerEntry, tutorEntry);

  return {
    ok: true,
    status: 200,
    data: {
      attemptId: attempt.attemptId,
      questionId: req.questionId,
      message: tutorEntry,
      conversation: [...conv],
      aiProviderConfigured: aiCfg.configured,
      disclosureNotice: OFFICIAL_TUTOR_DISCLAIMER,
      remainingTurns: Math.max(0, Math.floor((MAX_TUTOR_MESSAGES_PER_QUESTION - conv.length) / 2)),
    },
  };
}

export function checkTutorPracticeForAttempt(
  attempt: StoredAttempt,
  userId: string,
  req: TutorPracticeCheckRequestDto
):
  | { ok: true; status: 200; data: TutorPracticeCheckResponseDto }
  | TutorAuthError {
  const auth = authorizeTutorAccess(attempt, userId, req.questionId, 'similar_practice');
  if (!auth.ok) return auth;

  const practiceQ = attempt.questions.find((item) => item.id === req.practiceQuestionId);
  if (!practiceQ) {
    return {
      ok: false,
      status: 404,
      errorCode: 'PRACTICE_QUESTION_NOT_FOUND',
      message: 'Follow-up practice question was not found in this attempt.',
    };
  }

  if (!auth.terminal && !attempt.tutorProgression?.[practiceQ.id]?.evaluated) {
    return {
      ok: false,
      status: 409,
      errorCode: 'PRACTICE_ITEM_LOCKED',
      message:
        'Follow-up practice checking in an active Tutor session is restricted to previously evaluated questions so unevaluated attempt answer keys remain confidential.',
    };
  }

  const scored = scoreCanonicalQuestion(practiceQ, req.responseJson);
  const cleanRationale = stripClinicalHtml(practiceQ.generalRationale);
  const checkResult: TutorPracticeCheckResponseDto = {
    practiceQuestionId: practiceQ.id,
    isCorrect: scored.isCorrect,
    pointsAwarded: scored.pointsAwarded,
    maxPoints: scored.maxPoints,
    feedback: scored.isCorrect
      ? 'Correct! You applied the underlying concept accurately on this isolated practice check.'
      : scored.isPartiallyCorrect
        ? `Partially correct (${scored.pointsAwarded}/${scored.maxPoints}). Review the official explanation below to close the remaining gap.`
        : 'Not quite — review the clinical rationale below and contrast what changed between the two choices.',
    officialRationale: cleanRationale || undefined,
    isolatedFromAttempt: true,
    checkedAtUtc: new Date().toISOString(),
  };

  if (!attempt.tutorPracticeChecks) attempt.tutorPracticeChecks = {};
  if (!attempt.tutorPracticeChecks[req.questionId]) attempt.tutorPracticeChecks[req.questionId] = [];
  attempt.tutorPracticeChecks[req.questionId].push(checkResult);

  return {
    ok: true,
    status: 200,
    data: checkResult,
  };
}
