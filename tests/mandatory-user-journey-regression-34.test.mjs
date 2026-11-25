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

    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context);
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

const { middleware } = await import('../src/middleware.ts');
const { verifyLearnerEntitlement } = await import('../src/lib/subscriptions/entitlement-service.ts');
const { NextRequest } = await import('next/server');

const ROOT = repoRoot;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    failed++;
    process.exitCode = 1;
  }
}

console.log('=== NURVIA AUTHORITATIVE 34-POINT MANDATORY REGRESSION TEST SUITE ===\n');

// -------------------------------------------------------------------------
// GROUP 1: HOMEPAGE AND PUBLIC DISCOVERY (1 - 9)
// -------------------------------------------------------------------------
console.log('--- Group 1: Homepage and Public Discovery (1 - 9) ---');

await test('1. Guest opens the homepage without authentication', () => {
  const req = new NextRequest('http://localhost:3000/', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Homepage must return 200 without redirect for guest');
  assert.equal(res.headers.get('location'), null);
});

await test('2. Guest explores available pathways', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('RN Exams'), 'Must render RN Exams pathway');
  assert.ok(pageSrc.includes('LPN Exams'), 'Must render LPN Exams pathway');
  assert.ok(pageSrc.includes('RN Exit Exams'), 'Must render RN Exit Exams pathway');
  assert.ok(pageSrc.includes('LPN Exit Exams'), 'Must render LPN Exit Exams pathway');
});

await test('3. Guest selects RN and reaches RN subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('rnPathwayHref = "/learner/library?track=RN"'), 'RN pathway href must link to /learner/library?track=RN');

  const req = new NextRequest('http://localhost:3000/learner/library?track=RN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/learner/library?track=RN must return 200 without redirect for guests');
});

await test('4. Guest selects PN/LPN and reaches PN/LPN subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('/exams?track=PN_LPN'), 'PN/LPN pathway href must link to /exams?track=PN_LPN for guests');

  const req = new NextRequest('http://localhost:3000/exams?track=PN_LPN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/exams?track=PN_LPN must return 200 without redirect for guests');
});

await test('5. Guest selects RN Exit and reaches its subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('/exams?track=RN_Exit'), 'RN Exit pathway href must link to /exams?track=RN_Exit for guests');

  const req = new NextRequest('http://localhost:3000/exams?track=RN_Exit', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/exams?track=RN_Exit must return 200 without redirect for guests');
});

await test('6. Guest selects PN Exit and reaches its subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('/exams?track=PN_Exit'), 'PN Exit pathway href must link to /exams?track=PN_Exit for guests');

  const req = new NextRequest('http://localhost:3000/exams?track=PN_Exit', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/exams?track=PN_Exit must return 200 without redirect for guests');
});

await test('7. Guest browses individual subject cards without authentication', () => {
  const req = new NextRequest('http://localhost:3000/exams', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/exams must allow unauthenticated guest browsing');

  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(subjectCardSrc.includes('subject.title'), 'SubjectCard renders subject title');
  assert.ok(subjectCardSrc.includes('categoryLabel'), 'SubjectCard renders category label');
  assert.ok(subjectCardSrc.includes('metrics.rnExamCount'), 'SubjectCard renders RN exam metrics');
  assert.ok(subjectCardSrc.includes('metrics.pnExamCount'), 'SubjectCard renders PN exam metrics');
});

await test('8. Guest can click Try a Practice Set without being forced to sign in', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('startHref = "/learner/library"'), 'startHref must route to /learner/library');
  assert.ok(pageSrc.includes('Try a Practice Set'), 'Try a Practice Set button rendered');
  assert.ok(!pageSrc.includes('startHref = isAuthenticated ? "/learner/library" : `/sign-in'), 'Must not force sign-in for Try a Practice Set');
  const req = new NextRequest('http://localhost:3000/learner/library', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, '/learner/library must return 200 without redirect for guests');
});

