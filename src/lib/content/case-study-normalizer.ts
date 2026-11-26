/**
 * NURVIA-PREP — Clinical Case Study & Exhibit Normalization Engine
 *
 * Provides typed interfaces and re-exports from core native ESM normalization engine.
 */

import {
  isCaseStudyQuestion as coreIsCaseStudy,
  resolveAuthoritativeExhibitId as coreResolveExhibitId,
  normalizeExhibits as coreNormalizeExhibits,
  resolveAuthoritativeCaseStudyId as coreResolveCaseStudyId,
  normalizeCaseStudies as coreNormalizeCaseStudies,
  groupQuestionsByCaseStudy as coreGroupQuestions,
  getCaseStudyNavigation as coreGetNavigation,
  deduplicateQuestions as coreDeduplicateQuestions,
} from './case-study-normalizer-core.mjs';

export interface ExhibitLike {
  id?: string | number | null;
  guidId?: string | null;
  numericId?: number | null;
  type?: string | number | null;
  title?: string | null;
  name?: string | null;
  content?: string | null;
  description?: string | null;
  instructions?: string | null;
  prerequisites?: string | null;
  displayOrder?: number | null;
  metadata?: Record<string, unknown> | null;
  attachments?: unknown[] | null;
  [key: string]: any;
}

export interface NormalizedExhibit {
  id: string;
  guidId?: string;
  numericId?: number;
  type: string;
  title: string;
  content: string;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  attachments?: unknown[];
}

export interface CaseStudyLike {
  id?: string | number | null;
  guidId?: string | null;
  numericId?: number | null;
  caseStudyId?: string | null;
  caseId?: string | null;
  caseStudyGuidId?: string | null;
  title?: string | null;
  caseTitle?: string | null;
  stem?: string | null;
  metaStem?: string | null;
  metaQuestionText?: string | null;
  scenario?: string | null;
  description?: string | null;
  instructions?: string | null;
  questionType?: string | number | null;
  exhibits?: ExhibitLike[] | null;
  questionContents?: ExhibitLike[] | null;
  questions?: unknown[] | null;
  questionIds?: string[] | null;
  [key: string]: any;
}

export interface NormalizedCaseStudy {
  id: string;
  guidId?: string;
  numericId?: number;
  title: string;
  scenario: string;
  metaStem?: string;
  description?: string;
  instructions?: string;
  exhibits: NormalizedExhibit[];
  questionIds: string[];
}

export interface CaseStudyGroup<Q = unknown> {
  caseStudyId: string | null;
  isCaseStudy: boolean;
  caseStudy: NormalizedCaseStudy | null;
  questions: Q[];
}

export interface CaseStudyNavigationInfo {
  isCaseStudy: boolean;
  caseStudyId: string | null;
  caseStudyTitle?: string;
  totalCasesInExam: number;
  currentCaseIndex: number;
  questionIndexInCase: number;
  totalQuestionsInCase: number;
  isFirstInCase: boolean;
  isLastInCase: boolean;
  prevCaseQuestionIndex: number | null;
  nextCaseQuestionIndex: number | null;
}

export function isCaseStudyQuestion(
  type: string | number | undefined | null
): boolean {
  return coreIsCaseStudy(type);
}

export function resolveAuthoritativeExhibitId(
  ex: any
): string | null {
  return coreResolveExhibitId(ex);
}

export function normalizeExhibits<T = any>(
  rawExhibits: T[] | undefined | null
): NormalizedExhibit[] {
  return coreNormalizeExhibits(rawExhibits) as NormalizedExhibit[];
}

export function resolveAuthoritativeCaseStudyId(
  item: any
): string | null {
  return coreResolveCaseStudyId(item);
}

export function normalizeCaseStudies<T = any>(
  rawCases: T[] | undefined | null
): NormalizedCaseStudy[] {
  return coreNormalizeCaseStudies(rawCases) as NormalizedCaseStudy[];
}

export function groupQuestionsByCaseStudy<Q = any>(
  questions: Q[]
): CaseStudyGroup<Q>[] {
  return coreGroupQuestions(questions) as CaseStudyGroup<Q>[];
}

export function getCaseStudyNavigation<Q = any>(
  questions: Q[],
  currentQuestionIndex: number
): CaseStudyNavigationInfo {
  return coreGetNavigation(questions, currentQuestionIndex) as CaseStudyNavigationInfo;
}

export function deduplicateQuestions<Q = any>(
  questions: Q[]
): Q[] {
  return coreDeduplicateQuestions(questions) as Q[];
}
