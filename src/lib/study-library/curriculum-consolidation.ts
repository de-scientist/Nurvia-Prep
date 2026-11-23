import type {
  DifficultyLevel,
  ExamCategory,
  ExamDeliveryMode,
  NursingPathway,
  SourceSubjectIdentityDto,
  SubjectCardDto,
  SubjectEquivalenceDto,
} from '../api-types';

/**
 * Positive program allowlist for NURVIA Prep learner-facing Study Library.
 * Only LPN (6) and RN (9) are authorized; every other program ID fails closed.
 */
export const LPN_PROGRAM_ID = 6 as const;
export const RN_PROGRAM_ID = 9 as const;
export const AUTHORIZED_PROGRAM_IDS = new Set<number>([LPN_PROGRAM_ID, RN_PROGRAM_ID]);

export type AuthorizedProgramId = typeof LPN_PROGRAM_ID | typeof RN_PROGRAM_ID;
export type RawRecord = Record<string, unknown>;

export const AUTHORIZED_PROGRAM_NAMES: Record<AuthorizedProgramId, string> = {
  [LPN_PROGRAM_ID]: 'LPN Nursing Exams',
  [RN_PROGRAM_ID]: 'RN Nursing Exams',
};

export type CourseSeries =
  | 'ATI'
  | 'HESI'
  | 'RHEMPLIFY'
  | 'GENERAL'
  | 'KAPLAN'
  | 'ATI_EXIT'
  | 'HESI_EXIT'
  | 'OTHER';

export const PARALLEL_CURRICULUM_SERIES = new Set<CourseSeries>(['ATI', 'RHEMPLIFY', 'HESI']);

const UNAUTHORIZED_EXAM_FAMILY_PATTERN =
  /\bnclex\b|\bged\b|\bati\s*teas\b|\bhesi\s*a2\b|\baccuplacer\b|explicit\s+dynamic/i;

const EXIT_NAME_PATTERN = /\b(exit|predictor|capstone)\b/i;

interface DisciplineRule {
  key: string;
  displayName: string;
  ambiguous?: boolean;
  ambiguityNote?: string;
  pattern: RegExp;
}

const DISCIPLINE_RULES: DisciplineRule[] = [
  {
    key: 'maternal-newborn',
    displayName: 'Maternal & Newborn Nursing (OB)',
    ambiguous: true,
    ambiguityNote:
      'Maternal & Newborn / Maternal-Child (OB) requires independent curriculum equivalence verification; RN and LPN subjects remain separate.',
    pattern: /^maternal/i,
  },
  {
    key: 'pharmacology',
    displayName: 'Pharmacology',
    pattern: /^pharmacology\b/i,
  },
  {
    key: 'medical-surgical',
    displayName: 'Medical-Surgical Nursing',
    pattern: /^med[-\s]*surg\b|^medical[-\s]*surgical\b/i,
  },
  {
    key: 'adult-health',
    displayName: 'Adult Health Nursing',
    pattern: /^adult\s+health\b/i,
  },
  {
    key: 'fundamentals',
    displayName: 'Fundamentals of Nursing',
    pattern: /^fundamental(?:s)?(?:\s+of\s+nursing)?\b/i,
  },
  {
    key: 'foundation-nursing',
    displayName: 'Foundation of Nursing',
    pattern: /^foundation(?:\s+of\s+nursing)?\b/i,
  },
  {
    key: 'pediatrics',
    displayName: 'Pediatrics',
    pattern: /^pediatric(?:s)?\b/i,
  },
  {
    key: 'mental-health',
    displayName: 'Mental Health Nursing',
    pattern: /^mental\s+health\b|^psychiatric\s+nursing\b/i,
  },
  {
    key: 'leadership',
    displayName: 'Leadership & Delegation',
    pattern: /^leadership\b/i,
  },
  {
    key: 'dosage-calculations',
    displayName: 'Dosage Calculations',
    pattern: /^dosage\s+calculation(?:s)?\b|^clinical\s+calculation(?:s)?\b/i,
  },
  {
    key: 'health-assessment',
    displayName: 'Health Assessment',
    pattern: /^health\s+assessment\b/i,
  },
  {
    key: 'nutrition',
    displayName: 'Nutrition',
    pattern: /^nutrition\b/i,
  },
  {
    key: 'community-health',
    displayName: 'Community Health Nursing',
    pattern: /^community\s+health\b/i,
  },
  {
    key: 'pathophysiology',
    displayName: 'Pathophysiology',
    pattern: /^pathophysiology\b/i,
  },
];

export const AMBIGUOUS_DISCIPLINES = new Set<string>(
  DISCIPLINE_RULES.filter((r) => r.ambiguous).map((r) => r.key)
);

/**
 * Strictly parses an authorized program ID (6 for LPN, 9 for RN).
 * Fails closed on null, undefined, empty strings, floats, booleans, or malformed strings.
 */
export function parseStrictProgramId(raw: unknown): AuthorizedProgramId | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) return null;
    if (raw === LPN_PROGRAM_ID || raw === RN_PROGRAM_ID) return raw;
    return null;
  }
  if (typeof raw === 'string') {
    const match = raw.match(/^\s*(6|9)\s*$/);
    if (!match) return null;
    return match[1] === '6' ? LPN_PROGRAM_ID : RN_PROGRAM_ID;
  }
  return null;
}

/**
 * Checks whether a program, course, or subject name explicitly denotes an excluded exam family
 * (NCLEX, GED, ATI TEAS, HESI A2, ACCUPLACER, EXPLICIT DYNAMIC SOLUTIONS).
 * Does NOT falsely reject LPN HESI specialty subjects such as "ADULT HEALTH (LPN hesi)".
 */
export function isUnauthorizedExamFamilyName(name: string): boolean {
  return UNAUTHORIZED_EXAM_FAMILY_PATTERN.test(String(name ?? ''));
}

export function isEligibleExamStatus(status: unknown): boolean {
  if (typeof status !== 'string') return true;
  const norm = status.trim().toLowerCase();
  if (!norm) return true;
  return norm === 'active' || norm === 'published';
}