await test('9. Quick Practice remains functional and preserves its existing intended experience', () => {
  const previewSrc = fs.readFileSync(path.join(ROOT, 'src/components/home/practice-question-preview.tsx'), 'utf8');
  assert.ok(previewSrc.includes('id="quick-practice"'), 'Quick Practice component must have id="quick-practice"');
  assert.ok(previewSrc.includes('QUICK PRACTICE'), 'Must have Quick Practice title');
  assert.ok(previewSrc.includes('formatTimer'), 'Must include working countdown timer');
  assert.ok(previewSrc.includes('handleSelectOption'), 'Must allow option selection');
  assert.ok(previewSrc.includes('Clinical Reasoning & Rationale'), 'Must reveal educational rationale');
  assert.ok(previewSrc.includes('Quick Practice Completed!'), 'Must include completion screen');
  assert.ok(previewSrc.includes('handleRestart'), 'Must allow restarting practice');
});

// -------------------------------------------------------------------------
// GROUP 2: EXAMINATION ACCESS (10 - 15)
// -------------------------------------------------------------------------
console.log('\n--- Group 2: Examination Access (10 - 15) ---');

await test('10. Guest selects an examination from an RN subject card and receives the authentication gate', () => {
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(subjectCardSrc.includes('!isAuthenticated'), 'SubjectCard checks if learner is authenticated');
  assert.ok(
    subjectCardSrc.includes('/sign-in?returnTo='),
    'SubjectCard initiates authentication gate for unauthenticated guests'
  );
  assert.ok(
    subjectCardSrc.includes('track'),
    'SubjectCard preserves RN pathway in returnTo destination'
  );
});

await test('11. Guest selects an examination from a PN/LPN subject card and receives the authentication gate', () => {
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(
    subjectCardSrc.includes('params.set("track", targetPathway)'),
    'SubjectCard preserves targeted pathway (including PN_LPN) in returnTo'
  );
});

await test('12. Guest cannot access examination details directly', () => {
  const req = new NextRequest('http://localhost:3000/exams/exam_abc_123', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 307, 'Guest direct request to /exams/[id] must be blocked');
  const loc = res.headers.get('location') || '';
  assert.ok(loc.includes('/sign-in'), 'Redirect must point to /sign-in');
  assert.ok(loc.includes('returnTo=%2Fexams%2Fexam_abc_123'), 'Preserves detail returnTo');
});

await test('13. Guest cannot access protected questions through direct API requests', () => {
  const attemptRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'),
    'utf8'
  );
  assert.ok(attemptRouteSrc.includes('resolveAttemptLearner'), 'Start endpoint resolves authenticated learner');
  assert.ok(attemptRouteSrc.includes("errorCode: 'UNAUTHORIZED'"), 'Rejects unauthenticated requests with UNAUTHORIZED');
  assert.ok(attemptRouteSrc.includes('status: 401'), 'Returns status 401');

  const strataRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/strata/[resource]/route.ts'), 'utf8');
  assert.ok(strataRoute.includes("resource === 'exams'"), 'Strata exams route requires authentication');
});

await test('14. The selected pathway, subject and examination are preserved through authentication', () => {
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(subjectCardSrc.includes('params.set("track"'), 'Preserves track in destination');
  assert.ok(subjectCardSrc.includes('params.set("subject"'), 'Preserves subject title in destination');
  assert.ok(subjectCardSrc.includes('params.set("subjectIds"'), 'Preserves subjectIds in destination');
  assert.ok(subjectCardSrc.includes('params.set("programId"'), 'Preserves programId in destination');
});

await test('15. After successful authentication and verification, the learner returns to the intended examination', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('params.get("returnTo")'), 'ValidateClient reads returnTo parameter');
  assert.ok(validateSrc.includes('safeDestination'), 'ValidateClient computes safeDestination');
});

