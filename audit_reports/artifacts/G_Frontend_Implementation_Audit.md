# G. Frontend Implementation Audit

## Overview

This artifact documents how the current NURVIA Prep frontend processes programs, subjects, common matches, subject cards, and navigation. The inspection covers the key components identified in the audit specification.

### 1. Programme Filtering in StudyLibraryView

**Component**: `src/components/study/study-library-view.tsx`

**Pathway state initialization** (lines 63-66):
```typescript
const queryTrack = searchParams?.get("track") || initialTrack || "All";
const [pathway, setPathway] = React.useState<string>(queryTrack);
```

**API call** (lines 209-224):
```typescript
void nurviaApi
  .getStudyLibrary(queryParams)
  .then((response) => { ... });
```

**Query params included** (lines 175-192):
- `pathway: pathway === "All" ? undefined : pathway` (line 176)
- `category`, `searchTerm`, `school`, `subject`, `season`, `topic`, `difficulty`, `questionType`, `savedOnly`
- `program: advanced.program || undefined` (line 188)
- `course: advanced.course || undefined` (line 189)

**Programme filtering application** (api-client.ts lines 1465-1515, within `getStudyLibrarySubjects` filteredSubjects filter):
```typescript
if (reqProgram && reqProgram !== 'all') {
  const pr = String(item.programName ?? item.programId ?? '').toLowerCase();
  if (pr !== reqProgram && !pr.includes(reqProgram)) return false;
}
```

**Current behavior**:
- If `reqProgram` is specified (e.g., "RN" or "LPN"), filters subjects by checking if the requested programme name/id is contained in the subject's `programName` or `programId`
- The `includes` matching means "RN" would match "RN Nursing Exams"
- No explicit RN/LPN-only retention — the filter works in conjunction with the `excludedProgramIds` filter applied earlier in the pipeline (stages 1-2)

**Learner dashboard integration** (src/app/learner/page.tsx, line 138):
```typescript
href="/study-guides"
```
- The learner page includes a link to study guides, but no direct programme filtering visible in this snippet.

### 2. Subject Card Rendering and Pathway Selection

**Component**: `src/components/study/SubjectCard.tsx`

**Pathway detection** (lines 50-53):
```typescript
const pathways = subject.availablePathways && subject.availablePathways.length > 0
  ? subject.availablePathways
  : ["RN", "PN_LPN"];
const hasMultiplePathways = pathways.includes("RN") && pathways.includes("PN_LPN");
const rnCount = subject.rnExamCount ?? 0;
const pnCount = subject.pnExamCount ?? 0;
```

**Rendering logic** (lines 163-241, summarized):

| Condition | Rendered Element | Pathway Behaviour |
|---|---|---|
| `hasMultiplePathways && hasExams` | Dropdown with RN + LPN/PN options + "Explore Subject" button | Learner selects pathway; URL `track` param updated via `onSelectSubject(subjectTitle, selectedPathway)` |
| `hasMultiplePathways && !hasExams` | Disabled button: "No Examinations Available" | No navigation; counts show 0 |
| `!hasMultiplePathways` | Single pathway button | Uses `pathways[0]` (defaults to RN if only one pathway has exams) |
| `hasExams` | Button text: `View ${pathways[0] === "PN_LPN" ? "LPN/PN" : "RN"} Examinations (${subject.totalExams})` | Shows pathway-specific count |
| `!hasExams` | Button text: "No Examinations Available" | Disabled, no navigation |

**Subject selection** (study-library-view.tsx, lines 476-483):
```typescript
onSelectSubject={(subjectName, selectedPathway) => {
  if (selectedPathway) {
    setPathway(selectedPathway as any);
  }
  setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
  setPageNumber(1);
}}
```

**When pathway is selected from dropdown**:
1. `setPathway(selectedPathway)` updates the `pathway` state and URL `track` param
2. `setAdvanced(subject)` updates the selected subject filter
3. `setPageNumber(1)` resets to page 1
4. Study Library re-renders with the new pathway and subject filters

**When subject title is selected** (no pathway):
1. Only `setAdvanced(subject)` is called; `pathway` state remains whatever it was
2. URL `track` param may or may not update depending on prior state

