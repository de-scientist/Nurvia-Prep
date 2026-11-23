import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        url: 'data:text/javascript,export default {};',
        shortCircuit: true,
      };
    }

    if (specifier.startsWith('@/')) {
      const base = path.resolve(repoRoot, 'src', specifier.slice(2));
      for (const ext of ['', '.ts', '.tsx', '.mjs', '.js']) {
        const candidate = ext ? `${base}${ext}` : base;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }

    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file://')
    ) {
      const parentDir = path.dirname(new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
      const base = path.resolve(parentDir, specifier);
      for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
        const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const filePath = new URL(url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
      const source = fs.readFileSync(filePath, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.Preserve,
          esModuleInterop: true,
        },
        fileName: filePath,
      });
      return { format: 'module', source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const consolidation = await import('../src/lib/study-library/curriculum-consolidation.ts');
const apiClient = await import('../src/lib/api-client.ts');
const studyLibraryIndex = await import('../src/lib/lexmacasto/study-library-index.ts');

const {
  LPN_PROGRAM_ID,
  RN_PROGRAM_ID,
  parseStrictProgramId,
  isUnauthorizedExamFamilyName,
  filterAuthorizedPrograms,
  filterAuthorizedCourses,
  buildCoursesByIdMap,
  buildProgramsByIdMap,
  resolveAuthoritativeSubjectProgramId,
  resolveAuthoritativeExamProgramId,
  partitionAuthorizedSubjects,
  consolidateRnAndLpnSubjects,
  lookupExamsForSourceSubject,
  buildExamsBySubjectMap,
  formatPathwayLabel,
  formatPathwayShortLabel,
  normalizePathwayParam,
  programIdForPathway,
  isPathwayMatch,
} = consolidation;

const {
  nurviaApi,
  classifyAuthoritativePathway,
  clearStudyLibraryCaches,
} = apiClient;

const {
  verifyAuthorizedNominalTarget,
  verifyAuthorizedStudySetExam,
  getAuthorizedStudyLibraryIndex,
  clearServerStudyLibraryIndexCache,
} = studyLibraryIndex;

function mockJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const val of Object.values(obj)) {
      deepFreeze(val);
    }
  }
  return obj;
}

console.log('=== STUDY LIBRARY SUBJECT CONSOLIDATION VERIFICATION SUITE ===');

// 1. Positive program allowlist {6, 9}
{
  assert.equal(parseStrictProgramId(6), 6);
  assert.equal(parseStrictProgramId('6'), 6);
  assert.equal(parseStrictProgramId(' 6 '), 6);
  assert.equal(parseStrictProgramId(9), 9);
  assert.equal(parseStrictProgramId('9'), 9);
  assert.equal(parseStrictProgramId(' 9 '), 9);

  for (const bad of [2, 3, 4, 5, 7, 8, 13, 0, -1, 6.5, NaN, Infinity, '', null, undefined, 'RN', 'LPN', '6;7', true, {}]) {
    assert.equal(parseStrictProgramId(bad), null, `Expected parseStrictProgramId(${String(bad)}) to fail closed`);
  }

  assert.equal(isUnauthorizedExamFamilyName('NCLEX-RN Readiness'), true);
  assert.equal(isUnauthorizedExamFamilyName('ATI TEAS 7 Science'), true);
  assert.equal(isUnauthorizedExamFamilyName('HESI A2 Reading'), true);
  assert.equal(isUnauthorizedExamFamilyName('ADULT HEALTH (LPN hesi)'), false);
  assert.equal(isUnauthorizedExamFamilyName('FUNDAMENTAL of Nursing (LPN hesi)'), false);

  const progs = filterAuthorizedPrograms([
    { id: 3, name: 'ATI TEAS' },
    { id: 5, name: 'HESI A2' },
    { id: 6, name: 'LPN Nursing Exams' },
    { id: 7, name: 'NCLEX PN' },
    { id: 8, name: 'NCLEX RN' },
    { id: 9, name: 'RN Nursing Exams' },
    { id: 13, name: 'EXPLICIT DYNAMIC SOLUTIONS' },
    { id: null, name: 'Ghost' },
  ]);
  assert.deepEqual(progs.map((p) => p.id), [6, 9]);

  const courses = filterAuthorizedCourses([
    { id: 21, programId: 6, name: 'ATI Practice Assessments (PN)' },
    { id: 34, programId: 9, name: 'ATI Practice Assessments (RN)' },
    { id: 40, programId: 7, name: 'NCLEX-PN Course' },
    { id: 41, programId: 2, name: 'ACCUPLACER Math' },
    { id: 42, programId: 4, name: 'GED Science' },
    { id: 43, name: 'Orphan Course Without Program' },
  ]);
  assert.deepEqual(courses.map((c) => c.id), [21, 34]);
  console.log('[PASS] 1. Positive program allowlist {6, 9} strictly rejects all unauthorized/malformed IDs');
}

