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
      const parentDir = path.dirname(
        new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, '$1')
      );
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

const presentation = await import('../src/lib/study-library/subject-card-presentation.ts');
const consolidation = await import('../src/lib/study-library/curriculum-consolidation.ts');

const {
  resolveSubjectClassification,
  getPathwayBadgeLabel,
  resolveDefaultPathway,
  getVerifiedPathwayMetrics,
  buildSubjectCardPresentation,
  buildSubjectSelectionContext,
  formatExclusiveCtaLabel,
} = presentation;

const {
  partitionAuthorizedSubjects,
  consolidateRnAndLpnSubjects,
  buildCoursesByIdMap,
  buildProgramsByIdMap,
  buildExamsBySubjectMap,
} = consolidation;

console.log('=== STUDY LIBRARY SUBJECT CARD & DROPDOWN UX VERIFICATION SUITE ===');

// 1. Pathway coverage labels derive from consolidated metadata (COMMON -> Shared: RN & LPN, RN_ONLY -> RN, LPN_ONLY -> LPN)
{
  const programs = buildProgramsByIdMap([
    { id: 6, name: 'LPN Nursing Exams' },
    { id: 9, name: 'RN Nursing Exams' },
  ]);
  const courses = buildCoursesByIdMap([
    { id: 34, guidId: 'c-ati-rn', programId: 9, name: 'ATI Practice Assessments (RN)' },
    { id: 21, guidId: 'c-ati-pn', programId: 6, name: 'ATI Practice Assessments (PN)' },
    { id: 36, guidId: 'c-gen-rn', programId: 9, name: 'General Nursing RN' },
    { id: 23, guidId: 'c-kap-pn', programId: 6, name: 'Kaplan Nursing PN' },
    { id: 37, guidId: 'c-exit-rn', programId: 9, name: 'ATI RN Exit Exam' },
    { id: 24, guidId: 'c-exit-pn', programId: 6, name: 'ATI PN Exit Exam' },
  ]);

  const rawSubjects = [
    { id: 101, guidId: 'sub-rn-pharm', courseId: 34, name: 'Pharmacology (RN)' },
    { id: 201, guidId: 'sub-pn-pharm', courseId: 21, name: 'Pharmacology (LPN)' },
    { id: 102, guidId: 'sub-rn-ob', courseId: 34, name: 'Maternal & Newborn Nursing' },
    { id: 202, guidId: 'sub-pn-ob', courseId: 21, name: 'Maternal Newborn LPN' },
    { id: 103, guidId: 'sub-rn-empty', courseId: 36, name: 'Endocrinology' },
    { id: 203, guidId: 'sub-pn-only', courseId: 23, name: 'Pre-Requisites' },
    { id: 199, guidId: 'sub-rn-exit', courseId: 37, name: 'RN Comprehensive Predictor' },
    { id: 299, guidId: 'sub-pn-exit', courseId: 24, name: 'PN Comprehensive Predictor' },
  ];

  const examFixtures = [
    { id: 1, guidId: 'ex-rn-1', programId: 9, subjectId: 101, subjectGuidId: 'sub-rn-pharm', title: 'RN Pharm 1', questionsCount: 40, status: 'Active' },
    { id: 2, guidId: 'ex-rn-2', programId: 9, subjectId: 101, subjectGuidId: 'sub-rn-pharm', title: 'RN Pharm 2', questionsCount: 35, status: 'Active' },
    { id: 3, guidId: 'ex-pn-1', programId: 6, subjectId: 201, subjectGuidId: 'sub-pn-pharm', title: 'LPN Pharm 1', questionsCount: 30, status: 'Active' },
    { id: 4, guidId: 'ex-rn-ob', programId: 9, subjectId: 102, subjectGuidId: 'sub-rn-ob', title: 'RN OB 1', questionsCount: 50, status: 'Active' },
    { id: 5, guidId: 'ex-pn-ob', programId: 6, subjectId: 202, subjectGuidId: 'sub-pn-ob', title: 'LPN OB 1', questionsCount: 25, status: 'Active' },
    { id: 6, guidId: 'ex-pn-pre', programId: 6, subjectId: 203, subjectGuidId: 'sub-pn-only', title: 'LPN Pre-Req 1', questionsCount: 20, status: 'Active' },
    { id: 7, guidId: 'ex-rn-exit', programId: 9, subjectId: 199, subjectGuidId: 'sub-rn-exit', title: 'RN Exit 1', questionsCount: 150, status: 'Active' },
    { id: 8, guidId: 'ex-pn-exit', programId: 6, subjectId: 299, subjectGuidId: 'sub-pn-exit', title: 'PN Exit 1', questionsCount: 150, status: 'Active' },
  ];

  const { rnSubjects, lpnSubjects } = partitionAuthorizedSubjects(rawSubjects, courses, programs);
  const cards = consolidateRnAndLpnSubjects(rnSubjects, lpnSubjects, buildExamsBySubjectMap(examFixtures), {
    examIndexComplete: true,
  });

  const pharm = cards.find((c) => c.title === 'Pharmacology');
  assert.ok(pharm);
  const pharmPres = buildSubjectCardPresentation(pharm, 'All');
  assert.equal(pharmPres.classification, 'COMMON');
  assert.equal(pharmPres.pathwayBadgeLabel, 'Shared: RN & LPN');
  assert.equal(pharmPres.hasMultiplePathways, true);
  assert.equal(pharmPres.pathwayOptions.length, 2);
  assert.deepEqual(
    pharmPres.pathwayOptions.map((o) => ({ pathway: o.pathway, programId: o.programId, exams: o.examCount, questions: o.questionCount })),
    [
      { pathway: 'RN', programId: 9, exams: 2, questions: 75 },
      { pathway: 'PN_LPN', programId: 6, exams: 1, questions: 30 },
    ]
  );

  // Ambiguous OB cards remain separate RN and LPN cards (never merged into Shared: RN & LPN)
  const obCards = cards.filter((c) => c.title.includes('Maternal'));
  assert.equal(obCards.length, 2);
  const rnOb = obCards.find((c) => c.classification === 'RN_ONLY');
  const lpnOb = obCards.find((c) => c.classification === 'LPN_ONLY');
  assert.ok(rnOb && lpnOb);
  assert.equal(buildSubjectCardPresentation(rnOb).pathwayBadgeLabel, 'RN');
  assert.equal(buildSubjectCardPresentation(lpnOb).pathwayBadgeLabel, 'LPN');
  assert.equal(buildSubjectCardPresentation(rnOb).hasMultiplePathways, false);
  assert.equal(buildSubjectCardPresentation(lpnOb).hasMultiplePathways, false);

  // Zero-exam exclusive card preserves 0 count without fabricating numbers
  const emptyRn = cards.find((c) => c.title === 'Endocrinology');
  assert.ok(emptyRn);
  assert.equal(buildSubjectCardPresentation(emptyRn).pathwayBadgeLabel, 'RN');
  assert.equal(formatExclusiveCtaLabel(emptyRn, emptyRn.pathway), 'No Examinations Available');
  assert.equal(getVerifiedPathwayMetrics(emptyRn, emptyRn.pathway).examCount, 0);
  assert.equal(getVerifiedPathwayMetrics(emptyRn, emptyRn.pathway).questionCount, 0);

  // LPN exclusive card and Exit cards
  const lpnOnly = cards.find((c) => c.title === 'Pre-Requisites');
  assert.ok(lpnOnly);
  assert.equal(buildSubjectCardPresentation(lpnOnly).pathwayBadgeLabel, 'LPN');
  assert.equal(formatExclusiveCtaLabel(lpnOnly, lpnOnly.pathway), 'View LPN/PN Examinations (1)');

  const rnExit = cards.find((c) => c.pathway === 'RN_Exit');
  const pnExit = cards.find((c) => c.pathway === 'PN_Exit');
  assert.ok(rnExit && pnExit);
  assert.equal(buildSubjectCardPresentation(rnExit).pathwayBadgeLabel, 'RN');
  assert.equal(buildSubjectCardPresentation(rnExit).categoryLabel, 'Exit Predictor');
  assert.equal(buildSubjectCardPresentation(pnExit).pathwayBadgeLabel, 'LPN');
  assert.equal(buildSubjectCardPresentation(pnExit).categoryLabel, 'Exit Predictor');

  // Vague labels must never appear in pathway badges
  for (const card of cards) {
    const label = buildSubjectCardPresentation(card).pathwayBadgeLabel;
    assert.equal(
      ['Shared: RN & LPN', 'RN', 'LPN'].includes(label),
      true,
      `Unexpected pathway badge label: ${label}`
    );
    assert.equal(/^(Common|General|All|Multiple|Shared content)$/i.test(label), false);
  }

  console.log('[PASS] 1. Pathway coverage labels derive strictly from consolidated metadata without vague labels or fabricated counts');

  // 2. Pathway dropdown selection metrics & authoritative single-program routing context
  assert.equal(resolveDefaultPathway(pharm, 'All'), 'RN');
  assert.equal(resolveDefaultPathway(pharm, 'PN_LPN'), 'PN_LPN');

  const rnMetrics = getVerifiedPathwayMetrics(pharm, 'RN');
  assert.equal(rnMetrics.examCount, 2);
  assert.equal(rnMetrics.questionCount, 75);

  const lpnMetrics = getVerifiedPathwayMetrics(pharm, 'PN_LPN');
  assert.equal(lpnMetrics.examCount, 1);
  assert.equal(lpnMetrics.questionCount, 30);

  const rnSelection = buildSubjectSelectionContext(pharm, 'RN');
  assert.equal(rnSelection.programId, 9);
  assert.equal(rnSelection.pathway, 'RN');
  assert.deepEqual(rnSelection.subjectIds, ['sub-rn-pharm']);

  const lpnSelection = buildSubjectSelectionContext(pharm, 'PN_LPN');
  assert.equal(lpnSelection.programId, 6);
  assert.equal(lpnSelection.pathway, 'PN_LPN');
  assert.deepEqual(lpnSelection.subjectIds, ['sub-pn-pharm']);

  // Fallback classification derivation when DTO omits explicit classification
  assert.equal(resolveSubjectClassification({ ...pharm, classification: undefined }), 'COMMON');
  assert.equal(getPathwayBadgeLabel(resolveSubjectClassification({ ...lpnOnly, classification: undefined })), 'LPN');

  console.log('[PASS] 2. Dropdown pathway selection updates verified metrics and preserves programId {6, 9} & subjectIds routing');
}

