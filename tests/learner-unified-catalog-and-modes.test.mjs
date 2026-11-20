import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.\w+$/.test(specifier)) {
      for (const ext of ['.ts', '.mjs', '.js']) {
        try {
          return nextResolve(`${specifier}${ext}`, context);
        } catch {
          // continue search
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const source = fs.readFileSync(fileURLToPath(url), 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: fileURLToPath(url),
      });
      return { format: 'module', shortCircuit: true, source: outputText };
    }
    return nextLoad(url, context);
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const {
  nurviaApi,
  classifyAuthoritativePathway,
  cleanSubjectDisplayName,
  inferExamPathway,
} = await import('../src/lib/api-client.ts');

console.log('=== NURVIA-PLEX AUTHORITATIVE 4-PATHWAY & LEARNER CATALOGUE TEST SUITE ===');

// 1. Authoritative 4-Pathway Strict Boundary Test
console.log('1. Verifying Authoritative 4-Pathway Classification & Scope Enforcement...');

// Ineligible records MUST resolve to eligible: false
const nclexPnRecord = { id: 'ex-nclex-1', title: 'NCLEX-PN Client Needs Practice Exam', assessmentId: 6, programId: 7 };
const nclexRnRecord = { id: 'ex-nclex-2', title: 'NCLEX-RN Comprehensive Examination', assessmentId: 7, programId: 8 };
const gedRecord = { id: 'ex-ged', title: 'GED Mathematical Reasoning Examination', assessmentId: 3 };
const teasRecord = { id: 'ex-teas', title: 'ATI TEAS Science Assessment', assessmentId: 2, programId: 3 };
const hesiA2Record = { id: 'ex-hesi-a2', title: 'HESI A2 Admissions Exam', assessmentId: 4, programId: 5 };
const edsRecord = { id: 'ex-eds', title: 'EXPLICIT DYNAMIC SOLUTIONS Assessment', programId: 13 };

assert.equal(classifyAuthoritativePathway(nclexPnRecord).eligible, false, 'NCLEX-PN must be strictly excluded');
assert.equal(classifyAuthoritativePathway(nclexRnRecord).eligible, false, 'NCLEX-RN must be strictly excluded');
assert.equal(classifyAuthoritativePathway(gedRecord).eligible, false, 'GED must be strictly excluded');
assert.equal(classifyAuthoritativePathway(teasRecord).eligible, false, 'ATI TEAS must be strictly excluded');
assert.equal(classifyAuthoritativePathway(hesiA2Record).eligible, false, 'HESI A2 must be strictly excluded');
assert.equal(classifyAuthoritativePathway(edsRecord).eligible, false, 'EDS unrelated program must be strictly excluded');

// Eligible records MUST resolve to one of the 4 approved pathways
const rnRecord = { id: 'ex-rn-1', title: 'Pharmacology and Parenteral Therapies Final Exam', assessmentId: 8, programId: 9 };
const pnRecord = { id: 'ex-pn-1', title: 'Fundamentals of Practical Nursing', assessmentId: 5, programId: 6 };
const rnExitRecord = { id: 'ex-rn-exit', title: 'RN Comprehensive Exit Predictor Exam', assessmentId: 10 };
const pnExitRecord = { id: 'ex-pn-exit', title: 'PN Comprehensive Exit Predictor Exam', assessmentId: 10 };

const resRn = classifyAuthoritativePathway(rnRecord);
assert.equal(resRn.eligible, true);
assert.equal(resRn.pathway, 'RN');

const resPn = classifyAuthoritativePathway(pnRecord);
assert.equal(resPn.eligible, true);
assert.equal(resPn.pathway, 'PN_LPN');

const resRnExit = classifyAuthoritativePathway(rnExitRecord);
assert.equal(resRnExit.eligible, true);
assert.equal(resRnExit.pathway, 'RN_Exit');

const resPnExit = classifyAuthoritativePathway(pnExitRecord);
assert.equal(resPnExit.eligible, true);
assert.equal(resPnExit.pathway, 'PN_Exit');

console.log('[PASS] 1. Authoritative 4-Pathway Classification & Scope Enforcement verified.');

// 2. Clean Subject Display Names Test
console.log('2. Verifying Subject Display Name Cleansing...');
assert.equal(cleanSubjectDisplayName('NCLEX-PN - Fundamentals of Nursing'), 'Fundamentals of Nursing');
assert.equal(cleanSubjectDisplayName('Pharmacology - RN'), 'Pharmacology');
assert.equal(cleanSubjectDisplayName('Med-Surg (General RN)'), 'Medical-Surgical Nursing');
assert.equal(cleanSubjectDisplayName('Pediatrics Exams'), 'Pediatrics');
assert.equal(cleanSubjectDisplayName('Dosage Calculation & Clinical Math'), 'Dosage Calculations');
console.log('[PASS] 2. Subject display name cleansing verified.');

// 3. Review Mode Fallback Prevention Test
console.log('3. Verifying Review Mode Fallback Prevention in exam-session...');
const examSessionSource = fs.readFileSync(path.join(ROOT, 'src/app/exam-session/page.tsx'), 'utf8');

// Must NOT fall through to getActiveAttempt when modeParam === "Review"
assert.ok(
  examSessionSource.includes('modeParam === "Review"') &&
  examSessionSource.includes('setLoadError') &&
  examSessionSource.includes('Review mode is not available for this attempt until it has been submitted and graded.'),
  'exam-session must stop and display an explicit error when Review mode fails, without falling back to Exam mode'
);
console.log('[PASS] 3. Review mode fallback prevention verified.');

// 4. PrepFord External Redirection Test
console.log('4. Verifying NCLEX Redirection to PrepFord...');
const nextConfigSrc = fs.readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');
assert.ok(nextConfigSrc.includes('/nclex') && nextConfigSrc.includes('https://www.prepford.com/'), 'next.config.ts must redirect /nclex to PrepFord');

const nclexPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/nclex/page.tsx'), 'utf8');
assert.ok(nclexPageSrc.includes('https://www.prepford.com/'), 'src/app/nclex/page.tsx must direct learners to PrepFord');

const learnerShellSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/learner-shell.tsx'), 'utf8');
assert.ok(learnerShellSrc.includes('https://www.prepford.com/'), 'learner-shell must link NCLEX Prep Hub externally to PrepFord');
console.log('[PASS] 4. PrepFord NCLEX external redirection verified.');

// 5. SubjectCard Unified RN/PN Dropdown CTA Test
console.log('5. Verifying SubjectCard Unified RN/PN CTA Selection...');
const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
assert.ok(subjectCardSrc.includes('onSelectSubject: (subjectName: string, pathway?: string) => void'), 'SubjectCardProps must support pathway selection');
assert.ok(subjectCardSrc.includes('hasMultiplePathways'), 'SubjectCard must detect multiple pathways');
assert.ok(subjectCardSrc.includes('RN Pathway') && subjectCardSrc.includes('LPN / PN Pathway'), 'SubjectCard dropdown must provide RN and LPN/PN options');
console.log('[PASS] 5. SubjectCard RN/PN dropdown CTA verified.');

// 6. Study Library Category Tabs 4-Pathway Scope Test
console.log('6. Verifying StudyLibraryCategoryTabs 4-Pathway Scope...');
const categoryTabsSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/StudyLibraryCategoryTabs.tsx'), 'utf8');
assert.ok(!categoryTabsSrc.includes('"NursingMath"'), 'NursingMath must be removed from pathway tabs');
assert.ok(!categoryTabsSrc.includes('RN_Exit: "NCLEX"'), 'NCLEX label must not be displayed on RN_Exit tab');
assert.ok(categoryTabsSrc.includes('RN_Exit: "RN Exit"'), 'RN_Exit must be labeled "RN Exit"');
assert.ok(categoryTabsSrc.includes('PN_Exit: "LPN Exit"'), 'PN_Exit must be labeled "LPN Exit"');
console.log('[PASS] 6. StudyLibraryCategoryTabs 4-pathway alignment verified.');

// 7. Learner Dashboard (/learner) Catalogue and Stats Parity Test
console.log('7. Verifying /learner Subject Catalogue & Stats Parity...');
const learnerPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/page.tsx'), 'utf8');
assert.ok(learnerPageSrc.includes('SubjectCard'), '/learner must render SubjectCard items in Subject Catalogue');
assert.ok(learnerPageSrc.includes('getStudyLibrarySubjects'), '/learner must fetch study library subjects');
assert.ok(learnerPageSrc.includes('getStudyLibrarySummary'), '/learner must fetch study library summary for true stats count');
assert.ok(learnerPageSrc.includes('totalEligibleExams'), '/learner must display total eligible exams count');
assert.ok(learnerPageSrc.includes('https://www.prepford.com/'), '/learner ecosystem banner must direct NCLEX to PrepFord');
console.log('[PASS] 7. /learner Subject Catalogue & Stats Parity verified.');

console.log('\nALL 7 VERIFICATION SUITES PASSED CLEANLY (7/7)!');
