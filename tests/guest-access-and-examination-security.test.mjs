import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

console.log('=== NURVIA GUEST ACCESS & EXAMINATION SECURITY SPECIFICATION TEST SUITE ===\n');

// =========================================================================
// SECTION A: GUEST ACCESS & PATHWAY SELECTION GATES
// =========================================================================
console.log('--- SECTION A: Guest Discovery & Pathway Selection Gates ---');

await test('A1. Public homepage allows unauthenticated visitor access (status 200)', () => {
  const req = new NextRequest('http://localhost:3000/', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Must return 200 for public homepage');
  assert.equal(res.headers.get('location'), null, 'Must not redirect public homepage');
});

await test('A2. Unauthenticated visitor can enter /learner/library directly for subject discovery (status 200)', () => {
  const req = new NextRequest('http://localhost:3000/learner/library', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Must allow unauthenticated request to /learner/library');
  assert.equal(res.headers.get('location'), null, 'Must not redirect visitor entering library to browse subjects');
});

await test('A3. Unauthenticated visitor can enter RN library directly (?track=RN) for subject discovery', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=RN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Must allow unauthenticated RN library request for subject browsing');
  assert.equal(res.headers.get('location'), null, 'Must not redirect visitor browsing RN subjects');
});

await test('A4. Unauthenticated visitor can enter LPN library directly (?track=PN_LPN) for subject discovery', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=PN_LPN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Must allow unauthenticated LPN library request for subject browsing');
  assert.equal(res.headers.get('location'), null, 'Must not redirect visitor browsing LPN subjects');
});

await test('A5. Subject selection authentication gate preserves returnTo destination with track and subject', () => {
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(subjectCardSrc.includes('!isAuthenticated'), 'Must check authentication before examination access');
  assert.ok(subjectCardSrc.includes('/sign-in?returnTo='), 'Must redirect unauthenticated user to /sign-in');
  assert.ok(subjectCardSrc.includes('track'), 'Must preserve pathway track');
  assert.ok(subjectCardSrc.includes('subject'), 'Must preserve subject');
});

await test('A6. Unauthenticated visitor cannot access examination details directly (/learner/library/[id])', () => {
  const req = new NextRequest('http://localhost:3000/learner/library/exam_abc123', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 307, 'Must redirect unauthenticated request to examination detail page');
  const loc = res.headers.get('location') || '';
  assert.ok(loc.includes('/sign-in'), 'Must redirect to /sign-in');
  assert.ok(loc.includes('returnTo=%2Flearner%2Flibrary%2Fexam_abc123'), 'Must preserve detail destination');

  const detailPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/library/[id]/page.tsx'), 'utf8');
  assert.ok(!detailPageSrc.includes('allowPublic={true}'), 'Detail page must not allow unauthenticated public access');
});

await test('A7. Learner examination pages do not allow unauthenticated public access, while library enables public browsing', () => {
  const librarySrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/library/page.tsx'), 'utf8');
  const dashboardSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/page.tsx'), 'utf8');
  const examsSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/exams/page.tsx'), 'utf8');

  assert.ok(librarySrc.includes('allowPublic={true}'), 'Library page must enable allowPublic for public subject discovery');
  assert.ok(!dashboardSrc.includes('allowPublic={true}'), 'Dashboard page must not enable allowPublic');
  assert.ok(!examsSrc.includes('allowPublic={true}'), 'Exams page must not enable allowPublic');
});

await test('A8. Homepage pathway selection directs guests to pathway subjects without forced authentication, while examination selection from subject cards triggers authentication', () => {
  const homeMainSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');

  assert.ok(homeMainSrc.includes('rnPathwayHref'), 'Homepage must define RN pathway navigation');
  assert.ok(homeMainSrc.includes('lpnPathwayHref'), 'Homepage must define LPN pathway navigation');
  assert.ok(homeMainSrc.includes('rnPathwayHref = "/learner/library?track=RN"'), 'Homepage must route RN to /learner/library?track=RN');
  assert.ok(homeMainSrc.includes('/exams?track=PN_LPN'), 'Homepage must route PN/LPN to public subject discovery');
  assert.ok(homeMainSrc.includes('startHref = "/learner/library"'), 'Homepage must define startHref for Practice Set');
  assert.ok(subjectCardSrc.includes('/sign-in?returnTo='), 'SubjectCard must enforce authentication when accessing examinations');
});

