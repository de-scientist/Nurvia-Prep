import type {
  AuthorizedProgramId,
  AuthorizedSourceSubject,
  RawRecord,
} from '../study-library/curriculum-consolidation';
import {
  AUTHORIZED_PROGRAM_NAMES,
  buildCoursesByIdMap,
  buildProgramsByIdMap,
  filterAuthorizedCourses,
  filterAuthorizedPrograms,
  isEligibleExamStatus,
  parseStrictProgramId,
  partitionAuthorizedSubjects,
  resolveAuthoritativeExamProgramId,
} from '../study-library/curriculum-consolidation';
import { buildStrataEndpointPath, type StrataResourceKey } from './contracts';
import { lexmaCastoRequest, normalizeStrataEnvelope } from './client';
import type { CastoSessionCredentials, OptionalSiteMetadata } from './headers';

export interface AuthorizedStudyLibraryIndex {
  complete: boolean;
  fetchedAt: number;
  programs: RawRecord[];
  courses: RawRecord[];
  subjects: RawRecord[];
  rnSubjects: AuthorizedSourceSubject[];
  lpnSubjects: AuthorizedSourceSubject[];
  examsBySubjectGuid: Record<string, RawRecord[]>;
  allAuthorizedExams: RawRecord[];
  failedSubjectIds: string[];
  excludedSubjectCount: number;
  coursesById: Map<string, RawRecord>;
  programsById: Map<string, RawRecord>;
  subjectsByKey: Map<string, AuthorizedSourceSubject>;
  examsById: Map<string, RawRecord>;
}

const INDEX_CACHE_TTL_MS = 5 * 60 * 1000;
const SUBJECT_BATCH_SIZE = 16;

let cachedIndex: AuthorizedStudyLibraryIndex | null = null;
let cachedIndexTimestamp = 0;
let inFlightIndexPromise: Promise<AuthorizedStudyLibraryIndex> | null = null;

export function clearServerStudyLibraryIndexCache(): void {
  cachedIndex = null;
  cachedIndexTimestamp = 0;
  inFlightIndexPromise = null;
}

async function fetchAllAbsoluteResource(
  resource: Extract<StrataResourceKey, 'programs' | 'courses' | 'subjects'>,
  siteMeta?: OptionalSiteMetadata,
  session?: CastoSessionCredentials | null
): Promise<{ complete: boolean; items: RawRecord[] }> {
  const firstPath = buildStrataEndpointPath(resource, { page: 1, perPage: 250 }, 'absolute');
  const firstRes = await lexmaCastoRequest(firstPath, { method: 'GET', session, siteMeta });
  if (!firstRes.ok) {
    return { complete: false, items: [] };
  }

  const firstNorm = normalizeStrataEnvelope(firstRes.data);
  if (!firstNorm) {
    return { complete: false, items: [] };
  }

  const items: RawRecord[] = [...firstNorm.data.items];
  const totalPages = Math.max(1, Number(firstNorm.data.skewTotalPages || 1));
  let complete = true;

  if (totalPages > 1) {
    const restPromises = Array.from({ length: totalPages - 1 }, (_, idx) => {
      const page = idx + 2;
      const pagePath = buildStrataEndpointPath(resource, { page, perPage: 250 }, 'absolute');
      return lexmaCastoRequest(pagePath, { method: 'GET', session, siteMeta });
    });

    const restResults = await Promise.all(restPromises);
    for (const res of restResults) {
      if (!res.ok) {
        complete = false;
        continue;
      }
      const norm = normalizeStrataEnvelope(res.data);
      if (!norm) {
        complete = false;
        continue;
      }
      items.push(...norm.data.items);
    }
  }

  return { complete, items };
}

function enrichSubjectWithAuthoritativeOwnership(src: AuthorizedSourceSubject): RawRecord {
  return {
    ...src.raw,
    programId: src.programId,
    programName: src.programName,
    courseId: src.courseId ?? src.raw.courseId,
    courseGuidId: src.courseGuidId ?? src.raw.courseGuidId,
    courseName: src.courseName ?? src.raw.courseName,
    pathway: src.pathway,
  };
}

