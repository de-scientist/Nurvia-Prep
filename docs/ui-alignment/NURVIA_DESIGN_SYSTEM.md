# NURVIA — Canonical Design System Specification

This specification establishes the single authoritative design language for NURVIA across all public pages, authentication workflows, learner dashboards (including the six program-specific dashboards), examination engines (all eight themes and twenty-one question renderers), study modules, administration consoles, and system diagnostic tools.

---

## 1. Brand Colors and Semantic Color Tokens

| Token / Variable | Light Value | Dark Value | Purpose |
|---|---|---|---|
| `--brand-navy` | `#142B4A` | `#F8FAFC` | Deep Navy — primary NURVIA brand identity, structural headings, primary banners |
| `--brand-navy-deep` | `#0F2036` | `#0B1220` | Deepest navy emphasis and hover states |
| `--brand-teal` / `--primary` | `#0D9488` | `#2DD4BF` | Clinical Teal — primary actions, active navigation states, interactive accents |
| `--brand-teal-dark` / `--primary-hover` | `#0F766E` | `#5EEAD4` | Darker teal for hover and active states |
| `--background` | `#FFFFFF` | `#0B1220` | Main application background |
| `--surface` | `#F8FAFC` | `#111C2E` | Subtle elevated/grouped surfaces, panels, sidebars |
| `--surface-muted` | `#F1F5F9` | `#18263B` | Secondary muted surfaces, table headers, filter chips |
| `--surface-elevated` | `#FFFFFF` | `#1B2B42` | Elevated cards, modals, popovers |
| `--foreground` / `--text-primary` | `#0F172A` | `#F8FAFC` | Primary body and heading text |
| `--text-secondary` | `#475569` | `#CBD5E1` | Supporting descriptive copy |
| `--text-muted` | `#64748B` | `#94A3B8` | Metadata, captions, timestamps, secondary labels |
| `--border` | `#E2E8F0` | `#27364A` | Standard card, table, and section dividers |
| `--border-strong` | `#CBD5E1` | `#3B4C63` | Emphasized input and active container outlines |
| `--success` / `--correct-answer` | `#059669` | `#34D399` | Accessible clinical emerald for correct answers, passed states, verified badges |
| `--warning` / `--bookmarked-question` | `#D97706` | `#F59E0B` | Accessible amber for flagged questions, warnings, pending states |
| `--error` / `--incorrect-answer` | `#BE123C` | `#FB7185` | Accessible rose/red for errors, failed validations, incorrect responses |
| `--info` | `#0D9488` | `#2DD4BF` | Informational guidance and clinical rationale callouts |

### Program Dashboard Theme Tokens (`PanelThemeContext`)
- `navbar`: `#FFFFFF` (light) / `#0F172A` (dark)
- `leftSidebar`: `#F8FAFC` (light) / `#0F172A` (dark)
- `rightSidebar`: `#F8FAFC` (light) / `#111C2E` (dark)
- `content`: `#FFFFFF` (light) / `#0B1220` (dark)
- `footer`: `#F8FAFC` (light) / `#0F172A` (dark)
- `text`: `#0F172A` (light) / `#F8FAFC` (dark)

---

## 2. Typography Scale and Font Weights

- **Brand & Heading Font (`--font-brand`)**: `"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Weights: `600` (SemiBold), `700` (Bold), `800` (ExtraBold)
- **UI & Clinical Reading Font (`--font-ui`)**: `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Weights: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold)
- **Monospace Font**: System mono (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) for timers, numerical values, and route paths.

---

## 3. Heading Hierarchy

| Level | Scale | Font Family | Weight | Tracking & Line Height |
|---|---|---|---|---|
| **Display Hero (`h1`)** | `2.75rem` – `3.75rem` (`44px–60px`) | `font-brand` | `800` (`font-extrabold`) | `tracking-tight`, `leading-[1.06]` |
| **Page Title (`h1`)** | `1.875rem` – `2.25rem` (`30px–36px`) | `font-brand` | `800` (`font-extrabold`) | `tracking-tight`, `leading-tight` |
| **Section Heading (`h2`)** | `1.5rem` – `1.875rem` (`24px–30px`) | `font-brand` | `700` (`font-bold`) | `tracking-tight`, `leading-snug` |
| **Card / Module Title (`h3`)** | `1.125rem` – `1.25rem` (`18px–20px`) | `font-brand` | `700` (`font-bold`) | `leading-snug` |
| **Subheading (`h4`)** | `0.875rem` – `1rem` (`14px–16px`) | `font-brand` | `600` (`font-semibold`) | `leading-normal` |
| **Eyebrow / Section Kicker** | `0.75rem` (`12px`) | `font-ui` | `700` (`font-bold`) | `uppercase tracking-widest text-brand-teal` |