// 2. Fail-closed subject and exam program resolution
{
  const coursesById = buildCoursesByIdMap([
    { id: 21, guidId: 'c-21', programId: 6, name: 'ATI Practice Assessments (PN)' },
    { id: 34, guidId: 'c-34', programId: 9, name: 'ATI Practice Assessments (RN)' },
    { id: 50, guidId: 'c-50', programId: 7, name: 'NCLEX PN Course' },
  ]);
  const subjectsByKey = new Map([
    ['sub-rn-1', { programId: RN_PROGRAM_ID }],
    ['101', { programId: RN_PROGRAM_ID }],
  ]);

  assert.equal(resolveAuthoritativeSubjectProgramId({ id: 1, name: 'Pharmacology' }, coursesById), null);
  assert.equal(resolveAuthoritativeSubjectProgramId({ id: 2, name: 'Unknown', courseId: 999 }, coursesById), null);
  assert.equal(resolveAuthoritativeSubjectProgramId({ id: 3, name: 'Psychosocial Integrity', courseId: 50 }, coursesById), null);
  assert.equal(resolveAuthoritativeSubjectProgramId({ id: 4, name: 'Conflict', courseId: 21, programId: 9 }, coursesById), null);
  assert.equal(resolveAuthoritativeSubjectProgramId({ id: 81, name: 'ADULT HEALTH (LPN hesi)', courseId: 21 }, coursesById), 6);

  assert.equal(resolveAuthoritativeExamProgramId({ id: 'e1' }, subjectsByKey, coursesById), null);
  assert.equal(resolveAuthoritativeExamProgramId({ id: 'e2', programId: 6, subjectGuidId: 'sub-rn-1' }, subjectsByKey, coursesById), null);
  assert.equal(resolveAuthoritativeExamProgramId({ id: 'e3', programId: 9, subjectGuidId: 'sub-rn-1', courseId: 34 }, subjectsByKey, coursesById), 9);
  console.log('[PASS] 2. Fail-closed resolution rejects missing, corrupt, unknown, and conflicting ownership');
}

// 3. Disjoint RN/LPN partitioning without mutating source objects
{
  const programs = [{ id: 6, name: 'LPN Nursing Exams' }, { id: 9, name: 'RN Nursing Exams' }, { id: 7, name: 'NCLEX PN' }];
  const courses = [
    { id: 21, guidId: 'c-ati-pn', programId: 6, name: 'ATI Practice Assessments (PN)' },
    { id: 34, guidId: 'c-ati-rn', programId: 9, name: 'ATI Practice Assessments (RN)' },
    { id: 99, guidId: 'c-nclex', programId: 7, name: 'NCLEX-PN Review' },
  ];
  const rawSubjects = deepFreeze([
    {
      id: 50,
      guidId: 'sub-lpn-50',
      courseId: 21,
      name: 'Pharmacology (LPN)',
      description: 'Contains ATI Prep resources for RN.',
    },
    {
      id: 150,
      guidId: 'sub-rn-150',
      courseId: 34,
      name: 'Pharmacology (RN)',
      description: 'RN pharmacology prep.',
    },
    {
      id: 188,
      guidId: 'sub-nclex-188',
      courseId: 99,
      name: 'Safety and Infection Control',
    },
  ]);

  const res = partitionAuthorizedSubjects(rawSubjects, buildCoursesByIdMap(courses), buildProgramsByIdMap(programs));
  assert.equal(res.rnSubjects.length, 1);
  assert.equal(res.lpnSubjects.length, 1);
  assert.equal(res.excludedCount, 1);
  assert.equal(res.rnSubjects[0].programId, 9);
  assert.equal(res.lpnSubjects[0].programId, 6);
  // Description copy-paste "for RN" MUST NOT flip LPN subject pathway!
  assert.equal(res.lpnSubjects[0].pathway, 'PN_LPN');
  console.log('[PASS] 3. Disjoint partitioning preserves immutability and ignores misleading description text');
}