// =========================================================================
// SECTION B: PROTECTED EXAMINATION TESTS
// =========================================================================
console.log('\n--- SECTION B: Protected Examination Tests ---');

await test('B1. Middleware redirects unauthenticated requests to /exam-session with returnTo preserved', () => {
  const req = new NextRequest(
    'http://localhost:3000/exam-session?examId=exam_456&mode=Exam&layout=Sequential',
    { headers: { host: 'localhost:3000' } }
  );
  const res = middleware(req);
  assert.equal(res.status, 307, 'Must block unauthenticated access to /exam-session');
  const loc = res.headers.get('location') || '';
  assert.ok(loc.includes('/sign-in'), 'Redirect must point to /sign-in');
  assert.ok(loc.includes('returnTo=%2Fexam-session%3FexamId%3Dexam_456%26mode%3DExam%26layout%3DSequential'));
});

await test('B2. Middleware redirects unauthenticated requests to account & attempt routes', () => {
  const protectedPaths = [
    '/learner/history',
    '/learner/performance',
    '/learner/my-exams',
    '/learner/custom-practice',
    '/learner/saved-questions',
    '/learner/attempt/attempt_99',
    '/learner/attempts/attempt_99',
    '/learner/account',
    '/learner/settings',
    '/learner/subscription',
  ];

  for (const p of protectedPaths) {
    const req = new NextRequest(`http://localhost:3000${p}`, { headers: { host: 'localhost:3000' } });
    const res = middleware(req);
    assert.equal(res.status, 307, `Must redirect unauthenticated request to ${p}`);
    const loc = res.headers.get('location') || '';
    assert.ok(loc.includes('/sign-in'), `Must redirect ${p} to /sign-in`);
  }
});

await test('B3. API /api/attempts/start/[examId] blocks unauthenticated visitors with 401 UNAUTHORIZED', () => {
  const startRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'),
    'utf8'
  );
  assert.ok(startRouteSrc.includes('resolveAttemptLearner'), 'Must resolve authenticated learner');
  assert.ok(startRouteSrc.includes('UNAUTHORIZED'), 'Must return UNAUTHORIZED');
  assert.ok(startRouteSrc.includes('status: 401'), 'Must return status 401');
});

await test('B4. API /api/attempts/[attemptId] endpoints block unauthenticated visitors with 401 UNAUTHORIZED', () => {
  const attemptRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/[attemptId]/route.ts'),
    'utf8'
  );
  const responsesRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/[attemptId]/responses/route.ts'),
    'utf8'
  );
  const submitRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/[attemptId]/submit/route.ts'),
    'utf8'
  );
  const reviewRouteSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/[attemptId]/review/route.ts'),
    'utf8'
  );

  for (const src of [attemptRouteSrc, responsesRouteSrc, submitRouteSrc, reviewRouteSrc]) {
    assert.ok(src.includes('resolveAttemptLearner'), 'Must check resolveAttemptLearner');
    assert.ok(src.includes('UNAUTHORIZED'), 'Must return UNAUTHORIZED');
    assert.ok(src.includes('401'), 'Must respond with status 401');
  }
});

await test('B5. API /api/attempts/[attemptId]/tutor routes block unauthenticated visitors with 401 UNAUTHORIZED', () => {
  const tutorRoutes = [
    'src/app/api/attempts/[attemptId]/tutor/hint/route.ts',
    'src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts',
    'src/app/api/attempts/[attemptId]/tutor/session/route.ts',
  ];

  for (const r of tutorRoutes) {
    const src = fs.readFileSync(path.join(ROOT, r), 'utf8');
    assert.ok(src.includes('resolveAttemptLearner'), `${r} must check resolveAttemptLearner`);
    assert.ok(src.includes('UNAUTHORIZED'), `${r} must return UNAUTHORIZED`);
  }
});