---

## 4. Page Layout and Content Widths

- **Public Marketing & Catalog Pages**: `max-w-7xl` (`1280px`) centered with `px-4 sm:px-6 lg:px-8` horizontal padding and `py-12 sm:py-16` vertical section rhythm.
- **Learner & Admin Workspaces**: `max-w-7xl` (`1280px`) fluid container inside the shell main region with `p-4 sm:p-6 lg:p-8`.
- **Program Dashboards (`app/dashboards/*`)**: `max-w-[100rem]` (`1600px`) responsive workspace container supporting collapsible left/right sidebars via `useFlexPageClasp`.
- **Focused Examination Canvas**: `max-w-5xl` (`1024px`) for standalone/case questions or full-viewport split-pane in NGN unfolding case studies.

---

## 5. Navigation Dimensions

- **Public Top Announcement Bar**: `min-h-[36px]`, `py-2 px-4`, background `#142B4A` (`bg-brand-navy`), text `#FFFFFF`, `text-xs font-medium`.
- **Public Sticky Navbar (`PublicShell`)**: `h-16` (`64px`), `sticky top-0 z-40`, `bg-surface/95 backdrop-blur-md border-b border-border`.
- **Desktop Nav Links**: 9 canonical items (`Home`, `Exams`, `Study`, `Care Plans`, `Mark K.`, `Community`, `FAQ`, `NCLEX`, `TEAS`), `px-3 py-1.5 rounded-md text-xs lg:text-[13px] font-medium`.

---

## 6. Sidebar Behavior

- **Learner Sidebar (`LearnerShell`)**: Fixed left (`w-[264px]` expanded, `w-[76px]` collapsed on `lg+`), slide-over drawer with `bg-black/60 backdrop-blur-sm` backdrop below `lg`.
- **Admin Sidebar (`AdminShell`)**: Fixed left (`w-[260px]` expanded, `w-[72px]` collapsed on `lg+`), high-density navigation groups (`OVERVIEW`, `CONTENT MANAGEMENT`, `LEARNER & ACCESS`, `MONETIZATION`).
- **Program Dashboard Sidebars (`LeftSidebar` / `RightSidebar`)**: `w-64` (`256px`) expanded, `w-20` (`80px`) collapsed, `top-16 h-[calc(100vh-64px)]`, `border-slate-200 dark:border-slate-800`, using NURVIA `--leftSidebar-bg` (`#F8FAFC`) and `--text-color` (`#0F172A`).

---

## 7. Header Behavior

- All sticky headers (`PublicShell`, `LearnerShell`, `AdminShell`, `ProgramDashboardShell`, `UpperStickyNavBar`) maintain `h-16` (`64px`) height, `border-b border-border`, subtle backdrop blur, and immediate access to search (`SeekModal` / `Ctrl+K`), theme toggle, and user account menu.

---

## 8. Button Variants and Sizes

- **Primary**: `bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm` (`#0D9488` teal with white text) or brand navy CTA (`bg-brand-navy hover:bg-brand-navyDeep text-white`).
- **Secondary**: `bg-surface text-brand-navy border border-border hover:bg-surface-muted shadow-sm`.
- **Outline**: `border border-border bg-surface text-foreground hover:bg-surface-muted`.
- **Ghost**: `text-foreground hover:bg-surface-muted`.
- **Destructive**: `bg-semantic-error text-white hover:bg-rose-800 shadow-sm`.
- **Link**: `text-primary underline-offset-4 hover:underline p-0 h-auto`.
- **Sizes**: `sm` (`h-8 px-3 text-xs`), `md` (`h-10 px-4 text-sm`), `lg` (`h-12 px-6 text-base`), `icon` (`h-10 w-10`).

---

## 9. Form Controls

- **Inputs, Selects, Textareas**: `h-10` (inputs/selects), `rounded-md` or `rounded-lg`, `border border-border bg-surface px-3.5 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal`.
- **Error State**: `border-semantic-error focus-visible:ring-semantic-error` paired with an accessible `role="alert"` or descriptive helper message.
- **Phone Input (`PhoneCountryInput`)**: Searchable ISO country selector + E.164 normalization.

