# NURVIA Prep — UI/UX Redesign Audit & Implementation Baseline

## 1. Existing Architecture & System Context
- **Framework**: Next.js 15.5.19 with App Router, React 19, TypeScript.
- **Styling**: Tailwind CSS v4 with custom theme tokens (`@theme inline`), CSS variables in `src/app/globals.css`, and Google Fonts (`Plus Jakarta Sans` for brand headings, `Inter` for UI).
- **Authentication**: Custom backend session architecture with HttpOnly cookies (`nurvia_casto_line`, `nurvia_casto_badge`), same-origin proxy routes under `/api/auth/*` forwarding to upstream API (`getBackendBaseUrl()`). Dedicated Google social endpoints exist at `/api/auth/social/google` and `/api/auth/social/onetap`.
- **Navigation & Layouts**:
  - `PublicShell`: Header with 9 approved navigation items (Home, Exams, Study, Care Plans, Mark K., Community, FAQ, NCLEX, TEAS), quick search modal (Cmd+K), and responsive mobile drawer.
  - `LearnerShell`: Responsive desktop sidebar with expandable sections (Overview, Exams, Study, Community, Resources, Settings), top bar with notifications, and subscription/avatar controls.
- **Learning & Examination Engine**:
  - Multi-mode examination system (Review Mode, Exam Mode, Tutor Mode) with real-time timers, question navigation, bookmarks, and immediate/deferred scoring.
  - Tutor Mode panel with structured hierarchy: 1. Hint, 2. All Correct Answers, 3. Rationale, with selective blurring for unrevealed guidance.
  - SATA (Select All That Apply) validation enforcing exact-selection counts prior to submission.
  - Study Library with RN and LPN pathway separation, exam body filters (ATI, HESI, NCSBN), and responsive card grids.

---

## 2. Existing Functionality That Must Be Preserved
1. **Quick Practice on Public Homepage**: Interactive warfarin pharmacology sample question, learn-as-you-go rationale feedback, keyboard navigation, question stepping, and exam-session CTA.
2. **Hero Section Architecture**: Single split composition (messaging + Quick Practice) over decorative background video with muted/reduced-motion awareness.
3. **RN vs. PN/LPN Pathway Separation**: Maintained across homepage study tracks, registration, learner library, subject filters, and examination catalogs.
4. **Email Verification Code Flow**: Required verification code generation, input modal, resend behavior, and backend verification status enforcement.
5. **Exact SATA Answer-Selection Validation**: Enforcing required choice count for SATA questions before submission.
6. **Tutor Mode Hierarchy & Selective Blurring**: Three-section layout (Hint, Correct Answers, Rationale) with unrevealed rationale blurring and zero duplicate rationale blocks in question view.
7. **Protected Route Gates & Public Guest Browsing**: Public visitors can freely browse `/learner`, `/learner/library`, and `/learner/exams`, while examination attempts (`/exam-session`, `/learner/attempt/*`) strictly require authentication and active entitlement.
8. **Subscription Status & Entitlements**: Accurate backend subscription checks, no fabricated metrics or fake demo charts.

---

## 3. Current UI/UX Weaknesses & Opportunities
1. **Visual Tone Consistency**: Inconsistent color accents across older components; opportunity to unify under the **Clinical Warmth** palette:
   - Deep Teal (`#0A6265`) for primary brand actions.
   - Forest Slate (`#193B42`) for authoritative headings and high-contrast text.
   - Eucalyptus Mist (`#F1F6F4`) and Warm Sand (`#F5EDE2`) for softer backgrounds.
   - Soft Sage (`#D6E9E3`) for subtle borders and badges.
   - Muted Amber (`#C58B43`) for focus and bookmark accents.
2. **Authentication Simplicity**:
   - `src/app/sign-in/page.tsx` and `src/app/sign-up/page.tsx` contained legacy PIN credential toggles and lacked prominent Google OAuth buttons.
   - Removing the PIN requirement streamlines the form down to pure email/password while introducing high-visibility "Continue with Google".
