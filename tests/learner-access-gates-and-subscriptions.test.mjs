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

const { verifyLearnerEntitlement } = await import('../src/lib/subscriptions/entitlement-service.ts');
const { middleware } = await import('../src/middleware.ts');
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

console.log('=== NURVIA LEARNER ACCESS GATES & SUBSCRIPTION STATUS TEST SUITE ===');

// --- 1. SERVER-SIDE AUTHENTICATION & LIBRARY ROUTE PROTECTION ---
await test('1. Middleware: unauthenticated requests to /learner/library redirect server-side to /sign-in with returnTo preserved', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=RN&subjectIds=188', {
    headers: { host: 'localhost:3000' },
  });

  const res = middleware(req);
  assert.equal(res.status, 307, 'Should redirect unauthenticated request');
  const location = res.headers.get('location') || '';
  assert.ok(location.includes('/sign-in'), 'Redirect must point to /sign-in');
  assert.ok(location.includes('returnTo=%2Flearner%2Flibrary%3Ftrack%3DRN%26subjectIds%3D188'), 'returnTo must preserve full path and query params');
});

await test('2. Middleware: authenticated requests with Casto session cookies pass through to /learner/library', () => {
  const req = new NextRequest('http://localhost:3000/learner/library?track=PN_LPN', {
    headers: {
      host: 'localhost:3000',
      cookie: 'nurvia_casto_line=valid_line_123; nurvia_casto_badge=valid_badge_456',
    },
  });

  const res = middleware(req);
  assert.notEqual(res.status, 307, 'Authenticated request must not redirect to sign-in');
  assert.equal(res.status, 200);
});

await test('3. LearnerStudyLibraryPage: does not grant public bypass (allowPublic removed)', () => {
  const libraryPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/library/page.tsx'), 'utf8');
  assert.ok(!libraryPageSrc.includes('allowPublic'), 'LearnerStudyLibraryPage must not contain allowPublic');
  assert.ok(libraryPageSrc.includes('<LearnerShell>'), 'Must enforce LearnerShell authentication');
});

// --- 2. EMAIL VERIFICATION GATE & MODAL ---
await test('4. LearnerShell: mounts LearnerVerificationModal when user is authenticated but unverified', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/learner-shell.tsx'), 'utf8');
  assert.ok(shellSrc.includes('LearnerVerificationModal'), 'LearnerShell must import LearnerVerificationModal');
  assert.ok(
    shellSrc.includes('user?.emailVerified === false') || shellSrc.includes('emailVerified'),
    'Must check emailVerified status'
  );
  assert.ok(shellSrc.includes('NavbarSubscriptionButton'), 'LearnerShell must include NavbarSubscriptionButton');
});

await test('5. LearnerVerificationModal: provides email display, resend action, cooldown, and status check', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/auth/LearnerVerificationModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('Email Verification Required'), 'Modal must announce verification requirement');
  assert.ok(modalSrc.includes('user.email'), 'Modal must display user account email');
  assert.ok(modalSrc.includes('/api/auth/support/email'), 'Modal must invoke support email endpoint');
  assert.ok(modalSrc.includes('resend-verification'), 'Action must be resend-verification');
  assert.ok(modalSrc.includes('resendCooldown'), 'Must implement resend cooldown timer');
  assert.ok(modalSrc.includes("I've Verified My Email") || modalSrc.includes('Checking Status'), 'Must provide re-check verification action');
  assert.ok(modalSrc.includes('role="dialog"'), 'Must have accessible dialog semantics');
});

// --- 3. REGISTRATION & VERIFICATION CONTINUATION ---
await test('6. Registration page: dispatches verification email and preserves returnTo destination', () => {
  const signUpSrc = fs.readFileSync(path.join(ROOT, 'src/app/sign-up/page.tsx'), 'utf8');
  assert.ok(signUpSrc.includes('/api/auth/support/email'), 'Sign up must trigger verification email on success');
  assert.ok(signUpSrc.includes('resend-verification'), 'Action must be resend-verification');
  assert.ok(signUpSrc.includes('signInHref'), 'Must link to sign in with preserved destination');
});

await test('7. ValidateClient: revalidates auth state and continues automatically to returnTo without restarting journey', () => {
  const validateSrc = fs.readFileSync(path.join(ROOT, 'src/app/(web)/auth/validate/ValidateClient.tsx'), 'utf8');
  assert.ok(validateSrc.includes('safeDestination'), 'ValidateClient must compute safe internal destination');
  assert.ok(validateSrc.includes('returnTo'), 'Must parse returnTo parameter');
  assert.ok(validateSrc.includes('refresh()'), 'Must revalidate authenticated session on success');
  assert.ok(validateSrc.includes('Continue to Study Library'), 'Must provide continue action');
});

