# NURVIA — Complete Application UI Inventory & Baseline Audit (Batches 0 & 1)

## 1. Batch 0 — Repository Baseline & Protection

| Attribute | Recorded Value |
|---|---|
| **Repository Root** | `C:\Users\gitau\Documents\NURVIA` |
| **Frontend Workspace** | `C:\Users\gitau\Documents\NURVIA\apps\web` |
| **Backend Workspace** | `C:\Users\gitau\Documents\NURVIA\apps\api` |
| **Read-Only Reference** | `C:\Users\gitau\Documents\Qlex` (strictly untouched, read-only) |
| **Shared Production Backend** | `https://explicitbackend.com` (strictly untouched, read-only) |
| **Git Branch** | `master` |
| **Git HEAD** | `ec2bbc9f085b3203f39a3024ca0e7966618a5e9f` |
| **Pre-Existing Working Tree** | `M apps/web/package.json`, `AA docs/replication/API_AND_BACKEND_DEPENDENCY_REGISTER.md`, `AA docs/replication/TEST_AND_VERIFICATION_REPORT.md` (preserved untouched) |
| **Baseline TypeScript Check** | `npx tsc --noEmit` — **PASS (0 errors)** |
| **Baseline Unit & Contract Tests** | `npm test` (16 automated test suites in `package.json`, plus 5 additional suites) — **PASS (100%)** |
| **Application Identity** | `WEBSITE_11` (`SKEW_LINE_APP_KEY` server-only, `nurvia_casto_*` HttpOnly cookies) |

---

## 2. Batch 1 — Complete Frontend Route & Component Inventory

A forensic scan of `C:\Users\gitau\Documents\NURVIA\apps\web` (`app/`, `components/`, `lib/`, `assets/`, `public/`, `styles/`) inventoried **1,918 source and asset files**, comprising:
- **436 concrete `page.tsx` routes**
- **71 `layout.tsx` route layouts**
- **75 Next.js API Route Handlers (`route.ts`)**

### 2.1 Classification by Application Area

| Area | Page Routes (`page.tsx`) | Layouts (`layout.tsx`) | Primary Shells & Components | Current Visual State & Alignment Need |
|---|---:|---:|---|---|
| **1. Public Website (Canonical NURVIA)** | 18 | 1 | `app/page.tsx`, `components/layout/public-shell.tsx`, `app/exams`, `app/study`, `app/care-plans`, `app/mark-k`, `app/community`, `app/faq`, `app/nclex`, `app/teas`, `app/terms`, `app/privacy`, `app/design-system` | Uses NURVIA Clinical Precision tokens; requires token harmonization with canonical `#142B4A` navy / `#0D9488` teal / `#FFFFFF` background / `#F8FAFC` surface. |
| **2. Public Website (Replicated `(web)` Routes)** | 32 | 3 | `app/(web)/layout.tsx` (wraps in `PublicShell`), `app/(web)/explore`, `app/(web)/pages/**`, `app/(web)/includes/**`, `app/(web)/components/**` | Wrapped in `PublicShell`, but inner page sections (`exams/*`, `contact-us`, `about-us`, `faqs`, `subscription/*`, `includes/navbar`, `includes/footer`) contain Qlex neon/pastel inline gradients (`#68FA51`, `bg-yellow-200`, `bg-pink-200`, `bg-red-100`) and `/logo/logo.png` references. |
| **3. Authentication & Account Management** | 97 | 12 | Canonical: `app/sign-in`, `app/sign-up`, `app/forgot-password`, `app/reset-password`, `app/accept-invitation`, `app/access-denied`, `components/auth/auth-shell.tsx`<br>Replicated `(web)/auth`: 13 pages + 5 modals (`Annex`, `Impel`, `Login`, `Register`, `auth`)<br>Dashboard Auth: 78 pages across 6 programs (`app/dashboards/*/auth/**`) | Canonical `/sign-in` and `/sign-up` use `AuthShell`. Replicated modals and `dashboards/*/auth/**` pages use Qlex `bg-pink-200`, `bg-yellow-100`, `text-pink-800`, `bg-green-200`, and `⚓` anchor symbols in user messages. |
| **4. Learner Dashboards (Canonical + 6 Programs)** | 222 | 31 | Canonical: `app/learner/**` (24 pages), `components/layout/learner-shell.tsx`<br>Program Dashboards: 198 pages across `ati-teas`, `hesi-a2`, `lpn-nursing`, `nclex-pn`, `nclex-rn`, `rn-nursing` (`app/dashboards/*/**`), `components/dashboards/ProgramDashboardShell.tsx` | Canonical `/learner/**` uses `LearnerShell`. The 6 program dashboards (`app/dashboards/*`) use `PanelThemeContext` with Qlex pastel default colors (`#c7fff2`, `#cee4ff`, `#e2dbff`, `#fffce6`, `#ffecad`), Qlex `/logo/logo.png`, `Qlex Nursing` footer copyright, and noisy `bg-yellow-200`/`bg-green-100`/`🏌️‍♂️` controls. |
| **5. Examination Interfaces (Canonical + 48 Live Exam Routes)** | 50 | 20 | Canonical: `app/exam-session/page.tsx`, `components/layout/exam-shell.tsx`, `components/exam/renderers/*` (21 renderers)<br>Live Exams: `app/web/(livexams)/[program]/vista/exam/[theme]/page.tsx` + 48 static routes across 6 programs × 8 themes (`atlas`, `cascade`, `classic`, `generic`, `glacial`, `orbit`, `pulse`, `zen`) | All 8 themes and 21 question renderers are functional. The 48 `(livexams)` upper sticky navbars and includes reference Qlex `/logo/logo.png`, `/logo/logo-dark.png`, and `🏌️‍♂️`/`⚓` symbols. |
| **6. Learning & Study Modules** | (Included in Public & Learner counts) | — | `components/study/*`, `app/mark-k/**`, `app/care-plans/**`, `app/learner/{library,my-exams,custom-practice,history,hub,guides,flashcards,care-plans,calculators,ai-tutor,saved-questions,community,planner}` | Preserves strict content boundary: only Mark K. Lectures and Nursing Care Plans use local content support; all other modules remain server-driven via LexmaCasto. |
| **7. Administration** | 16 | 2 | `app/admin/**` (16 pages), `components/layout/admin-shell.tsx` | Uses `AdminShell` with NURVIA logo and staff RBAC enforcement; minor encoding cleanup (`â€¢` separator in `admin-shell.tsx` and `learner-shell.tsx`) and token alignment needed. |
| **8. System Tools & Diagnostics** | 1 | 2 | `app/system/debug/routes/view/page.tsx`, `components/admin/system-debug-routes-viewer.tsx`, `app/api/system/debug/routes/route.ts` | Uses `AdminShell` and NURVIA styling with staff-only RBAC and read-only LexmaCasto contract. |

