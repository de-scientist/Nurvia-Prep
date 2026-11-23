# I. Revised Implementation Roadmap

## Priority-Ordered Implementation Phases

This roadmap provides ordered implementation phases with dependencies and acceptance criteria, based on the audit findings and the revised 9-stage architecture specification.

### Phase 1: Programme Filtering Enhancement (WEEK 1)
**Objective**: Make programme filtering explicit and defendable.

**Dependencies**: None — works with existing code structure.

**Acceptance Criteria**:
- [ ] Only subjects with programme IDs 6 (LPN) or 9 (RN) are retained in the learner-facing curriculum
- [ ] Programme IDs 7, 8, 3, 5, 13 are excluded
- [ ] Any other programme IDs from the strata backend are also excluded (defense-in-depth)
- [ ] All 7 existing test suites pass without modification

**Required Changes** (2 files):

**File 1: `src/lib/api-client.ts`** — After the `excludedProgramIds` filter (after line 1247, before the `authoritativeSubjectMap` construction at line 1249):

Add explicit RN/LPN programme retention:
```typescript
// After the excludedProgramIds filter, retain only RN and LPN programmes
const validProgramIds = new Set(['6', '9']);
const rawSubjects = (subjectsRes.success && subjectsRes.data ? subjectsRes.data.items : []).filter((sub: Record<string, any>) => {
  // ... existing excludedProgramIds and name-pattern filtering ...

  // NEW: Explicit RN/LPN retention
  const pId = Number(sub.programId ?? c?.programId ?? '');
  if (pId && !validProgramIds.has(String(pId))) return false;

  return true;
});
```

**File 2: `src/components/study/study-library-view.tsx`** — No code changes needed if API filtering is adequate; may need to update pathway state initialization logic.

**Rationale**: This makes the filtering intent explicit rather than implicit. The current "filter out the bad, keep the rest" approach is functional but not comprehensive. This change ensures that only RN and LPN programmes are retained, even if the strata backend returns subjects with other programme IDs.

**Verification**: Run all 7 test suites; verify that the programme filtering logic produces the expected subject counts.

---

### Phase 2: Separate RN/LPN Subject Collections (WEEK 1-2)
**Objective**: Create two independent RN and LPN subject collections before consolidation.

**Dependencies**: Phase 1 (programme filtering enhancement).

**Acceptance Criteria**:
- [ ] `rnSubjects` array contains only RN-identified subjects (programId 9 or RN pathway)
- [ ] `lpnSubjects` array contains only LPN-identified subjects (programId 6 or PN_LPN pathway)
- [ ] No subject appears in both collections
- [ ] All RN-only and LPN-only subjects are preserved in their respective collections
- [ ] All 7 existing test suites pass without modification

**Required Changes** (1 file):

**File 1: `src/lib/api-client.ts`** — After program filtering (Stage 2) and before the `authoritativeSubjectMap` construction (Stage 4), add:

```typescript
// Stage 3: Create separate RN and LPN subject collections
const rnSubjects = rawSubjects.filter((sub: Record<string, any>) => {
  const pId = Number(sub.programId ?? c?.programId ?? 0);
  // programmeId 9 = RN Nursing Exams; also check for RN pathway identification
  const hasRNPathway = ['RN', 'RN_Exit'].includes(inferExamPathway(sub));
  return pId === 9 || hasRNPathway;
});

const lpnSubjects = rawSubjects.filter((sub: Record<string, any>) => {
  const pId = Number(sub.programId ?? c?.programId ?? 0);
  // programmeId 6 = LPN Nursing Exams; also check for PN_LPN pathway identification
  const hasPNPathway = inferExamPathway(sub) === 'PN_LPN';
  return pId === 6 || hasPNPathway;
});
```

**Important**: The `rawSubjects` at this point has already been filtered by programme ID (from Phase 1), so `rnSubjects` and `lpnSubjects` will naturally be disjoint. The additional pathway checks provide defense-in-depth.

**Rationale**: Per specification Stage 3, the frontend must create two independent collections before attempting consolidation. This ensures that RN and LPN subjects are tracked separately throughout the merging process.