function enrichExamWithAuthoritativeOwnership(
  exam: RawRecord,
  subject: AuthorizedSourceSubject
): RawRecord {
  return {
    ...exam,
    programId: subject.programId,
    programName: subject.programName,
    courseId: exam.courseId ?? subject.courseId,
    courseGuidId: exam.courseGuidId ?? subject.courseGuidId,
    courseName: exam.courseName ?? subject.courseName,
    subjectId: exam.subjectId ?? subject.subjectId,
    subjectGuidId: exam.subjectGuidId ?? subject.subjectGuidId,
    subjectName: exam.subjectName ?? subject.rawName,
  };
}

async function fetchNominalExamsForSubject(
  subject: AuthorizedSourceSubject,
  siteMeta?: OptionalSiteMetadata,
  session?: CastoSessionCredentials | null
): Promise<{ complete: boolean; exams: RawRecord[] }> {
  const identifier = subject.subjectGuidId ?? subject.subjectId;
  const baseQuery = {
    identifier,
    dynamicLearningStrataName: 'subject',
    page: 1,
    perPage: 250,
  };
  const firstPath = buildStrataEndpointPath('exams', baseQuery, 'nominal');
  const firstRes = await lexmaCastoRequest(firstPath, { method: 'GET', session, siteMeta });
  if (!firstRes.ok) {
    return { complete: false, exams: [] };
  }

  const firstNorm = normalizeStrataEnvelope(firstRes.data);
  if (!firstNorm) {
    return { complete: false, exams: [] };
  }

  const rawItems: RawRecord[] = [...firstNorm.data.items];
  const totalPages = Math.max(1, Number(firstNorm.data.skewTotalPages || 1));
  let complete = true;

  if (totalPages > 1) {
    const pageResults = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) => {
        const page = idx + 2;
        const pagePath = buildStrataEndpointPath(
          'exams',
          { identifier, dynamicLearningStrataName: 'subject', page, perPage: 250 },
          'nominal'
        );
        return lexmaCastoRequest(pagePath, { method: 'GET', session, siteMeta });
      })
    );

    for (const res of pageResults) {
      if (!res.ok) {
        complete = false;
        continue;
      }
      const norm = normalizeStrataEnvelope(res.data);
      if (!norm) {
        complete = false;
        continue;
      }
      rawItems.push(...norm.data.items);
    }
  }

  const seen = new Set<string>();
  const verified: RawRecord[] = [];
  for (const item of rawItems) {
    if (!isEligibleExamStatus(item.status)) continue;

    // Fail closed if exam programId is missing or does not strictly match the subject's authorized programId
    if (parseStrictProgramId(item.programId) !== subject.programId) {
      continue;
    }

    // Fail closed if subject FK does not match
    const exSubGuid =
      typeof item.subjectGuidId === 'string' ? item.subjectGuidId.trim().toLowerCase() : '';
    const exSubId =
      item.subjectId !== undefined && item.subjectId !== null ? String(item.subjectId).trim() : '';
    if (
      (exSubGuid && subject.subjectGuidId && exSubGuid !== subject.subjectGuidId.toLowerCase()) ||
      (exSubId && exSubId !== subject.subjectId)
    ) {
      continue;
    }

    const dedupeKey = String(item.guidId ?? item.id ?? '').trim();
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    verified.push(enrichExamWithAuthoritativeOwnership(item, subject));
  }

  return { complete, exams: verified };
}

/**
 * Loads, verifies, and caches the authoritative {6, 9} Study Library curriculum index
 * using exact subject-parent nominal examination queries.
 * Partial/incomplete fetches are never cached as complete.
 */
