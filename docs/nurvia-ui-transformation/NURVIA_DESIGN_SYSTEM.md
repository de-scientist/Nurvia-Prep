# NURVIA-PREP — AUTHORITATIVE NURVIA DESIGN SYSTEM SPECIFICATION

**Project:** Nurvia-Prep  
**Reference Authority:** `C:\Users\gitau\Documents\NURVIA\apps\web`  
**Specification Date:** 2026-11-18  

---

## 1. Brand Identity & Core Design Tokens

Nurvia-Prep adopts the exact **NURVIA Clinical Precision** design language established in the NURVIA reference application (`apps/web/app/globals.css`, `apps/web/tailwind.config.ts`, `apps/web/components/brand/logo.tsx`, `apps/web/components/layout/public-shell.tsx`).

### 1.1 Canonical Color Tokens

| Token / CSS Variable | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--brand-navy` | `#142B4A` | `#F8FAFC` | Primary NURVIA brand identity, structural headers, primary CTA buttons, announcement bar |
| `--brand-navy-deep` | `#0F2036` | `#0B1220` | Deep navy hover/active state and dark-mode primary surface |
| `--brand-teal` / `--primary` | `#0D9488` | `#2DD4BF` | Clinical Teal — primary actions, active navigation indicators, focus rings, clinical accents |
| `--brand-teal-dark` / `--primary-hover` | `#0F766E` | `#5EEAD4` | Darker teal hover/active state |
| `--background` | `#FFFFFF` | `#0B1220` | Primary page canvas background |
| `--surface` | `#F8FAFC` | `#111C2E` | Subtle elevated cards, sidebars, navigation shells, secondary sections |
| `--surface-muted` | `#F1F5F9` | `#18263B` | Muted panels, table headers, filter chips, skeleton placeholders |
| `--surface-elevated` | `#FFFFFF` | `#1B2B42` | Modals, dropdown menus, popovers, floating cards |
| `--text-primary` / `--foreground` | `#0F172A` | `#F8FAFC` | Primary heading and body typography |
| `--text-secondary` | `#475569` | `#CBD5E1` | Supporting copy, descriptions, table cells |
| `--text-muted` | `#64748B` | `#94A3B8` | Captions, metadata, timestamps, helper labels |
| `--border` | `#E2E8F0` | `#27364A` | Standard structural, card, table, and header dividers |
| `--border-strong` | `#CBD5E1` | `#3B4C63` | Form input borders and emphasized card outlines |
| `--success` / `--correct-answer` | `#059669` | `#34D399` | Clinical emerald — passed states, verified badges, correct answers |
| `--warning` / `--bookmarked-question` | `#D97706` | `#F59E0B` | Amber — review flags, warnings, bookmarks, time alerts |
| `--error` / `--incorrect-answer` | `#BE123C` | `#FB7185` | Clinical rose/red — validation errors, failed states, incorrect answers |
| `--info` | `#0D9488` | `#2DD4BF` | Informational callouts and clinical rationales |

### 1.2 Dashboard & Examination Theme Tokens

- **`PanelThemeContext` (`DEFAULT_THEME_COLORS` & `lightColors` / `darkColors`):**
  - `navbar`: `#FFFFFF` (light) / `#0F172A` (dark)
  - `leftSidebar`: `#F8FAFC` (light) / `#0F172A` (dark)
  - `rightSidebar`: `#F8FAFC` (light) / `#111C2E` (dark)
  - `content`: `#FFFFFF` (light) / `#0B1220` (dark)
  - `footer`: `#F8FAFC` (light) / `#0F172A` (dark)
  - `text`: `#0F172A` (light) / `#F8FAFC` (dark)
- **`ExamThemeContext` (`DEFAULT_EXAM_COLORS`, `LIGHT_EXAM_COLORS`, `DARK_EXAM_COLORS`):**
  - `upperNavbar`: `#FFFFFF` (light) / `#0F172A` (dark)
  - `lowerNavbar` & `nonStickyNavbar`: `#F8FAFC` (light) / `#111C2E` (dark)
  - `content`: `#F8FAFC` (default) / `#FFFFFF` (light) / `#0B1220` (dark)
  - `footer`: `#F1F5F9` (light) / `#0F172A` (dark)
  - `leftSidebar` & `rightSidebar`: `#F8FAFC` (light) / `#0F172A` (dark)
  - `upperNavText` & `contentText`: `#0F172A` (light) / `#F8FAFC` (dark)

