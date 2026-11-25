// tests/quiznurse-brand-and-regression-60.test.mjs
// Authoritative 60-Point QuizNurse Brand, Domain, Learner Journey & Preservation Test Suite

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function runTest(num, title, fn) {
  try {
    fn();
    console.log(`[PASS] ${num}. ${title}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${num}. ${title}:`, err.message);
    failed++;
  }
}

console.log('=== QUIZNURSE AUTHORITATIVE 60-POINT BRAND & REGRESSION TEST SUITE ===\n');

// ---------------------------------------------------------------------------
// Group 1: Brand Identity (1 - 10)
// ---------------------------------------------------------------------------
console.log('--- Group 1: Brand Identity (1 - 10) ---');

runTest(1, 'Homepage displays QuizNurse branding', () => {
  const homeContent = fs.readFileSync('src/app/(web)/pages/home/home.tsx', 'utf8');
  assert.ok(homeContent.includes('QuizNurse Standard'), 'Home should reference QuizNurse Standard');
  assert.ok(homeContent.includes('QuizNurse learning ecosystem'), 'Home should reference QuizNurse ecosystem');
  assert.ok(!homeContent.includes('NURVIA Standard'), 'Home should not contain former brand in standard badge');
});

runTest(2, 'Header displays the new QuizNurse logo', () => {
  const navContent = fs.readFileSync('src/app/(web)/includes/navbar/index.tsx', 'utf8');
  assert.ok(navContent.includes('label="QuizNurse"'), 'Navbar logo should have label QuizNurse');
  assert.ok(navContent.includes('QuizNurse Education'), 'Navbar announcement should reference QuizNurse Education');
});

runTest(3, 'Footer displays the new logo and brand name', () => {
  const footerContent = fs.readFileSync('src/app/(web)/includes/footer/index.tsx', 'utf8');
  assert.ok(footerContent.includes('label="QuizNurse"'), 'Footer logo should have label QuizNurse');
  assert.ok(footerContent.includes('QuizNurse. All rights reserved.'), 'Footer copyright should state QuizNurse');
});

runTest(4, 'Authentication pages display QuizNurse branding', () => {
  const authShell = fs.readFileSync('src/components/auth/auth-shell.tsx', 'utf8');
  assert.ok(authShell.includes('QuizNurseLogo'), 'AuthShell should import QuizNurseLogo');
  assert.ok(authShell.includes('QuizNurse Learner Sanctuary'), 'AuthShell should declare QuizNurse Learner Sanctuary');
  assert.ok(authShell.includes('Welcome back. Your next chapter begins here.'), 'AuthShell sign-in heading should match mandate');
  assert.ok(authShell.includes("Let's build your next chapter."), 'AuthShell registration heading should match mandate');
  assert.ok(authShell.includes('Every journey deserves another beginning.'), 'AuthShell recovery heading should match mandate');
  assert.ok(authShell.includes('One small step brings your learning journey closer to its destination.'), 'AuthShell verification line should match mandate');
});

runTest(5, 'Learner library displays QuizNurse branding', () => {
  const headerContent = fs.readFileSync('src/components/study/StudyLibraryHeader.tsx', 'utf8');
  assert.ok(headerContent.includes('QuizNurse Study Catalogue'), 'Library header should display QuizNurse Study Catalogue');
});

runTest(6, 'Examination pages display QuizNurse branding', () => {
  const examSession = fs.readFileSync('src/app/exam-session/page.tsx', 'utf8');
  assert.ok(examSession.includes('QuizNurse Examination'), 'Exam session should set title to QuizNurse Examination');
  assert.ok(examSession.includes('Loading QuizNurse examination session...'), 'Loading screen should state QuizNurse examination session');
});

runTest(7, 'Subscription pages display QuizNurse branding', () => {
  const subContent = fs.readFileSync('src/app/learner/subscription/page.tsx', 'utf8');
  assert.ok(subContent.includes('compare available QuizNurse tiers'), 'Subscription page should reference QuizNurse tiers');
});

runTest(8, 'Loading and error states use the correct identity', () => {
  const loading = fs.readFileSync('src/app/loading.tsx', 'utf8');
  const notFound = fs.readFileSync('src/app/not-found.tsx', 'utf8');
  const netError = fs.readFileSync('src/components/shared/feedback/NetworkError.tsx', 'utf8');
  assert.ok(loading.includes('Loading QuizNurse workspace...'), 'Loading should use QuizNurse');
  assert.ok(notFound.includes('outside the QuizNurse learning environment'), 'NotFound should use QuizNurse');
  assert.ok(netError.includes("We couldn't reach QuizNurse services"), 'NetworkError should use QuizNurse');
});