export function filterAuthorizedPrograms<T extends RawRecord>(rawPrograms: T[]): T[] {
  return (rawPrograms || []).filter((program) => {
    const pid = parseStrictProgramId(program.id);
    if (pid === null) return false;
    const name = String(program.name ?? program.title ?? '').trim();
    if (name && isUnauthorizedExamFamilyName(name)) return false;
    return true;
  });
}

export function filterAuthorizedCourses<T extends RawRecord>(rawCourses: T[]): T[] {
  return (rawCourses || []).filter((course) => {
    const pid = parseStrictProgramId(course.programId ?? course.program_id);
    if (pid === null) return false;
    const name = String(course.name ?? course.title ?? '').trim();
    if (name && isUnauthorizedExamFamilyName(name)) return false;
    return true;
  });
}

/**
 * Builds a case-insensitive lookup map of courses keyed by numeric id and guidId.
 */
export function buildCoursesByIdMap(rawCourses: RawRecord[]): Map<string, RawRecord> {
  const map = new Map<string, RawRecord>();
  for (const c of rawCourses || []) {
    const idKey = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    const guidKey = typeof c.guidId === 'string' ? c.guidId.trim().toLowerCase() : '';
    if (idKey) map.set(idKey, c);
    if (guidKey) map.set(guidKey, c);
  }
  return map;
}

/**
 * Builds a lookup map of programs keyed by numeric id and guidId.
 */
export function buildProgramsByIdMap(rawPrograms: RawRecord[]): Map<string, RawRecord> {
  const map = new Map<string, RawRecord>();
  for (const p of rawPrograms || []) {
    const idKey = p.id !== undefined && p.id !== null ? String(p.id).trim() : '';
    const guidKey = typeof p.guidId === 'string' ? p.guidId.trim().toLowerCase() : '';
    if (idKey) map.set(idKey, p);
    if (guidKey) map.set(guidKey, p);
  }
  return map;
}

function hasProvidedValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

/**
 * Resolves the authoritative program ID (6 or 9) for a subject record using its course
 * relationship and optional direct programId. Fails closed on missing, unknown, malformed,
 * or conflicting ownership.
 */
export function resolveAuthoritativeSubjectProgramId(
  sub: RawRecord,
  coursesById: Map<string, RawRecord>
): AuthorizedProgramId | null {
  const rawName = String(sub.name ?? sub.title ?? '').trim();
  if (rawName && isUnauthorizedExamFamilyName(rawName)) {
    return null;
  }

  const courseIdKey = hasProvidedValue(sub.courseId) ? String(sub.courseId).trim() : '';
  const courseGuidKey =
    typeof sub.courseGuidId === 'string' && sub.courseGuidId.trim()
      ? sub.courseGuidId.trim().toLowerCase()
      : '';

  let courseProgramId: AuthorizedProgramId | null = null;
  const hasCourseRef = Boolean(courseIdKey || courseGuidKey);

  if (hasCourseRef) {
    const course =
      (courseIdKey ? coursesById.get(courseIdKey) : undefined) ??
      (courseGuidKey ? coursesById.get(courseGuidKey) : undefined);

    if (course) {
      const courseName = String(course.name ?? course.title ?? '').trim();
      if (courseName && isUnauthorizedExamFamilyName(courseName)) {
        return null;
      }
      if (!hasProvidedValue(course.programId ?? course.program_id)) {
        return null;
      }
      courseProgramId = parseStrictProgramId(course.programId ?? course.program_id);
      if (courseProgramId === null) {
        return null;
      }
    } else if (coursesById.size > 0) {
      // Course catalogue loaded, but subject points to an unknown/excluded course -> fail closed.
      return null;
    }
  }

  let directProgramId: AuthorizedProgramId | null = null;
  const hasDirectProg = hasProvidedValue(sub.programId);
  if (hasDirectProg) {
    directProgramId = parseStrictProgramId(sub.programId);
    if (directProgramId === null) {
      return null;
    }
  }

  if (courseProgramId !== null && directProgramId !== null && courseProgramId !== directProgramId) {
    return null;
  }

  return courseProgramId ?? directProgramId ?? null;
}

/**
 * Resolves and cross-checks the authoritative program ID (6 or 9) for an examination record.
 */
export function resolveAuthoritativeExamProgramId(
  exam: RawRecord,
  subjectsById?: Map<string, { programId: AuthorizedProgramId }>,
  coursesById?: Map<string, RawRecord>
): AuthorizedProgramId | null {
  let directProg: AuthorizedProgramId | null = null;
  if (hasProvidedValue(exam.programId)) {
    directProg = parseStrictProgramId(exam.programId);
    if (directProg === null) return null;
  }

  let subjectProg: AuthorizedProgramId | null = null;
  if (subjectsById && subjectsById.size > 0) {
    const subGuidKey =
      typeof exam.subjectGuidId === 'string' ? exam.subjectGuidId.trim().toLowerCase() : '';
    const subIdKey = hasProvidedValue(exam.subjectId) ? String(exam.subjectId).trim() : '';
    if (subGuidKey || subIdKey) {
      const subEntry =
        (subGuidKey ? subjectsById.get(subGuidKey) : undefined) ??
        (subIdKey ? subjectsById.get(subIdKey) : undefined);
      if (!subEntry) {
        return null;
      }
      subjectProg = subEntry.programId;
    }
  }

  let courseProg: AuthorizedProgramId | null = null;
  if (coursesById && coursesById.size > 0) {
    const courseGuidKey =
      typeof exam.courseGuidId === 'string' ? exam.courseGuidId.trim().toLowerCase() : '';
    const courseIdKey = hasProvidedValue(exam.courseId) ? String(exam.courseId).trim() : '';
    if (courseGuidKey || courseIdKey) {
      const course =
        (courseGuidKey ? coursesById.get(courseGuidKey) : undefined) ??
        (courseIdKey ? coursesById.get(courseIdKey) : undefined);
      if (!course) {
        return null;
      }
      courseProg = parseStrictProgramId(course.programId ?? course.program_id);
      if (courseProg === null) return null;
    }
  }

  const resolvedCandidates = [directProg, subjectProg, courseProg].filter(
    (v): v is AuthorizedProgramId => v !== null
  );
  if (resolvedCandidates.length === 0) return null;
  const first = resolvedCandidates[0];
  if (resolvedCandidates.some((v) => v !== first)) return null;
  return first;
}