---

## 2. Typography & Hierarchy

- **Brand & Heading Font (`--font-brand`):** `"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (weights `600`, `700`, `800`).
- **UI & Clinical Body Font (`--font-ui`):** `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (weights `400`, `500`, `600`, `700`).
- **Heading Scale:**
  - Hero Display (`h1`): `text-[2.5rem] sm:text-5xl lg:text-[3.5rem] font-brand font-extrabold tracking-tight leading-[1.08] text-foreground`
  - Page Title (`h1`): `text-2xl sm:text-3xl font-brand font-extrabold tracking-tight text-foreground`
  - Section Heading (`h2`): `text-2xl sm:text-3xl font-brand font-bold tracking-tight text-foreground`
  - Card / Module Heading (`h3`): `text-lg sm:text-xl font-brand font-bold text-foreground`
  - Eyebrow Kicker: `text-xs font-bold uppercase tracking-widest text-brand-teal`

---

## 3. Brand Mark & Visual Assets

- **Vector Brand Component (`src/components/common/NurviaLogo.tsx`):**
  - Renders the canonical NURVIA Geometric Learning Path dual-curve vector symbol (`#142B4A` navy + `#0D9488` clinical teal with pathway nodes) paired with `NURVIA` / `NURVIA-PREP` wordmark and `PATHWAY TO CONFIDENCE` subtitle.
- **Static Brand Assets (`public/brand/*` & `public/logo/*`):**
  - `/brand/nurvia-symbol.svg`, `/brand/nurvia-logo-light.svg`, `/brand/nurvia-logo-dark.svg`, `/brand/favicon.svg`
  - `/logo/logo.png`, `/logo/logo-dark.png`, `/favicons/favicon.png`

---

## 4. Component Primitives & Layout Rules

1. **Public Navigation (`src/app/(web)/includes/navbar/index.tsx`):**
   - Top `#142B4A` announcement bar (`NURVIA Education — Your Path to Nursing Confidence`).
   - Sticky `h-16` (`64px`) header with `bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800`.
   - NURVIA geometric symbol + wordmark on left; clean navigation links & structured mega-menus in center; `SeekModal` search button (`Ctrl+K`), authenticated programme switcher or `Sign In` / `Sign Up` / `Explore Exams` CTA buttons on right; slide-over mobile drawer.
2. **Public Footer (`src/app/(web)/includes/footer/index.tsx`):**
   - Multi-column NURVIA clinical education footer on `bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800` with brand mission, Exam Tracks, Learning Tools, Platform Workspaces, copyright, educational disclaimer, and `Annex` system status trigger.
3. **Buttons:**
   - Primary Teal: `bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-[#0D9488]`
   - Primary Navy: `bg-[#142B4A] hover:bg-[#0F2036] text-white font-semibold rounded-lg shadow-xs transition-colors`
   - Secondary / Outline: `border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-[#0D9488]/60 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors`
4. **Cards & Surfaces:**
   - Clean `rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-[#0D9488]/50 hover:shadow-md transition-all`.
   - Zero neon/pastel clashing backgrounds (`#ffe8e8`, `#d6fbe0`, `#fafed6`, `bg-yellow-200`, `bg-pink-200`, `from-green-200 to-orange-200` strictly prohibited).
5. **Forms & Inputs:**
   - Consistent `rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20`.
   - Inline accessible `role="alert"` error/success feedback banners; zero native `alert()` calls.
6. **Tables & Data Views:**
   - `rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden` with `bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider` headers.
7. **Examination Interface:**
   - Clean clinical question header with `#142B4A` / `#0D9488` progress bar, `#142B4A` question number badge, high-contrast clinical option cards (`hover:border-[#0D9488]/60`, selected `border-[#0D9488] bg-[#0D9488]/5`), semantic emerald/rose feedback states, and structured rationale/hint accordions.