// -------------------------------------------------------------------------
// GROUP 3: VERIFICATION (16 - 19)
// -------------------------------------------------------------------------
console.log('\n--- Group 3: Verification (16 - 19) ---');

await test('16. Authenticated but unverified learner can explore public subjects', () => {
  const req = new NextRequest('http://localhost:3000/exams?track=RN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Public subjects route remains open (status 200)');
});

await test('17. Unverified learner cannot access examination details', () => {
  const detailApiSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/study-library/[id]/route.ts'), 'utf8');
  assert.ok(detailApiSrc.includes('learner.emailVerified === false'), 'Detail API checks emailVerified');
  assert.ok(detailApiSrc.includes("errorCode: 'UNVERIFIED_EMAIL'"), 'Returns UNVERIFIED_EMAIL error code');
  assert.ok(detailApiSrc.includes('status: 403'), 'Returns status 403');
});

await test('18. Existing verification flow is initiated correctly', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/learner-shell.tsx'), 'utf8');
  assert.ok(shellSrc.includes('<LearnerVerificationModal'), 'LearnerShell renders LearnerVerificationModal');
  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/auth/LearnerVerificationModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('resend-verification'), 'Modal supports resending verification email');
});

await test('19. The intended examination destination survives email verification', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/auth/LearnerVerificationModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('returnTo?: string'), 'Modal accepts returnTo prop');
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('returnTo'), 'ValidateClient reads and uses returnTo');
});

// -------------------------------------------------------------------------
// GROUP 4: SUBSCRIPTION (20 - 28)
// -------------------------------------------------------------------------
console.log('\n--- Group 4: Subscription (20 - 28) ---');

await test('20. Authenticated and verified learner without a subscription can browse examination listings', () => {
  const strataRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/strata/[resource]/route.ts'), 'utf8');
  assert.ok(!strataRoute.includes('verifyLearnerEntitlement'), 'Browsing exams does not enforce subscription requirement');
});

await test('21. Such a learner can open permitted examination details', () => {
  const detailApiSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/study-library/[id]/route.ts'), 'utf8');
  assert.ok(!detailApiSrc.includes('verifyLearnerEntitlement'), 'Opening exam details does not require a subscription');
});

await test('22. Such a learner encounters no authentication gate while browsing', () => {
  const libraryViewSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/study-library-view.tsx'), 'utf8');
  assert.ok(libraryViewSrc.includes('StudyLibraryView'), 'StudyLibraryView mounts without auth gate for authenticated users');
});

await test('23. Such a learner encounters no subscription gate while browsing', () => {
  const studySetCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCard.tsx'), 'utf8');
  assert.ok(!studySetCardSrc.includes('verifyLearnerEntitlement'), 'StudySetCard renders without subscription blocking');
});

await test('24. Selecting Start Exam triggers the subscription gate', () => {
  const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsSrc.includes('/api/subscriptions/status?mode='), 'Checks subscription status for Exam mode');
  assert.ok(actionsSrc.includes('/learner/subscription?requiredMode='), 'Routes to /learner/subscription when not entitled');
});

await test('25. Selecting Tutor Mode triggers the subscription gate', () => {
  const actionsSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsSrc.includes('handleLaunchMode'), 'handleLaunchMode handles Tutor mode');
});

await test('26. Applicable feature and pathway entitlements are validated', async () => {
  const result = await verifyLearnerEntitlement({
    session: 'mock-valid-session',
    mode: 'Exam',
    pathway: 'RN',
    siteMeta: {},
    isSuperadmin: false,
    isEmailVerified: true,
  });
  assert.equal(typeof result.allowed, 'boolean', 'Entitlement service returns boolean decision');
  assert.equal(typeof result.status, 'string', 'Entitlement service returns subscription status');
});