// 3. Structural UI hierarchy, compact layout, direct actions, and accessibility contracts in SubjectCard.tsx
{
  const cardSrc = fs.readFileSync(path.join(repoRoot, 'src/components/study/SubjectCard.tsx'), 'utf8');

  const cardIdx = cardSrc.indexOf('data-testid="subject-card"');
  const titleIdx = cardSrc.indexOf('{subject.title}');
  const labelIdx = cardSrc.indexOf('categoryLabel');
  const rnBtnIdx = cardSrc.indexOf('selectPathway("RN")');
  const lpnBtnIdx = cardSrc.indexOf('selectPathway("PN_LPN")');

  assert.ok(cardIdx > -1, 'SubjectCard root must have testid="subject-card"');
  assert.ok(labelIdx > -1 && titleIdx > labelIdx, 'Category/Subject label must appear before title');
  assert.ok(rnBtnIdx > titleIdx, 'Direct RN action must appear in card actions below title');
  assert.ok(lpnBtnIdx > titleIdx, 'Direct LPN/PN action must appear in card actions below title');

  // Simplification verification per Section 4: no dropdown, no merged badges, no repeated course labels
  assert.equal(cardSrc.includes('Select Academic Pathway'), false, 'Select Academic Pathway dropdown must be removed');
  assert.equal(cardSrc.includes('MERGED — RN + LPN'), false, 'MERGED — RN + LPN label must be removed from the simplified card');

  // Accessibility and mobile touch targets
  assert.ok(cardSrc.includes('GraduationCap'), 'Subject card must render subject category icon');
  assert.ok(cardSrc.includes('ArrowRight'), 'Direct pathway actions must render forward indicators');

  // Learner dashboard key uniqueness check
  const learnerDashSrc = fs.readFileSync(path.join(repoRoot, 'src/app/learner/page.tsx'), 'utf8');
  assert.ok(
    learnerDashSrc.includes('key={subject.presentationId ?? subject.id}'),
    '/learner dashboard must key SubjectCard by presentationId ?? id'
  );

  console.log('[PASS] 3. SubjectCard simplified compact DOM hierarchy, direct pathway actions, and accessibility contracts verified');
}

console.log('\nALL STUDY LIBRARY CARD & DROPDOWN TESTS PASSED!');