// 4, 5, 6, 7, 8, 9. Consolidation rules, ambiguity separation, exit isolation, Foundation vs Fundamentals, FK counts
{
  const programs = buildProgramsByIdMap([
    { id: 6, name: 'LPN Nursing Exams' },
    { id: 9, name: 'RN Nursing Exams' },
  ]);
  const allCourses = buildCoursesByIdMap([
    { id: 34, guidId: 'c-ati-rn', programId: 9, name: 'ATI Practice Assessments (RN)' },
    { id: 21, guidId: 'c-ati-pn', programId: 6, name: 'ATI Practice Assessments (PN)' },
    { id: 35, guidId: 'c-rhem-rn', programId: 9, name: 'Rhemplify Nursing RN' },
    { id: 22, guidId: 'c-rhem-pn', programId: 6, name: 'Rhemplify Nursing PN' },
    { id: 39, guidId: 'c-hesi-rn', programId: 9, name: 'HESI Specialty RN' },
    { id: 25, guidId: 'c-hesi-pn', programId: 6, name: 'HESI Specialty PN' },
    { id: 36, guidId: 'c-gen-rn', programId: 9, name: 'General Nursing RN' },
    { id: 23, guidId: 'c-kap-pn', programId: 6, name: 'Kaplan Nursing PN' },
    { id: 37, guidId: 'c-exit-ati-rn', programId: 9, name: 'ATI RN Exit Exam' },
    { id: 24, guidId: 'c-exit-ati-pn', programId: 6, name: 'ATI PN Exit Exam' },
  ]);

  const rawSubjects = [
    // Common via ATI parallel series
    { id: 101, guidId: 'sub-rn-pharm-ati', courseId: 34, name: 'Pharmacology (RN)' },
    { id: 102, guidId: 'sub-rn-pharm-rhem', courseId: 35, name: 'Pharmacology-RN' },
    { id: 201, guidId: 'sub-pn-pharm-ati', courseId: 21, name: 'Pharmacology (LPN)' },
    // Tier 1 explicit equivalenceId even in General/Kaplan
    { id: 103, guidId: 'sub-rn-eq', courseId: 36, name: 'Adult Medical Specialty', equivalenceId: 'EQ-ADULT-SPEC' },
    { id: 203, guidId: 'sub-pn-eq', courseId: 23, name: 'LPN Adult Care Specialty', equivalenceId: 'EQ-ADULT-SPEC' },
    // Same discipline (Nutrition) in General vs Kaplan WITHOUT parallel series or equivalenceId -> MUST NOT MERGE
    { id: 104, guidId: 'sub-rn-nutr', courseId: 36, name: 'Nutrition (RN)' },
    { id: 204, guidId: 'sub-pn-nutr', courseId: 23, name: 'Nutrition (LPN)' },
    // Ambiguous Maternal OB in shared ATI series -> MUST NOT MERGE
    { id: 105, guidId: 'sub-rn-ob', courseId: 34, name: 'Maternal & Newborn Nursing' },
    { id: 205, guidId: 'sub-pn-ob', courseId: 21, name: 'Maternal Newborn LPN' },
    // Foundation of Nursing vs Fundamentals of Nursing -> MUST STAY DISTINCT
    { id: 174, guidId: 'sub-rn-foundn', courseId: 39, name: 'Foundation of Nursing-RN' },
    { id: 175, guidId: 'sub-rn-fund', courseId: 39, name: 'Fundamentals of Nursing-RN' },
    { id: 275, guidId: 'sub-pn-fund', courseId: 25, name: 'Fundamentals of Nursing (LPN)' },
    // Zero-exam exclusive subject -> MUST NOT fabricate || 4 or || 50
    { id: 106, guidId: 'sub-rn-empty', courseId: 36, name: 'Critical Care Simulation' },
    // Exit predictors -> strictly isolated
    { id: 199, guidId: 'sub-rn-exit', courseId: 37, name: 'RN Comprehensive Predictor' },
    { id: 299, guidId: 'sub-pn-exit', courseId: 24, name: 'PN Comprehensive Predictor' },
  ];

  const examFixtures = [
    { id: 1, guidId: 'ex-rn-p1', programId: 9, subjectId: 101, subjectGuidId: 'sub-rn-pharm-ati', title: 'RN Pharm ATI 1', questionsCount: 30, status: 'Active' },
    { id: 2, guidId: 'ex-rn-p2', programId: 9, subjectId: 102, subjectGuidId: 'sub-rn-pharm-rhem', title: 'RN Pharm Rhem 1', questionsCount: 25, status: 'Published' },
    { id: 3, guidId: 'ex-pn-p1', programId: 6, subjectId: 201, subjectGuidId: 'sub-pn-pharm-ati', title: 'LPN Pharm ATI 1', questionsCount: 20, status: 'Active' },
    // Cross-program hijack attempt inside LPN key -> must be ignored!
    { id: 4, guidId: 'ex-hijack', programId: 9, subjectId: 201, subjectGuidId: 'sub-pn-pharm-ati', title: 'Cross Program Hijack', questionsCount: 99, status: 'Active' },
    // Draft exam -> must be ignored!
    { id: 5, guidId: 'ex-draft', programId: 6, subjectId: 201, subjectGuidId: 'sub-pn-pharm-ati', title: 'Draft Exam', questionsCount: 40, status: 'Draft' },
    { id: 6, guidId: 'ex-rn-exit', programId: 9, subjectId: 199, subjectGuidId: 'sub-rn-exit', title: 'RN Exit Predictor A', questionsCount: 150, status: 'Active' },
    { id: 7, guidId: 'ex-pn-exit', programId: 6, subjectId: 299, subjectGuidId: 'sub-pn-exit', title: 'PN Exit Predictor A', questionsCount: 150, status: 'Active' },
  ];

  const { rnSubjects, lpnSubjects } = partitionAuthorizedSubjects(rawSubjects, allCourses, programs);
  const examsBySubject = buildExamsBySubjectMap(examFixtures);
  // Also simulate hijack directly in LPN GUID bucket
  examsBySubject.get('sub-pn-pharm-ati').push({
    id: 404,
    guidId: 'ex-cross-bucket',
    programId: 9,
    subjectGuidId: 'sub-pn-pharm-ati',
    title: 'Sneaky RN Exam in LPN Bucket',
    questionsCount: 50,
    status: 'Active',
  });

  const cards = consolidateRnAndLpnSubjects(rnSubjects, lpnSubjects, examsBySubject, {
    examIndexComplete: true,
  });

  const pharmCard = cards.find((c) => c.title === 'Pharmacology');
  assert.ok(pharmCard);
  assert.equal(pharmCard.classification, 'COMMON');
  assert.equal(pharmCard.equivalence?.verified, true);
  assert.equal(pharmCard.equivalence?.evidenceType, 'parallel-curriculum-series-and-metadata');
  assert.deepEqual(pharmCard.availablePathways, ['RN', 'PN_LPN']);
  assert.equal(pharmCard.rnExamCount, 2);
  assert.equal(pharmCard.pnExamCount, 1);
  assert.equal(pharmCard.totalExams, 3);
  assert.equal(pharmCard.totalQuestions, 75);
  assert.equal(pharmCard.sourceSubjects.rn.length, 2);
  assert.equal(pharmCard.sourceSubjects.lpn.length, 1);
  assert.equal(pharmCard.sourceSubjects.rn[0].subjectGuidId, 'sub-rn-pharm-ati');
  assert.equal(pharmCard.sourceSubjects.lpn[0].subjectGuidId, 'sub-pn-pharm-ati');

  const eqCard = cards.find((c) => c.equivalence?.evidenceReference === 'equivalenceId:EQ-ADULT-SPEC');
  assert.ok(eqCard);
  assert.equal(eqCard.classification, 'COMMON');
  assert.equal(eqCard.equivalence?.evidenceType, 'authoritative-equivalence-id');

  const nutrCards = cards.filter((c) => c.title === 'Nutrition');
  assert.equal(nutrCards.length, 2, 'Nutrition without parallel series or equivalenceId must NOT merge');
  assert.ok(nutrCards.every((c) => c.classification !== 'COMMON'));
  assert.ok(nutrCards.every((c) => c.equivalence?.status === 'UNVERIFIED_SEPARATE'));

  const obCards = cards.filter((c) => c.title.includes('Maternal'));
  assert.equal(obCards.length, 2, 'Maternal & Newborn OB must remain separate across RN and LPN');
  assert.ok(obCards.every((c) => c.equivalence?.status === 'AMBIGUOUS_SEPARATE'));
  assert.ok(obCards.every((c) => (c.ambiguityNotes?.length ?? 0) > 0));

  const foundationCard = cards.find((c) => c.title === 'Foundation of Nursing');
  const fundamentalsCard = cards.find((c) => c.title === 'Fundamentals of Nursing');
  assert.ok(foundationCard && fundamentalsCard);
  assert.equal(foundationCard.classification, 'RN_ONLY');
  assert.equal(fundamentalsCard.classification, 'COMMON');

  const emptyCard = cards.find((c) => c.title === 'Critical Care Simulation');
  assert.ok(emptyCard);
  assert.equal(emptyCard.totalExams, 0, 'Must NOT fabricate default 4 exams');
  assert.equal(emptyCard.totalQuestions, 0, 'Must NOT fabricate default questions');

  const rnExitCard = cards.find((c) => c.pathway === 'RN_Exit');
  const pnExitCard = cards.find((c) => c.pathway === 'PN_Exit');
  assert.ok(rnExitCard && pnExitCard);
  assert.deepEqual(rnExitCard.availablePathways, ['RN_Exit']);
  assert.deepEqual(pnExitCard.availablePathways, ['PN_Exit']);
  assert.equal(rnExitCard.equivalence?.evidenceType, 'exit-pathway-isolated');
  assert.equal(pnExitCard.equivalence?.evidenceType, 'exit-pathway-isolated');

  // Verify partial index marks examCountsVerified = false
  const partialCards = consolidateRnAndLpnSubjects(rnSubjects, lpnSubjects, examsBySubject, {
    examIndexComplete: false,
    failedSubjectIds: new Set(['sub-rn-pharm-ati']),
  });
  assert.equal(partialCards.find((c) => c.title === 'Pharmacology')?.examCountsVerified, false);

  // Direct lookup guard rejects wrong subject GUID
  const directLookup = lookupExamsForSourceSubject(rnSubjects[0], examsBySubject);
  assert.equal(directLookup.length, 1);
  assert.equal(directLookup[0].guidId, 'ex-rn-p1');

  console.log('[PASS] 4-9. Consolidation rules, OB ambiguity, Exit isolation, Foundation vs Fundamentals, and FK counts verified');
}