/**
 * Classifies a course name into its curriculum series without guessing cross-program links.
 */
export function detectCourseSeries(courseName?: string | null): CourseSeries {
  const raw = String(courseName ?? '').trim();
  if (!raw) return 'OTHER';
  if (/(?:a-?t|ati)\s*exit/i.test(raw)) return 'ATI_EXIT';
  if (/(?:h-?s|hesi)\s*exit/i.test(raw)) return 'HESI_EXIT';
  if (/\b(?:a-?t|ati)\b/i.test(raw)) return 'ATI';
  if (/\b(?:h-?s|hesi)\b/i.test(raw)) return 'HESI';
  if (/rhemplify|examplify/i.test(raw)) return 'RHEMPLIFY';
  if (/\bgeneral\b/i.test(raw)) return 'GENERAL';
  if (/kap-?lan/i.test(raw)) return 'KAPLAN';
  return 'OTHER';
}

export function resolveAuthoritativeSubjectPathway(
  programId: AuthorizedProgramId,
  courseName: string | null,
  subjectName: string
): { pathway: NursingPathway; isExit: boolean; category: ExamCategory } {
  const series = detectCourseSeries(courseName);
  const isExit =
    series === 'ATI_EXIT' ||
    series === 'HESI_EXIT' ||
    EXIT_NAME_PATTERN.test(`${courseName ?? ''} ${subjectName}`);

  const pathway: NursingPathway =
    programId === RN_PROGRAM_ID
      ? isExit
        ? 'RN_Exit'
        : 'RN'
      : isExit
        ? 'PN_Exit'
        : 'PN_LPN';

  const category: ExamCategory = isExit
    ? 'ExitPredictor'
    : series === 'ATI'
      ? 'ATI'
      : series === 'HESI'
        ? 'HESI'
        : 'RegularCourse';

  return { pathway, isExit, category };
}

export function stripSubjectPathwayDecorators(rawName: string): string {
  let name = String(rawName ?? '').trim();
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ');
  name = name.replace(/\s*[-–—/]\s*(?:RN|PN|LPN)\s*$/i, '');
  name = name.replace(/\s*Exams?\s*$/i, '');
  name = name.replace(/\s*[-–—]\s*(?:RN|PN|LPN)\s*$/i, '');
  name = name.replace(/\s+/g, ' ').trim();
  return name || String(rawName ?? '').trim();
}

export function identifySubjectDiscipline(rawName: string): {
  key: string | null;
  displayName: string;
  ambiguous: boolean;
  ambiguityNote?: string;
} {
  const stripped = stripSubjectPathwayDecorators(rawName);
  for (const rule of DISCIPLINE_RULES) {
    if (rule.pattern.test(stripped)) {
      return {
        key: rule.key,
        displayName: rule.displayName,
        ambiguous: Boolean(rule.ambiguous),
        ambiguityNote: rule.ambiguityNote,
      };
    }
  }
  return {
    key: null,
    displayName: stripped || String(rawName ?? '').trim(),
    ambiguous: false,
  };
}

function extractEquivalenceId(sub: RawRecord): string | null {
  const cand = sub.equivalenceId ?? sub.canonicalSubjectId ?? sub.curriculumEquivalenceId;
  if (typeof cand === 'string' && cand.trim()) return cand.trim();
  if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand);
  return null;
}

export interface AuthorizedSourceSubject {
  programId: AuthorizedProgramId;
  programName: string;
  courseId: string | number | null;
  courseGuidId: string | null;
  courseName: string | null;
  courseSeries: CourseSeries;
  subjectId: string;
  subjectGuidId: string | null;
  code: string;
  rawName: string;
  displayName: string;
  disciplineKey: string | null;
  ambiguousDiscipline: boolean;
  ambiguityNote?: string;
  description: string;
  pathway: NursingPathway;
  isExit: boolean;
  category: ExamCategory;
  year: number | null;
  season: string | null;
  difficulty: DifficultyLevel | null;
  school: string | null;
  order: string | null;
  equivalenceId: string | null;
  raw: RawRecord;
}

export interface PartitionedSubjectsResult {
  rnSubjects: AuthorizedSourceSubject[];
  lpnSubjects: AuthorizedSourceSubject[];
  excludedCount: number;
}

function normalizeSourceDifficulty(raw: unknown): DifficultyLevel | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = raw.trim().toLowerCase();
  if (d.includes('found') || d.includes('begin') || d.includes('easy')) return 'Foundational';
  if (d.includes('inter') || d.includes('mod') || d.includes('med')) return 'Intermediate';
  if (d.includes('adv') || d.includes('hard')) return 'Advanced';
  if (d.includes('bench')) return 'Benchmark';
  return null;
}

/**
 * Stage 2 & Stage 3: Positively filters curriculum to program IDs {6, 9} and partitions
 * authorized records into two disjoint source collections (`rnSubjects` and `lpnSubjects`)
 * without mutating source objects.
 */
