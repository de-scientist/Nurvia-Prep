import type {
  QuestionCorrectAnswerMetaDto,
  QuestionMatrixDto,
  QuestionMediaDto,
  QuestionType,
} from '@/lib/api-types';
import type { AnswerValue, ExamSubmissionType } from '@/lib/services/nexus/strata/examService';
import {
  resolveNormalizedQuestionType as coreResolve,
  getStrataSubmissionType as coreGetSubType,
  toStrataAnswerPayload as coreToPayload,
  fromStrataSavedUserAnswer as coreFromSaved,
  evaluateCanonicalQuestion as coreEvaluate,
  wasCanonicalOptionSelected as coreWasSelected,
} from './strata-answer-core.mjs';

export interface CanonicalOptionLike {
  id: string;
  numericId?: number;
  optionIndex: number;
  optionText: string;
  displayOrder?: number;
  isCorrect?: boolean;
  specificRationale?: string;
  description?: string;
  data?: string;
  label?: string;
  order?: string;
  link?: string;
}

export interface CanonicalQuestionLike {
  id: string;
  numericId?: number;
  questionType: QuestionType | string | number;
  options: CanonicalOptionLike[];
  media?: QuestionMediaDto[];
  matrix?: QuestionMatrixDto;
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  contentJsonData?: string;
}

export function resolveNormalizedQuestionType(questionType: QuestionType | string | number): {
  raw: string;
  isCaseBased: boolean;
  baseType: string;
} {
  return coreResolve(questionType);
}

export function getStrataSubmissionType(
  questionType: QuestionType | string | number
): ExamSubmissionType {
  return coreGetSubType(questionType) as ExamSubmissionType;
}

export function toStrataAnswerPayload(
  q: CanonicalQuestionLike,
  responseJson: string | null | undefined
): AnswerValue {
  return coreToPayload(q, responseJson) as AnswerValue;
}

export function fromStrataSavedUserAnswer(
  q: CanonicalQuestionLike,
  savedUserAnswer?: {
    userAnswerData?: string | null;
    userOrder?: string | null;
    userHotspot?: string | null;
    userHighlight?: string | null;
    openEndedAnswer?: string | null;
    questionOptionId?: number | null;
    questionMatrixCellId?: number | null;
    questionMediaId?: number | null;
  } | null
): string | undefined {
  return coreFromSaved(q, savedUserAnswer);
}

export function evaluateCanonicalQuestion(
  q: CanonicalQuestionLike,
  responseJson?: string | null
): boolean {
  return coreEvaluate(q, responseJson);
}

export function wasCanonicalOptionSelected(
  optionId: string,
  responseJson?: string | null
): boolean {
  return coreWasSelected(optionId, responseJson);
}