export async function getAuthorizedStudyLibraryIndex(
  siteMeta?: OptionalSiteMetadata,
  session?: CastoSessionCredentials | null
): Promise<AuthorizedStudyLibraryIndex> {
  const now = Date.now();
  if (cachedIndex && cachedIndex.complete && now - cachedIndexTimestamp < INDEX_CACHE_TTL_MS) {
    return cachedIndex;
  }

  if (inFlightIndexPromise) {
    return inFlightIndexPromise;
  }

  inFlightIndexPromise = (async () => {
    try {
      const [progsRes, coursesRes, subsRes] = await Promise.all([
        fetchAllAbsoluteResource('programs', siteMeta, session),
        fetchAllAbsoluteResource('courses', siteMeta, session),
        fetchAllAbsoluteResource('subjects', siteMeta, session),
      ]);

      const authorizedPrograms = filterAuthorizedPrograms(progsRes.items);
      const authorizedCourses = filterAuthorizedCourses(coursesRes.items);

      const programsById = buildProgramsByIdMap(authorizedPrograms);
      // Pass ALL raw courses into resolveAuthoritativeSubjectProgramId so unauthorized courses
      // cause fail-closed exclusion rather than looking merely "unknown".
      const allCoursesById = buildCoursesByIdMap(coursesRes.items);

      const { rnSubjects, lpnSubjects, excludedCount } = partitionAuthorizedSubjects(
        subsRes.items,
        allCoursesById,
        programsById
      );

      const allAuthorizedSubjects = [...rnSubjects, ...lpnSubjects];
      const authorizedSubjectsByKey = new Map<string, AuthorizedSourceSubject>();
      for (const s of allAuthorizedSubjects) {
        authorizedSubjectsByKey.set(s.subjectId.toLowerCase(), s);
        if (s.subjectGuidId) {
          authorizedSubjectsByKey.set(s.subjectGuidId.toLowerCase(), s);
        }
      }

      const examsBySubjectGuid: Record<string, RawRecord[]> = {};
      const allAuthorizedExams: RawRecord[] = [];
      const globalSeenExamIds = new Set<string>();
      const examsById = new Map<string, RawRecord>();
      const failedSubjectIds: string[] = [];

      for (let i = 0; i < allAuthorizedSubjects.length; i += SUBJECT_BATCH_SIZE) {
        const batch = allAuthorizedSubjects.slice(i, i + SUBJECT_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (sub) => {
            const res = await fetchNominalExamsForSubject(sub, siteMeta, session);
            return { sub, res };
          })
        );

        for (const { sub, res } of batchResults) {
          const key = (sub.subjectGuidId ?? sub.subjectId).toLowerCase();
          if (!res.complete) {
            failedSubjectIds.push(key);
          }
          examsBySubjectGuid[key] = res.exams;
          for (const ex of res.exams) {
            const exGuid = typeof ex.guidId === 'string' ? ex.guidId.trim() : '';
            const exId = ex.id !== undefined && ex.id !== null ? String(ex.id).trim() : '';
            const dedupeKey = exGuid || exId;
            if (exGuid) examsById.set(exGuid.toLowerCase(), ex);
            if (exId) examsById.set(exId.toLowerCase(), ex);
            if (dedupeKey && !globalSeenExamIds.has(dedupeKey)) {
              globalSeenExamIds.add(dedupeKey);
              allAuthorizedExams.push(ex);
            }
          }
        }
      }

      const complete =
        progsRes.complete &&
        coursesRes.complete &&
        subsRes.complete &&
        failedSubjectIds.length === 0;

      const authorizedCoursesById = buildCoursesByIdMap(authorizedCourses);

      const index: AuthorizedStudyLibraryIndex = {
        complete,
        fetchedAt: Date.now(),
        programs: authorizedPrograms,
        courses: authorizedCourses,
        subjects: allAuthorizedSubjects.map(enrichSubjectWithAuthoritativeOwnership),
        rnSubjects,
        lpnSubjects,
        examsBySubjectGuid,
        allAuthorizedExams,
        failedSubjectIds,
        excludedSubjectCount: excludedCount,
        coursesById: authorizedCoursesById,
        programsById,
        subjectsByKey: authorizedSubjectsByKey,
        examsById,
      };

      if (complete) {
        cachedIndex = index;
        cachedIndexTimestamp = Date.now();
      }

      return index;
    } finally {
      inFlightIndexPromise = null;
    }
  })();

  return inFlightIndexPromise;
}

export type NominalValidationResult =
  | {
      authorized: true;
      programId: AuthorizedProgramId;
      programName: string;
      canonicalIdentifier: string;
      subjectId?: string;
      subjectGuidId?: string | null;
    }
  | {
      authorized: false;
      reason: string;
    };

/**
 * Verifies server-side that a nominal exam lookup (`program`, `course`, or `subject`)
 * targets ONLY an authorized LPN (6) or RN (9) entity. Fails closed otherwise.
 */
