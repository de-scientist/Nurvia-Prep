# NURVIA-PREP — COMPLETE APPLICATION UI/UX INVENTORY

**Project:** Nurvia-Prep  
**Target Repository:** `C:\Users\gitau\Documents\Nurvia-Prep`  
**Inventory Date:** 2026-11-18  

---

## 1. Route Group Summary

| Route Group | Base Path | Page / Route Count | Layout Count | Primary Purpose |
|---|---|---|---|---|
| **Root Application Shell** | `src/app/` | 0 | 1 (`layout.tsx`) | Root HTML/Body, font loading (`Plus Jakarta Sans` & `Inter`), global providers (`ThemeProvider`, `LeftSidebarProvider`, `RightSidebarProvider`) |
| **Public Website & Marketing** | `src/app/(web)/` | 30 | 7 | Homepage (`/`), Public Navbar & Footer, 6 Exam Track Landing Pages, 13 Informational/Legal/Community Pages (`(more)`), 8 Discovery/Study Pages (`entrance`, `actions`, `notes`, `resources`, `seek`, `shop`, `create`, `contact-us`), 2 Heed Messaging Pages, Subscription Package Page, Site Directory (`/explore`) |
| **Public Authentication & Modals** | `src/app/(web)/auth/` | 14 (+ 5 modals) | 0 | Login, Register, Logout, OneTap, Password Recovery, Social Recovery, Social Complete, Support, 2FA Update, Password Update, Token Validation, and 5 Auth Modals (`auth`, `Login`, `Register`, `Impel`, `Annex`) |
| **Programme Learner Dashboards (×6)** | `src/app/dashboards/{track}/` | 222 (`37 × 6`) | 6 (`1 × 6`) | 6 distinct programme workspaces (`ati-teas`, `hesi-a2`, `lpn-nursing`, `nclex-pn`, `nclex-rn`, `rn-nursing`): Dashboard Overview, 13 Programme Auth/Account Pages, Assessments (`4`), Exams (`4`), Progress Analytics (`1`), Reports (`3`), Results (`1`), Learning Hierarchy (`12`: Programs, Courses, Subjects), Support/Info (`4`), Subscriptions (`2`) |
| **Live Examination Engine (×6 tracks ×8 themes)** | `src/app/web/(livexams)/{track}/` | 48 (`8 × 6`) | 54 (`9 × 6`) | 8 live examination layout themes per track (`atlas`, `cascade`, `classic`, `generic`, `glacial`, `orbit`, `pulse`, `zen`) + shared `QuestionTypes` dispatcher, 19 standalone question renderers, 19 case-based dynamic renderers, `QuestionToolbar`, `QuestionActionNavigator`, `ImageViewer` |
| **Nexus System & Registry Views** | `src/app/web/(nexus)/` | 2 | 1 | System-wide Assessments Overview and Programs Overview |
| **BFF API Proxy Routes** | `src/app/api/` | 61 | 0 | Server-side proxy routes to hosted `.NET` backend (`auth/*`, `media/*`, `nexus/*`, `seek`, `system/*`, `users/*`) — **strictly preserved untouched** |

---

## 2. Detailed Public Website Inventory (`src/app/(web)/`)

1. **Homepage (`src/app/(web)/page.tsx` -> `src/app/(web)/pages/home/home.tsx`)**
   - Hero section, interactive clinical question preview, student testimonial carousel, featured exam track cards, searchable & filterable study sets catalog, 3 core learning modes (`Review Mode`, `Exam Mode`, `Tutor Mode`), NGN Clinical Judgment Measurement Model showcase, primary CTA section.
2. **Public Shell (`src/app/(web)/layout.tsx`, `includes/navbar/index.tsx`, `includes/footer/index.tsx`)**
   - Top announcement banner, sticky NURVIA navigation bar with NURVIA geometric brand lockup, direct & structured programme links, `SeekModal` global search trigger (`Ctrl+K`), authenticated programme switcher / unauthenticated Sign In & Sign Up actions, mobile slide-over drawer, and structured multi-column NURVIA footer with `Annex` system modal trigger.
3. **Exam Track Landing Pages (`src/app/(web)/pages/exams/{ati-teas,hesi-a2,lpn-nursing,nclex-pn,nclex-rn,rn-nursing}/page.tsx`)**
   - Programme hero banner, active subscription status banner (`ActiveSubscriptionCard`), live `SubscriptionItem` pricing catalog, "Why Choose" feature cards, exam subject breakdown cards, `Contact` inquiry section, and community links.
4. **Discovery, Study & Utility Pages**
   - `/pages/entrance` & `/pages/actions` & `/pages/notes`: Live `useRelativeStrataPrograms` track selector cards.
   - `/pages/resources`: Comprehensive exam & study resource directory cards.
   - `/pages/seek`: Full-page interactive search workspace (`seekService`).
   - `/pages/shop`, `/pages/create`, `/pages/contact-us`, `/pages/subscription/package`, `/explore`: E-commerce/resource shop, creation workspace, contact form, subscription checkout return handler, and SEO site directory.
   - `/pages/heed/current` & `/pages/heed/relative`: Learner/support messaging threads and `HeedReplyBox`.
5. **Informational, Community & Legal Pages (`src/app/(web)/pages/(more)/*`)**
   - `about-us`, `blogs`, `documentation`, `faqs`, `live-sessions`, `mission`, `privacy-policy`, `reviews`, `social-groups`, `team`, `terms-of-service`, `values`, `vission`.

---

## 3. Detailed Authentication & Account Inventory