// 10, 11, 12, 17. Client api-client pipeline (Path A nominal routing, fail closed, cache isolation, filters/summary)
{
  const origFetch = globalThis.fetch;
  try {
    clearStudyLibraryCaches();

    const mockIndexPayload = {
      success: true,
      message: 'OK',
      data: {
        complete: true,
        fetchedAt: Date.now(),
        programs: [
          { id: 6, name: 'LPN Nursing Exams' },
          { id: 9, name: 'RN Nursing Exams' },
        ],
        courses: [
          { id: 21, guidId: 'c-21', programId: 6, name: 'ATI Practice Assessments (PN)' },
          { id: 34, guidId: 'c-34', programId: 9, name: 'ATI Practice Assessments (RN)' },
          { id: 37, guidId: 'c-37', programId: 9, name: 'ATI RN Exit Exam' },
        ],
        subjects: [
          { id: 101, guidId: 'sub-rn-pharm', courseId: 34, courseName: 'ATI Practice Assessments (RN)', programId: 9, programName: 'RN Nursing Exams', name: 'Pharmacology (RN)' },
          { id: 201, guidId: 'sub-pn-pharm', courseId: 21, courseName: 'ATI Practice Assessments (PN)', programId: 6, programName: 'LPN Nursing Exams', name: 'Pharmacology (LPN)' },
          { id: 199, guidId: 'sub-rn-exit', courseId: 37, courseName: 'ATI RN Exit Exam', programId: 9, programName: 'RN Nursing Exams', name: 'RN ATI Exit' },
        ],
        examsBySubjectGuid: {
          'sub-rn-pharm': [
            { id: 9001, guidId: 'ex-rn-pharm-1', programId: 9, subjectId: 101, subjectGuidId: 'sub-rn-pharm', courseId: 34, courseName: 'ATI Practice Assessments (RN)', title: 'Pharmacology RN Practice 1', questionsCount: 45, status: 'Active' },
          ],
          'sub-pn-pharm': [
            { id: 6001, guidId: 'ex-pn-pharm-1', programId: 6, subjectId: 201, subjectGuidId: 'sub-pn-pharm', courseId: 21, courseName: 'ATI Practice Assessments (PN)', title: 'Pharmacology LPN Practice 1', questionsCount: 35, status: 'Published' },
          ],
          'sub-rn-exit': [
            { id: 9099, guidId: 'ex-rn-exit-1', programId: 9, subjectId: 199, subjectGuidId: 'sub-rn-exit', courseId: 37, courseName: 'ATI RN Exit Exam', title: 'Comprehensive Predictor', questionsCount: 150, status: 'Active' },
          ],
        },
        failedSubjectIds: [],
      },
    };

    const fetchedUrls = [];
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      fetchedUrls.push(urlStr);
      if (urlStr.includes('/api/strata/curriculum-index')) {
        return mockJsonResponse(mockIndexPayload);
      }
      if (urlStr.includes('/api/strata/schools')) {
        return mockJsonResponse({ success: true, data: { items: [], skewTotalPages: 1 } });
      }
      if (urlStr.includes('/api/strata/topics')) {
        return mockJsonResponse({ success: true, data: { items: [], skewTotalPages: 1 } });
      }
      if (urlStr.includes('/api/strata/sections')) {
        return mockJsonResponse({ success: true, data: { items: [], skewTotalPages: 1 } });
      }
      if (urlStr.includes('/api/strata/exams')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              ...mockIndexPayload.data.examsBySubjectGuid['sub-rn-pharm'],
              ...mockIndexPayload.data.examsBySubjectGuid['sub-pn-pharm'],
            ],
            skewTotalPages: 1,
          },
        });
      }
      return mockJsonResponse({ success: false, message: 'Unhandled mock URL' }, 404);
    };

    // Subjects consolidation
    const subjRes = await nurviaApi.getStudyLibrarySubjects({ pageNumber: 1, pageSize: 12 });
    assert.equal(subjRes.success, true);
    const pharm = subjRes.data.items.find((s) => s.title === 'Pharmacology');
    assert.ok(pharm);
    assert.equal(pharm.classification, 'COMMON');
    assert.equal(pharm.rnExamCount, 1);
    assert.equal(pharm.pnExamCount, 1);
    assert.equal(pharm.totalExams, 2);

    // Path A: Selecting ONLY LPN source GUID returns ONLY LPN exam
    const lpnExamsRes = await nurviaApi.getStudyLibrary({
      pathway: 'PN_LPN',
      programId: 6,
      subjectIds: pharm.sourceSubjects.lpn.map((s) => s.subjectGuidId).join(','),
    });
    assert.equal(lpnExamsRes.data.totalCount, 1);
    assert.equal(lpnExamsRes.data.items[0].id, 'ex-pn-pharm-1');
    assert.equal(lpnExamsRes.data.items[0].programId, 6);
    assert.equal(lpnExamsRes.data.items[0].subjectGuidId, 'sub-pn-pharm');

    // Path A: Selecting ONLY RN source GUID returns ONLY RN exam
    const rnExamsRes = await nurviaApi.getStudyLibrary({
      pathway: 'RN',
      programId: 9,
      subjectIds: pharm.sourceSubjects.rn.map((s) => s.subjectGuidId).join(','),
    });
    assert.equal(rnExamsRes.data.totalCount, 1);
    assert.equal(rnExamsRes.data.items[0].id, 'ex-rn-pharm-1');
    assert.equal(rnExamsRes.data.items[0].programId, 9);

    // Path B: Subject name + LPN pathway stays strictly LPN
    const pathBRes = await nurviaApi.getStudyLibrary({
      subject: 'Pharmacology',
      pathway: 'PN_LPN',
    });
    assert.equal(pathBRes.data.totalCount, 1);
    assert.equal(pathBRes.data.items[0].id, 'ex-pn-pharm-1');

    // Fail-closed unauthorized & conflicting filters
    assert.equal((await nurviaApi.getStudyLibrary({ programId: '7' })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrary({ programId: 'bad' })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrary({ program: 'NCLEX-RN' })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrary({ pathway: 'RN', programId: 6 })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrary({ pathway: 'TEAS' })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrary({ subjectIds: 'unauthorized-nclex-id' })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrarySubjects({ programId: 7 })).data.totalCount, 0);
    assert.equal((await nurviaApi.getStudyLibrarySubjects({ program: 'ATI TEAS' })).data.totalCount, 0);

    // Filters & Summary report truthful counts (zero 1555/77750/fallback)
    const filtersRes = await nurviaApi.getStudyLibraryFilters();
    assert.deepEqual(filtersRes.data.programs.map((p) => Number(p.id)).sort(), [6, 9]);
    assert.deepEqual(filtersRes.data.pathways, ['RN', 'PN_LPN', 'RN_Exit', 'PN_Exit']);
    assert.equal(filtersRes.data.schools.length, 0);

    const summaryRes = await nurviaApi.getStudyLibrarySummary();
    assert.equal(summaryRes.data.totalPublishedStudySets, 3);
    assert.equal(summaryRes.data.totalAvailableQuestions, 230);
    assert.equal(summaryRes.data.totalPathways, 3);

    // Partial page 2 failure is NEVER cached in fetchAllStrataExams
    clearStudyLibraryCaches();
    let p2FailOnce = true;
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [{ id: 1, guidId: 'ex-1', programId: 9, title: 'RN Exam 1' }],
            skewTotalPages: 2,
          },
        });
      }
      if (urlStr.includes('page=2')) {
        if (p2FailOnce) {
          p2FailOnce = false;
          return mockJsonResponse({ success: false, message: 'Server error' }, 500);
        }
        return mockJsonResponse({
          success: true,
          data: {
            items: [{ id: 2, guidId: 'ex-2', programId: 6, title: 'LPN Exam 2' }],
            skewTotalPages: 2,
          },
        });
      }
      return mockJsonResponse({ success: false }, 404);
    };

    const firstAttempt = await nurviaApi.fetchAllStrataExams({ scope: 'learner' });
    assert.equal(firstAttempt.length, 1);
    const secondAttempt = await nurviaApi.fetchAllStrataExams({ scope: 'learner' });
    assert.equal(secondAttempt.length, 2, 'Partial multi-page fetch must not have been cached');

    console.log('[PASS] 10-12 & 17. Client Path A/B routing, fail-closed guards, truthful summary/filters, and partial-cache protection verified');
  } finally {
    globalThis.fetch = origFetch;
    clearStudyLibraryCaches();
  }
}