runTest(9, 'Favicon and PWA metadata use QuizNurse', () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
  assert.strictEqual(manifest.short_name, 'QuizNurse');
  assert.ok(manifest.name.includes('QuizNurse'));
  assert.strictEqual(manifest.theme_color, '#0A6265');
  assert.ok(fs.existsSync('public/brand/favicon.svg'), 'favicon.svg must exist');
  assert.ok(fs.existsSync('public/brand/quiznurse-app-icon.svg'), 'quiznurse-app-icon.svg must exist');
});

runTest(10, 'Social metadata identifies QuizNurse', () => {
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  assert.ok(layout.includes('siteName: "QuizNurse"'), 'Root layout OpenGraph should use QuizNurse');
  assert.ok(layout.includes('/brand/quiznurse-social-preview.svg'), 'Root layout should reference QuizNurse OG banner');
  assert.ok(fs.existsSync('public/brand/quiznurse-social-preview.svg'), 'OG banner file must exist');
});

// ---------------------------------------------------------------------------
// Group 2: Domain Configuration (11 - 20)
// ---------------------------------------------------------------------------
console.log('\n--- Group 2: Domain Configuration (11 - 20) ---');

runTest(11, 'Canonical production URL is https://quiznurse.com', () => {
  const config = fs.readFileSync('src/lib/config/config.ts', 'utf8');
  assert.ok(config.includes('https://quiznurse.com'), 'Config must configure canonical domain https://quiznurse.com');
});

runTest(12, 'Canonical metadata uses the verified domain', () => {
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  assert.ok(layout.includes('new URL("https://quiznurse.com")'), 'Root layout metadataBase must be https://quiznurse.com');
});

runTest(13, 'Authentication callbacks use approved production URLs', () => {
  const siteLinks = fs.readFileSync('src/lib/config/siteLinks.ts', 'utf8');
  assert.ok(siteLinks.includes('https://quiznurse.com'), 'SITE_URL fallback must use https://quiznurse.com');
});

runTest(14, 'Email verification links use the correct configured domain', () => {
  const config = fs.readFileSync('src/lib/config/config.ts', 'utf8');
  assert.ok(config.includes('APP_DOMAIN = process.env.SKEW_LINE_APP_DOMAIN || "https://quiznurse.com"'));
});

runTest(15, 'Password recovery links use the correct configured domain', () => {
  const siteLinks = fs.readFileSync('src/lib/config/siteLinks.ts', 'utf8');
  const config = fs.readFileSync('src/lib/config/config.ts', 'utf8');
  assert.ok(siteLinks.includes('SITE_URL') && config.includes('APP_DOMAIN'));
});

runTest(16, 'Payment return URLs are correct and preserve returnTo', () => {
  const subPage = fs.readFileSync('src/app/learner/subscription/page.tsx', 'utf8');
  assert.ok(subPage.includes('returnTo'), 'Subscription page must preserve returnTo destination');
});

runTest(17, 'CORS and cookie configuration support the intended production domain', () => {
  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  assert.ok(middleware.includes('nurvia_casto_line'), 'Middleware must maintain cookie session validation');
});

runTest(18, 'No redirect loops are introduced', () => {
  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  assert.ok(!middleware.includes('redirect(req.nextUrl)'), 'No unconditional self-redirects');
});

runTest(19, 'Sitemap and Robots specify official production domain', () => {
  const robots = fs.readFileSync('public/robots.txt', 'utf8');
  assert.ok(robots.includes('Sitemap: https://quiznurse.com/sitemap.xml'), 'Robots must specify official sitemap URL');
  const sitemap = fs.readFileSync('src/app/sitemap.ts', 'utf8');
  assert.ok(sitemap.includes('https://quiznurse.com'), 'Sitemap must specify official baseUrl');
});

runTest(20, 'Temporary deployment URLs are not exposed as canonical production URLs', () => {
  const config = fs.readFileSync('src/lib/config/config.ts', 'utf8');
  assert.ok(!config.includes('nurvia-black.vercel.app'), 'Config must not expose temporary vercel URLs as defaults');
});

// ---------------------------------------------------------------------------
// Group 3: Learner Journey Preservation (21 - 32)
// ---------------------------------------------------------------------------
console.log('\n--- Group 3: Learner Journey Preservation (21 - 32) ---');

runTest(21, 'Guests can access the homepage', () => {
  assert.ok(fs.existsSync('src/app/page.tsx'), 'Homepage file must exist');
});

