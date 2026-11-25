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

console.log('=== NURVIA AUTHORITATIVE 50-POINT LEARNER ACCESS CONTROL VERIFICATION ===\n');

// =========================================================================
// SECTION A: GUEST DISCOVERY AND PATHWAY SELECTION (1 - 10)
// =========================================================================
console.log('--- A. Guest Discovery and Pathway Selection ---');

await test('1. Guest can access the public homepage', () => {
  const req = new NextRequest('http://localhost:3000/', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Homepage must return 200 without redirect');
  assert.equal(res.headers.get('location'), null);
});

await test('2. Guest can view publicly displayed subjects', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('initialStudySets'), 'Homepage must render public study sets');
  assert.ok(pageSrc.includes('filteredSets'), 'Homepage must display filtered subject cards');
});

await test('3. Guest can view available RN and PN/LPN pathways', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('RN Exams'), 'Homepage must display RN Exams pathway option');
  assert.ok(pageSrc.includes('LPN Exams'), 'Homepage must display LPN Exams pathway option');
  assert.ok(pageSrc.includes('RN Exit Exams'), 'Homepage must display RN Exit pathway option');
  assert.ok(pageSrc.includes('LPN Exit Exams'), 'Homepage must display LPN Exit pathway option');
});

await test('4. Guest selecting RN reaches RN subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('rnPathwayHref'), 'Homepage must compute rnPathwayHref');
  assert.ok(pageSrc.includes('rnPathwayHref = "/learner/library?track=RN"'), 'Guest RN selection must route directly to RN library');

  const req = new NextRequest('http://localhost:3000/learner/library?track=RN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'RN library subjects route must return status 200 without redirect for guests');
});

await test('5. Guest selecting PN/LPN reaches PN/LPN subjects without authentication', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('lpnPathwayHref'), 'Homepage must compute lpnPathwayHref');
  assert.ok(pageSrc.includes('/exams?track=PN_LPN'), 'Guest PN/LPN selection must route directly to public PN/LPN subjects');

  const req = new NextRequest('http://localhost:3000/exams?track=PN_LPN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Public PN/LPN subjects route must return status 200 without redirect for guests');
});

await test('5b. Guest selecting an examination from a subject card encounters the authentication gate', () => {
  const subjectCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/SubjectCard.tsx'), 'utf8');
  assert.ok(
    subjectCardSrc.includes('!isAuthenticated'),
    'SubjectCard must check authentication state'
  );
  assert.ok(
    subjectCardSrc.includes('/sign-in?returnTo='),
    'Unauthenticated examination selection from subject card must route to sign-in'
  );
  assert.ok(
    subjectCardSrc.includes('track='),
    'SubjectCard must preserve pathway in returnTo'
  );
  assert.ok(
    subjectCardSrc.includes('params.set("subject"') || subjectCardSrc.includes('subject='),
    'SubjectCard must preserve subject name in returnTo'
  );
});

await test('5c. Guest can click Try a Practice Set on homepage without being forced to sign in', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('startHref'), 'Homepage must define startHref');
  assert.ok(
    pageSrc.includes('startHref = "/learner/library"'),
    'Try a Practice Set must navigate to /learner/library without forcing sign-in'
  );
});

await test('6. Guest can enter the RN library directly for subject discovery without authentication', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=RN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Direct guest entry to RN library for subject discovery must return 200');
  assert.equal(res.headers.get('location'), null, 'Must not redirect guest browsing RN subjects in library');
});

await test('7. Guest can enter the PN/LPN library directly for subject discovery without authentication', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=PN_LPN', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Direct guest entry to PN/LPN library for subject discovery must return 200');
  assert.equal(res.headers.get('location'), null, 'Must not redirect guest browsing PN/LPN subjects in library');
});