// 13. 4-Way pathway classification & overriding bogus assessmentId
{
  const bogusRnExam = {
    id: 500,
    programId: 9,
    assessmentId: 10,
    assessmentName: 'LPN Exit Exams',
    courseName: 'ATI Practice Assessments (RN)',
    subjectName: 'Pharmacology (RN)',
    title: 'Pharmacology RN Set',
  };
  const rnClass = classifyAuthoritativePathway(bogusRnExam);
  assert.equal(rnClass.eligible, true);
  assert.equal(rnClass.pathway, 'RN');

  const lpnExam = {
    id: 600,
    programId: 6,
    assessmentId: 6,
    assessmentName: 'NCLEX PN GROUP',
    courseName: 'ATI Practice Assessments (PN)',
    subjectName: 'Fundamentals (LPN)',
    title: 'Fundamentals LPN Set',
  };
  const lpnClass = classifyAuthoritativePathway(lpnExam);
  assert.equal(lpnClass.eligible, true);
  assert.equal(lpnClass.pathway, 'PN_LPN');

  assert.equal(classifyAuthoritativePathway({ id: 700, programId: 7, title: 'NCLEX PN Exam' }).eligible, false);
  assert.equal(classifyAuthoritativePathway({ id: 701, title: 'Orphan Unowned Exam' }).eligible, false);
  assert.equal(classifyAuthoritativePathway({ id: 702, programId: 9, pathway: 'PN_LPN', title: 'Mismatch' }).eligible, false);
  console.log('[PASS] 13. 4-way classifier respects authoritative programId and fails closed on unowned/conflicting records');
}