---

## 10. Cards and Panels

- Standard surface container: `rounded-xl` or `rounded-2xl`, `border border-border bg-surface text-foreground shadow-sm`.
- Hover interactive cards: `hover:border-brand-teal/50 hover:shadow-md transition-all`.
- Prohibited: clashing neon pastel gradients (`bg-yellow-200`, `bg-pink-200`, `from-green-200 to-orange-200`).

---

## 11. Tables and Data Displays

- Container: `overflow-x-auto rounded-xl border border-border bg-surface shadow-xs`.
- Header (`thead`): `bg-surface-muted border-b border-border text-xs font-bold uppercase tracking-wider text-foreground-secondary`.
- Rows (`tbody tr`): `border-b border-border/70 hover:bg-surface-muted/60 transition-colors text-sm text-foreground`.

---

## 12. Modals and Drawers

- Backdrop: `fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm`.
- Modal surface: `rounded-2xl border border-border bg-surface text-foreground shadow-2xl`.
- Header: `#142B4A` navy header bar or clean `border-b border-border` header with accessible close button (`aria-label="Close"`).

---

## 13. Dropdowns and Menus

- Surface: `rounded-xl border border-border bg-surface text-foreground shadow-xl p-2`.
- Menu items: `role="menuitem"`, `rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-teal`.
- Full keyboard support (`Escape`, `ArrowDown`, `ArrowUp`, `Home`, `End`).

---

## 14. Tabs and Segmented Controls

- Filter chips / pills: `rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors`.
- Active state: `bg-brand-navy text-white border-brand-navy` or `bg-brand-teal text-white border-brand-teal`.
- Inactive state: `bg-surface text-foreground-secondary border-border hover:border-brand-teal/50`.

---

## 15. Alerts and Notifications

- Semantic alert banners with `role="alert"`:
  - **Info**: `border-brand-teal/30 bg-brand-teal/10 text-foreground`
  - **Success**: `border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200`
  - **Warning**: `border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200`
  - **Error**: `border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200`
- Browser `alert()` and `window.confirm()` are prohibited.

---

## 16. Loading States

- Skeleton placeholders (`DashboardSkeleton`, `SkeletonCard`, `TableSkeleton`) and inline spinners (`InlineLoader`, `PageLoader`, `SectionLoader`) use `animate-pulse bg-surface-muted` and `text-brand-teal` spinners with `aria-live="polite"`.

---

## 17. Empty States

- Structured centered panel (`rounded-2xl border border-border bg-surface p-8 text-center`) with a muted icon, clear heading, truthful explanation, and a reset/action button where applicable.
- Never fabricate synthetic records when a backend catalogue returns 0 items.

---

## 18. Error States

- Truthful service/network error cards (`ApiErrorHandler`, `NetworkError`, `501 NOT_PROVISIONED` alerts) with `role="alert"`, clear human-readable message, and retry action where applicable.

---

## 19. Responsive Breakpoints

- Mobile: `< 640px` (`default` / `min-[480px]`)
- Tablet: `sm: 640px`, `md: 768px`
- Desktop: `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`
- Essential actions and navigation items remain accessible across all breakpoints via responsive drawers and toolbars.

---

## 20. Focus and Accessibility States

- All interactive controls expose `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`.
- WCAG 2.2 AA contrast compliance across light and dark modes (`#0F172A` on `#FFFFFF` = 17.9:1; `#FFFFFF` on `#142B4A` = 13.5:1; `#FFFFFF` on `#0F766E` / `#0D9488` clinical action states).

---

## 21. Iconography

- Standard icon set: `lucide-react` (`w-4 h-4` to `w-6 h-6`, `strokeWidth={2}`), supplemented by `react-icons/fi` and `react-icons/fa6` in replicated modules and SVG clinical icons in `assets/icons/iconslist/`.
- Brand mark: NURVIA Geometric Learning Path vector symbol (`components/brand/logo.tsx` and `public/brand/nurvia-symbol.svg`).

---

## 22. Animation and Transition Rules

- Restrained, purposeful transitions (`transition-colors duration-200`, `transition-all duration-200`).
- Respect `prefers-reduced-motion: reduce` in carousels (`StudentTestimonialCarousel`) and background media (`HeroBackgroundVideo`).
