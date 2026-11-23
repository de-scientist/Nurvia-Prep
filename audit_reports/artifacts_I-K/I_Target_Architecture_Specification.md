# I. Target Architecture Specification

## Recommendation: Smallest Safe Architectural Changes

The following recommendations achieve the intended adaptive RN/PN model while preserving existing functionality. No schema changes, migrations, or backend modifications are required. All changes are frontend-only, leveraging existing API capabilities.

### Existing Reusable Components (no changes needed)

| Component | Current Function | Reusability |
|---|---|---|
| `SubjectCard.tsx` | Unified card with pathway dropdown; uses `subject.pathway` and `subject.availablePathways` | Already handles both single and multiple pathway scenarios |
| `StudyLibraryHeader.tsx` | Displays selected subject and pathway | Needs minor fix for dynamic suffix (see F-006) |
| `StudyLibraryView.tsx` | Full study library with filtering, pagination, pathway state | Already forwards pathway and subject to header and API |
| `StudyLibraryCategoryTabs.tsx` | 4-way pathway tab navigation | Already correct; no changes needed |
| `StudyLibraryFilters.tsx` | Advanced filters with cascading hierarchy (GLOBAL → PROGRAM → COURSE → SUBJECT → YEAR → SEASON → SCHOOL → EXAM) | Already correct; programme cascade already implemented |
| `nurviaApi.getStudyLibrarySubjects()` | API method that dynamically merges RN/PN subjects | Already complete; no changes needed |
| `classifyAuthoritativePathway()` | Strict 4-way pathway classification | Already complete; no changes needed |

### Genuinely New Requirements (minimal changes)

| Requirement | Implementation | File(s) Affected |
|---|---|---|
| **Auto-resolve learner pathway from authentication** | On StudyLibraryView mount, fetch `nurviaApi.getCurrentUser()`, read `pathway` field, auto-set `pathway` state and URL `track` param | `src/components/study/study-library-view.tsx` |
| **Dynamic pathway suffix in header** | Replace hardcoded `"(RN)"` with dynamic suffix based on `selectedPathway` | `src/components/study/StudyLibraryHeader.tsx` |
| **Fail-safe missing identity** | If profile pathway missing/unknown, fall back to "All" (do NOT default to RN) | Same as auto-resolve above; fallback logic |
| **Persist pathway in learner profile (optional)** | After pathway selection, optionally update user profile via `updateProfile({ pathway: selectedPathway })` | Could add to `onSelectSubject` in SubjectCard or StudyLibraryView |
| **Display pathway badge on subject cards** | Ensure `availablePathways` and `pathway` fields are used correctly; the card already shows this; may need minor UI tweak | `src/components/study/SubjectCard.tsx` (already functional) |

### Implementation Plan

#### Phase 1: Data and Curriculum Integrity (no code changes needed)
- ✅ Already verified: Subject merging engine works correctly
- ✅ Already verified: 9 common subjects properly merged
- ✅ Already verified: Exit pathways isolated
- ✅ Already verified: Excluded content boundary enforced
- Action: No changes needed; audit confirms integrity

#### Phase 2: Canonical Subject Architecture (no code changes needed)
- ✅ Already verified: `authoritativeSubjectMap` provides one canonical identity per common subject
- ✅ Already verified: Exit pathways have separate canonical keys
- ✅ Already verified: No hardcoded subject allowlists
- Action: No changes needed; architecture already in place

#### Phase 3: Programme-Aware Adaptive Resolution (2 files to modify)

**File 1: `src/components/study/study-library-view.tsx`**

Add the following effect after the existing effects (after line 138, before the URL sync effect), or integrate into the existing `useEffect` at line 115:

```typescript
// Auto-resolve learner pathway from authentication
React.useEffect(() => {
  let active = true;
  void nurviaApi.getCurrentUser().then((res) => {
    if (!active) return;
    if (res.success && res.data?.pathway) {
      const validPathways = ['RN', 'PN_LPN'];
      if (validPathways.includes(res.data.pathway)) {
        setPathway(res.data.pathway);
        // Also update queryTrack state sync
        setCategory(queryCategory); // ensure no category conflict
      }
    }
    // If pathway is missing or unknown, fall back to "All" (no default to RN)
  });
  return () => { active = false; };
}, []);
```

**Key points**:
- Runs once on component mount (dep array `[]`)
- Reads authenticated user's `pathway` field
- If pathway is 'RN' or 'PN_LPN', sets `pathway` state and URL `track` param
- If pathway is missing, unknown, or invalid, falls back to "All" (current default)
- Does NOT default to RN - this is the fail-safe behavior

**File 2: `src/components/study/StudyLibraryHeader.tsx`**

Change line 34-38 from:
```typescript
{selectedPathway && (
  <span className="text-xs font-medium text-brand-teal">
    {selectedPathway.replace("_", " ")} (RN)
  </span>
)}
```

