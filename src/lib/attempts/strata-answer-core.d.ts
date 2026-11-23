export function resolveNormalizedQuestionType(questionType: string | number): {
  raw: string;
  isCaseBased: boolean;
  baseType: string;
};

export function getStrataSubmissionType(questionType: string | number): string;

export function toStrataAnswerPayload(
  q: Record<string, unknown> | object,
  responseJson: string | null | undefined
): unknown;

export function fromStrataSavedUserAnswer(
  q: Record<string, unknown> | object,
  savedUserAnswer?: Record<string, unknown> | object | null
): string | undefined;

export interface CanonicalQuestionScoreResult {
  isAnswered: boolean;
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  allowPartialCredit: boolean;
  scoringRule: 'all_or_nothing' | 'partial_credit_plus_minus' | 'partial_credit_proportional';
}

export function isResponseAnswered(responseJson?: string | null): boolean;

export function evaluateCanonicalQuestion(
  q: Record<string, unknown> | object,
  responseJson?: string | null
): boolean;

export function scoreCanonicalQuestion(
  q: Record<string, unknown> | object,
  responseJson?: string | null
): CanonicalQuestionScoreResult;

export function wasCanonicalOptionSelected(
  optionId: string,
  responseJson?: string | null
): boolean;