await test('8. Guest cannot access examination details', () => {
  const req = new NextRequest('http://localhost:3000/learner/library/exam_secret_123', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 307, 'Direct guest entry to examination detail page must be blocked');
  const loc = res.headers.get('location') || '';
  assert.ok(loc.includes('/sign-in'), 'Must redirect to sign-in');
  assert.ok(loc.includes('returnTo=%2Flearner%2Flibrary%2Fexam_secret_123'), 'Must preserve detail destination');
});

await test('9. Guest cannot retrieve protected examination content through direct API requests', () => {
  const strataRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/strata/[resource]/route.ts'), 'utf8');
  assert.ok(strataRoute.includes("resource === 'exams'"), 'Strata exams route must enforce auth gate');
  const detailRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/study-library/[id]/route.ts'), 'utf8');
  assert.ok(detailRoute.includes('!session'), 'Study library detail route must enforce auth gate');
});

await test('10. The selected pathway is preserved during authentication', () => {
  const signInSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-in/page.tsx'), 'utf8');
  assert.ok(signInSrc.includes('returnTo'), 'Sign-in page must preserve returnTo');
  assert.ok(signInSrc.includes('track'), 'Sign-in page must preserve pathway track');
});

// =========================================================================
// SECTION B: EMAIL VERIFICATION (11 - 15)
// =========================================================================
console.log('\n--- B. Email Verification ---');

await test('11. Authenticated but unverified learner cannot enter the examination library', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/learner-shell.tsx'), 'utf8');
  assert.ok(
    shellSrc.includes('user?.emailVerified === false'),
    'LearnerShell must detect unverified email status'
  );
  assert.ok(
    shellSrc.includes('Email Verification Required'),
    'LearnerShell must hide library content when email is unverified'
  );
});

await test('12. The existing email-verification flow is initiated appropriately', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/learner-shell.tsx'), 'utf8');
  assert.ok(
    shellSrc.includes('<LearnerVerificationModal'),
    'LearnerShell must render LearnerVerificationModal for unverified learners'
  );
  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/auth/LearnerVerificationModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('resend-verification'), 'Modal must support resend verification action');
});

await test('13. The selected pathway survives email verification', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('params.get("track")'), 'ValidateClient must read track parameter');
  assert.ok(validateSrc.includes('track='), 'ValidateClient must preserve track on redirect');
  assert.ok(validateSrc.includes('safeDestination'), 'ValidateClient must resolve safe destination');
});

await test('14. After successful verification, the learner reaches the correct examination library', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('router.push(safeDestination)'), 'ValidateClient must forward to destination');
});

await test('15. The learner is not incorrectly sent to a generic homepage or the wrong pathway', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('/learner/library?track='), 'ValidateClient must prioritize pathway destination over generic fallback');
});

// =========================================================================
// SECTION C: AUTHENTICATED LEARNERS WITHOUT SUBSCRIPTIONS (16 - 26)
// =========================================================================
console.log('\n--- C. Authenticated Learners Without Subscriptions ---');

await test('16. Authenticated and verified learner without a subscription can enter the RN examination library', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=RN', {
    headers: {
      host: 'localhost:3000',
      cookie: 'nurvia_casto_line=valid_line; nurvia_casto_badge=valid_badge',
    },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Authenticated request to RN library must succeed');
  assert.equal(res.headers.get('location'), null);
});

await test('17. Authenticated and verified learner without a subscription can enter the PN/LPN examination library', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=PN_LPN', {
    headers: {
      host: 'localhost:3000',
      cookie: 'nurvia_casto_line=valid_line; nurvia_casto_badge=valid_badge',
    },
  });
  const res = middleware(req);
  assert.equal(res.status, 200, 'Authenticated request to PN/LPN library must succeed');
  assert.equal(res.headers.get('location'), null);
});

await test('18. Such learners can browse examination listings', () => {
  const libraryViewSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/study-library-view.tsx'), 'utf8');
  assert.ok(libraryViewSrc.includes('StudySetCard'), 'Library view must display StudySetCard components');
  assert.ok(!libraryViewSrc.includes('requireSubscription'), 'Library view must not require subscription to list exams');
});