await test('B6. Backend entitlement service blocks unauthenticated learner (UNAUTHORIZED)', async () => {
  const res = await verifyLearnerEntitlement({
    session: null,
    mode: 'Exam',
    pathway: 'RN',
  });
  assert.equal(res.allowed, false);
  assert.equal(res.errorCode, 'UNAUTHORIZED');
});

await test('B7. Backend entitlement service blocks unverified email (UNVERIFIED)', async () => {
  const res = await verifyLearnerEntitlement({
    session: { castoLine: 'line_1', castoBadge: 'badge_1' },
    mode: 'Exam',
    pathway: 'RN',
    isEmailVerified: false,
  });
  assert.equal(res.allowed, false);
  assert.equal(res.errorCode, 'UNVERIFIED');
});

await test('B8. API /api/attempts/start/[examId] strictly checks email verification and entitlement', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'),
    'utf8'
  );
  assert.ok(src.includes('learner.emailVerified === false'), 'Must verify email before attempt starts');
  assert.ok(src.includes('UNVERIFIED_EMAIL'), 'Must emit UNVERIFIED_EMAIL error code');
  assert.ok(src.includes('verifyLearnerEntitlement'), 'Must verify subscription entitlement');
  assert.ok(src.includes('SUBSCRIPTION_REQUIRED'), 'Must reject unentitled attempts');
});

// =========================================================================
// SECTION C: CONTINUATION TESTS
// =========================================================================
console.log('\n--- SECTION C: Continuation Tests ---');

await test('C1. StudySetCardActions directs unauthenticated visitor to /sign-in with returnTo preserved', () => {
  const cardActionsSrc = fs.readFileSync(
    path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'),
    'utf8'
  );
  assert.ok(cardActionsSrc.includes('status === "unauthenticated"'), 'Must check unauthenticated status');
  assert.ok(cardActionsSrc.includes('/sign-in?returnTo='), 'Must redirect to /sign-in?returnTo=');
  assert.ok(cardActionsSrc.includes('buildStudySessionHref'), 'Must preserve target study session URL');
});

await test('C2. LearnerDashboard published examinations card preserves destination for unauthenticated visitors', () => {
  const dashboardSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/page.tsx'), 'utf8');
  assert.ok(dashboardSrc.includes('/sign-in?returnTo='), 'Dashboard Start Exam must direct guests to sign-in with destination');
  assert.ok(dashboardSrc.includes('exam-session?examId='), 'Target destination must be exam-session with examId');
});

await test('C3. Sign-in page safely preserves returnTo and pathway track parameters', () => {
  const signInSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-in/page.tsx'), 'utf8');
  assert.ok(signInSrc.includes('safeReturnTo'), 'Must implement safeReturnTo logic');
  assert.ok(signInSrc.includes('params.get("returnTo")'), 'Must read returnTo param');
  assert.ok(signInSrc.includes('params.get("track")'), 'Must read track param');
  assert.ok(signInSrc.includes('destination.origin !== window.location.origin'), 'Must validate origin against open redirects');
});

await test('C4. Sign-up page safely preserves returnTo and forwards to signInHref', () => {
  const signUpSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-up/page.tsx'), 'utf8');
  assert.ok(signUpSrc.includes('params.get("returnTo")'), 'Must read returnTo param');
  assert.ok(signUpSrc.includes('signInHref'), 'Must maintain sign-in continuation link');
});

await test('C5. ValidateClient preserves returnTo and refreshes session on email verification', () => {
  const validateSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'),
    'utf8'
  );
  assert.ok(validateSrc.includes('safeDestination'), 'Must sanitize returnTo destination');
  assert.ok(validateSrc.includes('refresh()'), 'Must revalidate session');
});

await test('C6. Subscription page preserves returnTo and offers Resume on activation', () => {
  const subSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subSrc.includes('safeReturnTo'), 'Must sanitize returnTo destination');
  assert.ok(subSrc.includes('Resume'), 'Must offer Resume CTA after activation');
});

console.log(`\n=========================================================================`);
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log(`=========================================================================`);

if (failed > 0) {
  process.exit(1);
}