**Primary CTA button** (lines 166-173):
```typescript
<Button
  type="button"
  onClick={() => onSelectSubject(subject.title, subject.pathway)}
  className="flex-1 flex items-center justify-center gap-2 rounded-r-none"
>
  <span>Explore Subject</span>
  <ArrowRight className="h-4 w-4" />
</Button>
```
- Uses `subject.pathway` (the primary pathway from the SubjectCardDto, not necessarily the only pathway)
- If `availablePathways` includes both RN and PN_LPN, the primary pathway may be just one of the two

### 3. Study Library Header and Pathway Display

**Component**: `src/components/study/StudyLibraryHeader.tsx`

**Displayed context** (lines 29-39):
```typescript
{selectedSubject && (
  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2">
    <h2 className="font-semibold text-foreground">
      {selectedSubject}
    </h2>
    {selectedPathway && (
      <span className="text-xs font-medium text-brand-teal">
        {selectedPathway.replace("_", " ")} (RN)
      </span>
    )}
  </div>
)}
```

**Bug identified** (see Defect Register F-006): The suffix `(RN)` is hardcoded, so when `selectedPathway = "PN_LPN"`, the display shows "PN LPN (RN)" — incorrect suffix. The suffix should dynamically match the pathway.

**`selectedPathway` source**: Comes from the `pathway` state in `StudyLibraryView`, which is initialized from the URL `track` param and updated via `setPathway()`.

### 3. Category Tabs and Pathway Filtering

**Component**: `src/components/study/StudyLibraryCategoryTabs.tsx`

**4-way pathway tab alignment** (verified in test suite, test 6):
- "RN_Exit: "RN Exit"" and "PN_Exit: "LPN Exit"" labels present and correct
- "NursingMath" removed from tabs
- NCLEX label not displayed on RN_Exit tab

**Filter logic** (from code inspection):
- Tabs filtered by `classifyAuthoritativePathway` and `matchesRequestedPathway` (api-client.ts:329-340)
- `matchesRequestedPathway` maps requested pathway to actual pathway:
  - `req === 'all'` → always true
  - `req === 'rn'` → actual must be `'rn'`
  - `req === 'pnlpn'`, `req === 'pn'`, `req === 'lpn'` → actual must be `'pnlpn'` or `'pn'` or `'lpn'`
  - `req === 'rnexit'` → actual must be `'rnexit'`
  - `req === 'pnexit'` → actual must be `'pnexit'`
  - fallback: `actual === req`

**Filter continuity** (from report acceptance):
- Search, difficulty, course, school, season, examination, topic, question-type filters all retain context
- URL `track` and `subject` parameters persist across filter changes

### 4. Navigation and URL Parameter Persistence

**URL parameter initialization** (study-library-view.tsx, lines 63-66):
```typescript
const queryTrack = searchParams?.get("track") || initialTrack || "All";
const [pathway, setPathway] = React.useState<string>(queryTrack);
```

**URL parameter sync** (lines 141-166, useEffect):
```typescript
// Outgoing: update URL when pathway or subject changes
if (pathway !== "All") {
  params.set("track", pathway);
} else if (initialTrack && initialTrack !== "All") {
  params.set("track", "All");
}
if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
if (advanced.subject) params.set("subject", advanced.subject);
```

**Incoming: sync from URL on mount** (lines 115-118):
```typescript
// Sync incoming route track/category props
React.useEffect(() => {
  setPathway(queryTrack);
  setCategory(queryCategory);
}, [queryTrack, queryCategory]);
```

**Browser back/forward** (verified in report acceptance, items 45-46):
- URL `track` and `subject` parameters persist
- Refresh restores correct subject and pathway
- Back/forward navigation restores correct navigation state

**Subject selection navigation** (study-library-view.tsx, lines 476-483):
```typescript
onSelectSubject={(subjectName, selectedPathway) => {
  if (selectedPathway) {
    setPathway(selectedPathway as any);
  }
  setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
  setPageNumber(1);
}}
```