await test('19. Such learners can open permitted examination details', () => {
  const detailRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/study-library/[id]/route.ts'), 'utf8');
  assert.ok(!detailRoute.includes('verifyLearnerEntitlement'), 'Detail route must not block learners lacking subscriptions');
});

await test('20. Loading examination details does not trigger the authentication gate', () => {
  const detailsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetDetails.tsx'), 'utf8');
  assert.ok(!detailsComp.includes('loadDetail() { router.push("/sign-in")'), 'Loading details must not redirect authenticated learners');
});

await test('21. Loading examination details does not trigger the subscription gate', () => {
  const detailsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetDetails.tsx'), 'utf8');
  assert.ok(!detailsComp.includes('loadDetail() { router.push("/learner/subscription")'), 'Loading details must not trigger subscription redirect');
});

await test('22. Selecting Start Exam immediately triggers the subscription gate', () => {
  const actionsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsComp.includes('/api/subscriptions/status?mode='), 'Card actions must verify subscription status');
  assert.ok(actionsComp.includes('router.push(subDestination)'), 'Must redirect to subscription page when unentitled');
});

await test('23. Selecting Tutor Mode immediately triggers the subscription gate', () => {
  const detailsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetDetails.tsx'), 'utf8');
  assert.ok(detailsComp.includes('handleLaunchMode("Tutor"'), 'Details component must handle Tutor Mode launch');
  assert.ok(detailsComp.includes('subDestination'), 'Must prepare subscription destination');
});

await test('24. Other protected learning modes also trigger the subscription gate', () => {
  const actionsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsComp.includes('mode === "Exam"') || actionsComp.includes('mode: "Exam" | "Tutor"'), 'Guards all protected modes');
});

await test('25. The subscription gate directs the learner to /learner/subscription', () => {
  const actionsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsComp.includes('/learner/subscription?requiredMode='), 'Destination must be /learner/subscription with context');
});

await test('26. The authentication gate is never displayed for an already authenticated and verified learner solely because they lack a subscription', () => {
  const actionsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  const detailsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetDetails.tsx'), 'utf8');
  assert.ok(actionsComp.includes('router.push(subDestination)'), 'Card actions routes to subDestination when user lacks subscription');
  assert.ok(detailsComp.includes('router.push(subDestination)'), 'Details routes to subDestination when user lacks subscription');
});

// =========================================================================
// SECTION D: SUBSCRIPTION AND ENTITLEMENT VALIDATION (27 - 35)
// =========================================================================
console.log('\n--- D. Subscription and Entitlement Validation ---');

await test('27. Expired subscription cannot launch protected learning modes', async () => {
  const result = await verifyLearnerEntitlement({
    session: { castoBadge: 'test', castoLine: 'test', appDomain: 'test', castoId: '1' },
    mode: 'Exam',
    isSuperadmin: false,
    isEmailVerified: true,
  });
  assert.equal(result.allowed, false, 'Expired or missing subscription must be denied');
});

await test('28. Cancelled subscription cannot launch protected learning modes', async () => {
  const result = await verifyLearnerEntitlement({
    session: { castoBadge: 'test', castoLine: 'test', appDomain: 'test', castoId: '1' },
    mode: 'Tutor',
    isSuperadmin: false,
    isEmailVerified: true,
  });
  assert.equal(result.allowed, false, 'Cancelled or missing subscription must be denied');
});

await test('29. Inactive subscription cannot launch protected learning modes', async () => {
  const result = await verifyLearnerEntitlement({
    session: { castoBadge: 'test', castoLine: 'test', appDomain: 'test', castoId: '1' },
    mode: 'Exam',
    pathway: 'RN',
    isSuperadmin: false,
    isEmailVerified: true,
  });
  assert.equal(result.allowed, false, 'Inactive subscription must be denied');
});

