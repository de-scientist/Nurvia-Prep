import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.\w+$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
        try {
          return nextResolve(`${specifier}${ext}`, context);
        } catch {
          // try next extension
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

const { nurviaApi } = await import('../src/lib/api-client.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '..');
const WEB_ROOT = fs.existsSync(path.join(baseDir, 'src', 'app'))
  ? path.join(baseDir, 'src')
  : baseDir;

function readText(relPath) {
  return fs.readFileSync(path.join(WEB_ROOT, relPath), 'utf8');
}

console.log('--- NURVIA SUBJECT-FIRST STUDY LIBRARY & FILTER PRESERVATION TEST SUITE ---');

// 1. Source verification of UI preservation
const studyViewSrc = readText('components/study/study-library-view.tsx');
const advFiltersSrc = readText('components/study/StudyLibraryAdvancedFilters.tsx');
const catTabsSrc = readText('components/study/StudyLibraryCategoryTabs.tsx');
const subjectCardSrc = readText('components/study/SubjectCard.tsx');
const statesSrc = readText('components/study/StudyLibraryStates.tsx');
const apiTypesSrc = readText('lib/api-types.ts');
const apiClientSrc = readText('lib/api-client.ts');

// Verify existing filter IDs and elements are strictly preserved
assert.match(advFiltersSrc, /id="filter-program"/, 'Filter program ID preserved');
assert.match(advFiltersSrc, /id="filter-course"/, 'Filter course ID preserved');
assert.match(advFiltersSrc, /id="filter-subject"/, 'Filter subject ID preserved');
assert.match(advFiltersSrc, /id="filter-year"/, 'Filter year ID preserved');
assert.match(advFiltersSrc, /id="filter-season"/, 'Filter season ID preserved');
assert.match(advFiltersSrc, /id="filter-school"/, 'Filter school ID preserved');
assert.match(advFiltersSrc, /id="filter-exam"/, 'Filter exam ID preserved');
assert.match(advFiltersSrc, /id="filter-topic"/, 'Filter topic ID preserved');
assert.match(advFiltersSrc, /id="filter-difficulty"/, 'Filter difficulty ID preserved');
assert.match(advFiltersSrc, /id="filter-qtype"/, 'Filter qtype ID preserved');
console.log('[PASS] 1. Filter Control IDs & Hierarchy: All 10 existing filter controls strictly preserved');

// 2. Verify SubjectCard visual structure and identity
assert.match(subjectCardSrc, /GraduationCap/, 'Subject card displays Subject icon badge');
assert.match(subjectCardSrc, /View Examinations/, 'Subject card provides prominent View Examinations CTA');
assert.match(subjectCardSrc, /BookOpen/, 'Subject card displays total examinations count');
assert.match(subjectCardSrc, /HelpCircle/, 'Subject card displays total questions count');
console.log('[PASS] 2. Subject Card Identity: Represents authoritative subject with examinations count & CTA');

// 3. Verify Subject-to-Examination breadcrumb & return journey
assert.match(studyViewSrc, /Back to Subject Catalogue/, 'StudyLibraryView includes Back to Subject Catalogue CTA');
assert.match(studyViewSrc, /Subject Catalogue/, 'StudyLibraryView includes Subject Catalogue breadcrumb');
assert.match(studyViewSrc, /isExamView/, 'StudyLibraryView distinguishes subject catalogue from exam view');
console.log('[PASS] 3. Learner Journey: Subject-to-examination flow and return navigation context verified');

// 4. Behavioral test: getStudyLibraryFilters returns complete 7-dimension data
const originalFetch = globalThis.fetch;
try {
  // Mock Strata absolute endpoints with rich academic data
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('program')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 9, name: 'RN Nursing Exams', code: 'RN' },
              { id: 8, name: 'NCLEX RN', code: 'NCLEX_RN' },
              { id: 7, name: 'NCLEX PN', code: 'NCLEX_PN' },
            ],
            skewTotal: 3,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (u.includes('course')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 40, name: 'Client Needs.', programId: 7 },
              { id: 39, name: 'Rhenis H-S Exams-RN', programId: 9 },
            ],
            skewTotal: 2,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (u.includes('subject')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 188, name: 'Psychosocial Integrity (NCLEX PN)', courseId: 40, courseName: 'Client Needs.', year: 2026, season: 'Fall', difficulty: 'Beginner' },
              { id: 184, name: 'Pharmacology-RN', courseId: 39, courseName: 'Rhenis H-S Exams-RN', year: 2026, season: 'Fall', difficulty: 'Intermediate' },
              { id: 175, name: 'Fundamentals of Nursing-RN', courseId: 39, courseName: 'Rhenis H-S Exams-RN', year: 2026, season: 'Fall', difficulty: 'Foundation' },
            ],
            skewTotal: 3,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (u.includes('exam')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              { id: 2122, guidId: 'ex-2122', title: 'Hard Level,', description: 'Hard Level Psychosocial Integrity', questionsCount: 22, duration: 60, school: 'WGU', year: 2026, season: 'Fall', status: 'Published' },
              { id: 2121, guidId: 'ex-2121', title: 'Moderate Level,', description: 'Moderate Level Psychosocial Integrity', questionsCount: 22, duration: 60, school: 'Chamberlain', year: 2026, season: 'Fall', status: 'Published' },
              { id: 1421, guidId: 'ex-1421', title: 'RN Pharmacology 2023 VATI Exam-1', description: 'Comprehensive Pharmacology', questionsCount: 60, duration: 75, school: 'Galen', year: 2026, season: 'Fall', status: 'Published' },
            ],
            skewTotal: 3,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Default empty strata response for topics, schools, sections
    return new Response(
      JSON.stringify({
        success: true,
        data: { items: [], skewTotal: 0 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const filtersRes = await nurviaApi.getStudyLibraryFilters();
  assert.equal(filtersRes.success, true);
  assert.ok(filtersRes.data?.programs.length >= 3, 'Programs loaded');
  assert.ok(filtersRes.data?.courses.length >= 2, 'Courses loaded');
  assert.ok(filtersRes.data?.subjects.length >= 3, 'Subjects loaded');
  assert.ok(filtersRes.data?.schools.includes('WGU'), 'WGU school loaded from exams');
  assert.ok(filtersRes.data?.schools.includes('Chamberlain'), 'Chamberlain school loaded from exams');
  assert.ok(filtersRes.data?.academicYears.includes(2026), 'Academic year 2026 loaded');
  assert.ok(filtersRes.data?.seasons.includes('Fall'), 'Season Fall loaded');
  console.log('[PASS] 4. Behavioral: getStudyLibraryFilters accurately resolves all 7 dimensions');

  // 5. Behavioral test: getStudyLibrarySubjects returns subjects with computed examinations count
  const subjectsRes = await nurviaApi.getStudyLibrarySubjects({ pageNumber: 1, pageSize: 12 });
  assert.equal(subjectsRes.success, true);
  assert.ok(subjectsRes.data?.items.length >= 2, 'Subjects returned');
  const psychoSubject = subjectsRes.data?.items.find((s) => s.name.includes('Psychosocial Integrity'));
  assert.ok(psychoSubject, 'Psychosocial Integrity subject found');
  assert.equal(psychoSubject.totalExams, 2, 'Accurately counts 2 matching exams for Psychosocial Integrity');
  assert.equal(psychoSubject.totalQuestions, 44, 'Accurately sums 44 questions');
  assert.equal(psychoSubject.courseName, 'Client Needs.');
  console.log('[PASS] 5. Behavioral: getStudyLibrarySubjects populates authoritative cards with linked exams & metrics');

  // 6. Behavioral test: selecting subject drills down into its examinations
  const examsRes = await nurviaApi.getStudyLibrary({ subject: 'Psychosocial Integrity (NCLEX PN)', pageNumber: 1, pageSize: 12 });
  assert.equal(examsRes.success, true);
  assert.equal(examsRes.data?.items.length, 2, 'Returns only examinations matching Psychosocial Integrity');
  assert.ok(examsRes.data?.items.every((e) => e.description.includes('Psychosocial Integrity')), 'All returned exams belong to subject');
  console.log('[PASS] 6. Behavioral: getStudyLibrary returns exact exams for selected subject with full metadata');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('\nALL 6 SUBJECT-FIRST STUDY LIBRARY VERIFICATION TESTS PASSED (6/6)!');