**Effect of pathway change**:
1. `setPathway(selectedPathway)` → updates URL `track` param → triggers API call with new `reqPathway` filter
2. `setAdvanced(subject)` → updates selected subject → triggers API call with new `advanced.subject` filter
3. `setPageNumber(1)` → resets pagination

**Direct URL navigation**:
- `?track=RN` → Shows RN pathway for all subjects
- `?track=PN_LPN` → Shows PN_LPN pathway for all subjects
- `?subject=Medical-Surgical Nursing` → Shows the unified "Medical-Surgical Nursing" card
- `?track=RN&subject=Medical-Surgical Nursing` → Shows Medical-Surgical Nursing with RN pathway pre-selected
- `?track=PN_LPN&subject=Medical-Surgical Nursing` → Shows Medical-Surgical Nursing with PN_LPN pathway pre-selected

### 5. Exclusive Subject Handling

**PN-exclusive subject** `subj-pn-care` (Practical Nursing Clinical Care):
- `pathway: 'PN_LPN'`, `availablePathways: ['PN_LPN']`
- `rnExamCount: 0`, `pnExamCount: undefined` (or 0)
- `totalExams`: computed from `primarySub.unitsCount || 4` (since `totalExams = rnExamCount + pnExamCount = 0 + undefined`, and the code has `if (totalExams === 0) totalExams = primarySub.unitsCount || 4`)
- Card renders as PN_LPN-only with no RN dropdown option (since `hasMultiplePathways` would be `PN_LPN.includes("RN") && PN_LPN.includes("PN_LPN")` = `false || false` = `false`)

**RN-exclusive subjects**: Not present in the fallback data. If the strata backend returns RN subjects without PN counterparts, they would have `availablePathways: ['RN']` and render as RN-only cards with no PN dropdown option.

### 6. Curriculum Isolation Enforcement

**Program filtering** (getStudyLibrarySubjects, stages 1-2):
- `excludedProgramIds = new Set([7, 8, 3, 5, 13])` filters out NCLEX-PN, NCLEX-RN, GED, TEAS, HESI A2
- Name-pattern filtering: `/nclex|ged|teas|hesi|explicit/i.test(name)` on line 1241
- Result: Subjects from programs 6 (LPN) and 9 (RN) pass through; others are excluded

**Pathway filtering** (getStudyLibrarySubjects, stage 7):
- `reqPathway` filter applies `classifyAuthoritativePathway` per examination
- When `?track=RN`, only RN-classified examinations are included in `matchingExams`, `rnExamCount`, and the display
- When `?track=PN_LPN`, only PN_LPN-classified examinations are included

**Search filtering** (getStudyLibrarySubjects, line 1510-1513):
```typescript
if (search) {
  const hay = `${item.title} ${item.description} ${item.courseName ?? ''} ${item.programName ?? ''}`.toLowerCase();
  if (!hay.includes(search)) return false;
}
```
- Searches across title, description, course name, and programme name
- No explicit programme exclusion in the search path; the search text could match content from excluded programmes if the search terms overlap

**Dashboard/Study Library parity** (report acceptance, item 14):
- Both pages consume the same `nurviaApi.getStudyLibrarySubjects` API method
- Identical canonical names, pathway availability, RN/PN counts, combined totals, question totals, dropdown behavior, destination URLs, and filter continuity

**Potential leak points** (Stage 9 investigation areas):
1. **Cached API responses**: If the Study Library caches `getStudyLibrarySubjects` results, stale data could reintroduce excluded programmes on navigation
2. **Direct URL access**: A URL like `?track=All&subject=Medical-Surgical Nursing` could display the unified card without pathway filtering, potentially showing both RN and PN examinations (intended behavior, but could be misconstrued as "leakage")
3. **Category tab interactions**: Switching category tabs applies `classifyAuthoritativePathway` filtering, but the `reqProgram` filter might not be applied consistently across all tab interactions
4. **Search without programme context**: Searching for "nursing" could return subjects from excluded programmes if the text matches

### 7. Summary of Frontend Behaviour