3. **Homepage Rhythm & Section Transitions**:
   - Card borders and shadows can be softened to feel more welcoming and less boxed-in.
   - Typography hierarchy can be sharpened with refined tracking, leading, and clinical pill badges.
4. **Learner Dashboard Layout**:
   - Welcome overview and progress metrics can be structured with cleaner card surfaces, balanced whitespace, and unified icon treatments.
5. **Study Library & Examination Interfaces**:
   - Modernize filter chips, search input, and subject cards with smooth hover transitions, clear category badges, and distraction-free examination typography.

---

## 4. Relevant Components and Routes
- **Public Homepage**: `src/app/page.tsx`, `src/components/home/practice-question-preview.tsx`, `src/components/home/hero-background-video.tsx`, `src/components/home/student-testimonial-carousel.tsx`.
- **Layouts & Shells**: `src/components/layout/public-shell.tsx`, `src/components/layout/learner-shell.tsx`, `src/components/brand/logo.tsx`.
- **Authentication**: `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/components/auth/auth-shell.tsx`, `src/lib/services/auth/socialService.ts`, `src/app/api/auth/social/google/route.ts`.
- **Learner Dashboard**: `src/app/learner/page.tsx`, `src/components/learner/learner-dashboard.tsx`.
- **Study Library**: `src/app/learner/library/page.tsx`, `src/components/study/study-library-view.tsx`, `src/components/study/StudyLibraryCategoryTabs.tsx`, `src/components/study/StudyLibraryAdvancedFilters.tsx`.
- **Examination & Tutor Mode**: `src/app/exam-session/page.tsx`, `src/components/exam/TutorModePanel.tsx`, `src/components/exam/renderers/MultipleResponseRenderer.tsx`.
- **Styles & Config**: `src/app/globals.css`, `tailwind.config.ts`.

---

## 5. Proposed Visual Improvements (Clinical Warmth)
- **Palette**: Introduce Clinical Warmth variables into CSS and Tailwind config while maintaining backwards compatibility with canonical tests (`#142B4A`, `#0D9488`).
- **Typography & Rhythm**: Inter and Plus Jakarta Sans with generous line heights, legible contrast, and clean tabular numbers.
- **Form & Input Design**: Softened border radii (12-16px), warm focus rings, unified floating labels, and accessible error badges.
- **Card Surfaces**: Elevation without harsh drop-shadows; subtle 1px borders with warm tints (`rgba(10, 98, 101, 0.08)`).

---

## 6. Potential Functional Risks & Safeguards
- **Risk**: Modifying auth pages could break `returnTo` preservation or email verification flows.
  - *Safeguard*: Retain URL parameter parsing, sanitize return destinations, preserve `LearnerVerificationModal`.
- **Risk**: Altering homepage hero could break `hero-redesign.test.mjs` assertions (copy, DOM order, video background).
  - *Safeguard*: Keep all verified text snippets and layout markers intact; test with `node tests/hero-redesign.test.mjs`.
- **Risk**: Breaking SATA validation or Tutor Mode hierarchy.
  - *Safeguard*: Validate with `node tests/subject-filters-exam-bodies-tutor-sata.test.mjs`.

---

## 7. Implementation Sequence
1. **Design Foundations**: Update `globals.css` and `tailwind.config.ts` with Clinical Warmth tokens.
2. **Authentication Upgrades**:
   - Add Google sign-in button using existing `redirectToSocialProvider`.
   - Remove PIN sign-in and PIN registration options.
   - Enhance auth shell styling and feedback alerts.
3. **Public Homepage Upgrades**:
   - Refine hero composition, styling, typography, and button states.
   - Upgrade Quick Practice visual cards and feedback styling while preserving all 6 hero test criteria.
   - Refine study sets, learning modes, testimonials, and FAQ sections.
4. **Learner Dashboard Upgrades**:
   - Refresh layout, welcome hero, progress stats, and exam recommendation cards.
5. **Study Library & Examination Environment**:
   - Polish subject filters, pathway tabs, question display, and Tutor Mode guidance.
6. **Verification & Regression Testing**:
   - Run all targeted test suites.
   - Verify build and TypeScript validation.
