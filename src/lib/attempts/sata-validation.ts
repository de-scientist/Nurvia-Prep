/**
 * Frontend SATA (Select All That Apply) Selection Validation
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * This validation is strictly CLIENT-SIDE / FRONTEND-ONLY.
 * The upstream assessment backend is immutable and does not enforce selection counts.
 * This helper ensures learners select the exact required number of options specified in the stem/instructions
 * before submitting their response, preventing incomplete submissions while preserving their selections.
 */

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
}): number | null {
  const textToSearch = `${question.instructions || ''} ${question.metaStem || ''} ${question.stem || ''}`;
  
  // Pattern 1: "(Select 4)" or "(Choose 3)"
  const parenMatch = textToSearch.match(/\((?:select|choose|pick)\s+(\d+)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);

  // Pattern 2: "Select 4 findings", "Select all that apply. (Select 4)", "Select 3 interventions"
  const selectMatch = textToSearch.match(/\b(?:select|choose|pick)\s+(?:all\s+that\s+apply[.,;]?\s*(?:\()?)?(\d+)\b/i);
  if (selectMatch) return parseInt(selectMatch[1], 10);

  // Pattern 3: "(N options)" or "Select N options"
  const optionsMatch = textToSearch.match(/\b(?:select|choose|pick)\s+(\d+)\s+(?:options|answers|findings|interventions|actions|manifestations|cues|items)\b/i);
  if (optionsMatch) return parseInt(optionsMatch[1], 10);

  // Pattern 4: Metadata check if available on client
  if (question.correctAnswerMeta) {
    if (Array.isArray(question.correctAnswerMeta.correctOptionIds) && question.correctAnswerMeta.correctOptionIds.length > 0) {
      return question.correctAnswerMeta.correctOptionIds.length;
    }
    if (Array.isArray(question.correctAnswerMeta.correctCellIds) && question.correctAnswerMeta.correctCellIds.length > 0) {
      return question.correctAnswerMeta.correctCellIds.length;
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