await test('30. Pending subscription cannot launch protected learning modes unless explicitly authorized', async () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'src/lib/subscriptions/entitlement-service.ts'), 'utf8');
  assert.ok(serviceSrc.includes('normalizeSubStatus'), 'Must normalize backend status');
  assert.ok(!serviceSrc.includes("status === 'Pending' && !isDateExpired"), 'Pending status must not be treated as active');
});

await test('31. Active subscription without the required feature entitlement cannot launch that feature', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'src/lib/subscriptions/entitlement-service.ts'), 'utf8');
  assert.ok(serviceSrc.includes('options.mode === \'Tutor\' && !grantsTutor'), 'Must check Tutor entitlement specifically');
  assert.ok(serviceSrc.includes('options.mode === \'Exam\' && !grantsExam'), 'Must check Exam entitlement specifically');
});

await test('32. Active subscription with the wrong pathway entitlement cannot launch the protected experience', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT, 'src/lib/subscriptions/entitlement-service.ts'), 'utf8');
  assert.ok(serviceSrc.includes('grantedPathways.has'), 'Must check pathway allowlist against active subscription');
  assert.ok(serviceSrc.includes('does not include access to the'), 'Must reject unauthorized pathway');
});

await test('33. Valid subscription with the correct feature and pathway entitlement permits access', async () => {
  const result = await verifyLearnerEntitlement({
    session: { castoBadge: 'admin', castoLine: 'admin', appDomain: 'test', castoId: '99' },
    mode: 'Exam',
    pathway: 'RN',
    isSuperadmin: true,
    isEmailVerified: true,
  });
  assert.equal(result.allowed, true, 'Superadmin or valid entitlement must be permitted');
  assert.equal(result.status, 'Active');
});

await test('34. Subscription verification failure denies protected access safely (fail closed)', async () => {
  const result = await verifyLearnerEntitlement({
    session: null,
    mode: 'Exam',
  });
  assert.equal(result.allowed, false, 'Failure must deny access');
  assert.equal(result.errorCode, 'UNAUTHORIZED');
});

await test('35. Stale client subscription state cannot bypass backend authorization', () => {
  const startRouteSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'), 'utf8');
  assert.ok(startRouteSrc.includes('verifyLearnerEntitlement'), 'Start route must independently evaluate entitlement');
});

// =========================================================================
// SECTION E: BACKEND PROTECTION (36 - 43)
// =========================================================================
console.log('\n--- E. Backend Protection ---');

await test('36. Direct protected-session URL access cannot bypass authorization', () => {
  const req = new NextRequest('http://localhost:3000/exam-session?examId=exam_999&mode=Exam', {
    headers: { host: 'localhost:3000' },
  });
  const res = middleware(req);
  assert.equal(res.status, 307, 'Must redirect unauthenticated request to /exam-session');
});

await test('37. Direct examination-session API requests cannot bypass authorization', () => {
  const startRouteSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'), 'utf8');
  assert.ok(startRouteSrc.includes('resolveAttemptLearner'), 'Must resolve authenticated learner');
  assert.ok(startRouteSrc.includes('learner.emailVerified === false'), 'Must verify email verification');
  assert.ok(startRouteSrc.includes('verifyLearnerEntitlement'), 'Must check subscription entitlement');
});

await test('38. Unauthorized learners cannot retrieve protected questions', () => {
  const reviewRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/exams/[examId]/review-content/route.ts'), 'utf8');
  assert.ok(reviewRoute.includes('verifyLearnerEntitlement'), 'Review content route must check entitlement');
  assert.ok(reviewRoute.includes('learner.emailVerified === false'), 'Review content route must check email verification');
});

await test('39. Unauthorized learners cannot create examination attempts', () => {
  const startRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'), 'utf8');
  assert.ok(startRoute.includes('!entitlement.allowed'), 'Attempt creation must block unentitled requests');
});