export async function verifyAuthorizedNominalTarget(
  level: 'program' | 'course' | 'subject',
  identifier: string,
  siteMeta?: OptionalSiteMetadata,
  session?: CastoSessionCredentials | null
): Promise<NominalValidationResult> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { authorized: false, reason: 'Target identifier is required.' };
  }

  const index = await getAuthorizedStudyLibraryIndex(siteMeta, session);
  const norm = trimmed.toLowerCase();

  if (level === 'program') {
    const strict = parseStrictProgramId(trimmed);
    if (strict !== null) {
      return {
        authorized: true,
        programId: strict,
        programName: AUTHORIZED_PROGRAM_NAMES[strict],
        canonicalIdentifier: String(strict),
      };
    }
    const prog = index.programsById.get(norm) ?? index.programsById.get(trimmed);
    const pid = prog ? parseStrictProgramId(prog.id) : null;
    if (pid !== null) {
      return {
        authorized: true,
        programId: pid,
        programName: AUTHORIZED_PROGRAM_NAMES[pid],
        canonicalIdentifier: typeof prog?.guidId === 'string' ? prog.guidId : String(pid),
      };
    }
    return {
      authorized: false,
      reason: 'Requested program is outside the authorized RN (9) and LPN (6) allowlist.',
    };
  }

  if (level === 'course') {
    const course = index.coursesById.get(norm) ?? index.coursesById.get(trimmed);
    const pid = course ? parseStrictProgramId(course.programId) : null;
    if (course && pid !== null) {
      return {
        authorized: true,
        programId: pid,
        programName: AUTHORIZED_PROGRAM_NAMES[pid],
        canonicalIdentifier:
          typeof course.guidId === 'string' && course.guidId.trim()
            ? course.guidId.trim()
            : String(course.id ?? trimmed),
      };
    }
    return {
      authorized: false,
      reason: 'Requested course is not owned by an authorized RN (9) or LPN (6) program.',
    };
  }

  const subject = index.subjectsByKey.get(norm);
  if (subject) {
    return {
      authorized: true,
      programId: subject.programId,
      programName: subject.programName,
      canonicalIdentifier: subject.subjectGuidId ?? subject.subjectId,
      subjectId: subject.subjectId,
      subjectGuidId: subject.subjectGuidId,
    };
  }

  return {
    authorized: false,
    reason: 'Requested subject is not owned by an authorized RN (9) or LPN (6) program.',
  };
}

/**
 * Checks whether a single exam record from `exams/list/current` belongs to the authorized
 * {6, 9} RN/LPN Study Library. Enriches with authoritative subject/course/program metadata
 * from the verified index when available.
 */
export function verifyAuthorizedStudySetExam(
  rawItem: RawRecord,
  index: AuthorizedStudyLibraryIndex
): { authorized: boolean; enriched: RawRecord | null; reason?: string } {
  const exGuid = typeof rawItem.guidId === 'string' ? rawItem.guidId.trim().toLowerCase() : '';
  const exId = rawItem.id !== undefined && rawItem.id !== null ? String(rawItem.id).trim().toLowerCase() : '';

  const indexed = (exGuid ? index.examsById.get(exGuid) : undefined) ?? (exId ? index.examsById.get(exId) : undefined);
  if (indexed) {
    return {
      authorized: true,
      enriched: {
        ...rawItem,
        programId: indexed.programId,
        programName: indexed.programName,
        courseId: rawItem.courseId ?? indexed.courseId,
        courseGuidId: rawItem.courseGuidId ?? indexed.courseGuidId,
        courseName: rawItem.courseName ?? indexed.courseName,
        subjectId: rawItem.subjectId ?? indexed.subjectId,
        subjectGuidId: rawItem.subjectGuidId ?? indexed.subjectGuidId,
        subjectName: rawItem.subjectName ?? indexed.subjectName,
      },
    };
  }

  // Not in verified nominal index: only allow if rawItem carries verifiable {6, 9} ownership
  // AND index is incomplete (if index is complete and exam isn't under any of the 109 authorized
  // subjects, reject unless programId is strictly 6 or 9 with consistent FKs).
  const resolvedProg = resolveAuthoritativeExamProgramId(
    rawItem,
    index.subjectsByKey,
    index.coursesById
  );
  if (resolvedProg === null) {
    return {
      authorized: false,
      enriched: null,
      reason: 'Examination belongs to an unauthorized or unverified program.',
    };
  }

  if (index.complete) {
    return {
      authorized: false,
      enriched: null,
      reason: 'Examination is not part of the verified RN/LPN subject catalog.',
    };
  }

  return {
    authorized: true,
    enriched: {
      ...rawItem,
      programId: resolvedProg,
      programName: rawItem.programName ?? AUTHORIZED_PROGRAM_NAMES[resolvedProg],
    },
  };
}