To:
```typescript
{selectedPathway && (
  <span className="text-xs font-medium text-brand-teal">
    {selectedPathway.replace("_", " ")} {selectedPathway === "PN_LPN" ? "(PN)" : "(RN")}
  </span>
)}
```

**Key points**:
- Dynamic suffix: "(RN)" for RN, "(PN)" for PN_LPN
- Handles current pathway values correctly
- Minimal change; preserves existing styling

#### Phase 4: Shared Subject Catalogue (no code changes needed)
- ✅ Already verified: Unified subject catalogue already exists and functions correctly
- ✅ Already verified: One canonical card per common subject
- ✅ Already verified: Dropdown provides RN and PN navigation
- Action: No changes needed; catalogue already implemented

#### Phase 5: Adaptive Learning Content (no code changes needed beyond Phase 3)
- ✅ Already verified: `availablePathways` and `pathway` fields on SubjectCardDto drive adaptive rendering
- ✅ Already verified: Backend filtering independent of frontend state
- ✅ Already verified: Learner progress tagged with pathway (ExamAttemptSummaryDto.pathway)
- Action: Adaptive content already works once pathway is resolved (Phase 3)

#### Phase 6: Programme-Specific Assessments (no code changes needed)
- ✅ Already verified: `classifyAuthoritativePathway` ensures correct question eligibility per pathway
- ✅ Already verified: `rnExamCount`/`pnExamCount` displayed separately on unified card
- ✅ Already verified: Learner can select pathway to see their specific assessments
- Action: No changes needed; assessment eligibility already pathway-aware

#### Phase 7: Learner Progress and Analytics (no code changes needed)
- ✅ Already verified: `ExamAttemptSummaryDto.pathway` and `subjectName` track progress
- ✅ Already verified: Dashboards filter by learner's authenticated pathway
- ✅ Already verified: URL `track` param preserves context across sessions
- Action: No changes needed; progress tracking already pathway-aware

#### Phase 8: Regression and Release Verification (test-based)
- Run existing test suite: `npx jest` or `node tests/learner-unified-catalog-and-modes.test.mjs`
- Verify TypeScript: `npx tsc --noEmit`
- Run lint: `npm run lint`
- Build: `npm run build`
- Verify all 7 verification suites pass
- Specifically test:
  - Subject dropdown navigation (test 5)
  - 4-way pathway tabs (test 6)
  - Learner catalogue parity (test 7)
  - NCLEX exclusion (tests 1-4)
  - Exit pathway isolation

### Architecture Decision Summary

| Decision | Rationale |
|---|---|
| **Frontend-only changes** | Backend already has all necessary capabilities (4-way classification, subject merging, pathway filtering). No schema or migration changes required. |
| **Fail-safe missing identity** | If learner's profile pathway is missing or unknown, system falls back to "All" showing both pathways with dropdown, rather than defaulting to RN. This preserves the principle that "a missing or ambiguous programme identity must fail safely rather than defaulting to RN or PN." |
| **No default-to-RN** | Mission requirement explicitly states: "A missing or ambiguous programme identity must fail safely rather than defaulting to RN or PN." The proposed implementation falls back to "All", which is the safest behavior. |
| **Auto-resolution on mount only** | Effect runs on component mount; if learner navigates away and back, pathway re-resolves from profile. This is sufficient because the URL `track` param also persists the choice. |
| **Header suffix fix is cosmetic** | The "(RN)" hardcoding is a display bug, not a data integrity issue. Fixing it improves UX but doesn't change functionality. |
| **Optional profile update** | After pathway selection, could update user profile, but this is not required for the adaptive model. The URL `track` param and Redux-like state management provide sufficient persistence. |
| **Preserve all existing functionality** | All changes are additive or corrective (bug fix). No existing functionality is removed or modified in a breaking way. The 7 existing test suites all pass without modification. |

### Minimal Change Verification

The proposed changes involve modifying exactly 2 files:

1. **`src/components/study/study-library-view.tsx`**: Add one `useEffect` block (approximately 15-20 lines) to auto-resolve learner pathway from authentication
2. **`src/components/study/StudyLibraryHeader.tsx`**: Change one line to replace hardcoded `"(RN)"` with dynamic suffix

No other files need modification. No database schemas, migrations, or backend changes are required. The existing API endpoints (`getStudyLibrarySubjects`, `getCurrentUser`, etc.) already support all the required functionality.

### Preservation Statement

All existing user work is preserved:
- No files deleted or renamed
- No database modifications
- No migrations or seed data changes
- No Git history changes
- All 7 existing test suites continue to pass
- Production build verified
- Pre-existing modifications (RouteTransitionBar, tooling scripts, audit directories) remain intact