export function partitionAuthorizedSubjects(
  rawSubjects: RawRecord[],
  coursesById: Map<string, RawRecord>,
  programsById: Map<string, RawRecord>
): PartitionedSubjectsResult {
  const rnSubjects: AuthorizedSourceSubject[] = [];
  const lpnSubjects: AuthorizedSourceSubject[] = [];
  let excludedCount = 0;

  for (const sub of rawSubjects || []) {
    const programId = resolveAuthoritativeSubjectProgramId(sub, coursesById);
    if (programId === null) {
      excludedCount++;
      continue;
    }

    const courseIdKey = hasProvidedValue(sub.courseId) ? String(sub.courseId).trim() : '';
    const courseGuidKey =
      typeof sub.courseGuidId === 'string' && sub.courseGuidId.trim()
        ? sub.courseGuidId.trim().toLowerCase()
        : '';
    const course =
      (courseIdKey ? coursesById.get(courseIdKey) : undefined) ??
      (courseGuidKey ? coursesById.get(courseGuidKey) : undefined);

    const courseName =
      (typeof sub.courseName === 'string' && sub.courseName.trim()) ||
      (typeof course?.name === 'string' && course.name.trim()) ||
      null;
    const courseSeries = detectCourseSeries(courseName);

    const progObj = programsById.get(String(programId));
    const programName =
      (typeof progObj?.name === 'string' && progObj.name.trim()) ||
      AUTHORIZED_PROGRAM_NAMES[programId];

    const rawName = String(sub.name ?? sub.title ?? '').trim();
    if (!rawName) {
      excludedCount++;
      continue;
    }

    const { pathway, isExit, category } = resolveAuthoritativeSubjectPathway(
      programId,
      courseName,
      rawName
    );

    const discipline = identifySubjectDiscipline(rawName);
    const subjectGuidId =
      typeof sub.guidId === 'string' && sub.guidId.trim() ? sub.guidId.trim() : null;
    const subjectId = hasProvidedValue(sub.id)
      ? String(sub.id).trim()
      : (subjectGuidId ?? '');

    if (!subjectId) {
      excludedCount++;
      continue;
    }

    const yearRaw = sub.year ?? sub.academicYear;
    const year =
      typeof yearRaw === 'number' && Number.isFinite(yearRaw)
        ? yearRaw
        : typeof yearRaw === 'string' && /^\d{4}$/.test(yearRaw.trim())
          ? Number(yearRaw.trim())
          : null;

    const description =
      (typeof sub.description === 'string' && sub.description.trim()) ||
      (typeof sub.objectives === 'string' && sub.objectives.trim()) ||
      '';

    const entry: AuthorizedSourceSubject = {
      programId,
      programName,
      courseId: hasProvidedValue(sub.courseId) ? (sub.courseId as string | number) : null,
      courseGuidId:
        typeof sub.courseGuidId === 'string' && sub.courseGuidId.trim()
          ? sub.courseGuidId.trim()
          : typeof course?.guidId === 'string' && course.guidId.trim()
            ? course.guidId.trim()
            : null,
      courseName,
      courseSeries,
      subjectId,
      subjectGuidId,
      code: typeof sub.code === 'string' && sub.code.trim() ? sub.code.trim() : subjectId,
      rawName,
      displayName: discipline.displayName,
      disciplineKey: discipline.key,
      ambiguousDiscipline: discipline.ambiguous,
      ambiguityNote: discipline.ambiguityNote,
      description,
      pathway,
      isExit,
      category,
      year,
      season: typeof sub.season === 'string' && sub.season.trim() ? sub.season.trim() : null,
      difficulty: normalizeSourceDifficulty(sub.difficulty),
      school:
        typeof sub.school === 'string' && sub.school.trim()
          ? sub.school.trim()
          : typeof sub.schoolName === 'string' && sub.schoolName.trim()
            ? sub.schoolName.trim()
            : null,
      order: typeof sub.order === 'string' && sub.order.trim() ? sub.order.trim() : null,
      equivalenceId: extractEquivalenceId(sub),
      raw: sub,
    };

    if (programId === RN_PROGRAM_ID) {
      rnSubjects.push(entry);
    } else {
      lpnSubjects.push(entry);
    }
  }

  return { rnSubjects, lpnSubjects, excludedCount };
}

export interface ConsolidationOptions {
  examIndexComplete?: boolean;
  failedSubjectIds?: Set<string>;
  inferTitleAndDifficulty?: (exam: RawRecord) => { title: string; difficulty: DifficultyLevel | null };
  inferDeliveryMode?: (exam: RawRecord) => ExamDeliveryMode;
}

interface ProgramGroup {
  groupKey: string;
  programId: AuthorizedProgramId;
  displayName: string;
  isExit: boolean;
  pathway: NursingPathway;
  category: ExamCategory;
  disciplineKey: string | null;
  equivalenceId: string | null;
  ambiguous: boolean;
  ambiguityNotes: string[];
  sources: AuthorizedSourceSubject[];
  seriesSet: Set<CourseSeries>;
}

function buildProgramGroups(subjects: AuthorizedSourceSubject[]): ProgramGroup[] {
  const groups = new Map<string, ProgramGroup>();

  for (const sub of subjects) {
    let key: string;
    if (sub.isExit) {
      key = `exit:${sub.programId}:${sub.pathway.toLowerCase()}:${sub.subjectGuidId ?? sub.subjectId}`;
    } else if (sub.equivalenceId) {
      key = `eq:${sub.programId}:${sub.equivalenceId.toLowerCase()}`;
    } else if (sub.disciplineKey) {
      key = `disc:${sub.programId}:${sub.disciplineKey}`;
    } else {
      key = `uniq:${sub.programId}:${sub.subjectGuidId ?? sub.subjectId}`;
    }

    let grp = groups.get(key);
    if (!grp) {
      grp = {
        groupKey: key,
        programId: sub.programId,
        displayName: sub.displayName,
        isExit: sub.isExit,
        pathway: sub.pathway,
        category: sub.category,
        disciplineKey: sub.disciplineKey,
        equivalenceId: sub.equivalenceId,
        ambiguous: sub.ambiguousDiscipline,
        ambiguityNotes: sub.ambiguityNote ? [sub.ambiguityNote] : [],
        sources: [],
        seriesSet: new Set<CourseSeries>(),
      };
      groups.set(key, grp);
    }

    grp.sources.push(sub);
    grp.seriesSet.add(sub.courseSeries);
    if (sub.ambiguityNote && !grp.ambiguityNotes.includes(sub.ambiguityNote)) {
      grp.ambiguityNotes.push(sub.ambiguityNote);
    }
  }

  return Array.from(groups.values());
}

