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

export function evaluateCanonicalQuestion(
  q: Record<string, unknown> | object,
  responseJson?: string | null
): boolean;

export function wasCanonicalOptionSelected(
  optionId: string,
  responseJson?: string | null
): boolean;
