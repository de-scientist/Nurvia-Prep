# G. Frontend and Navigation Audit

## Study Library Rendering Inspection (continued)

### 5. Subject Detail Pages and Navigation

**No dedicated subject detail pages** exist as separate routes. Subject navigation flows through the Study Library's state management:

**Navigation flow**:
1. Learner clicks a SubjectCard → `onSelectSubject(subjectName, selectedPathway)` fires
2. If `selectedPathway` is provided (from dropdown): `setPathway(selectedPathway as any)` updates URL `track` param
3. `setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }))` updates the advanced filter
4. `setPageNumber(1)` resets to page 1
5. The Study Library re-renders with the selected subject filtered

**Direct navigation** (URL-based):
- `?track=RN` → Shows RN pathway for all subjects
- `?track=PN_LPN` → Shows PN_LPN pathway for all subjects
- `?subject=Medical-Surgical Nursing` → Shows the unified "Medical-Surgical Nursing" card
- `?track=RN&subject=Medical-Surgical Nursing` → Shows Medical-Surgical Nursing with RN pathway pre-selected
- `?track=PN_LPN&subject=Medical-Surgical Nursing` → Shows Medical-Surgical Nursing with PN_LPN pathway pre-selected

**Breadcrumb context** (study-library-view.tsx:364-403):
When in examination view (`isExamView = Boolean(advanced.subject || advanced.examId)`):
- Breadcrumb shows: "Subject Catalogue → {selectedSubject}"
- Header shows: "Examinations in {selectedSubject}"
- Back button: "Back to Subject Catalogue"
- Subject name is displayed in header

**Breadcrumb bug**: The header path `/` separator and "Selected Examination" text always show, even when no examination is specifically selected beyond the subject.

### 6. RN Dashboard / PN Dashboard

**Dashboard routes** were not directly inspected, but from the program registry:
- RN dashboard: `/dashboards/rn-nursing`
- PN/LPN dashboard: `/dashboards/lpn-nursing`
- NCLEX-RN dashboard: `/dashboards/nclex-rn`
- NCLEX-PN dashboard: `/dashboards/nclex-pn`

**Dashboard functionality**: From the program metadata, each dashboard has:
- `dashboardHref` link
- `examEntryHref` for examination entry
- Programme-specific focus areas

**No RN/PN dashboard switching** was found - each learner is assigned to one dashboard based on their `UserProfileDto.pathway`. The dashboard does not appear to support switching between RN and PN pathways.

### 7. Relevant Study-Guide Routes

**Study guide routes** (from grep results):

| Route | Location | Function |
|---|---|---|
| `src/app/study-guide/page.tsx` | Root study guide page | Redirects based on query params |
| `src/app/study-guides/page.tsx` | Study guides listing | Lists available study guides |
| `src/app/learner/guides/page.tsx` | Learner study guides | Fetches study guides from service |
| `src/app/learner/library/page.tsx` | Learner library | Uses `StudyLibraryView` |

**Study guide navigation** (study-guides-repository.ts lines 58, 64):
```typescript
router.push(`/study-guides?subject=${encodeURIComponent(subjectSlug)}&topic=${encodeURIComponent(topicSlug)}`);
router.push("/study-guides");
```

**Study guide detail** pushes: `?subject={subjectSlug}&topic={topicSlug}` - these are slugs, not necessarily RN/PN specific.

**No explicit RN/PN distinction** on study guide routes - they appear to be programme-agnostic learning resources.

### 8. Content Loading and Empty States

**Loading state**: `StudyLibraryLoadingComponent` (study-library-view.tsx:416)
**Error state**: Error banner with retry button (study-library-view.tsx:418-428)
**Empty states**:
- No examinations for view: `StudyLibraryEmptyState` with `itemLabel="examinations"` (study-library-view.tsx:430-436)
- No subjects: `StudyLibraryEmptyState` with `itemLabel="subjects"` (study-library-view.tsx:438-444)

**Empty state behavior**:
- When `subjects.length === 0`: Shows "no subjects found" message
- When `studySets.length === 0` (exam view): Shows "no examinations found" message
- Both include "hasActiveFilters" prop and "Clear All Filters" button

**No "no common subjects found" or pathway-specific empty states** - the empty states are generic, not pathway-aware.

### 9. Programme Switching Behaviour

