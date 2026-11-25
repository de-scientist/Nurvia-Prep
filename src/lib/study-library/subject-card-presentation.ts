import type { SourceSubjectIdentityDto, SubjectCardDto } from '../api-types';
import {
  formatPathwayShortLabel,
  LPN_PROGRAM_ID,
  normalizePathwayParam,
  programIdForPathway,
  RN_PROGRAM_ID,
  type AuthorizedProgramId,
} from './curriculum-consolidation';

export type SubjectCardClassification = 'COMMON' | 'RN_ONLY' | 'LPN_ONLY';

export type PathwayBadgeLabel = 'Shared: RN & LPN' | 'RN' | 'LPN';

export interface SubjectPathwayOption {
  pathway: 'RN' | 'PN_LPN';
  label: 'RN Pathway' | 'LPN Pathway';
  shortLabel: 'RN' | 'LPN';
  programId: AuthorizedProgramId;
  examCount: number;
  questionCount: number;
  subjectIds: string[];
}

export interface SubjectCardPresentation {
  classification: SubjectCardClassification;
  pathwayBadgeLabel: PathwayBadgeLabel;
  categoryLabel: string;
  isExitPathway: boolean;
  hasMultiplePathways: boolean;
  pathwayOptions: SubjectPathwayOption[];
  defaultSelectedPathway: string;
}

export interface VerifiedPathwayMetrics {
  examCount: number;
  questionCount: number | null;
  totalQuestions: number;
  rnExamCount: number;
  pnExamCount: number;
  examCountsVerified: boolean;
}

export interface SubjectSelectionPayload {
  subjectName: string;
  pathway: string;
  programId: 6 | 9;
  subjectIds: string[];
  examId?: string;
  card: SubjectCardDto;
}

const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  ATI: 'ATI',
  HESI: 'HESI',
  RegularCourse: 'Course Exams',
  ExitPredictor: 'Exit Predictor',
  Certification: 'Certification',
};