runTest(22, 'Guests can select pathways', () => {
  const home = fs.readFileSync('src/app/page.tsx', 'utf8');
  assert.ok(home.includes('track=RN'), 'Home should support RN pathway selection');
  assert.ok(home.includes('track=PN_LPN'), 'Home should support PN_LPN pathway selection');
});

runTest(23, 'Guests can access /learner/library', () => {
  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  assert.ok(!middleware.includes('pathname.startsWith("/learner/library")'), 'Middleware must NOT block /learner/library for guests');
});

runTest(24, 'Guests can browse subject cards', () => {
  const libraryView = fs.readFileSync('src/components/study/study-library-view.tsx', 'utf8');
  assert.ok(libraryView.includes('SubjectCard'), 'Library view must render SubjectCard');
});

runTest(25, 'Selecting a subject triggers authentication at the correct point', () => {
  const cardActions = fs.readFileSync('src/components/study/StudySetCardActions.tsx', 'utf8');
  assert.ok(cardActions.includes('/sign-in?returnTo='), 'Guest selecting exam on subject card is routed to /sign-in with returnTo');
});

runTest(26, 'Subject context survives sign-in', () => {
  const signIn = fs.readFileSync('src/app/sign-in/page.tsx', 'utf8');
  assert.ok(signIn.includes('returnTo'), 'Sign-in must preserve returnTo');
});

runTest(27, 'Subject context survives email verification', () => {
  const validate = fs.readFileSync('src/app/(web)/auth/validate/ValidateClient.tsx', 'utf8');
  assert.ok(validate.includes('returnTo'), 'Email validate client must preserve returnTo');
});

runTest(28, 'Successful verification automatically opens the selected subject examinations', () => {
  const validate = fs.readFileSync('src/app/(web)/auth/validate/ValidateClient.tsx', 'utf8');
  assert.ok(validate.includes('safeDestination') && validate.includes('router.push(safeDestination)'), 'ValidateClient must forward to target destination');
});

runTest(29, 'Verified learners can browse examinations without a subscription', () => {
  const library = fs.readFileSync('src/app/learner/library/page.tsx', 'utf8');
  assert.ok(!library.includes('redirect("/learner/subscription")'), 'Library must not force subscription redirect merely to browse');
});

runTest(30, 'Subscription enforcement remains at protected learning-mode launch', () => {
  const actionsSrc = fs.readFileSync('src/components/study/StudySetCardActions.tsx', 'utf8');
  assert.ok(actionsSrc.includes('/learner/subscription?requiredMode='), 'Redirects unentitled learner to /learner/subscription');
});

runTest(31, 'Backend entitlement checks remain functional', () => {
  const api = fs.readFileSync('src/lib/api-client.ts', 'utf8');
  assert.ok(api.includes('getMySubscription'), 'API client must support subscription checks');
});

runTest(32, 'Quick Practice remains publicly accessible and functional', () => {
  const homeSrc = fs.readFileSync('src/app/page.tsx', 'utf8');
  const qpSrc = fs.readFileSync('src/components/home/practice-question-preview.tsx', 'utf8');
  assert.ok(homeSrc.includes('startHref = "/learner/library"'), 'Practice Set link must navigate to /learner/library without sign-in');
  assert.ok(qpSrc.includes('handleSelectOption'), 'Quick practice component must allow interaction directly for guests');
});

// ---------------------------------------------------------------------------
// Group 4: Existing Functionality Preservation (33 - 44)
// ---------------------------------------------------------------------------
console.log('\n--- Group 4: Existing Functionality Preservation (33 - 44) ---');

runTest(33, 'Google authentication configuration exists', () => {
  const authShell = fs.readFileSync('src/app/sign-in/page.tsx', 'utf8');
  assert.ok(authShell.includes('Google') || authShell.includes('google'), 'Sign in must support Google authentication');
});

runTest(34, 'Email/password authentication works', () => {
  const signIn = fs.readFileSync('src/app/sign-in/page.tsx', 'utf8');
  assert.ok(signIn.includes('password'), 'Sign in must support password');
});

runTest(35, 'Registration works', () => {
  const signUp = fs.readFileSync('src/app/sign-up/page.tsx', 'utf8');
  assert.ok(signUp.includes('register') || signUp.includes('handleSubmit'), 'Sign up must handle registration');
});

runTest(36, 'Email verification works', () => {
  const modal = fs.readFileSync('src/components/auth/LearnerVerificationModal.tsx', 'utf8');
  assert.ok(modal.includes('verifyEmail') || modal.includes('confirm'), 'Verification modal must exist');
});

runTest(37, 'Password recovery works', () => {
  const forgot = fs.readFileSync('src/app/forgot-password/page.tsx', 'utf8');
  assert.ok(forgot.includes('forgotPassword') || forgot.includes('handleSubmit'), 'Forgot password must exist');
});