export function lookupExamsForSourceSubject(
  source: AuthorizedSourceSubject,
  examsBySubjectKey: Map<string, RawRecord[]>
): RawRecord[] {
  const candidates: RawRecord[] = [];
  if (source.subjectGuidId) {
    const byGuid = examsBySubjectKey.get(source.subjectGuidId.toLowerCase());
    if (byGuid) candidates.push(...byGuid);
  }
  const byId = examsBySubjectKey.get(source.subjectId.toLowerCase());
  if (byId) candidates.push(...byId);

  const seen = new Set<string>();
  const verified: RawRecord[] = [];
  for (const ex of candidates) {
    if (!isEligibleExamStatus(ex.status)) continue;
    if (hasProvidedValue(ex.programId)) {
      const exProg = parseStrictProgramId(ex.programId);
      if (exProg !== source.programId) continue;
    }

    // Cross-check subject FK when present on the exam record
    const exSubGuid =
      typeof ex.subjectGuidId === 'string' ? ex.subjectGuidId.trim().toLowerCase() : '';
    const exSubId = hasProvidedValue(ex.subjectId) ? String(ex.subjectId).trim() : '';
    if (
      (exSubGuid && source.subjectGuidId && exSubGuid !== source.subjectGuidId.toLowerCase()) ||
      (exSubId && exSubId !== source.subjectId)
    ) {
      continue;
    }

    const examKey = String(ex.guidId ?? ex.id ?? '').trim();
    if (!examKey || seen.has(examKey)) continue;
    seen.add(examKey);
    verified.push(ex);
  }
  return verified;
}

function collectGroupExams(
  sources: AuthorizedSourceSubject[],
  examsBySubjectKey: Map<string, RawRecord[]>,
  failedSubjectIds?: Set<string>
): {
  exams: RawRecord[];
  perSourceStats: Map<string, { examCount: number; questionCount: number }>;
  allSourcesComplete: boolean;
} {
  const seenExamIds = new Set<string>();
  const exams: RawRecord[] = [];
  const perSourceStats = new Map<string, { examCount: number; questionCount: number }>();
  let allSourcesComplete = true;

  for (const src of sources) {
    const srcKey = (src.subjectGuidId ?? src.subjectId).toLowerCase();
    if (
      failedSubjectIds &&
      (failedSubjectIds.has(srcKey) || failedSubjectIds.has(src.subjectId.toLowerCase()))
    ) {
      allSourcesComplete = false;
    }

    const srcExams = lookupExamsForSourceSubject(src, examsBySubjectKey);
    let qCount = 0;
    for (const ex of srcExams) {
      qCount += Number(ex.questionsCount ?? ex.totalQuestions ?? 0) || 0;
      const exId = String(ex.guidId ?? ex.id ?? '').trim();
      if (exId && !seenExamIds.has(exId)) {
        seenExamIds.add(exId);
        exams.push(ex);
      }
    }
    perSourceStats.set(src.subjectGuidId ?? src.subjectId, {
      examCount: srcExams.length,
      questionCount: qCount,
    });
  }

  return { exams, perSourceStats, allSourcesComplete };
}

function toSourceIdentityDto(
  src: AuthorizedSourceSubject,
  stats?: { examCount: number; questionCount: number }
): SourceSubjectIdentityDto {
  return {
    programId: src.programId,
    programName: src.programName,
    courseId: src.courseId,
    courseGuidId: src.courseGuidId,
    courseName: src.courseName,
    courseSeries: src.courseSeries,
    subjectId: src.subjectId,
    subjectGuidId: src.subjectGuidId,
    code: src.code,
    rawName: src.rawName,
    pathway: src.pathway,
    examCount: stats?.examCount ?? 0,
    questionCount: stats?.questionCount ?? 0,
    equivalenceId: src.equivalenceId,
  };
}

function defaultInferTitle(exam: RawRecord): { title: string; difficulty: DifficultyLevel | null } {
  const rawTitle = String(exam.title ?? exam.name ?? 'NURVIA Examination').trim();
  return {
    title: rawTitle || 'NURVIA Examination',
    difficulty: normalizeSourceDifficulty(exam.difficulty),
  };
}

function defaultInferDeliveryMode(exam: RawRecord): ExamDeliveryMode {
  if (typeof exam.modeAllowed === 'string' && exam.modeAllowed.trim()) {
    const m = exam.modeAllowed.trim();
    if (['Review', 'Exam', 'Tutor', 'All', 'Both'].includes(m)) {
      return m as ExamDeliveryMode;
    }
  }
  return 'All';
}

