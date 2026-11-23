import type {
  QuestionCorrectAnswerMetaDto,
  QuestionMatrixDto,
  QuestionMediaDto,
} from '@/lib/api-types';

export interface RendererOption {
  id: string;
  numericId?: number;
  optionIndex: number;
  optionText: string;
  displayOrder?: number;
  description?: string;
  data?: string;
  label?: string;
  order?: string;
  link?: string;
  isCorrect?: boolean;
  specificRationale?: string;
  wasSelected?: boolean;
}

export interface RendererExhibit {
  id?: string;
  type: string | number;
  title: string;
  content: string;
  displayOrder?: number;
}

export interface RendererQuestion {
  id: string;
  numericId?: number;
  guidId?: string;
  sectionId?: number;
  sectionGuidId?: string;
  sectionName?: string;
  orderIndex?: number;
  stem: string;
  metaStem?: string;
  instructions?: string;
  questionType: string | number;
  cognitiveSkill?: string | number;
  clientNeedCategory?: string | number;
  difficulty?: string;
  learningObjectives?: string[];
  resources?: string;
  prerequisites?: string;
  options: RendererOption[];
  exhibits?: RendererExhibit[];
  media?: QuestionMediaDto[];
  matrix?: QuestionMatrixDto;
  blankSelectPassage?: string;
  highlightPassage?: string;
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  contentIntegrityError?: string;
  contentJsonData?: string;
  generalRationale?: string;
  isCorrect?: boolean;
  isPartiallyCorrect?: boolean;
  allowPartialCredit?: boolean;
  pointsAwarded?: number;
  maxPoints?: number;
  isFlagged?: boolean;
  learnerResponse?: string;
}

export interface QuestionRendererProps {
  question: RendererQuestion;
  value?: string | null;
  onChange?: (val: string) => void;
  disabled?: boolean;
  isReview?: boolean;
  hideRationaleBox?: boolean;
  onAskTutor?: (questionId: string) => void;
  canAskTutor?: boolean;
}