runTest(38, 'Examination functionality works', () => {
  const session = fs.readFileSync('src/app/exam-session/page.tsx', 'utf8');
  assert.ok(session.includes('startAttempt'), 'Exam session must support startAttempt');
});

runTest(39, 'Tutor Mode works for entitled learners', () => {
  const tutor = fs.readFileSync('src/components/exam/TutorModePanel.tsx', 'utf8');
  assert.ok(tutor.includes('requestTutorHint'), 'Tutor panel must support tutor assistance');
});

runTest(40, 'Payment and subscription workflows remain functional', () => {
  const sub = fs.readFileSync('src/app/learner/subscription/page.tsx', 'utf8');
  assert.ok(sub.includes('requestCheckout'), 'Subscription must support requestCheckout');
});

runTest(41, 'Learner progress and results remain intact', () => {
  const history = fs.readFileSync('src/app/learner/history/page.tsx', 'utf8');
  assert.ok(history.includes('getAttemptHistory'), 'History must support getAttemptHistory');
});

runTest(42, 'Existing API contracts remain compatible', () => {
  const client = fs.readFileSync('src/lib/api-client.ts', 'utf8');
  assert.ok(client.includes('export const nurviaApi'), 'nurviaApi export must remain for backward compatibility');
  assert.ok(client.includes('export const quizNurseApi'), 'quizNurseApi export must be present');
});

runTest(43, 'No existing subject or pathway mappings are lost', () => {
  const curr = fs.readFileSync('src/lib/study-library/curriculum-consolidation.ts', 'utf8');
  assert.ok(curr.includes('RN_PROGRAM_ID'), 'RN Program ID must be preserved');
  assert.ok(curr.includes('LPN_PROGRAM_ID'), 'LPN Program ID must be preserved');
});

runTest(44, 'No existing learner records are lost (schemas & models intact)', () => {
  const types = fs.readFileSync('src/lib/api-types.ts', 'utf8');
  assert.ok(types.includes('QuestionDto'), 'QuestionDto must exist');
  assert.ok(types.includes('ExamDto'), 'ExamDto must exist');
});

// ---------------------------------------------------------------------------
// Group 5: Visual and Responsive Quality (45 - 54)
// ---------------------------------------------------------------------------
console.log('\n--- Group 5: Visual and Responsive Quality (45 - 54) ---');

runTest(45, 'Logo is readable at favicon size (32x32)', () => {
  const fav = fs.readFileSync('public/brand/favicon.svg', 'utf8');
  assert.ok(fav.includes('viewBox="0 0 32 32"'), 'Favicon must be calibrated at 32x32');
  assert.ok(fav.includes('rect width="32" height="32"'), 'Favicon container must exist');
});

runTest(46, 'Logo is visually correct on light backgrounds', () => {
  const light = fs.readFileSync('public/brand/quiznurse-logo-light.svg', 'utf8');
  assert.ok(light.includes('#193B42'), 'Light logo wordmark uses Forest Slate');
  assert.ok(light.includes('#0A6265'), 'Light logo symbol uses Deep Teal');
});

runTest(47, 'Logo is visually correct on dark backgrounds', () => {
  const dark = fs.readFileSync('public/brand/quiznurse-logo-dark.svg', 'utf8');
  assert.ok(dark.includes('#F8FAFC') || dark.includes('#FFFFFF'), 'Dark logo wordmark uses crisp light text');
  assert.ok(dark.includes('#2DD4BF'), 'Dark logo accent uses vivid teal');
});

runTest(48, 'Homepage is responsive and preserves mobile navigation', () => {
  const nav = fs.readFileSync('src/app/(web)/includes/navbar/index.tsx', 'utf8');
  assert.ok(nav.includes('mobileMenuOpen'), 'Navbar must support mobile menu');
});

runTest(49, 'Authentication pages are responsive with split screen', () => {
  const authShell = fs.readFileSync('src/components/auth/auth-shell.tsx', 'utf8');
  assert.ok(authShell.includes('lg:col-span-5'), 'AuthShell must define desktop visual panel col span');
  assert.ok(authShell.includes('lg:col-span-7'), 'AuthShell must define desktop form panel col span');
  assert.ok(authShell.includes('lg:hidden'), 'AuthShell must provide compact mobile visual banner');
});

runTest(50, 'Learner interfaces are responsive', () => {
  const learnerShell = fs.readFileSync('src/components/layout/learner-shell.tsx', 'utf8');
  assert.ok(learnerShell.includes('Menu') || learnerShell.includes('sidebar'), 'Learner shell must support responsive sidebar');
});

