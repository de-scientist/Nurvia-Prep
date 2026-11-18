# NURVIA-PREP — PHASE 0 REPOSITORY BASELINE & PROTECTION REPORT

**Project:** Nurvia-Prep (formerly Qlex / Castoline)  
**Target Repository:** `C:\Users\gitau\Documents\Nurvia-Prep`  
**Authoritative Design Reference Repository:** `C:\Users\gitau\Documents\NURVIA` (`apps/web`)  
**Baseline Date:** 2026-11-18  

---

## 1. Repository & Git State Baseline

| Attribute | Recorded Value |
|---|---|
| **Nurvia-Prep Repository Path** | `C:\Users\gitau\Documents\Nurvia-Prep` |
| **Git Branch** | `main` (`## No commits yet on main` — freshly initialized `.git` repository) |
| **Git HEAD** | Unborn branch (`ref: refs/heads/main`, 0 commits) |
| **Git Remotes** | None configured (`git remote -v` returns empty) |
| **Pre-Existing Working Tree** | All project directories (`src/`, `public/`, `audit_reports/`, `.skewblanc/`) and configuration files (`package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.local`) present in working tree; zero tracked commits |
| **Reference Repository (`NURVIA`)** | `C:\Users\gitau\Documents\NURVIA` — branch `master`, HEAD `ec2bbc9f085b3203f39a3024ca0e7966618a5e9f` (strictly read-only reference) |

---

## 2. Technology Stack & Build Baseline

| Layer | Package / Tool | Version | Baseline Status |
|---|---|---|---|
| **Framework** | Next.js (App Router + Turbopack) | `^15.5.19` | Verified (`package.json`) |
| **UI Runtime** | React / React DOM | `^18.3.1` | Verified (`package.json`) |
| **Language** | TypeScript (`strict: true`) | `^5` | `npx tsc --noEmit` — **PASS (0 errors)** |
| **Linter** | ESLint + `eslint-config-next` | `^9` / `15.3.5` | `npm run lint` — **PASS (`✔ No ESLint warnings or errors`)** |
| **Styling System** | Tailwind CSS v4 (`@tailwindcss/postcss`) | `^4` | Configured in `postcss.config.mjs` and `src/app/globals.css` |
| **Icons** | `lucide-react`, `react-icons` | `^0.525.0`, `^5.7.0` | Installed & active |
| **Charts** | `recharts`, `apexcharts`, `react-apexcharts` | `^3.10.1`, `^5.2.0`, `^1.7.0` | Installed & active |
| **Rich Text / Parsing** | `@tiptap/react`, `lexical`, `html-react-parser` | `^3.15.3`, `^0.39.0`, `^6.1.5` | Installed & active |
| **Phone Input** | `react-phone-number-input`, `libphonenumber-js` | `^3.4.14`, `^1.12.10` | Installed & active |
| **Backend Integration** | BFF Proxy (`/api/*` -> `.NET` backend `http://108.61.9.189:8008`) | `SKEW_LINE_ACTIVE_BACKEND=dotnet` | Verified via `src/lib/api/api/api.ts` and `src/lib/config/siteHeaders.ts` |

---

## 3. Source Code Quantitative Baseline

- **Total files in `src/`:** `1,674`
- **Total route/page/layout files (`page.tsx`, `layout.tsx`, `route.ts`, `route.tsx`):** `495`
  - `src/app/(web)`: `71` files (public website, marketing, authentication pages & modals, explore, heed, seek, subscriptions)
  - `src/app/api`: `61` BFF route handlers
  - `src/app/dashboards`: `544` files (`6` programme dashboards: `ati-teas`, `hesi-a2`, `lpn-nursing`, `nclex-pn`, `nclex-rn`, `rn-nursing` + `shared/`)
  - `src/app/web`: `757` files (`6` tracks × `8` live examination themes in `(livexams)` + `21` question renderers/stencils + `(nexus)` administrative/system overview pages)
  - `src/components`: `14` shared components
  - `src/lib`: `158` files (`api`, `config`, `constants`, `contexts`, `hooks`, `services`, `types`, `utils`)
  - `src/styles`: `6` CSS files

---

## 4. Coupled Presentation & Business Logic Risk Register

| Risk ID | Area / Component | Coupling Description | Mitigation Strategy |
|---|---|---|---|
| **RISK-01** | `src/lib/config/config.ts` & `src/lib/config/siteHeaders.ts` | `APP_NAME` is read from `process.env.SKEW_LINE_APP_NAME` (`'Rhen-Nursing'` in `.env.local`) and used both for UI display (`{APP_NAME}`) and backend BFF header `x-site-name`. | Decouple UI display brand (`APP_NAME = "Nurvia-Prep"`, `APP_TITLE = "Nurvia-Prep"`) from the backend site header (`SITE_HEADER_NAME = process.env.SKEW_LINE_APP_NAME || "Rhen-Nursing"`) in `siteHeaders.ts` so backend site validation remains 100% untouched while all customer-facing surfaces display `Nurvia-Prep` / `NURVIA`. |
| **RISK-02** | `src/lib/contexts/panel/layout/theme/PanelThemeContext.tsx` | Dashboard components rely on CSS custom variables (`--navbar-bg`, `--leftSidebar-bg`, `--rightSidebar-bg`, `--content-bg`, `--footer-bg`, `--text-color`) injected onto `document.documentElement`, which defaulted to Qlex pastel colors (`#c7fff2`, `#cee4ff`, `#e2dbff`, `#fffce6`, `#ffecad`). | Replace `DEFAULT_THEME_COLORS`, `lightColors`, and `darkColors` with canonical NURVIA tokens (`#FFFFFF`, `#F8FAFC`, `#0F172A`, `#0B1220`, `#111C2E`) while preserving the `ThemeContext` API (`theme`, `customColors`, `setTheme`, `toggleTheme`). |
| **RISK-03** | `src/lib/contexts/web/assessment/theme/ExamThemeContext.tsx` | Examination layouts (`atlas`, `cascade`, `classic`, `generic`, `glacial`, `orbit`, `pulse`, `zen`) read `--exam-*` CSS variables set by `ExamThemeProvider`. | Align `DEFAULT_EXAM_COLORS`, `LIGHT_EXAM_COLORS`, and `DARK_EXAM_COLORS` with NURVIA clinical light/dark surfaces while preserving all 8 layout structures and per-zone customization hooks. |
| **RISK-04** | Authentication Pages & Modals (`src/app/(web)/auth/**`, `src/app/dashboards/*/auth/**`) | Form submission handlers construct specific `LoginCredentials` / `RegisterPayload` objects with backend challenge strings (`learner.login.skew8lancasto`, `register-skew8@lancasto`) and use native browser `alert()` for validation errors. | Replace native `alert()` calls with accessible inline error banners (`setError` / `setRegError`) and redesign the visual layout using NURVIA's split clinical branding panel + clean surface card while keeping every state variable, payload field, challenge string, and service call identical. |
| **RISK-05** | Examination Engine (`src/app/web/(livexams)/**`) | 48 live exam pages + 19 standalone renderers + `CaseBasedStencil` + `QuestionToolbar` + `UpperStickyNavBar` manage timers (`secondsLeft`, `saveResidualDuration`), debounced answer autosave (`submitAnswer`), and tool actions (`Star`, `Pin`, `Bookmark`, `Flag`, `Feedback`). | Redesign the visual presentation (headers, progress bar, question badges, option cards, rationale accordions, modals, and navigation bars) without altering any hook, event listener (`exam:submit`, `exam:paused`, `exam:resume`, `exam:goto:question`), or payload contract. |