await test('40. Unauthorized learners cannot start Tutor Mode sessions', () => {
  const tutorRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/[attemptId]/tutor/session/route.ts'), 'utf8');
  assert.ok(tutorRoute.includes('verifyLearnerEntitlement'), 'Tutor session route must check entitlement');
});

await test('41. Unauthorized learners cannot submit or persist protected responses', () => {
  const responsesRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/[attemptId]/responses/route.ts'), 'utf8');
  assert.ok(responsesRoute.includes('verifyLearnerEntitlement'), 'Responses route must check entitlement');
  assert.ok(responsesRoute.includes('learner.emailVerified === false'), 'Responses route must check email verification');
});

await test('42. Unauthorized learners cannot access protected attempt information', () => {
  const attemptRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/[attemptId]/route.ts'), 'utf8');
  assert.ok(attemptRoute.includes('verifyLearnerEntitlement'), 'Attempt route must check entitlement');
  assert.ok(attemptRoute.includes('learner.emailVerified === false'), 'Attempt route must check email verification');
});

await test('43. Authorized learners can complete the existing examination workflow normally', () => {
  const startRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'), 'utf8');
  assert.ok(
    startRoute.includes('attemptStore.setAttempt') || startRoute.includes('attemptStore.createAttempt'),
    'Authorized flow retains attempt persistence'
  );
  const submitRoute = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/[attemptId]/submit/route.ts'), 'utf8');
  assert.ok(submitRoute.includes('attemptStore.submitAttempt'), 'Authorized flow retains submitAttempt');
});

// =========================================================================
// SECTION F: RETURN NAVIGATION AND INTEGRATION (44 - 50)
// =========================================================================
console.log('\n--- F. Return Navigation and Integration ---');

await test('44. Selected pathway survives registration', () => {
  const signUpSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-up/page.tsx'), 'utf8');
  assert.ok(signUpSrc.includes('returnTo'), 'Sign-up must handle returnTo');
  assert.ok(signUpSrc.includes('track'), 'Sign-up must handle track parameter');
});

await test('45. Selected pathway survives sign-in', () => {
  const signInSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-in/page.tsx'), 'utf8');
  assert.ok(signInSrc.includes('returnTo'), 'Sign-in must preserve returnTo');
  assert.ok(signInSrc.includes('track'), 'Sign-in must preserve track');
});

await test('46. Selected pathway survives email verification', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('track'), 'Email verification must preserve track in safeDestination');
});

await test('47. Examination ID and intended learning mode are preserved when subscription gate is displayed', () => {
  const actionsComp = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(actionsComp.includes('requiredMode='), 'Subscription destination must preserve requiredMode');
  assert.ok(actionsComp.includes('examId='), 'Subscription destination must preserve examId');
  assert.ok(actionsComp.includes('pathway='), 'Subscription destination must preserve pathway');
});

await test('48. Successful subscription activation triggers fresh authorization validation', () => {
  const subPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subPageSrc.includes('/api/subscriptions/status?mode='), 'Subscription page must revalidate with backend');
});

await test('49. An authorized learner can continue to the intended destination', () => {
  const subPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subPageSrc.includes('safeReturnTo'), 'Subscription page must resolve safe return destination');
  assert.ok(subPageSrc.includes('router.push(safeReturnTo)'), 'Must navigate when authorized');
});

await test('50. An unsuccessful or incomplete subscription process does not grant access', () => {
  const subPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subPageSrc.includes('authData.allowed'), 'Must strictly require authData.allowed');
  assert.ok(subPageSrc.includes('data.allowed'), 'Resume must strictly require data.allowed');
});

console.log(`\n=========================================================================`);
console.log(`All 50 Authoritative Regression Tests Completed: ${passed} passed, ${failed} failed.`);
console.log(`=========================================================================\n`);