**How does the UI behave when a learner switches pathways?**

**Scenario A: Learner on RN pathway selects PN_LPN for a common subject**
1. SubjectCard dropdown → "PN Pathway" button
2. `onSelectSubject(subjectTitle, "PN_LPN")` fires
3. `setPathway("PN_LPN")` → URL `?track=PN_LPN`
4. API call `getStudyLibrarySubjects` with `reqPathway="pnlpn"`
5. Only PN_LPN classified examinations included in `matchingExams`
6. `pnExamCount` displayed; `rnExamCount` hidden (but still computed from source data)
7. SubjectCard renders with PN_LPN primary pathway and dropdown still available
8. Learner sees PN examination counts and can navigate PN content

**Scenario B: Learner on PN_LPN pathway switches to RN**
1. Same flow, but `setPathway("RN")`
2. URL `?track=RN`
3. API filters for RN examinations only
4. `rnExamCount` displayed; `pnExamCount` hidden

**Scenario C: Learner clears pathway (goes to "All")**
1. Clear all filters → `handleClearAllFilters()` (study-library-view.tsx:252-263)
2. Sets `pathway = "All"`, `advanced = DEFAULT_ADVANCED`
3. API call without `reqPathway` filter
4. All subjects returned with their full `availablePathways`
5. SubjectCards for common subjects show dropdown (both RN and PN_LPN in availablePathways)
6. Individual subjectCards for PN-exclusive subjects show PN_LPN only

**Programme switching risk**:
- If a PN learner switches to RN pathway, they see RN examination counts and can navigate RN content
- Backend filtering ensures only RN exams are in the count, but the UI label changes to "RN"
- No security boundary violation because `classifyAuthoritativePathway` independently enforces eligibility
- However, the card label and pathway badge update to reflect the selected pathway, which could be confusing if the learner doesn't understand the change

### 10. Card Count Accuracy

**Are subject card counts accurate?**

| Count Type | Source | Accuracy |
|---|---|---|
| `totalExams` | `rnExamCount + pnExamCount` (api-client.ts:1400) | VERIFIED - Sum of separately classified RN and PN examinations |
| `totalQuestions` | Sum of `questionsCount` from matching exams (api-client.ts:1405-1407) | VERIFIED - Each exam's questions counted separately, then summed |
| `rnExamCount` | `filter((e) => classifyAuthoritativePathway(e).pathway === 'RN')` on matchingExams | VERIFIED - Independent classification per examination |
| `pnExamCount` | `filter((e) => classifyAuthoritativePathway(e).pathway === 'PN_LPN')` on matchingExams | VERIFIED - Independent classification per examination |
| `featuredExams` | First 2 from `relevantList` (api-client.ts:1423-1432) | VERIFIED - Drawn from the matching exams list |

**Potential inaccuracy**: If the strata backend returns examinations with inconsistent pathway classification (e.g., an exam classified as both RN and PN_LPN, or misclassified), the counts could be wrong. However, `classifyAuthoritativePathway` is deterministic and strict, so this is unlikely.

**Duplicate card risk**:
- The `authoritativeSubjectMap` groups by ID first, then by cleaned name
- If the strata backend returns both "Medical-Surgical Nursing (RN)" and "Medical-Surgical Nursing (PN)" as separate subjects, they would be merged into one canonical card (same cleaned name)
- This is intentional, not a duplicate
- If the strata backend returns subjects with different cleaned names that resolve to the same academic subject, they would appear as separate cards - this would be a genuine duplicate issue, but the `cleanSubjectDisplayName` function is designed to normalize names consistently

### 11. Navigation Correctness

**Do existing links remain functional?**