**Verification**:
- Run all 7 test suites
- Manually verify that `rnSubjects.length + lpnSubjects.length + unmatchedSubjects.length = rawSubjects.length`
- Verify that no subject appears in both `rnSubjects` and `lpnSubjects`

---

### Phase 3: Evidence-Backed Common-Subject Identification (WEEK 2-3)
**Objective**: Replace pure name-based merging with evidence-backed common-subject identification.

**Dependencies**: Phase 2 (separate RN/LPN collections).

**Acceptance Criteria**:
- [ ] Common subjects are identified using course ID matching as primary method
- [ ] Subject ID-based matching is secondary fallback
- [ ] Cleaned display name matching is tertiary fallback (only when no ID-based match)
- [ ] Subjects with similar names but insufficient evidence are flagged for review
- [ ] Both original source subject IDs are preserved on consolidated cards
- [ ] All 7 existing test suites pass without modification

**Required Changes** (1 file):

**File 1: `src/lib/api-client.ts`** — Enhance the `matchingExams` subject-to-examination matching (lines 1342-1366) and the `authoritativeSubjectMap`/`groupMap` construction (lines 1249-1321):

**Enhancement 1**: In the `matchingExams` filter (lines 1342-1366), reorder/prioritize matching methods:
- Primary: Course-based matching (line 1351) — already the first tier
- Secondary: Subject ID-based matching using authoritative map (lines 1355-1359) — already the second tier
- Tertiary: Cleaned display name fallback (lines 1361-1365) — already the third tier, but make the logic more defensible

**Enhancement 2**: In the `authoritativeSubjectMap` construction (lines 1249-1263), add programme ID verification:
- When mapping by cleaned display name, also verify that the subject's programme ID is consistent (RN subjects should have programmeId 9, PN subjects should have programmeId 6)
- If programme IDs disagree, flag for review rather than merging

**Enhancement 3**: Preserve both source subject IDs:
- Add `sourceSubjectIds` field to the output `SubjectCardDto` or processing intermediate, listing all original subject IDs that contributed to the merged card
- Currently, `programName` is aggregated as `programNames.join(' / ') || null` (line 1337); this is functional but doesn't explicitly list source IDs

**Enhancement 4**: Add ambiguity flagging:
- Add `classification` field (`COMMON | RN_ONLY | LPN_ONLY`) to indicate the subject's programme relationship
- Add `ambiguityNotes` field for subjects like `subj-ob` where RN/PN curriculum differences are unknown

**Rationale**: Per specification Stage 4, subject matching must use a defensible canonical identity strategy. Name-based matching alone is insufficient; course ID and subject ID relationships provide stronger evidence of academic equivalence.

**Verification**:
- Run all 7 test suites
- Verify that common subjects still merge correctly when course IDs match
- Verify that subjects with similar names but different course IDs are NOT merged (or are flagged)
- Verify that both source subject IDs are preserved in the output

---

### Phase 4: Consolidation and Examination Aggregation (WEEK 3)
**Objective**: Ensure consolidated cards correctly display combined examination counts and preserve pathway-specific navigation.

**Dependencies**: Phase 2 (separate collections) and Phase 3 (evidence-backed matching).

**Acceptance Criteria**:
- [ ] `combinedExamCount = rnExamCount + pnExamCount` is displayed correctly on shared cards
- [ ] Selecting RN retrieves only RN examinations
- [ ] Selecting LPN retrieves only LPN examinations
- [ ] RN-only subjects remain as single-program cards
- [ ] LPN-only subjects remain as single-program cards
- [ ] All 7 existing test suites pass without modification

**Required Changes** (may be partially automatic from Phases 1-3):

Most of the consolidation logic (Phases 1-3) should automatically produce correct results if the earlier phases are implemented correctly. The key verification is:

**File 1: `src/lib/api-client.ts`** — Verify the consolidation logic (lines 1323-1462) produces correct results with the new input structure:
- `rnExamCount` and `pnExamCount` are computed from the separate RN and LPN subject collections
- `totalExams = rnExamCount + pnExamCount` is correct
- `availablePathways` correctly reflects which pathways have examinations
- `pathway` (primary) is set based on `availablePathways`
- Both source subject IDs are preserved (consider adding `sourceSubjectIds` to output)