1. **Web Auth Pages (`src/app/(web)/auth/**`)**
   - `/auth` (Tabbed Login/Register portal)
   - `/auth/login` (Learner login with Google OAuth + Email/Password + registration redirect banner)
   - `/auth/register` (Learner registration with Google OAuth + Email/Phone/Password generator & strength checklist)
   - `/auth/logout` (Session termination confirmation screen)
   - `/auth/onetap` (Google One-Tap authentication surface)
   - `/auth/recovery/password` & `/auth/recovery/social` (Account recovery flows)
   - `/auth/social/complete` (OAuth callback completion)
   - `/auth/support` (Authentication support request form)
   - `/auth/update/2fa` & `/auth/update/password` (Security credential updates)
   - `/auth/validate` & `/auth/validate/[reason]/[userGuid]/[token]` (`ValidateClient.tsx` email/token verification)
2. **Auth Modals (`src/app/(web)/auth/modals/*`)**
   - `auth.tsx`, `Login.tsx`, `Register.tsx`, `Impel.tsx`, `Annex.tsx`.
3. **Dashboard Auth & Account Management (`src/app/dashboards/{6 tracks}/auth/**`)**
   - Per track (`×6`): `login`, `register`, `logout`, `account/show`, `account/edit`, `account/support`, `account/recovery/password`, `account/recovery/social`, `account/security/2fa`, `account/security/password`, `account/security/profile`, `account/verify/email`, `account/verify/phone`.

---

## 4. Detailed Learner Dashboard & Study Module Inventory (`src/app/dashboards/{6 tracks}/`)

1. **Dashboard Shell (`layout.tsx`, `includes/navbar/Navbar.tsx`, `includes/sidebar/left/LeftSidebar.tsx`, `includes/sidebar/right/RightSidebar.tsx`, `includes/footer/Footer.tsx`)**
   - Collapsible left hierarchy & analytics sidebar, collapsible right profile/support sidebar, sticky top navbar with `SeekModal` (`Ctrl+K`), `ThemeDropdown`, `HeedMessageBell`, `UserDropdown`, and footer.
2. **Programme Dashboard Overview (`page.tsx` × 6 tracks)**
   - Hero greeting banner with `CircularGauge` GPA donut & hover breakdown popover, `MySubscriptionBanner`, active/in-progress exam card, monthly performance insight banner, auto-scrolling course strip (`ProgramCoursesRow`), pending/incomplete exams table, quick navigation cards, and clinical quote card.
3. **Assessment & Exam Catalogues (`vista/assessment/{assessments,exams}/{absolute,distinct}/{outline,overview}/page.tsx`)**
   - Card grid (`overview`) and tabular (`outline`) views with year/season filter pills, learning-level filters, sortable columns, search bar, pagination, and mode selector (`Practice`, `Review`, `Exam`).
4. **Performance Analytics, Reports & Results (`vista/assessment/exams/{progress,reports,results}/**`)**
   - `progress/absolute/page.tsx`: Recharts performance trends, subject mastery breakdowns, and KPI cards.
   - `reports/{absolute,distinct,relative}/page.tsx` & `Comparison.tsx`: Attempt history tables, score distributions, and peer comparisons.
   - `results/distinct/page.tsx`: Post-exam result summary with `ScoreRing`, `StatSlider`, `StatCard` grid, section breakdown table, past attempts list, and wrong-question review cards (`WrongQuestionCard`).
5. **Learning Modules (`vista/learning/{programs,courses,subjects}/{absolute,distinct}/{outline,overview}/page.tsx` + `dashboards/shared/**`)**
   - Hierarchical study modules (`Programs -> Courses -> Subjects`), `DistinctSubjects` section with DIY custom exam builder (`diyExamCreation.tsx`, `diyExamQuestionCreation.tsx`), and subscription management (`vista/subscriptions/{items,packages}/page.tsx`).

---

## 5. Detailed Examination Interface Inventory (`src/app/web/(livexams)/`)

1. **8 Examination Layout Themes (`× 6 tracks = 48 routes`)**
   - `atlas`, `cascade`, `classic`, `generic`, `glacial`, `orbit`, `pulse`, `zen`.
2. **Navigation & Control Ribbons (`partials/` per layout)**
   - `UpperStickyNavBar.tsx` (Logo, exam title, AI Assistant modal, Exam Tools toggle, Layouts popover, `QuestionActionNavigator`, user profile popover, remaining count, autosave status badge, countdown timer).
   - `LowerStickyNavBar.tsx`, `NonStickyNavBar.tsx`, `StickyNavBar.tsx`, `StickyFooter.tsx`, `LeftSideBar.tsx`, `ExamThemeDropdown.tsx`.
3. **Question Rendering Engine (`partials/dispatcher/QuestionTypes.tsx` & `partials/questiontypes/**`)**
   - 19 Standalone Renderers: `singleChoice`, `multipleSelect`, `trueFalse`, `numericResponse`, `matching`, `orderingNumber`, `orderingItem`, `orderingDragDrop`, `dynamicImage`, `multipleImage`, `blankSelect`, `blankFill`, `hotspot`, `openEnded`, `highLight`, `audioBased`, `videoBased`, `matrixSingleChoice`, `matrixMultipleSelect`.
   - 19 Case-Based Renderers via `CaseBasedDynamics.tsx` & `caseBased.tsx` (`CaseBasedStencil` split clinical scenario tabs + inner question renderer).
   - Shared `QuestionToolbar.tsx` (Clear selection, Show/Hide Hint, Show/Hide Correct Answer & Rationale accordion, Question Feedback modal, Star, Pin, Bookmark, Flag modal) and `QuestionActionNavigator.tsx`.