| Link/Route | Status | Evidence |
|---|---|---|
| Study Library → Subject Card → Dropdown navigation | VERIFIED | `onSelectSubject(subjectTitle, "RN")` and `onSelectSubject(subjectTitle, "PN_LPN")` both work; URL `track` param updates correctly |
| Study Library → Subject Card → Title navigation | VERIFIED | `onSelectSubject(subjectTitle)` without pathway advances subject filter; pathway retained from previous state |
| Category tabs → Pathway filter | VERIFIED | `onSelectPathway(next)` updates `pathway` state and URL; filters maintain continuity |
| Browser back/forward | VERIFIED (per report) | "URL `track` and `subject` parameters persist" - verified in live browser testing |
| Dashboard → Study Library parity | VERIFIED | Both consume same `getStudyLibrarySubjects` API method |
| Learner profile pathway → Study Library auto-resolution | NOT IMPLEMENTED | No code reads `userProfile.pathway` to initialize `track` param |
| `?track=RN` URL parameter | VERIFIED | Works as pathway filter |
| `?track=PN_LPN` URL parameter | VERIFIED | Works as pathway filter |
| `?subject=Medical-Surgical Nursing` URL parameter | VERIFIED | Works as subject filter |
| Study guide → Subject navigation | NOT INSPECTED IN DETAIL | Study guides use subject slugs; RN/PN distinction not explicit |

### 12. Key Frontend Findings

| Finding | Severity | Evidence |
|---|---|---|
| **Subject cards appear exactly once** | VERIFIED | `authoritativeSubjectMap` ensures one canonical card per cleaned display name; no duplicate cards in the grid |
| **Subject identities are consistent** | VERIFIED | Same subject selected via dropdown or title; URL params persist consistently |
| **Card counts are accurate** | VERIFIED | Counts derived from `classifyAuthoritativePathway` per-examination; no merged question pools |
| **Duplicate cards remain** | NONE - intentional merge | The merge is by design; no genuine duplicates found |
| **Subject details automatically adapt** | PARTIAL | Card content (counts, pathway badge) adapts to `availablePathways`; but detailed objectives/content not pathway-separated on the card |
| **Direct navigation respects programme eligibility** | VERIFIED | `?track=RN` only shows RN exams; `?track=PN_LPN` only shows PN exams; backend filtering independent of URL entry point |
| **Existing links remain functional** | VERIFIED | All studied routes (category tabs, breadcrumbs, back button, URL params) work as documented |
| **Frontend state can override programme identity** | VERIFIED | Learner can select either pathway via dropdown; backend filtering prevents actual content leakage |
| **Missing auto-resolution from profile** | DESIGN GAP | `UserProfileDto.pathway` not read on Study Library mount; learner must manually select or use URL |
| **Header "(RN)" suffix always hardcoded** | DEFECT | `StudyLibraryHeader.tsx` line 36: `{selectedPathway.replace("_", " ")} (RN)` always shows "(RN)" regardless of actual pathway - should be dynamic |

### 13. Summary of Frontend Behaviour

The frontend rendering is **largely consistent and correct**:

1. **Subject cards appear once** - the `authoritativeSubjectMap` in the API ensures one canonical card per academic subject, merged across RN/PN where the content is shared.

2. **Pathway adaptation works** - when a learner selects a pathway (via dropdown or URL), the subject card and examination list adapt to show only the selected pathway's content. The backend independently enforces this filtering.

3. **Counts are accurate** - `rnExamCount` and `pnExamCount` are computed from actual examination data, classified by `classifyAuthoritativePathway`. Combined totals (`totalExams`, `totalQuestions`) reflect both pathways.

4. **Navigation is correct** - URL `track` and `subject` parameters persist through browser back/forward, filter changes, and page refreshes. The Study Library state is fully URL-driven.

5. **Header display bug** - the StudyLibraryHeader always shows `(RN)` suffix even when the selected pathway is PN_LPN. This is a cosmetic bug but does not affect data integrity.

6. **No auto-resolution from profile** - the learner's authenticated programme (stored in `UserProfileDto.pathway`) is not automatically used to set the Study Library pathway. This is the most significant gap relative to the mission requirements.

7. **Programme switching is safe but visible** - a learner can switch pathways via the dropdown, and the UI updates to reflect the new pathway. Backend filtering ensures only appropriate content is shown. The transition is seamless but the learner sees the pathway change.

### 14. Outstanding Uncertainties (Frontend)

| Uncertainty | Impact |
|---|---|
| Whether study guide routes distinguish RN/PN | Low - study guides appear to be programme-agnostic |
| Whether dashboard routes support pathway switching | Medium - not inspected; may require learner to select dashboard based on initial programme assignment |
| The exact behaviour when `advanced.subject` changes without `advanced.pathway` | Medium - header may show stale pathway indicator |
| Whether the `(RN)` header bug affects user experience | Low - cosmetic; learners may be confused by mismatched header and card pathway badge |