export function formatSubjectCategoryLabel(category?: string | null): string {
  const raw = String(category ?? '').trim();
  if (!raw) return '';
  if (CATEGORY_DISPLAY_LABELS[raw]) return CATEGORY_DISPLAY_LABELS[raw];
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function collectSourceIds(sources?: SourceSubjectIdentityDto[]): string[] {
  return (sources ?? [])
    .map((s) => s.subjectGuidId ?? s.subjectId)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

function sumSourceQuestions(sources?: SourceSubjectIdentityDto[]): number {
  return (sources ?? []).reduce(
    (sum, s) => sum + (Number.isFinite(s.questionCount) ? Math.max(0, s.questionCount) : 0),
    0
  );
}

function sumSourceExams(sources?: SourceSubjectIdentityDto[]): number {
  return (sources ?? []).reduce(
    (sum, s) => sum + (Number.isFinite(s.examCount) ? Math.max(0, s.examCount) : 0),
    0
  );
}

/**
 * Resolves the authoritative subject classification strictly from consolidated metadata
 * (`COMMON`, `RN_ONLY`, or `LPN_ONLY`) without inventing missing pathways.
 */
export function resolveSubjectClassification(subject: SubjectCardDto): SubjectCardClassification {
  if (
    subject.classification === 'COMMON' ||
    subject.classification === 'RN_ONLY' ||
    subject.classification === 'LPN_ONLY'
  ) {
    return subject.classification;
  }

  const hasRnSources = (subject.sourceSubjects?.rn?.length ?? 0) > 0;
  const hasLpnSources = (subject.sourceSubjects?.lpn?.length ?? 0) > 0;
  if (hasRnSources && hasLpnSources) return 'COMMON';
  if (hasRnSources) return 'RN_ONLY';
  if (hasLpnSources) return 'LPN_ONLY';

  const pathways = (subject.availablePathways ?? [])
    .map((p) => normalizePathwayParam(p))
    .filter((p): p is NonNullable<typeof p> => p !== null && p !== 'All');

  const hasRnPathway = pathways.includes('RN') || pathways.includes('RN_Exit');
  const hasLpnPathway = pathways.includes('PN_LPN') || pathways.includes('PN_Exit');

  if (hasRnPathway && hasLpnPathway) return 'COMMON';
  if (hasLpnPathway && !hasRnPathway) return 'LPN_ONLY';
  if (hasRnPathway && !hasLpnPathway) return 'RN_ONLY';

  const strictProgId =
    subject.programId !== undefined && subject.programId !== null && subject.programId !== ''
      ? Number(subject.programId)
      : null;
  if (strictProgId === LPN_PROGRAM_ID) return 'LPN_ONLY';
  if (strictProgId === RN_PROGRAM_ID) return 'RN_ONLY';

  const normPrimary = normalizePathwayParam(subject.pathway);
  if (normPrimary === 'PN_LPN' || normPrimary === 'PN_Exit') return 'LPN_ONLY';

  return 'RN_ONLY';
}

export function getPathwayBadgeLabel(
  classification: SubjectCardClassification
): PathwayBadgeLabel {
  switch (classification) {
    case 'COMMON':
      return 'Shared: RN & LPN';
    case 'RN_ONLY':
      return 'RN';
    case 'LPN_ONLY':
      return 'LPN';
  }
}

export function resolveDefaultPathway(subject: SubjectCardDto, activePathway?: string): string {
  const classification = resolveSubjectClassification(subject);
  const pathways =
    subject.availablePathways && subject.availablePathways.length > 0
      ? subject.availablePathways
      : [subject.pathway];

  if (classification === 'COMMON') {
    const activeNorm = normalizePathwayParam(activePathway);
    if (activeNorm === 'PN_LPN') return 'PN_LPN';
    if (activeNorm === 'RN') return 'RN';

    const rnCount = subject.rnExamCount ?? sumSourceExams(subject.sourceSubjects?.rn);
    const pnCount = subject.pnExamCount ?? sumSourceExams(subject.sourceSubjects?.lpn);
    if (rnCount === 0 && pnCount > 0) return 'PN_LPN';
    return 'RN';
  }

  return pathways[0] || (classification === 'LPN_ONLY' ? 'PN_LPN' : 'RN');
}

export function getVerifiedPathwayMetrics(
  subject: SubjectCardDto,
  selectedPathway: string
): VerifiedPathwayMetrics {
  const classification = resolveSubjectClassification(subject);
  const rnSources = subject.sourceSubjects?.rn ?? [];
  const lpnSources = subject.sourceSubjects?.lpn ?? [];

  const rnExamCount =
    typeof subject.rnExamCount === 'number'
      ? Math.max(0, subject.rnExamCount)
      : rnSources.length > 0
        ? sumSourceExams(rnSources)
        : classification === 'RN_ONLY'
          ? Math.max(0, subject.totalExams)
          : 0;

  const pnExamCount =
    typeof subject.pnExamCount === 'number'
      ? Math.max(0, subject.pnExamCount)
      : lpnSources.length > 0
        ? sumSourceExams(lpnSources)
        : classification === 'LPN_ONLY'
          ? Math.max(0, subject.totalExams)
          : 0;

  const normSelected = normalizePathwayParam(selectedPathway);
  let examCount = Math.max(0, subject.totalExams);
  let questionCount: number | null = Math.max(0, subject.totalQuestions);

  if (classification === 'COMMON') {
    if (normSelected === 'PN_LPN' || normSelected === 'PN_Exit') {
      examCount = pnExamCount;
      questionCount = lpnSources.length > 0 ? sumSourceQuestions(lpnSources) : null;
    } else {
      examCount = rnExamCount;
      questionCount = rnSources.length > 0 ? sumSourceQuestions(rnSources) : null;
    }
  }

  return {
    examCount,
    questionCount,
    totalQuestions: Math.max(0, subject.totalQuestions),
    rnExamCount,
    pnExamCount,
    examCountsVerified: subject.examCountsVerified !== false,
  };
}

export function buildSubjectCardPresentation(
  subject: SubjectCardDto,
  activePathway?: string
): SubjectCardPresentation {
  const classification = resolveSubjectClassification(subject);
  const pathways =
    subject.availablePathways && subject.availablePathways.length > 0
      ? subject.availablePathways
      : [subject.pathway];

  const hasMultiplePathways =
    classification === 'COMMON' &&
    pathways.includes('RN') &&
    pathways.includes('PN_LPN');

  const rnSources = subject.sourceSubjects?.rn ?? [];
  const lpnSources = subject.sourceSubjects?.lpn ?? [];
  const rnCount = subject.rnExamCount ?? sumSourceExams(rnSources);
  const pnCount = subject.pnExamCount ?? sumSourceExams(lpnSources);

  const pathwayOptions: SubjectPathwayOption[] = hasMultiplePathways
    ? [
        {
          pathway: 'RN',
          label: 'RN Pathway',
          shortLabel: 'RN',
          programId: RN_PROGRAM_ID,
          examCount: Math.max(0, rnCount),
          questionCount: sumSourceQuestions(rnSources),
          subjectIds: collectSourceIds(rnSources),
        },
        {
          pathway: 'PN_LPN',
          label: 'LPN Pathway',
          shortLabel: 'LPN',
          programId: LPN_PROGRAM_ID,
          examCount: Math.max(0, pnCount),
          questionCount: sumSourceQuestions(lpnSources),
          subjectIds: collectSourceIds(lpnSources),
        },
      ]
    : [];

  const isExitPathway =
    pathways.some((p) => p === 'RN_Exit' || p === 'PN_Exit') ||
    subject.pathway === 'RN_Exit' ||
    subject.pathway === 'PN_Exit';

  return {
    classification,
    pathwayBadgeLabel: getPathwayBadgeLabel(classification),
    categoryLabel: formatSubjectCategoryLabel(subject.category),
    isExitPathway,
    hasMultiplePathways,
    pathwayOptions,
    defaultSelectedPathway: resolveDefaultPathway(subject, activePathway),
  };
}

/**
 * Resolves authoritative single-program subject selection context while preserving
 * exact `programId` (6 | 9) and `subjectIds` routing semantics.
 */
export function buildSubjectSelectionContext(
  subject: SubjectCardDto,
  targetPathway: string,
  explicitOpts?: { subjectId?: string; examId?: string; programId?: 6 | 9 }
): SubjectSelectionPayload {
  const rnSourceIds = collectSourceIds(subject.sourceSubjects?.rn);
  const lpnSourceIds = collectSourceIds(subject.sourceSubjects?.lpn);

  const inferredProgramId: AuthorizedProgramId =
    explicitOpts?.programId ??
    programIdForPathway(targetPathway) ??
    (lpnSourceIds.length > 0 && rnSourceIds.length === 0 ? LPN_PROGRAM_ID : RN_PROGRAM_ID);

  const programSourceIds = inferredProgramId === LPN_PROGRAM_ID ? lpnSourceIds : rnSourceIds;
  const fallbackSubjectId = subject.guidId ?? subject.id;
  const resolvedSubjectIds = explicitOpts?.subjectId
    ? [explicitOpts.subjectId]
    : programSourceIds.length > 0
      ? programSourceIds
      : fallbackSubjectId
        ? [fallbackSubjectId]
        : [];

  return {
    subjectName: subject.title,
    pathway: targetPathway,
    programId: inferredProgramId,
    subjectIds: resolvedSubjectIds,
    examId: explicitOpts?.examId,
    card: subject,
  };
}

export function formatExclusiveCtaLabel(subject: SubjectCardDto, primaryPathway: string): string {
  if (subject.totalExams <= 0) {
    return 'No Examinations Available';
  }
  const shortLabel = formatPathwayShortLabel(primaryPathway);
  return `View ${shortLabel} Examinations (${subject.totalExams})`;
}