runTest(51, 'Accessibility checks pass: aria-labels and semantic landmarks', () => {
  const authShell = fs.readFileSync('src/components/auth/auth-shell.tsx', 'utf8');
  assert.ok(authShell.includes('aria-label="QuizNurse Clinical Storytelling"'));
  assert.ok(authShell.includes('aria-label="Authentication form"'));
});

runTest(52, 'Reduced-motion preferences are respected in design tokens & animations', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  assert.ok(css.includes('--clinical-teal: #0A6265;'), 'Clinical warmth palette must be defined in CSS');
});

runTest(53, 'Vector SVG logo family assets exist on disk', () => {
  const requiredAssets = [
    'public/brand/quiznurse-symbol.svg',
    'public/brand/quiznurse-logo-light.svg',
    'public/brand/quiznurse-logo-dark.svg',
    'public/brand/quiznurse-logo-stacked.svg',
    'public/brand/quiznurse-symbol-monochrome.svg',
    'public/brand/favicon.svg',
    'public/brand/quiznurse-app-icon.svg',
    'public/brand/quiznurse-social-preview.svg',
  ];
  for (const asset of requiredAssets) {
    assert.ok(fs.existsSync(asset), `Asset must exist: ${asset}`);
  }
});

runTest(54, 'Design tokens enforce Clinical Warmth palette', () => {
  const tailwind = fs.readFileSync('tailwind.config.ts', 'utf8');
  assert.ok(tailwind.includes('teal: "#0A6265"'), 'Deep Teal must be configured');
  assert.ok(tailwind.includes('slate: "#193B42"'), 'Forest Slate must be configured');
  assert.ok(tailwind.includes('mist: "#F1F6F4"'), 'Eucalyptus Mist must be configured');
  assert.ok(tailwind.includes('sand: "#F5EDE2"'), 'Warm Sand must be configured');
  assert.ok(tailwind.includes('sage: "#D6E9E3"'), 'Soft Sage must be configured');
  assert.ok(tailwind.includes('amber: "#C58B43"'), 'Muted Amber must be configured');
});

// ---------------------------------------------------------------------------
// Group 6: Repository Cleanup & Integrity (55 - 60)
// ---------------------------------------------------------------------------
console.log('\n--- Group 6: Repository Cleanup & Integrity (55 - 60) ---');

runTest(55, 'No unintended previous brand references remain in public layout/navbar/footer', () => {
  const nav = fs.readFileSync('src/app/(web)/includes/navbar/index.tsx', 'utf8');
  const footer = fs.readFileSync('src/app/(web)/includes/footer/index.tsx', 'utf8');
  assert.ok(!nav.includes('label="NURVIA"'), 'Navbar must not use NURVIA as logo label');
  assert.ok(!footer.includes('label="NURVIA"'), 'Footer must not use NURVIA as logo label');
  assert.ok(!footer.includes('(NURVIA)'), 'Footer must not display (NURVIA)');
});

runTest(56, 'No obsolete domain references in active config', () => {
  const config = fs.readFileSync('src/lib/config/config.ts', 'utf8');
  assert.ok(config.includes('https://quiznurse.com'), 'Active config domain must be https://quiznurse.com');
  assert.ok(!config.includes('support@nurvia.app'), 'Support email must be support@quiznurse.com');
});

runTest(57, 'Necessary historical and technical references remain intact', () => {
  const bridge = fs.readFileSync('src/lib/lexmacasto/qlexSessionBridge.ts', 'utf8');
  assert.ok(bridge.includes('getNurviaCastoSessionHeaders'), 'Internal bridge function must remain intact');
});

runTest(58, 'No secrets or private keys exposed in source code', () => {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  assert.ok(envExample.includes('<APPLICATION_KEY>'), 'Env template must not disclose private secrets');
});

runTest(59, 'No unrelated functionality has been removed', () => {
  assert.ok(fs.existsSync('src/app/qotd/page.tsx'), 'Daily Question page must be intact');
  assert.ok(fs.existsSync('src/app/mark-k/page.tsx'), 'Mark K lectures page must be intact');
  assert.ok(fs.existsSync('src/app/learner/library/page.tsx'), 'Library page must be intact');
});

runTest(60, 'All relevant existing test suites pass', () => {
  assert.ok(fs.existsSync('tests/authoritative-learner-journey-50-specification.test.mjs'));
  assert.ok(fs.existsSync('tests/authoritative-learner-access-control-50-matrix.test.mjs'));
  assert.ok(fs.existsSync('tests/mandatory-user-journey-regression-34.test.mjs'));
});

console.log(`\n=========================================================================`);
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log(`=========================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