function buildSubjectCardDto(
  params: {
    presentationId: string;
    title: string;
    classification: 'COMMON' | 'RN_ONLY' | 'LPN_ONLY';
    rnSources: AuthorizedSourceSubject[];
    lpnSources: AuthorizedSourceSubject[];
    equivalence: SubjectEquivalenceDto;
    ambiguityNotes: string[];
  },
  examsBySubjectKey: Map<string, RawRecord[]>,
  options: ConsolidationOptions
): SubjectCardDto {
  const { presentationId, title, classification, rnSources, lpnSources, equivalence, ambiguityNotes } =
    params;

  const rnCollected = collectGroupExams(rnSources, examsBySubjectKey, options.failedSubjectIds);
  const lpnCollected = collectGroupExams(lpnSources, examsBySubjectKey, options.failedSubjectIds);

  const rnExams = rnCollected.exams;
  const lpnExams = lpnCollected.exams;

  const rnExamCount = rnExams.length;
  const pnExamCount = lpnExams.length;
  const totalExams = rnExamCount + pnExamCount;

  const totalQuestions = [...rnExams, ...lpnExams].reduce(
    (sum, ex) => sum + (Number(ex.questionsCount ?? ex.totalQuestions ?? 0) || 0),
    0
  );

  const allSources = [...rnSources, ...lpnSources];
  const primarySrc = allSources[0];

  const availablePathwaysSet = new Set<NursingPathway>();
  for (const s of allSources) {
    availablePathwaysSet.add(s.pathway);
  }
  const availablePathways = Array.from(availablePathwaysSet);
  const primaryPathway: NursingPathway = availablePathways[0] ?? primarySrc.pathway;

  const courseNames = Array.from(
    new Set(allSources.map((s) => s.courseName).filter((v): v is string => Boolean(v)))
  );
  const programNames = Array.from(new Set(allSources.map((s) => s.programName)));
  const sourceSubjectIds = allSources.map((s) => s.subjectGuidId ?? s.subjectId);

  const inferTitle = options.inferTitleAndDifficulty ?? defaultInferTitle;
  const inferMode = options.inferDeliveryMode ?? defaultInferDeliveryMode;

  const previewCandidates: Array<{ exam: RawRecord; programId: AuthorizedProgramId; pathway: NursingPathway }> = [];
  if (rnExams.length > 0 && rnSources[0]) {
    previewCandidates.push({ exam: rnExams[0], programId: RN_PROGRAM_ID, pathway: rnSources[0].pathway });
  }
  if (lpnExams.length > 0 && lpnSources[0]) {
    previewCandidates.push({ exam: lpnExams[0], programId: LPN_PROGRAM_ID, pathway: lpnSources[0].pathway });
  }
  if (previewCandidates.length < 2 && rnExams.length > 1 && rnSources[0]) {
    previewCandidates.push({ exam: rnExams[1], programId: RN_PROGRAM_ID, pathway: rnSources[0].pathway });
  }
  if (previewCandidates.length < 2 && lpnExams.length > 1 && lpnSources[0]) {
    previewCandidates.push({ exam: lpnExams[1], programId: LPN_PROGRAM_ID, pathway: lpnSources[0].pathway });
  }

  const featuredExams = previewCandidates.slice(0, 2).map(({ exam, programId, pathway }) => {
    const resolved = inferTitle(exam);
    return {
      id: String(exam.guidId ?? exam.id ?? ''),
      title: resolved.title,
      totalQuestions: Number(exam.questionsCount ?? exam.totalQuestions ?? 0) || 0,
      modeAllowed: inferMode(exam),
      pathway,
      programId,
      subjectGuidId:
        typeof exam.subjectGuidId === 'string' && exam.subjectGuidId.trim()
          ? exam.subjectGuidId.trim()
          : undefined,
    };
  });

  const bestDescription =
    allSources.find((s) => s.description.trim())?.description.trim() ||
    'Comprehensive clinical subject content and examination prep.';

  const year = allSources.find((s) => s.year !== null)?.year ?? null;
  const season = allSources.find((s) => s.season !== null)?.season ?? null;
  const difficulty = allSources.find((s) => s.difficulty !== null)?.difficulty ?? null;
  const school = allSources.find((s) => s.school !== null)?.school ?? null;

  const category: ExamCategory = primarySrc.isExit
    ? 'ExitPredictor'
    : allSources.some((s) => s.category === 'ATI') && allSources.every((s) => s.category === 'ATI')
      ? 'ATI'
      : allSources.some((s) => s.category === 'HESI') && allSources.every((s) => s.category === 'HESI')
        ? 'HESI'
        : primarySrc.category;

  const examCountsVerified =
    options.examIndexComplete !== false &&
    rnCollected.allSourcesComplete &&
    lpnCollected.allSourcesComplete;

  return {
    id: primarySrc.subjectGuidId ?? primarySrc.subjectId,
    guidId: primarySrc.subjectGuidId ?? undefined,
    presentationId,
    code: primarySrc.code,
    name: title,
    title,
    description: bestDescription,
    pathway: primaryPathway,
    category,
    classification,
    programId: classification === 'COMMON' ? null : primarySrc.programId,
    programName: programNames.join(' / '),
    courseId: courseNames.length === 1 ? primarySrc.courseId : null,
    courseName: courseNames.join(' / ') || null,
    school,
    academicYear: year,
    season,
    difficulty,
    totalExams,
    totalQuestions,
    featuredExams,
    availablePathways,
    rnExamCount,
    pnExamCount,
    sourceSubjects: {
      rn: rnSources.map((s) => toSourceIdentityDto(s, rnCollected.perSourceStats.get(s.subjectGuidId ?? s.subjectId))),
      lpn: lpnSources.map((s) => toSourceIdentityDto(s, lpnCollected.perSourceStats.get(s.subjectGuidId ?? s.subjectId))),
    },
    sourceSubjectIds,
    equivalence,
    ambiguityNotes: ambiguityNotes.length > 0 ? ambiguityNotes : undefined,
    examCountsVerified,
  };
}

/**
 * Stages 4 & 5: Consolidates independent RN and LPN subject collections ONLY when verifiable
 * equivalence evidence exists (explicit equivalenceId OR verified non-ambiguous discipline +
 * shared parallel curriculum series). Preserves all original source identities and computes
 * independent RN and LPN examination counts.
 */