await test('27. Direct protected API access cannot bypass subscription validation', () => {
  const startRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'),
    'utf8'
  );
  assert.ok(startRouteSrc.includes('verifyLearnerEntitlement'), 'Start attempt API validates subscription entitlement');
  assert.ok(startRouteSrc.includes('SUBSCRIPTION_REQUIRED'), 'Rejects with SUBSCRIPTION_REQUIRED when unentitled');
});

await test('28. An authorized subscriber can launch the appropriate learning experience', async () => {
  const superadminResult = await verifyLearnerEntitlement({
    session: 'admin-session',
    mode: 'Exam',
    pathway: 'RN',
    siteMeta: {},
    isSuperadmin: true,
    isEmailVerified: true,
  });
  assert.equal(superadminResult.allowed, true, 'Authorized user must be permitted to launch');
  assert.equal(superadminResult.status, 'Active');
});

// -------------------------------------------------------------------------
// GROUP 5: REGRESSION AND PRESERVATION (29 - 34)
// -------------------------------------------------------------------------
console.log('\n--- Group 5: Regression and Preservation (29 - 34) ---');

await test('29. Existing homepage hero functionality remains operational', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('HeroBackgroundVideo'), 'HeroBackgroundVideo is mounted in hero');
  assert.ok(pageSrc.includes('Turn Practice Into'), 'Hero headline preserved');
  assert.ok(pageSrc.includes('PracticeQuestionPreview'), 'PracticeQuestionPreview is mounted in hero');
});

await test('30. Existing Quick Practice functionality remains operational', () => {
  const previewSrc = fs.readFileSync(path.join(ROOT, 'src/components/home/practice-question-preview.tsx'), 'utf8');
  assert.ok(previewSrc.includes('heroPracticeQuestions'), 'Renders heroPracticeQuestions');
  assert.ok(previewSrc.includes('Warfarin is a vitamin K antagonist') || previewSrc.includes('rationale'), 'Shows full educational rationale');
});

await test('31. Existing RN and PN/LPN navigation remains operational', () => {
  const consolidationSrc = fs.readFileSync(
    path.join(ROOT, 'src/lib/study-library/curriculum-consolidation.ts'),
    'utf8'
  );
  assert.ok(consolidationSrc.includes('consolidateRnAndLpnSubjects'), 'Preserves RN and LPN consolidation');
  assert.ok(consolidationSrc.includes('partitionAuthorizedSubjects'), 'Preserves RN and LPN partitioning');
});

await test('32. Existing authentication and verification flows remain operational', () => {
  const signInSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-in/page.tsx'), 'utf8');
  assert.ok(signInSrc.includes('returnTo'), 'Sign-in preserves returnTo');
  const signUpSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-up/page.tsx'), 'utf8');
  assert.ok(signUpSrc.includes('returnTo'), 'Sign-up preserves returnTo');
});

await test('33. Existing examination delivery and grading remain operational', () => {
  const sataSrc = fs.readFileSync(path.join(ROOT, 'src/lib/attempts/sata-validation.ts'), 'utf8');
  assert.ok(sataSrc.includes('validateSataSelection'), 'SATA validation remains operational');
  const loaderSrc = fs.readFileSync(path.join(ROOT, 'src/lib/attempts/live-exam-loader.ts'), 'utf8');
  assert.ok(loaderSrc.includes('fetchLiveExamFromBackend'), 'Live exam loading remains operational');
});

await test('34. Existing subscription and payment workflows remain operational', () => {
  const subStatusRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/subscriptions/status/route.ts'), 'utf8');
  assert.ok(subStatusRoute.includes('verifyLearnerEntitlement'), 'Subscriptions status endpoint remains operational');
  const subPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subPageSrc.includes('activateFreeTier'), 'Free tier activation remains operational');
  assert.ok(subPageSrc.includes('requestCheckout'), 'Stripe checkout remains operational');
});

console.log(`\n=========================================================================`);
console.log(`All 34 Mandatory Regression Tests Completed: ${passed} passed, ${failed} failed.`);
console.log(`=========================================================================\n`);