**File 2: `src/components/study/SubjectCard.tsx`** — Verify the card rendering correctly uses the new data:
- `availablePathways` drives the dropdown visibility
- `pathway` drives the primary CTA button
- `rnExamCount` and `pnExamCount` are displayed separately
- `totalExams` = `rnExamCount + pnExamCount` is displayed

**Rationale**: With separate RN and LPN collections and evidence-backed matching, the aggregation and navigation logic should produce correct results automatically. The main verification is ensuring the data flows correctly from the API through to the UI.

**Verification**:
- Run all 7 test suites
- Manually verify a shared card (e.g., Medical-Surgical Nursing) displays correct RN/PN counts
- Verify dropdown navigation works for both pathways
- Verify RN-only and LPN-only subjects render correctly as single-program cards

---

### Phase 5: Pathway Navigation and Isolation (WEEK 3-4)
**Objective**: Ensure pathway-specific navigation retrieves the correct original examination collections.

**Dependencies**: Phase 3 (evidence-backed matching) and Phase 4 (consolidation/aggregation).

**Acceptance Criteria**:
- [ ] Selecting RN on a shared card navigates to RN examinations only
- [ ] Selecting LPN on a shared card navigates to LPN examinations only
- [ ] Direct URLs with `?track=RN` or `?track=PN_LPN` filter correctly
- [ ] RN-only and LPN-only subjects navigate to their respective examination collections
- [ ] The five excluded programmes never leak into the RN/LPN experience through navigation
- [ ] All 7 existing test suites pass without modification

**Required Changes** (2 files):

**File 1: `src/components/study/study-library-view.tsx`** — Verify the pathway selection handler (lines 476-483) correctly navigates to the pathway-specific collection:

The existing handler should work correctly if Phases 1-4 are implemented:
```typescript
onSelectSubject={(subjectName, selectedPathway) => {
  if (selectedPathway) {
    setPathway(selectedPathway as any);
  }
  setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
  setPageNumber(1);
}}
```

The `setPathway(selectedPathway)` updates the URL `track` param, and the Study Library API applies `reqPathway` filtering independently. This should correctly filter to the selected pathway's examinations.

**File 2: `src/lib/api-client.ts`** — Verify the `reqPathway` filtering in `getStudyLibrarySubjects` (lines 1465-1515) correctly filters examinations:

The existing filtering logic (lines 1465-1473) should work correctly:
```typescript
if (reqPathway && reqPathway !== 'all') {
  const normReq = reqPathway.toLowerCase().replace(/[\s_-]+/g, '');
  if (normReq === 'rn') {
    const hasRn = (item.availablePathways || []).includes('RN') || (item.rnExamCount ?? 0) > 0 || item.pathway === 'RN';
    if (!hasRn || item.pathway === 'RN_Exit') return false;
  } else if (normReq === 'pnlpn' || normReq === 'pn' || normReq === 'lpn') {
    const hasPn = (item.availablePathways || []).includes('PN_LPN') || (item.pnExamCount ?? 0) > 0 || item.pathway === 'PN_LPN';
    if (!hasPn || item.pathway === 'PN_Exit') return false;
  }
  // ...
}
```

**Rationale**: With separate RN and LPN collections and correct programme filtering, the pathway navigation should naturally work. The key verification is ensuring that `setPathway` + API `reqPathway` filtering produces the correct results.

**Verification**:
- Run all 7 test suites
- Test dropdown navigation: select RN, verify RN counts; select PN_LPN, verify PN counts
- Test direct URL navigation: `?track=RN` and `?track=PN_LPN`
- Test that excluded programme subjects don't appear

---

### Phase 6: Curriculum Isolation Throughout Learner Experience (WEEK 4)
**Objective**: Ensure the five excluded programmes never leak into the RN/LPN learner experience through alternative navigation or cached data.

**Dependencies**: Phase 4 (consolidation/aggregation) and Phase 5 (pathway navigation).