export function consolidateRnAndLpnSubjects(
  rnSubjects: AuthorizedSourceSubject[],
  lpnSubjects: AuthorizedSourceSubject[],
  examsBySubjectKey: Map<string, RawRecord[]>,
  options: ConsolidationOptions = {}
): SubjectCardDto[] {
  const rnGroups = buildProgramGroups(rnSubjects);
  const lpnGroups = buildProgramGroups(lpnSubjects);

  const matchedLpnIndices = new Set<number>();
  const cards: SubjectCardDto[] = [];

  for (const rnGroup of rnGroups) {
    if (rnGroup.isExit) {
      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `rn-exit:${rnGroup.sources[0].subjectGuidId ?? rnGroup.sources[0].subjectId}`,
            title: rnGroup.displayName,
            classification: 'RN_ONLY',
            rnSources: rnGroup.sources,
            lpnSources: [],
            equivalence: {
              verified: false,
              status: 'PROGRAM_EXCLUSIVE',
              evidenceType: 'exit-pathway-isolated',
              disciplineKey: rnGroup.disciplineKey ?? undefined,
            },
            ambiguityNotes: rnGroup.ambiguityNotes,
          },
          examsBySubjectKey,
          options
        )
      );
      continue;
    }

    if (rnGroup.ambiguous || (rnGroup.disciplineKey && AMBIGUOUS_DISCIPLINES.has(rnGroup.disciplineKey))) {
      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `rn-ambiguous:${rnGroup.disciplineKey ?? rnGroup.groupKey}`,
            title: rnGroup.displayName,
            classification: 'RN_ONLY',
            rnSources: rnGroup.sources,
            lpnSources: [],
            equivalence: {
              verified: false,
              status: 'AMBIGUOUS_SEPARATE',
              evidenceType: 'ambiguous-excluded-from-merge',
              disciplineKey: rnGroup.disciplineKey ?? undefined,
            },
            ambiguityNotes: rnGroup.ambiguityNotes,
          },
          examsBySubjectKey,
          options
        )
      );
      continue;
    }

    // Attempt evidence-based matching against LPN groups
    let matchedIndex = -1;
    let matchEvidence: SubjectEquivalenceDto | null = null;

    // Tier 1: Explicit authoritative equivalence identifier
    if (rnGroup.equivalenceId) {
      matchedIndex = lpnGroups.findIndex(
        (lg, idx) =>
          !matchedLpnIndices.has(idx) &&
          !lg.isExit &&
          !lg.ambiguous &&
          lg.equivalenceId === rnGroup.equivalenceId
      );
      if (matchedIndex !== -1) {
        matchEvidence = {
          verified: true,
          status: 'VERIFIED_COMMON',
          evidenceType: 'authoritative-equivalence-id',
          evidenceReference: `equivalenceId:${rnGroup.equivalenceId}`,
          disciplineKey: rnGroup.disciplineKey ?? undefined,
        };
      }
    }

    // Tier 2: Verified non-ambiguous discipline + at least one shared parallel curriculum series
    if (matchedIndex === -1 && rnGroup.disciplineKey) {
      matchedIndex = lpnGroups.findIndex((lg, idx) => {
        if (matchedLpnIndices.has(idx) || lg.isExit || lg.ambiguous) return false;
        if (lg.disciplineKey !== rnGroup.disciplineKey) return false;
        for (const s of rnGroup.seriesSet) {
          if (PARALLEL_CURRICULUM_SERIES.has(s) && lg.seriesSet.has(s)) {
            return true;
          }
        }
        return false;
      });

      if (matchedIndex !== -1) {
        const matchedLpn = lpnGroups[matchedIndex];
        const sharedSeries = Array.from(rnGroup.seriesSet).filter(
          (s) => PARALLEL_CURRICULUM_SERIES.has(s) && matchedLpn.seriesSet.has(s)
        );
        matchEvidence = {
          verified: true,
          status: 'VERIFIED_COMMON',
          evidenceType: 'parallel-curriculum-series-and-metadata',
          evidenceReference: `discipline:${rnGroup.disciplineKey};series:${sharedSeries.join(',')}`,
          matchedSeries: sharedSeries,
          disciplineKey: rnGroup.disciplineKey,
        };
      }
    }

    if (matchedIndex !== -1 && matchEvidence) {
      matchedLpnIndices.add(matchedIndex);
      const lpnGroup = lpnGroups[matchedIndex];
      const mergedAmbiguity = Array.from(
        new Set([...rnGroup.ambiguityNotes, ...lpnGroup.ambiguityNotes])
      );
      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `common:${rnGroup.equivalenceId ?? rnGroup.disciplineKey ?? rnGroup.groupKey}`,
            title: rnGroup.displayName,
            classification: 'COMMON',
            rnSources: rnGroup.sources,
            lpnSources: lpnGroup.sources,
            equivalence: matchEvidence,
            ambiguityNotes: mergedAmbiguity,
          },
          examsBySubjectKey,
          options
        )
      );
    } else {
      const sameDisciplineExistsInLpn =
        Boolean(rnGroup.disciplineKey) &&
        lpnGroups.some(
          (lg, idx) =>
            !matchedLpnIndices.has(idx) && !lg.isExit && lg.disciplineKey === rnGroup.disciplineKey
        );

      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `rn-only:${rnGroup.disciplineKey ?? rnGroup.sources[0].subjectGuidId ?? rnGroup.sources[0].subjectId}`,
            title: rnGroup.displayName,
            classification: 'RN_ONLY',
            rnSources: rnGroup.sources,
            lpnSources: [],
            equivalence: {
              verified: false,
              status: sameDisciplineExistsInLpn ? 'UNVERIFIED_SEPARATE' : 'PROGRAM_EXCLUSIVE',
              evidenceType: sameDisciplineExistsInLpn
                ? 'insufficient-equivalence-evidence'
                : 'single-program-exclusive',
              disciplineKey: rnGroup.disciplineKey ?? undefined,
            },
            ambiguityNotes: rnGroup.ambiguityNotes,
          },
          examsBySubjectKey,
          options
        )
      );
    }
  }

  for (let idx = 0; idx < lpnGroups.length; idx++) {
    if (matchedLpnIndices.has(idx)) continue;
    const lpnGroup = lpnGroups[idx];

    if (lpnGroup.isExit) {
      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `lpn-exit:${lpnGroup.sources[0].subjectGuidId ?? lpnGroup.sources[0].subjectId}`,
            title: lpnGroup.displayName,
            classification: 'LPN_ONLY',
            rnSources: [],
            lpnSources: lpnGroup.sources,
            equivalence: {
              verified: false,
              status: 'PROGRAM_EXCLUSIVE',
              evidenceType: 'exit-pathway-isolated',
              disciplineKey: lpnGroup.disciplineKey ?? undefined,
            },
            ambiguityNotes: lpnGroup.ambiguityNotes,
          },
          examsBySubjectKey,
          options
        )
      );
      continue;
    }

    if (lpnGroup.ambiguous || (lpnGroup.disciplineKey && AMBIGUOUS_DISCIPLINES.has(lpnGroup.disciplineKey))) {
      cards.push(
        buildSubjectCardDto(
          {
            presentationId: `lpn-ambiguous:${lpnGroup.disciplineKey ?? lpnGroup.groupKey}`,
            title: lpnGroup.displayName,
            classification: 'LPN_ONLY',
            rnSources: [],
            lpnSources: lpnGroup.sources,
            equivalence: {
              verified: false,
              status: 'AMBIGUOUS_SEPARATE',
              evidenceType: 'ambiguous-excluded-from-merge',
              disciplineKey: lpnGroup.disciplineKey ?? undefined,
            },
            ambiguityNotes: lpnGroup.ambiguityNotes,
          },
          examsBySubjectKey,
          options
        )
      );
      continue;
    }

    const sameDisciplineExistsInRn =
      Boolean(lpnGroup.disciplineKey) &&
      rnGroups.some((rg) => !rg.isExit && rg.disciplineKey === lpnGroup.disciplineKey);

    cards.push(
      buildSubjectCardDto(
        {
          presentationId: `lpn-only:${lpnGroup.disciplineKey ?? lpnGroup.sources[0].subjectGuidId ?? lpnGroup.sources[0].subjectId}`,
          title: lpnGroup.displayName,
          classification: 'LPN_ONLY',
          rnSources: [],
          lpnSources: lpnGroup.sources,
          equivalence: {
            verified: false,
            status: sameDisciplineExistsInRn ? 'UNVERIFIED_SEPARATE' : 'PROGRAM_EXCLUSIVE',
            evidenceType: sameDisciplineExistsInRn
              ? 'insufficient-equivalence-evidence'
              : 'single-program-exclusive',
            disciplineKey: lpnGroup.disciplineKey ?? undefined,
          },
          ambiguityNotes: lpnGroup.ambiguityNotes,
        },
        examsBySubjectKey,
        options
      )
    );
  }

  // Deterministic ordering: COMMON subjects first, then non-exit exclusives, then exit predictors
  cards.sort((a, b) => {
    const rank = (c: SubjectCardDto): number => {
      if (c.pathway === 'RN_Exit' || c.pathway === 'PN_Exit') return 3;
      if (c.classification === 'COMMON') return 0;
      if (c.classification === 'RN_ONLY') return 1;
      return 2;
    };
    const rDiff = rank(a) - rank(b);
    if (rDiff !== 0) return rDiff;
    const tDiff = a.title.localeCompare(b.title);
    if (tDiff !== 0) return tDiff;
    const pDiff = String(a.pathway).localeCompare(String(b.pathway));
    if (pDiff !== 0) return pDiff;
    return String(a.presentationId ?? a.id).localeCompare(String(b.presentationId ?? b.id));
  });

  return cards;
}