// --- 4. BACKEND SUBSCRIPTION & ENTITLEMENT ENFORCEMENT ---
await test('8. verifyLearnerEntitlement: fails closed when session is missing (UNAUTHORIZED)', async () => {
  const result = await verifyLearnerEntitlement({
    session: null,
    mode: 'Tutor',
    pathway: 'RN',
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 'None');
  assert.equal(result.errorCode, 'UNAUTHORIZED');
});

await test('9. verifyLearnerEntitlement: fails closed when email is unverified (UNVERIFIED)', async () => {
  const mockSession = { castoLine: 'line_test', castoBadge: 'badge_test' };
  const result = await verifyLearnerEntitlement({
    session: mockSession,
    mode: 'Exam',
    pathway: 'RN',
    isEmailVerified: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.errorCode, 'UNVERIFIED');
});

await test('10. verifyLearnerEntitlement: Superadmin is universally authorized', async () => {
  const result = await verifyLearnerEntitlement({
    session: { castoLine: 'super_line', castoBadge: 'super_badge' },
    mode: 'Tutor',
    pathway: 'RN',
    isSuperadmin: true,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, 'Active');
  assert.equal(result.entitlements?.tutor, true);
  assert.equal(result.entitlements?.exam, true);
});

await test('11. API /api/attempts/start/[examId]: enforces email verification and subscription entitlement server-side', () => {
  const startExamSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/attempts/start/[examId]/route.ts'), 'utf8');
  assert.ok(startExamSrc.includes('learner.emailVerified === false'), 'Must verify email before attempt starts');
  assert.ok(startExamSrc.includes('UNVERIFIED_EMAIL'), 'Must return UNVERIFIED_EMAIL error code');
  assert.ok(startExamSrc.includes('verifyLearnerEntitlement'), 'Must check subscription entitlement on backend');
  assert.ok(startExamSrc.includes('SUBSCRIPTION_REQUIRED'), 'Must reject unentitled attempts with 403');
});

await test('12. API /api/subscriptions/status: route exists with no-store headers and resolves entitlement', () => {
  const statusRouteSrc = fs.readFileSync(path.join(ROOT, 'src/app/api/subscriptions/status/route.ts'), 'utf8');
  assert.ok(statusRouteSrc.includes('verifyLearnerEntitlement'), 'Must invoke verifyLearnerEntitlement');
  assert.ok(statusRouteSrc.includes('NO_STORE_HEADERS'), 'Must enforce no-store headers');
  assert.ok(statusRouteSrc.includes('getServerCastoSession'), 'Must read server session');
});

// --- 5. STUDY LIBRARY TUTOR & EXAM MODE ACTION GATING ---
await test('13. StudySetCardActions: Tutor Mode and Exam Mode check subscription status before navigation', () => {
  const cardActionsSrc = fs.readFileSync(path.join(ROOT, 'src/components/study/StudySetCardActions.tsx'), 'utf8');
  assert.ok(cardActionsSrc.includes('/api/subscriptions/status'), 'Card actions must verify subscription with backend');
  assert.ok(cardActionsSrc.includes('handleLaunchMode'), 'Must intercept mode launch with verification handler');
  assert.ok(cardActionsSrc.includes('/learner/subscription?requiredMode='), 'Must redirect unentitled learners to subscription plans');
  assert.ok(cardActionsSrc.includes('returnTo='), 'Must preserve return destination with pathway and exam context');
});

await test('14. ExamLoadingScreen: handles subscription errors and renders direct link to subscription plans', () => {
  const screenSrc = fs.readFileSync(path.join(ROOT, 'src/components/exam/ExamLoadingScreen.tsx'), 'utf8');
  assert.ok(screenSrc.includes('View Subscription Plans'), 'Must provide direct link to subscription plans on subscription error');
  assert.ok(screenSrc.includes('/learner/subscription?returnTo='), 'Must preserve current attempt destination in returnTo');
});

// --- 6. DASHBOARD NAVBAR SUBSCRIPTION STATUS BUTTON ---
await test('15. NavbarSubscriptionButton: authoritative Active and Subscribe states with loading skeleton', () => {
  const navBtnSrc = fs.readFileSync(path.join(ROOT, 'src/components/layout/NavbarSubscriptionButton.tsx'), 'utf8');
  assert.ok(navBtnSrc.includes('/api/subscriptions/status'), 'Button must fetch authoritative backend status');
  assert.ok(navBtnSrc.includes('Active'), 'Must render Active badge when subscription is active');
  assert.ok(navBtnSrc.includes('Subscribe'), 'Must render Subscribe CTA when subscription is not active');
  assert.ok(navBtnSrc.includes('animate-pulse'), 'Must render loading skeleton during fetch');
  assert.ok(navBtnSrc.includes('/learner/subscription'), 'Must link to /learner/subscription');
  assert.ok(navBtnSrc.includes('nurvia:subscription-updated'), 'Must listen to subscription update events');
});

// --- 7. RETURN-TO-DESTINATION CONTINUITY ---
await test('16. Subscription page: preserves returnTo destination and provides Resume button after activation', () => {
  const subPageSrc = fs.readFileSync(path.join(ROOT, 'src/app/learner/subscription/page.tsx'), 'utf8');
  assert.ok(subPageSrc.includes('safeReturnTo'), 'Must safely parse returnTo destination');
  assert.ok(subPageSrc.includes('Resume'), 'Must offer Resume CTA after activation');
  assert.ok(subPageSrc.includes('nurvia:subscription-updated'), 'Must dispatch update event on activation');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