**Acceptance Criteria**:
- [ ] Study Library filters exclude excluded programmes
- [ ] Subject cards don't display excluded programme content
- [ ] Category and pathway filters respect programme boundaries
- [ ] Search results don't reintroduce excluded programmes
- [ ] Dashboard and Study Library remain consistent (parity)
- [ ] All 7 existing test suites pass without modification

**Required Changes** (may be partially automatic):

**File 1: `src/lib/api-client.ts`** — Enhanced filtering in `getStudyLibrarySubjects` and `getStudyLibrary`:

In `getStudyLibrarySubjects` (Stage 9 reinforcement):
- Ensure the `reqProgram` filter (lines 1487-1490) explicitly validates against only RN/LPN programmes
- Add explicit search filtering that respects programme boundaries (see F-017 remediation)
- Ensure `reqCategory`, `reqCourse`, `reqSchool`, `reqYear`, `reqSeason`, `reqDifficulty` filters don't reintroduce excluded content

In `getStudyLibrary` (for examination catalog):
- Ensure the `reqProgram` filter (lines 1487-1490 in the broader api-client.ts) applies the same RN/LPN retention
- Ensure category/topic/difficulty/school filters don't leak excluded programme content

**File 2: `src/components/study/StudyLibraryHeader.tsx`** — No change needed if programme filtering is correct; the header bug fix (F-006) is separate.

**File 3: `src/components/study/StudyLibraryCategoryTabs.tsx`** — No change needed; already correctly implements 4-way pathway alignment.

**Rationale**: Per specification Stage 9, the five excluded programmes must not leak into the RN/LPN learner experience through alternative navigation or stale cached responses. This phase reinforces the filtering at all entry points.

**Verification**:
- Run all 7 test suites
- Test each entry point: Study Library, Subject Cards, Search, Category Filters, Dashboard
- Verify that programme names from the excluded set (7, 8, 3, 5, 13) don't appear in the learner-facing curriculum
- Verify dashboard/library parity (report acceptance item 14)

---

### Phase 7: Regression and Release Verification (WEEK 4)
**Objective**: Verify no regressions introduced by the implementation changes.

**Dependencies**: Phases 1-6.

**Acceptance Criteria**:
- [ ] All 7 existing test suites pass
- [ ] TypeScript: `npx tsc --noEmit` — no errors
- [ ] Lint: `npm run lint` — no new warnings
- [ ] Production build: `npm run build` — successful
- [ ] No behavioural regressions in existing workflows
- [ ] Exit pathway classifications remain intact (RN_Exit/PN_Exit separate)
- [ ] NCLEX exclusion still works (tests 1-4 in learner-unified-catalog-and-modes.test.mjs)
- [ ] Dashboard/library parity maintained

**Required Actions** (no new code changes, verification only):

**Actions**:
1. Run: `npx jest` or `node tests/learner-unified-catalog-and-modes.test.mjs` — all 7 suites should pass
2. Run: `npx tsc --noEmit` — verify no TypeScript errors
3. Run: `npm run lint` — verify no new lint warnings
4. Run: `npm run build` — verify production build succeeds
5. Manually test existing workflows:
   - Subject dropdown navigation (test 5)
   - 4-way pathway tabs (test 6)
   - Learner catalogue parity (test 7)
   - NCLEX exclusion (tests 1-4)
   - Exit pathway isolation
   - Dashboard/library consistency

**Rationale**: Standard regression verification before any deployment.

**Rollback Plan**: If any issues are found, the changes are modular and reversible:
- Phase 1 changes (explicit programme IDs) can be reverted without affecting other phases
- Phase 2 changes (separate collections) can be reverted by removing the `rnSubjects`/`lpnSubjects` array creation
- Phase 3 changes (enhanced matching) can be reverted by reverting the matching logic to the previous name-based approach
- Phase 4-7 changes build on the earlier phases; rolling back earlier phases may have cascading effects

---

### Phase 8: Documentation and Handoff (WEEK 4)
**Objective**: Document the implementation and hand off to the team.

**Dependencies**: Phases 1-6 completed and verified.

**Acceptance Criteria**:
- [ ] All audit artifacts are updated to reflect the implemented changes
- [ ] Team members can explain the 9-stage architecture pipeline
- [ ] Test suites pass and demonstrate the expected behaviour
- [ ] Handoff documentation is complete

