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

export function normalizeSelectedOptionIds(
  serializedAnswer: string | null | undefined,
  validOptions?: Array<{ id: string; numericId?: number | string }>
): string[] {
  if (!serializedAnswer || (typeof serializedAnswer !== 'string' && typeof serializedAnswer !== 'object')) {
    return [];
  }
  try {
    const parsed = typeof serializedAnswer === 'string' ? JSON.parse(serializedAnswer) : serializedAnswer;
    let rawList: unknown[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const list = parsed.SelectedOptionIds ?? parsed.selectedOptionIds ?? parsed.SelectedMediaIds ?? parsed.selectedMediaIds;
      if (Array.isArray(list)) {
        rawList = list;
      } else if (parsed.SelectedOptionId || parsed.selectedOptionId) {
        rawList = [parsed.SelectedOptionId || parsed.selectedOptionId];
      }
    }

    // Clean and deduplicate strings
    const uniqueStrings = Array.from(
      new Set(
        rawList
          .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
          .filter((s) => s.length > 0)
      )
    );

    // If authoritative question options are provided, normalize against valid options
    if (validOptions && Array.isArray(validOptions) && validOptions.length > 0) {
      const canonicalIds = new Set<string>();
      for (const sel of uniqueStrings) {
        const matchingOpt = validOptions.find(
          (opt) => opt.id === sel || (opt.numericId !== undefined && String(opt.numericId) === sel)
        );
        if (matchingOpt) {
          canonicalIds.add(matchingOpt.id);
        }
      }
      return Array.from(canonicalIds);
    }

    return uniqueStrings;
  } catch {
    // Non-JSON string or malformed JSON
    if (typeof serializedAnswer === 'string') {
      const trimmed = serializedAnswer.trim();
      // If it looks like JSON or contains whitespace like "invalid json", it is invalid
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || /\s/.test(trimmed)) {
        return [];
      }
      if (validOptions && Array.isArray(validOptions) && validOptions.length > 0) {
        const items = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        const matched = items.filter((item) =>
          validOptions.some(
            (opt) => opt.id === item || (opt.numericId !== undefined && String(opt.numericId) === item)
          )
        );
        return Array.from(new Set(matched));
      }
      // Single token without whitespace
      if (trimmed.length > 0 && !/\s/.test(trimmed)) {
        return Array.from(new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean)));
      }
    }
  }
  return [];
}

export function getSelectedOptionCount(
  serializedAnswer: string | null | undefined,
  validOptions?: Array<{ id: string; numericId?: number | string }>
): number {
  return normalizeSelectedOptionIds(serializedAnswer, validOptions).length;
}

export function extractRequiredSataCount(question: {
  stem?: string;
  instructions?: string;
  metaStem?: string;
  correctAnswerMeta?: { correctOptionIds?: string[]; correctCellIds?: string[] };
  options?: Array<{ id: string; optionIndex?: number | string; optionText?: string; isCorrect?: boolean; numericId?: number | string }>;
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

  // Pattern 1: "(Select 4)" or "(Choose 3)" or "[Select 3]" or "(Select exactly 4)"
  const parenMatch = textToSearch.match(
    /[([{](?:select|choose|pick)\s+(?:all\s+that\s+apply[.,;]?\s*)?(?:exactly\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[)\]}]/i
  );
  if (parenMatch) {
    const parsed = parseNumOrWord(parenMatch[1]);
    if (parsed !== null) return parsed;
  }

  // Pattern 2: "Select 4 findings", "Select all that apply. (Select 4)", "Select 3 interventions"
  const selectMatch = textToSearch.match(
    /\b(?:select|choose|pick)\s+(?:all\s+that\s+apply[.,;]?\s*(?:\()?)?(?:exactly\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  );
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
    options?: Array<{ id: string; optionIndex?: number | string; optionText?: string; isCorrect?: boolean; numericId?: number | string }>;
    requiredSelections?: number;
    expectedCount?: number;
    correctCount?: number;
  },
  serializedAnswer: string | null | undefined
): SataValidationResult {
  if (!isSataQuestion(question.questionType)) {
    return {
      isValid: true,
      requiredCount: null,
      selectedCount: getSelectedOptionCount(serializedAnswer, question.options),
    };
  }

  const selectedCount = getSelectedOptionCount(serializedAnswer, question.options);
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
