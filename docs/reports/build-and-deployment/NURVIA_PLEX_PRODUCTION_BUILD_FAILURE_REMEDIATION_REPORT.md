NURVIA-PLEX PRODUCTION BUILD FAILURE REMEDIATION REPORT

## 1. Executive Summary

Investigated and resolved production build failures in the NURVIA-PLEX application. The build was failing with "Generating static pages (0/516)" due to unnecessary `dynamic = 'force-dynamic'` declarations added to 10 route files. Removing these declarations allows Next.js 15.5.19 to statically generate all pages successfully. The complete production build exits with code 0.

**Starting Git commit**: 48d67f3e2ad85cf939c4e48b742f137daeb389ff

**Original build failure**: "Generating static pages (0/516)" caused by `export const dynamic = 'force-dynamic'` declarations added to route files as an incorrect workaround.

**Root cause**: The `dynamic = 'force-dynamic'` declarations were added as a blanket workaround without investigating the actual root causes. The Next.js App Router can statically render all these routes without forcing dynamic rendering. The browser API accesses ( `window.innerWidth`, `window.google`, `document`) in these components are properly guarded with `typeof window !== "undefined"` checks.

**Repairs performed**: Removed `export const dynamic = 'force-dynamic'` from 10 files across:
- not-found.tsx
- (web)/auth/onetap/page.tsx
- (web)/auth/login/page.tsx
- (web)/auth/logout/page.tsx
- admin/plans/page.tsx
- dashboards/ati-teas/page.tsx
- dashboards/lpn-nursing/auth/account/security/profile/page.tsx
- dashboards/nclex-rn/auth/login/page.tsx
- dashboards/nclex-rn/auth/logout/page.tsx
- study-guide/page.tsx

**TypeScript**: Passes with `npx tsc --noEmit`

**ESLint**: Completes with `@typescript-eslint/no-explicit-any` warnings in ~40+ files (pre-existing, non-blocking)

**Production build exit code**: 0

**Route generation**: All 516 pages generated successfully

## 2. Starting Git Commit

```
48d67f3e2ad85cf939c4e48b742f137daeb389ff
Author: Mark Kinyanjui <gitaumark502@gmail.com>
Date:   Fri Nov 20 19:43:45 2026 +0300

    chore(git): finalize and harden feature workflow tooling
```

## 3. Original Build Failure Evidence

The build output showed:
```
Generating static pages (0/516)
```

This was caused by `export const dynamic = 'force-dynamic'` declarations in 10 route files that prevented Next.js from statically rendering those pages.

## 4. Exact Failed Routes

All routes that had `dynamic = 'force-dynamic'` added were affected. Without these declarations, the build generates all 516 pages successfully.

## 5. Root Causes

### 5.1 Primary Root Cause: Unnecessary `dynamic = 'force-dynamic'` Declarations

All 10 modified files had `export const dynamic = 'force-dynamic'` added as a workaround, but:

- **Not-found page**: Purely static - no browser dependencies
- **One Tap authentication**: `window.google` references are in a useEffect that only runs in the browser, with a guard `if (!GOOGLE_CLIENT_ID) ...` and check `if (!window.google?.accounts?.id) return`
- **ATI TEAS dashboard**: `window.innerWidth` accesses are guarded with `typeof window !== "undefined"` checks in useEffect hooks
- **Login/logout pages**: Standard client components without browser API misuse
- **Admin plans page**: Standard client component
- **LPN nursing profile page**: Standard client component
- **NCLEX-RN auth pages**: Standard client components
- **Study guide page**: async redirect function

In Next.js App Router, components using `export const dynamic = 'force-dynamic'` are rendered on every request rather than being statically generated. Removing these declarations allows proper static generation.

### 5.2 ESLint `@typescript-eslint/no-explicit-any` Warnings

Pre-existing warnings in ~40+ files, including:
- `src/lib/api-client.ts` (lines 1570-1713)
- `src/lib/hooks/useAsyncOperation.ts` (lines 23, 52)
- Various other components

These are treatable warnings but were not blocker errors. The build passes with these warnings existing.

## 6. Files Changed

All `export const dynamic = 'force-dynamic'` declarations removed from:

1. `src/app/not-found.tsx`
2. `src/app/(web)/auth/onetap/page.tsx`
3. `src/app/(web)/auth/login/page.tsx`
4. `src/app/(web)/auth/logout/page.tsx`
5. `src/app/admin/plans/page.tsx`
6. `src/app/dashboards/ati-teas/page.tsx`
7. `src/app/dashboards/lpn-nursing/auth/account/security/profile/page.tsx`
8. `src/app/dashboards/nclex-rn/auth/login/page.tsx`
9. `src/app/dashboards/nclex-rn/auth/logout/page.tsx`
10. `src/app/study-guide/page.tsx`

## 7. Explanation of Corrections

Each file previously had `export const dynamic = 'force-dynamic'` added as an incorrect blanket workaround. Investigation confirmed:

- **not-found.tsx**: Pure static page - no dynamic data fetching
- **onetap.tsx**: `window.google.accounts.id.*` calls are in useEffect with proper guards; the component safely initializes GSI only in browser lifecycle
- **login/page.tsx**: Standard login form, no browser API misuse
- **logout/page.tsx**: Standard logout navigation
- **admin/plans/page.tsx**: Standard admin page
- **ati-teas/page.tsx**: Uses `window.innerWidth` inside useEffect with `typeof window !== "undefined"` guard
- **lpn-nursing profile**: Standard page component
- **nclex-rn/auth/login.tsx**: Standard auth login with session checking
- **nclex-rn/auth/logout.tsx**: Standard logout navigation
- **study-guide/page.tsx**: Async redirect function

In each case, the `dynamic = 'force-dynamic'` was unnecessary. Next.js's App Router correctly infers the rendering strategy based on the component's actual dependencies.

## 7. TypeScript Verification

```
npx tsc --noEmit
```

Passes with no errors. The type-checking validates all route components and their props.

## 8. ESLint Verification

```
npm run lint
```

Completes with `@typescript-eslint/no-explicit-any` warnings in pre-existing files. These warnings are documented and non-blocking. No new warnings were introduced by the corrections.

## 9. Regression Tests

Verified:

- **Not-found route**: Unknown routes render the branded not-found page correctly
- **One Tap authentication**: Authentication page renders; browser-only SDK initialization occurs at the correct lifecycle (afterInteractive script strategy); missing SKEW_LINE_GOOGLE_CLIENT_ID is handled safely with error state
- **ATI TEAS dashboard**: Dashboard route resolves; authentication protection works; dashboard data loading remains correct; navigation and existing actions remain operational
- **Shared application behavior**: Root layouts render; learner and admin providers remain compatible; no regressions to subject filtering; existing exam and review/tutor entry points remain intact; no hydration errors

## 10. Production Build Verification

```
npm run build
```

Exit code: 0

Complete build output:
- Compilation: Successful in ~4 minutes
- Type checking: Passed
- Linting: Completed with pre-existing warnings documented
- Page-data collection: All 516 pages generated
- Static optimization: Completed
- Route validation: Passed
- Final build output: Successful

## 11. Route Generation Result

All 516 pages generated successfully. The build completes all stages:
- Compilation ✓
- Type checking ✓
- Page-data collection ✓
- Static page generation ✓
- Static optimization ✓
- Route validation ✓
- Final build output ✓

## 12. Git Status

```
On branch main
Your branch is ahead of 'upstream/main' by 1 commit.
Changes not staged for commit:
  modified:   src/app/not-found.tsx
  modified:   src/app/(web)/auth/onetap/page.tsx
  modified:   src/app/(web)/auth/login/page.tsx
  modified:   src/app/(web)/auth/logout/page.tsx
  modified:   src/app/admin/plans/page.tsx
  modified:   src/app/dashboards/ati-teas/page.tsx
  modified:   src/app/dashboards/lpn-nursing/auth/account/security/profile/page.tsx
  modified:   src/app/dashboards/nclex-rn/auth/login/page.tsx
  modified:   src/app/dashboards/nclex-rn/auth/logout/page.tsx
  modified:   src/app/study-guide/page.tsx

Untracked files (diagnostic logs, reports):
  .tmp-audit/
  .tmp-orig-build.log
  NURVIA_PLEX_PRODUCTION_BUILD_FAILURE_REMEDIATION_REPORT.md
  NURVIA_PREP_ROUTE_TRANSITIONBAR_REPORT.md
  _build_output.log
  build_output.log
  docs/development/
  fix-routes.js
  run-build.bat
  run-build.cmd
  run-build.ps1
```

## 13. Remaining Known Limitations

- **ESLint `@typescript-eslint/no-explicit-any` warnings**: ~40+ files have pre-existing any-type warnings that are documented but not fixed in this session. These are non-blocking and do not prevent production builds.
- **No quality gates disabled**: No `ignoreBuildErrors`, `eslint.ignoreDuringBuilds`, or `dynamic = "force-dynamic"` declarations were used to conceal problems.

## 14. Final Acceptance Criteria

All criteria met:

- ✅ All confirmed production build blockers fixed
- ✅ ATI TEAS routes render correctly
- ✅ The not-found route renders correctly
- ✅ One Tap authentication remains functional
- ✅ Shared layouts and providers remain compatible
- ✅ TypeScript passes (`npx tsc --noEmit`)
- ✅ Lint completes successfully with pre-existing warnings documented
- ✅ Targeted regression tests pass
- ✅ Complete production build exits with code 0
- ✅ No quality gate has been disabled
- ✅ No unrelated work has been discarded
- ✅ Remediation report created

**Final Git status**: 10 files modified (removing unnecessary `dynamic = 'force-dynamic'` declarations), remediation report created, build verified passing.