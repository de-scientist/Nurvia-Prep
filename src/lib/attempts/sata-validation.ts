/**
 * Frontend SATA (Select All That Apply) Selection Validation
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * This validation is strictly CLIENT-SIDE / FRONTEND-ONLY.
 * The upstream assessment backend is immutable and does not enforce selection counts.
 * This helper ensures learners select the exact required number of options specified in the stem/instructions
 * before submitting their response, preventing incomplete submissions while preserving their selections.
 */

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseNumOrWord(token: string): number | null {
  if (!token) return null;
  if (/^\d+$/.test(token)) {
    return parseInt(token, 10);
  }
  const lower = token.toLowerCase();
  return WORD_TO_NUM[lower] ?? null;
}

export function isSataQuestion(questionType: string | number | undefined | null): boolean {
  if (questionType === undefined || questionType === null) return false;
  const normalized = String(questionType).trim().toLowerCase().replace(/[-_ ]/g, '');
  return (
    normalized === 'multipleselect' ||
    normalized === 'multipleresponse' ||
    normalized === 'selectallthatapply' ||
    normalized === 'sata'
  );
}

export function getSelectedOptionCount(serializedAnswer: string | null | undefined): number {
  if (!serializedAnswer) return 0;
  try {
    const parsed = typeof serializedAnswer === 'string' ? JSON.parse(serializedAnswer) : serializedAnswer;
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === 'object') {
      const list = parsed.SelectedOptionIds ?? parsed.selectedOptionIds ?? parsed.SelectedMediaIds;
      if (Array.isArray(list)) return list.length;
      if (parsed.SelectedOptionId || parsed.selectedOptionId) return 1;
    }
  } catch {
    // Non-JSON string answer
  }
  return 0;
}

export function extractRequiredSataCount(question: {
  stem?: string;
  instructions?: string;
  metaStem?: string;
  correctAnswerMeta?: { correctOptionIds?: string[]; correctCellIds?: string[] };
  options?: Array<{ id: string; optionIndex?: number | string; optionText?: string; isCorrect?: boolean }>;
  requiredSelections?: number;
  expectedCount?: number;
  correctCount?: number;
  maxSelections?: number;
}): number | null {
  if (typeof question.requiredSelections === 'number' && question.requiredSelections > 0) {
    return question.requiredSelections;
  }
  if (typeof question.expectedCount === 'number' && question.expectedCount > 0) {
    return question.expectedCount;
  }
  if (typeof question.correctCount === 'number' && question.correctCount > 0) {
    return question.correctCount;
  }
  if (typeof question.maxSelections === 'number' && question.maxSelections > 0) {
    return question.maxSelections;
  }

  const textToSearch = `${question.instructions || ''} ${question.metaStem || ''} ${question.stem || ''}`;

  // Pattern 1: "(Select 4)" or "(Choose 3)" or "(Select three)"
  const parenMatch = textToSearch.match(/\((?:select|choose|pick)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\)/i);
  if (parenMatch) {
    const parsed = parseNumOrWord(parenMatch[1]);
    if (parsed !== null) return parsed;
  }

  // Pattern 2: "Select 4 findings", "Select all that apply. (Select 4)", "Select 3 interventions"
  const selectMatch = textToSearch.match(/\b(?:select|choose|pick)\s+(?:all\s+that\s+apply[.,;]?\s*(?:\()?)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (selectMatch) {
    const parsed = parseNumOrWord(selectMatch[1]);
    if (parsed !== null) return parsed;
  }

  // Pattern 3: "(N options)" or "Select N options"
  const optionsMatch = textToSearch.match(
    /\b(?:select|choose|pick)\s+(?:exactly\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:options|answers|findings|interventions|actions|manifestations|cues|items|statements|symptoms|prescriptions|orders)\b/i
  );
  if (optionsMatch) {
    const parsed = parseNumOrWord(optionsMatch[1]);
    if (parsed !== null) return parsed;
  }

  // Pattern 4: Metadata check if available on client
  if (question.correctAnswerMeta) {
    if (Array.isArray(question.correctAnswerMeta.correctOptionIds) && question.correctAnswerMeta.correctOptionIds.length > 0) {
      return question.correctAnswerMeta.correctOptionIds.length;
    }
    if (Array.isArray(question.correctAnswerMeta.correctCellIds) && question.correctAnswerMeta.correctCellIds.length > 0) {
      return question.correctAnswerMeta.correctCellIds.length;
    }
  }

  // Pattern 5: Direct options isCorrect check if available
  if (Array.isArray(question.options)) {
    const correctCount = question.options.filter((o) => o && o.isCorrect === true).length;
    if (correctCount > 0) {
      return correctCount;
    }
  }

  return null;
}

export interface SataValidationResult {
  isValid: boolean;
  requiredCount: number | null;
  selectedCount: number;
  message?: string;
}

export function validateSataSelection(
  question: {
    questionType?: string | number | null;
    stem?: string;
    instructions?: string;
    metaStem?: string;
    correctAnswerMeta?: { correctOptionIds?: string[]; correctCellIds?: string[] };
    options?: Array<{ id: string; optionIndex?: number | string; optionText?: string; isCorrect?: boolean }>;
    requiredSelections?: number;
    expectedCount?: number;
    correctCount?: number;
  },
  serializedAnswer: string | null | undefined
): SataValidationResult {
  if (!isSataQuestion(question.questionType)) {
    return { isValid: true, requiredCount: null, selectedCount: getSelectedOptionCount(serializedAnswer) };
  }

  const selectedCount = getSelectedOptionCount(serializedAnswer);
  const requiredCount = extractRequiredSataCount(question);

  if (requiredCount !== null && requiredCount > 0) {
    if (selectedCount !== requiredCount) {
      return {
        isValid: false,
        requiredCount,
        selectedCount,
        message: `Select ${requiredCount} answers to continue. You have selected ${selectedCount}.`,
      };
    }
    return { isValid: true, requiredCount, selectedCount };
  }

  // Fallback: when required count is not specified, require at least 1 selection
  if (selectedCount < 1) {
    return {
      isValid: false,
      requiredCount: null,
      selectedCount,
      message: 'Select at least 1 answer to continue.',
    };
  }

  return { isValid: true, requiredCount: null, selectedCount };
}