// 14 & 15 & 18. Formatting helpers & UI/page/search source contracts
{
  assert.equal(normalizePathwayParam('pn'), 'PN_LPN');
  assert.equal(normalizePathwayParam('RN_Exit'), 'RN_Exit');
  assert.equal(normalizePathwayParam('invalid'), null);
  assert.equal(programIdForPathway('RN'), 9);
  assert.equal(programIdForPathway('RN_Exit'), 9);
  assert.equal(programIdForPathway('PN_LPN'), 6);
  assert.equal(programIdForPathway('PN_Exit'), 6);
  assert.equal(isPathwayMatch('RN_Exit', 'RN'), false);
  assert.equal(isPathwayMatch('RN', 'RN'), true);

  assert.equal(formatPathwayLabel('RN'), 'Registered Nursing (RN)');
  assert.equal(formatPathwayLabel('PN_LPN'), 'Licensed Practical Nursing (LPN/PN)');
  assert.equal(formatPathwayLabel('RN_Exit'), 'RN Exit Predictor');
  assert.equal(formatPathwayLabel('PN_Exit'), 'LPN Exit Predictor');
  assert.equal(formatPathwayShortLabel('PN_LPN'), 'LPN/PN');
  assert.equal(formatPathwayShortLabel('RN_Exit'), 'RN Exit');

  const headerSrc = fs.readFileSync(path.join(repoRoot, 'src/components/study/StudyLibraryHeader.tsx'), 'utf8');
  assert.ok(headerSrc.includes('formatPathwayLabel'), 'Header must format selected pathway cleanly');
  assert.equal(headerSrc.includes('(RN)'), false, 'Header must not append hardcoded (RN)');

  const examsPageSrc = fs.readFileSync(path.join(repoRoot, 'src/app/learner/exams/page.tsx'), 'utf8');
  assert.ok(examsPageSrc.includes('formatPathwayShortLabel'), '/learner/exams must use formatPathwayShortLabel');
  assert.equal(examsPageSrc.includes('TEAS'), false, '/learner/exams must not advertise excluded TEAS family');

  const learnerPageSrc = fs.readFileSync(path.join(repoRoot, 'src/app/learner/page.tsx'), 'utf8');
  assert.equal(learnerPageSrc.includes('1555'), false, '/learner page must not contain fabricated 1555 count');
  assert.ok(learnerPageSrc.includes('onSelectSubjectSource'), '/learner page must pass onSelectSubjectSource');

  const cardSrc = fs.readFileSync(path.join(repoRoot, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.equal(cardSrc.includes(': ["RN", "PN_LPN"]'), false, 'SubjectCard must not invent ["RN", "PN_LPN"] fallback');
  assert.ok(cardSrc.includes('export interface SubjectSelectionContext'));
  assert.ok(cardSrc.includes('onSelectSubjectSource'));

  const viewSrc = fs.readFileSync(path.join(repoRoot, 'src/components/study/study-library-view.tsx'), 'utf8');
  assert.ok(viewSrc.includes('selectedSubjectIds'));
  assert.ok(viewSrc.includes('selectedProgramId'));
  assert.ok(viewSrc.includes('params.set("subjectIds"'));
  assert.ok(viewSrc.includes('params.set("programId"'));

  const advSrc = fs.readFileSync(path.join(repoRoot, 'src/components/study/StudyLibraryAdvancedFilters.tsx'), 'utf8');
  assert.ok(advSrc.includes('isPathwayMatch'));

  const searchSrc = fs.readFileSync(path.join(repoRoot, 'src/lib/search/search-service.ts'), 'utf8');
  assert.ok(searchSrc.includes('isUnauthorizedExamFamilyName') || !searchSrc.includes('NCLEX-RN'));

  console.log('[PASS] 14, 15, 18. Formatting helpers & UI/route/search contracts verified');
}

// 16. Server-side study-library-index nominal & single-exam authorization guards
{
  const origFetch = globalThis.fetch;
  const origEnv = {
    SKEW_LINE_ACTIVE_BACKEND: process.env.SKEW_LINE_ACTIVE_BACKEND,
    SKEW_LINE_DOTNET_BASE_URL: process.env.SKEW_LINE_DOTNET_BASE_URL,
    SKEW_LINE_APP_KEY: process.env.SKEW_LINE_APP_KEY,
    SKEW_LINE_APP_DOMAIN: process.env.SKEW_LINE_APP_DOMAIN,
  };
  try {
    process.env.SKEW_LINE_ACTIVE_BACKEND = 'dotnet';
    process.env.SKEW_LINE_DOTNET_BASE_URL = 'https://mock-backend.nurvia.test';
    process.env.SKEW_LINE_APP_KEY = 'test-app-key-for-mock-suite';
    process.env.SKEW_LINE_APP_DOMAIN = 'nurvia.test';

    clearServerStudyLibraryIndexCache();
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('programs')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              { id: 6, guidId: 'p-6', name: 'LPN Nursing Exams' },
              { id: 7, guidId: 'p-7', name: 'NCLEX PN' },
              { id: 9, guidId: 'p-9', name: 'RN Nursing Exams' },
            ],
            skewTotalPages: 1,
          },
        });
      }
      if (u.includes('courses')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              { id: 21, guidId: 'c-21', programId: 6, name: 'ATI Practice Assessments (PN)' },
              { id: 34, guidId: 'c-34', programId: 9, name: 'ATI Practice Assessments (RN)' },
              { id: 40, guidId: 'c-40', programId: 7, name: 'NCLEX PN Course' },
            ],
            skewTotalPages: 1,
          },
        });
      }
      if (u.includes('subjects')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              { id: 101, guidId: 'sub-rn-101', courseId: 34, name: 'Pharmacology (RN)' },
              { id: 201, guidId: 'sub-pn-201', courseId: 21, name: 'Pharmacology (LPN)' },
              { id: 188, guidId: 'sub-nclex-188', courseId: 40, name: 'Psychosocial Integrity' },
            ],
            skewTotalPages: 1,
          },
        });
      }
      if (u.includes('sub-rn-101')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              { id: 901, guidId: 'ex-rn-901', programId: 9, subjectId: 101, subjectGuidId: 'sub-rn-101', title: 'Valid RN Pharm Exam', status: 'Active' },
              { id: 902, guidId: 'ex-bad-902', programId: 6, subjectId: 101, subjectGuidId: 'sub-rn-101', title: 'Cross-Program Leak', status: 'Active' },
            ],
            skewTotalPages: 1,
          },
        });
      }
      if (u.includes('sub-pn-201')) {
        return mockJsonResponse({
          success: true,
          data: {
            items: [
              { id: 601, guidId: 'ex-pn-601', programId: 6, subjectId: 201, subjectGuidId: 'sub-pn-201', title: 'Valid LPN Pharm Exam', status: 'Published' },
            ],
            skewTotalPages: 1,
          },
        });
      }
      return mockJsonResponse({ success: true, data: { items: [], skewTotalPages: 1 } });
    };

    const index = await getAuthorizedStudyLibraryIndex();
    assert.equal(index.complete, true);
    assert.equal(index.excludedSubjectCount, 1);
    assert.equal(index.allAuthorizedExams.length, 2, 'Cross-program leak ex-bad-902 must be filtered out');

    assert.equal((await verifyAuthorizedNominalTarget('program', '7')).authorized, false);
    assert.equal((await verifyAuthorizedNominalTarget('course', 'c-40')).authorized, false);
    assert.equal((await verifyAuthorizedNominalTarget('subject', 'sub-nclex-188')).authorized, false);
    assert.equal((await verifyAuthorizedNominalTarget('subject', '188')).authorized, false);

    const validTarget = await verifyAuthorizedNominalTarget('subject', 'sub-pn-201');
    assert.equal(validTarget.authorized, true);
    assert.equal(validTarget.programId, 6);
    assert.equal(validTarget.subjectId, '201');
    assert.equal(validTarget.subjectGuidId, 'sub-pn-201');

    const deniedDetail = verifyAuthorizedStudySetExam({ id: 777, guidId: 'ex-nclex-777', programId: 7 }, index);
    assert.equal(deniedDetail.authorized, false);

    const allowedDetail = verifyAuthorizedStudySetExam({ id: 601, guidId: 'ex-pn-601', title: 'Valid LPN Pharm Exam' }, index);
    assert.equal(allowedDetail.authorized, true);
    assert.equal(allowedDetail.enriched?.programId, 6);
    assert.equal(allowedDetail.enriched?.subjectGuidId, 'sub-pn-201');

    console.log('[PASS] 16. Server-side study-library-index nominal & single-exam authorization guards verified');
  } finally {
    globalThis.fetch = origFetch;
    clearServerStudyLibraryIndexCache();
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

console.log('\nALL STUDY LIBRARY SUBJECT CONSOLIDATION TESTS PASSED!');