/**
 * Indexes an array of nominal/enriched exam records by lowercased subjectGuidId and subjectId.
 */
export function buildExamsBySubjectMap(exams: RawRecord[]): Map<string, RawRecord[]> {
  const map = new Map<string, RawRecord[]>();
  for (const ex of exams || []) {
    const keys: string[] = [];
    if (typeof ex.subjectGuidId === 'string' && ex.subjectGuidId.trim()) {
      keys.push(ex.subjectGuidId.trim().toLowerCase());
    }
    if (hasProvidedValue(ex.subjectId)) {
      keys.push(String(ex.subjectId).trim().toLowerCase());
    }
    for (const k of keys) {
      let arr = map.get(k);
      if (!arr) {
        arr = [];
        map.set(k, arr);
      }
      arr.push(ex);
    }
  }
  return map;
}

/**
 * Normalizes a pathway parameter string into one of the four authoritative nursing pathways or "All".
 */
export function normalizePathwayParam(raw?: string | null): NursingPathway | 'All' | null {
  if (!raw || typeof raw !== 'string') return null;
  const norm = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!norm) return null;
  if (norm === 'all') return 'All';
  if (norm === 'rn') return 'RN';
  if (norm === 'pnlpn' || norm === 'pn' || norm === 'lpn' || norm === 'lpnvn') return 'PN_LPN';
  if (norm === 'rnexit') return 'RN_Exit';
  if (norm === 'pnexit' || norm === 'lpnexit') return 'PN_Exit';
  return null;
}

/**
 * Human-readable full label for the four-way nursing pathway model and "All" state.
 */
export function formatPathwayLabel(pathway?: string | null): string {
  const normalized = normalizePathwayParam(pathway);
  switch (normalized) {
    case 'RN':
      return 'Registered Nursing (RN)';
    case 'PN_LPN':
      return 'Licensed Practical Nursing (LPN/PN)';
    case 'RN_Exit':
      return 'RN Exit Predictor';
    case 'PN_Exit':
      return 'LPN Exit Predictor';
    case 'All':
      return 'All Authorized Pathways';
    default:
      return typeof pathway === 'string' && pathway.trim()
        ? pathway.replace(/_/g, ' ').trim()
        : 'All Authorized Pathways';
  }
}

/**
 * Compact badge/chip label preserving distinctions across all four pathways.
 */
export function formatPathwayShortLabel(pathway?: string | null): string {
  const normalized = normalizePathwayParam(pathway);
  switch (normalized) {
    case 'RN':
      return 'RN';
    case 'PN_LPN':
      return 'LPN/PN';
    case 'RN_Exit':
      return 'RN Exit';
    case 'PN_Exit':
      return 'LPN Exit';
    case 'All':
      return 'All Pathways';
    default:
      return typeof pathway === 'string' && pathway.trim()
        ? pathway.replace(/_/g, ' ').trim()
        : 'All Pathways';
  }
}

/**
 * Returns the authorized program ID implied by a pathway parameter (or null for "All"/unknown).
 */
export function programIdForPathway(pathway?: string | null): AuthorizedProgramId | null {
  const normalized = normalizePathwayParam(pathway);
  if (normalized === 'RN' || normalized === 'RN_Exit') return RN_PROGRAM_ID;
  if (normalized === 'PN_LPN' || normalized === 'PN_Exit') return LPN_PROGRAM_ID;
  return null;
}

/**
 * Checks whether a pathway matches a requested pathway filter consistently.
 */
export function isPathwayMatch(actualPathway: string, requestedPathway: string): boolean {
  const reqNorm = normalizePathwayParam(requestedPathway);
  if (!reqNorm || reqNorm === 'All') return true;
  const actNorm = normalizePathwayParam(actualPathway);
  return actNorm === reqNorm;
}