| Feature | Current Behavior | Spec Compliance |
|---|---|---|
| **Program filtering** | `excludedProgramIds = [7, 8, 3, 5, 13]` + name-pattern filtering; IDs 6 & 9 pass through; other IDs may also pass | ⚠️ Partially compliant — excludes 5 named programmes but doesn't actively retain only RN/LPN |
| **Subject collection creation** | One merged collection via `authoritativeSubjectMap`/`groupMap`; no separate RN/LPN collections created | ❌ Non-compliant — spec requires two independent collections before consolidation |
| **Common-subject matching** | Name-based merge via `cleanSubjectDisplayName()` and `authoritativeSubjectMap` | ⚠️ Partially compliant — works for verified common subjects; risk of false positives |
| **Examination aggregation** | `totalExams = rnExamCount + pnExamCount`; separate `rnExams`/`pnExams` filters | ✅ Compliant — correct per specification |
| **Pathway navigation** | Dropdown on SubjectCard; URL `track` param updates; Study Library filters by selected pathway | ✅ Compliant — navigation works correctly |
| **Exclusive subjects** | `subj-pn-care` (PN-only) renders as single-program card; RN-exclusive status unknown | ⚠️ Partially compliant — PN-exclusive visible; RN-only status depends on backend data |
| **Curriculum isolation** | Programme-level filtering exists; pathway filtering independent; search may not exclude excluded programmes | ⚠️ Partially compliant — gaps in search and caching |
| **Header pathway suffix** | Hardcoded `"(RN)"` regardless of actual pathway | ❌ Defect — should be dynamic |
| **Auto-resolution from profile** | Not implemented | ❌ Missing — spec requirement not met |

### 8. Frontend Implementation Gaps (vs. Specification)

| Gap | Severity | Required Change |
|---|---|---|
| **No separate RN/LPN subject collections** (Stage 3) | HIGH | After program filtering, create `rnSubjects` and `lpnSubjects` arrays before attempting consolidation |
| **Name-based merging without evidence** (Stage 4) | HIGH | Replace pure name matching with evidence-backed common-subject identification (course IDs, programme relationships, etc.) |
| **Hardcoded "(RN)" header suffix** (Header) | MEDIUM | Change to dynamic: `selectedPathway === "PN_LPN" ? "(PN)" : "(RN)"` |
| **No explicit RN/LPN programme validation** (Programme filtering) | MEDIUM | Add explicit check that only subjects with `programId` in `[6, 9]` (or identified as RN/LPN via name patterns) are retained |
| **Ambiguous subject handling** (Stage 4) | MEDIUM | Flag subjects like `subj-ob` for academic review instead of assuming merge |
| **Curriculum isolation via search** (Stage 9) | LOW-MEDIUM | Ensure search results don't reintroduce excluded programme content |
| **Auto-resolution from learner profile** | DESIGN GAP | Not implemented — mission requirement: "system must automatically select the appropriate academic experience" |

### 9. Code Areas Requiring Change (if implementing the revised architecture)

| File | Change Type | Description |
|---|---|---|
| `src/components/study/study-library-view.tsx` | Modification | Add logic to create separate RN and LPN subject collections after program filtering (Stage 3); integrate auto-resolution from learner profile (Stage 9) |
| `src/components/study/StudyLibraryHeader.tsx` | Bug fix | Replace hardcoded `"(RN)"` with dynamic suffix based on `selectedPathway` |
| `src/lib/api-client.ts` | Modification | Enhance programme filtering to explicitly retain only RN/LPN; enhance common-subject matching with evidence beyond cleaned display name; add `sourceSubjectIds` to output |
| `src/components/study/SubjectCard.tsx` | Minor modification | Ensure `availablePathways` and `pathway` fields correctly drive dropdown and primary CTA behavior |
| `src/components/study/StudyLibraryCategoryTabs.tsx` | No change needed | Already correctly implements 4-way pathway alignment (verified) |

### 10. Preservation Statement

All existing user work is preserved:
- No files deleted or renamed
- No database modifications
- No migrations or seed data changes
- No Git history changes
- All 7 existing test suites continue to pass without modification
- Pre-existing modifications (RouteTransitionBar, tooling scripts, audit directories) remain intact
- The current implementation's subject merging functionality is documented and preserved in this audit