---

## 3. Forensic Summary of Identified Visual & Identity Gaps

1. **Qlex Logo Asset (`public/logo/logo.png`)**:
   - `public/logo/logo.png` is currently the Qlex "Q" ECG icon, referenced across **62 files** (`app/(web)/includes/navbar/index.tsx`, `app/(web)/layout.tsx`, `app/dashboards/*/includes/navbar/Navbar.tsx`, `app/web/(livexams)/*/includes/navbar/Navbar.tsx`, and all 48 `UpperStickyNavBar.tsx` files).
   - `components/common/SeoHeader.tsx` references `/favicons/favicon.png` instead of NURVIA's `/brand/favicon.svg`.
2. **Customer-Facing Qlex Copyright Strings**:
   - All 6 program dashboard footers (`app/dashboards/{ati-teas,hesi-a2,lpn-nursing,nclex-pn,nclex-rn,rn-nursing}/includes/footer/Footer.tsx`) render `&copy; {new Date().getFullYear()} Qlex Nursing. All rights reserved.`.
3. **Program Dashboard Theme Context (`PanelThemeContext.tsx`)**:
   - `DEFAULT_THEME_COLORS` sets `navbar: "#c7fff2"`, `leftSidebar: "#cee4ff"`, `rightSidebar: "#e2dbff"`, `content: "#fffce6"`, `footer: "#ffecad"`, causing all 6 program dashboards to render with pastel mint/blue/lavender/yellow/orange surfaces instead of NURVIA's `#FFFFFF` / `#F8FAFC` / `#142B4A` / `#0D9488` palette.
4. **Noisy Qlex Utility Classes & Inline Gradients**:
   - 7 public exam landing pages and contact sections use neon pastel inline gradients (`#68FA51` lime buttons, `rgb(195, 215, 255)`, `#f0fff4`, `#e1f6e7`, `#d4f5e8`, `bg-yellow-200` pricing wrappers).
   - 228 files across `(web)`, `dashboards/*`, and `(livexams)/*` use clashing Qlex classes (`bg-yellow-200`, `bg-pink-200`, `bg-red-100`, `text-pink-800`, `from-green-200 to-orange-200`, `from-fuchsia-100`) and decorative emojis (`🏌️‍♂️`, `⚓`) in buttons, search bars, and alerts.
5. **Mojibake Punctuation in Shells**:
   - `components/layout/learner-shell.tsx` (`Checking your sessionâ€¦`) and `components/layout/admin-shell.tsx` (`â€¢`) contain UTF-8 mojibake characters that should be clean Unicode (`…` and `•`).