**Required Changes** (primarily documentation):

**Artifacts to update**:
- Artifact A: Revised Architecture Specification — update to reflect implemented changes
- Artifact B: Verified Program Inventory — update programme counts
- Artifact C: RN/LPN Subject Inventory — update subject classifications
- Artifact D: Canonical Subject Mapping — update common-subject matches
- Artifact E: Backend and API Contract Audit — update any changed endpoints
- Artifact F: Examination Integrity Audit — update if examination counting changed
- Artifact G: Frontend Implementation Audit — update implementation details
- Artifact H: Evidence and Defect Register — update findings status
- Artifact I: Revised Implementation Roadmap — mark phases as complete
- Artifact J: Test and Verification Matrix — update
- Artifact K: Final Architecture Verdict — update to COMPLIANT/PARTIALLY_COMPLIANT/NON_COMPLIANT

**Rationale**: Ensures the team has current documentation and understands the implemented architecture.

---

## Roadmap Risk Assessment

| Phase | Risk Level | Mitigation |
|---|---|---|
| 1: Programme Filtering Enhancement | LOW | Small code change; easy to revert; tests verify behaviour |
| 2: Separate RN/LPN Subject Collections | MEDIUM | Changes data flow; may affect existing test expectations; thorough verification needed |
| 3: Evidence-Backed Common-Subject Identification | HIGH | Significant change to matching logic; could break existing merges; extensive testing required |
| 4: Consolidation and Examination Aggregation | MEDIUM | Builds on Phases 1-3; if earlier phases correct, should work; verification critical |
| 5: Pathway Navigation and Isolation | MEDIUM | Builds on earlier phases; navigation logic already exists; mainly verification |
| 6: Curriculum Isolation Throughout Learner Experience | MEDIUM | Reinforces existing filtering; mainly ensures no regressions |
| 7: Regression and Release Verification | LOW | Standard verification; rollback plan available |
| **Overall** | **MEDIUM** | Phases must be implemented in order; Phase 3 (evidence-backed matching) is the highest risk |

---

## Test Suite Impact Summary

| Test Suite | Expected Impact | Mitigation |
|---|---|---|
| **Test 1: Authoritative 4-Way Classification** | PASS | No changes to `classifyAuthoritativePathway` |
| **Test 2: Subject Display Name Cleansing** | PASS | No changes to `cleanSubjectDisplayName` |
| **Test 3: Review Mode Fallback Prevention** | PASS | No changes to exam-session code |
| **Test 4: NCLEX Redirection** | PASS | No changes to next.config.ts or nclex routes |
| **Test 5: SubjectCard Unified RN/PN CTA** | MAY NEED MODIFICATION | If SubjectCard props or rendering changes; verify dropdown still works |
| **Test 6: StudyLibraryCategoryTabs 4-Way** | PASS | No changes to category tabs |
| **Test 7: Learner Catalogue & Stats Parity** | MAY NEED MODIFICATION | If `getStudyLibrarySubjects` output structure changes; verify parity |
| **Overall** | **Mostly PASS** | Phases 1-2 should be transparent; Phase 3 may need test adjustments; Phases 4-7 should be transparent |

---

## Handoff Checklist

- [ ] All 7 test suites pass without modification
- [ ] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Revised Architecture Specification (Artifact A) updated
- [ ] Verified Program Inventory (Artifact B) updated
- [ ] RN/LPN Subject Inventory (Artifact C) updated
- [ ] Canonical Subject Mapping (Artifact D) updated
- [ ] Backend and API Contract Audit (Artifact E) updated
- [ ] Frontend Implementation Audit (Artifact G) updated
- [ ] Evidence and Defect Register (Artifact H) updated with closed/remediated findings
- [ ] Revised Implementation Roadmap (Artifact I) marked complete
- [ ] Test and Verification Matrix (Artifact J) complete
- [ ] Final Architecture Verdict (Artifact K) rendered
- [ ] Team briefing completed on 9-stage architecture pipeline
- [ ] Rollback plan documented and tested
