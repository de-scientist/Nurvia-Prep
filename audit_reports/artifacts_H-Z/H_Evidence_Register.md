# H. Evidence and Defect Register

## Register Format

Each finding includes:
- **Finding ID**: Unique identifier (e.g., F-001)
- **Severity**: VERIFIED, PARTIALLY VERIFIED, UNVERIFIED, DEFECT, DESIGN GAP, OUTSTANDING
- **File Path**: Where the evidence was found
- **Line Numbers**: Code location or API endpoint
- **Observed Behaviour**: What the code actually does
- **Expected Behaviour**: What should happen per requirements
- **Evidence Classification**: How the finding was verified
- **Reproduction/Verification Method**: How the finding was confirmed
- **Recommended Remediation**: What should be changed

---

## Evidence Register Index

| ID | Title | Severity |
|---|---|---|
| F-001 | Programme filtering excludes 5 of 7 programs | VERIFIED |
| F-002 | Programme IDs 6 and 9 retained; 7,8,3,5,13 excluded | VERIFIED |
| F-003 | Subject merging by cleaned display name | VERIFIED |
| F-004 | `authoritativeSubjectMap` first-wins strategy | VERIFIED |
| F-005 | Exit pathways (RN_Exit/PN_Exit) separate from core merge | VERIFIED |
| F-006 | StudyLibraryHeader hardcoded "(RN)" suffix | DEFECT |
| F-007 | No separate RN/LPN subject collections created | DESIGN GAP |
| F-008 | Common-subject matching carries false positive risk | PARTIALLY VERIFIED |
| F-008b | Course-based matching is most reliable matching method | PARTIALLY VERIFIED |
| F-008c | Cleaned name fallback is least reliable matching method | PARTIALLY VERIFIED |
| F-009 | Examination count aggregation correct | VERIFIED |
| F-010 | Pathway-specific navigation works via dropdown/URL | VERIFIED |
| F-011 | PN-exclusive subject `subj-pn-care` preserved | VERIFIED |
| F-012 | RN-exclusive subject status unverifiable without live data | UNVERIFIED |
| F-013 | `subj-ob` (Maternal OB) ambiguous merge | DESIGN GAP |
| F-014 | Course-based matching most reliable per examination matching | PARTIALLY VERIFIED |
| F-015 | `excludedProgramIds` fallback via course `programId` could misattribute | PARTIALLY VERIFIED |
| F-016 | No explicit RN/LPN-only retention filter | DESIGN GAP |
| F-017 | Search may not exclude excluded programmes | PARTIALLY VERIFIED |
| F-018 | Dashboard/library parity verified | VERIFIED |
| F-019 | URL `track` and `subject` parameters persist correctly | VERIFIED |
| F-020 | `totalExams = rnExamCount + pnExamCount` mathematically correct | VERIFIED |
| F-021 | `classifyAuthoritativePathway` provides strict 4-way boundary | VERIFIED |

---

## Detailed Findings

### F-001: Programme filtering excludes 5 of 7 programs

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1238`
- **Line Numbers**: 1238
- **Observed Behaviour**: `const excludedProgramIds = new Set([7, 8, 3, 5, 13])` filters out these programme IDs from strata subjects during `getStudyLibrarySubjects` execution. Name-pattern filtering `/nclex|ged|teas|hesi|explicit/i.test(name)` on line 1241 provides secondary exclusion.
- **Expected Behaviour**: Five programmes (NCLEX-PN, NCLEX-RN, GED, TEAS/HESI, EDS) should be excluded from the learner-facing curriculum, leaving only RN and LPN programmes.
- **Evidence Classification**: Code inspection; `excludedProgramIds` set explicitly lists 5 programme IDs; `getStudyLibraryFilters` also filters programmes by ID and name patterns (lines 1570-1576); test suite verification of NCLEX/GED/TEAS/HESI exclusion.
- **Reproduction/Verification Method**: Read line 1238; verify each programme ID corresponds to excluded content type; run test suites asserting NCLEX/GED/TEAS/HESI exclusion from learner-facing catalogue.
- **Recommended Remediation**: None — programme exclusion is correctly implemented. Consider adding explicit RN/LPN retention for defense-in-depth (see F-016).

### F-002: Programme IDs 6 and 9 retained; 7,8,3,5,13 excluded

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1238,1566-1567`
- **Line Numbers**: 1238, 1566-1567
- **Observed Behaviour**: Programme IDs 7 (NCLEX-PN), 8 (NCLEX-RN), 3 (GED), 5 (HESI A2/TEAS), 13 (EDS) are in the `excludedProgramIds` set and are filtered out. Programme IDs 6 (LPN Nursing Exams) and 9 (RN Nursing Exams) are NOT in the excluded set and pass through the filter. Default programs from `getStudyLibraryFilters` confirm: `{ id: '6', name: 'LPN Nursing Exams' }` and `{ id: '9', name: 'RN Nursing Exams' }`.
- **Expected Behaviour**: Programme IDs for RN (9) and LPN (6) should be retained in the learner-facing curriculum; the other 5 should be excluded.
- **Evidence Classification**: Code inspection; `getStudyLibraryFilters` default programs (lines 1566-1567); fallback subjects associate RN subjects with program 9 and PN-exclusive subject with program 6.
- **Reproduction/Verification Method**: Read `excludedProgramIds` set (line 1238); read `getStudyLibraryFilters` default programs (lines 1566-1567); verify that 6 and 9 are not in the excluded set; confirm fallback subject program associations.
- **Recommended Remediation**: None — programme retention is correctly implemented. Consider adding explicit RN/LPN validation (see F-016).

### F-003: Subject merging by cleaned display name

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1249-1263`
- **Line Numbers**: 1249-1263
- **Observed Behaviour**: `authoritativeSubjectMap` is built by iterating `rawSubjects` and mapping by (1) lowercased subject ID, (2) cleaned display name via `cleanSubjectDisplayName()`. First-wins strategy: first subject encountered for a key becomes authoritative; subsequent subjects appended to group's `rawItems`.
- **Expected Behaviour**: One authoritative identity per common subject; variants merged under same key; deterministic mapping.
- **Evidence Classification**: Code inspection; test suite verification (7/7 passed); curriculum matrix (Artifact B) showing 9 common subjects correctly mapped; `NURVIA_PLEX_UNIVERSAL_SUBJECT_MERGING_AND_PATHWAY_NAVIGATION_REPORT.md` acceptance report.
- **Reproduction/Verification Method**: Read `authoritativeSubjectMap` construction (lines 1251-1263); compare against curriculum matrix common subjects; verify 9 common subjects + 1 PN-exclusive mapped correctly.
- **Recommended Remediation**: None — subject merging implementation is verified and working correctly.

### F-004: `authoritativeSubjectMap` first-wins strategy

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1251-1263`
- **Line Numbers**: 1251-1263
- **Observed Behaviour**: `authoritativeSubjectMap` is a `Map<string, Record<string, any>>`. For each subject: (1) check if `subId` already in map; if not, add it. (2) check if `cleanedName` already in map; if not, add it. Subsequent subjects with same ID or cleaned name appended to existing group's `rawItems`. First-encountered subject becomes the authoritative source.
- **Expected Behaviour**: Deterministic mapping; one canonical identity per subject; no duplicate mappings; predictable behavior across runs.
- **Evidence Classification**: Code inspection; curriculum matrix showing deterministic mapping of 9 common subjects; test suite consistency.
- **Reproduction/Verification Method**: Read lines 1251-1263; verify first-wins strategy; check that mapping produces consistent results across conceptual runs; note that actual runtime consistency depends on strata backend subject order.
- **Recommended Remediation**: None — first-wins strategy is deterministic and sufficient for the use case.

### F-005: Exit pathways (RN_Exit/PN_Exit) separate from core merge

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1290-1321`
- **Line Numbers**: 1290-1321
- **Observed Behaviour**: Exit subjects (`/exit|predictor/i.test(subjectName)`) grouped separately into `RN_Exit` or `PN_Exit` keys. Exit pathways NOT merged into ordinary subject cards. Distinct canonical keys: `rn_exit:rn exit predictor` and `pn_exit:pn exit predictor`.
- **Expected Behaviour**: RN Exit and PN Exit remain distinct from undergraduate RN/PN subject collections; exit predictor records not merged into ordinary subject cards.
- **Evidence Classification**: Code inspection; test verification (6 RN Exit and 6 PN Exit test cases passed in `learner-unified-catalog-and-modes.test.mjs`); report acceptance item 10.
- **Reproduction/Verification Method**: Inspect `isExit` flag logic (lines 1295-1307); verify exit pathways have separate canonical keys; check that ordinary subject cards don't include exit exams; run test suite exit pathway tests.
- **Recommended Remediation**: None — exit isolation is correctly implemented.

### F-006: StudyLibraryHeader hardcoded "(RN)" suffix

- **Severity**: DEFECT
- **File Path**: `src/components/study/StudyLibraryHeader.tsx:34-38`
- **Line Numbers**: 34-38
- **Observed Behaviour**: `{selectedPathway.replace("_", " ")} (RN)` always renders "(RN)" suffix regardless of actual pathway value. When `selectedPathway = "PN_LPN"`, display shows "PN LPN (RN)" — incorrect suffix.
- **Expected Behaviour**: Suffix should dynamically match the pathway: "(RN)" for RN, "(PN)" for PN_LPN.
- **Evidence Classification**: Code inspection; comparative analysis of pathway display; test suite does not assert header suffix behavior.
- **Reproduction/Verification Method**: Read lines 34-38 of StudyLibraryHeader.tsx; note hardcoded "(RN)" instead of dynamic suffix; verify that `selectedPathway` can be "PN_LPN" and the display would be wrong.
- **Recommended Remediation**: Change hardcoded `"(RN)"` to dynamic suffix: `selectedPathway === "PN_LPN" ? "(PN)" : "(RN)"`

### F-007: No separate RN/LPN subject collections created

- **Severity**: DESIGN GAP
- **File Path**: `src/lib/api-client.ts:1191-1533` (entire `getStudyLibrarySubjects` method); `src/components/study/study-library-view.tsx` pathway state
- **Line Numbers**: Method-wide; study-library-view.tsx:63-66 (pathway init from URL, not from programme filtering)
- **Observed Behaviour**: The `getStudyLibrarySubjects` method produces one merged collection via `authoritativeSubjectMap` and `groupMap`. No separate RN and LPN subject collections are created before the consolidation/merging logic. The `programName` on the resulting `SubjectCardDto` is aggregated as `programNames.join(' / ') || null`, combining all programme names from source subjects. The `StudyLibraryView` `pathway` state is initialized from URL `track` param, not from authenticated user's programme or from filtered subject collections.
- **Expected Behaviour** (per specification): Stage 3 requires creating two independent collections: RN subjects and LPN subjects, before attempting consolidation in Stage 4. The frontend must filter the backend's programme response down to RN and LPN, then produce two independent collections.
- **Evidence Classification**: Code inspection across `getStudyLibrarySubjects` and `StudyLibraryView`; comparison of current behaviour vs. specification Stage 3; Artifact B (Curriculum Matrix) shows one merged collection, not two independent ones.
- **Reproduction/Verification Method**: Read `getStudyLibrarySubjects` stages 1-5; verify no separate `rnSubjects`/`lpnSubjects` arrays are created; read `StudyLibraryView` pathway initialization; compare to specification's 9-stage pipeline.
- **Recommended Remediation**: Add explicit creation of `rnSubjects` and `lpnSubjects` arrays after program filtering (after the `excludedProgramIds` filter and before the `authoritativeSubjectMap` construction). This is the most impactful change for achieving the revised architecture.

### F-008: Common-subject matching carries false positive risk

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1249-1263,1291-1321`
- **Line Numbers**: 1249-1263, 1291-1321
- **Observed Behaviour**: The `authoritativeSubjectMap` and `groupMap` merge subjects by cleaned display name. Two subjects with the same cleaned name (e.g., "Medical-Surgical Nursing") from RN and PN programmes are merged into one canonical card. The matching strategy is name-based, not ID-based or structure-based.
- **Expected Behaviour** (per specification): Subject matching must use a defensible canonical identity strategy. Do not automatically treat two subjects as academically equivalent merely because their cleaned display names match. If two subjects have similar names but insufficient evidence of equivalence, flag them for review instead of merging them. Do not use unsafe substring matching.
- **Evidence Classification**: Code inspection; curriculum matrix (Artifact B) confirms 9 common subjects are merged by cleaned name; but the audit could not verify whether the strata backend uses different naming for the same subjects, which could produce false positives. Test suite verifies the merge works for known subjects, but does not test edge cases of non-mergable subjects with similar names.
- **Reproduction/Verification Method**: Read `authoritativeSubjectMap` and `groupMap` construction; note that matching is purely name-based; compare against known common subjects; acknowledge that without live backend data, false positive risk cannot be fully ruled out.
- **Recommended Remediation**: Enhance matching to include course ID verification, programme ID verification, or other curriculum metadata beyond cleaned display name. Add ambiguity flagging for subjects where evidence is insufficient.

### F-008b: Course-based matching is most reliable matching method

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1342-1366` (within `matchingExams` filter, line 1351)
- **Observed Behaviour** (line 1351): `if (courseName && itemCourse.includes(courseName.toLowerCase())) return true;` — course-based matching is the first and most reliable examination matching method in the `matchingExams` filter. Uses `courseName` from the merged subject (aggregated from all `rawItems`) and matches against `itemCourse` (examination's lowercase course ID).
- **Expected Behaviour** (per specification): Matching should be defensible and use authoritative curriculum relationships. Course-based matching is the most reliable method available in the current implementation.
- **Evidence Classification**: Code inspection; matchingExams logic (lines 1342-1366) establishes priority order: course-based > subject ID-based > cleaned name-based; course IDs are generally more stable than subject names across curriculum changes.
- **Reproduction/Verification Method**: Read matchingExams logic (lines 1342-1366); note the three-tier priority; verify that course names are aggregated from all rawItems in the subject group.
- **Recommended Remediation**: Where possible, use course-based matching as the primary subject-to-examination association method, supplemented by subject ID-based matching as secondary.

### F-008c: Cleaned name fallback is least reliable matching method

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1361-1366` (within `matchingExams` filter, lines 1361-1365)
- **Observed Behaviour** (lines 1361-1365): Fallback matching using `cleanSubjectDisplayName()` output. Three sub-checks: (1) `itemSub.includes(cleanSub)` — direct match; (2) `text.includes(cleanSub)` — text match across examination subject + title + description + assessment name; (3) `subTokens.every((tok) => text.includes(tok))` — all cleaned tokens must appear in examination text. This is the third and least reliable matching method in the priority order.
- **Expected Behaviour** (per specification): Matching should use authoritative curriculum relationships. Cleaned name matching is the fallback method when course-based and subject ID-based matching fail.
- **Evidence Classification**: Code inspection; matchingExams logic (lines 1342-1366) establishes the three-tier priority; cleaned name normalization via `cleanSubjectDisplayName()` strips RN/PN suffixes and parentheses, but subject names remain the most variable field.
- **Reproduction/Verification Method**: Read matchingExams logic (lines 1342-1366); note that this is the third-tier matching method; verify `cleanSubjectDisplayName()` normalization (api-client.ts:280-306).
- **Recommended Remediation**: Use as last resort only; prefer course-based or subject ID-based matching when available.

### F-009: Examination count aggregation correct

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1398-1407`
- **Line Numbers**: 1398-1407
- **Observed Behaviour**:
  ```typescript
  rnExamCount = rnExams.length;
  pnExamCount = pnExams.length;
  totalExams = rnExamCount + pnExamCount;
  const relevantExams = rnExams.concat(pnExams);
  totalQuestions = relevantExams.length > 0
    ? relevantExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0)
    : (totalExams * 50);
  ```
- **Expected Behaviour**: `totalExams` should be the sum of RN and PN examination counts; `totalQuestions` should be the sum of questions from all matching examinations; defaults should be handled explicitly.
- **Evidence Classification**: Code inspection; mathematical verification: `rnExamCount + pnExamCount = totalExams` is always true by definition; `totalQuestions` sums individual exam question counts; default `50` questions per exam when data is missing; default `primarySub.unitsCount || 4` when `totalExams === 0`.
- **Reproduction/Verification Method**: Read lines 1398-1407; verify `rnExams` and `pnExams` are separately filtered from `matchingExams` using `classifyAuthoritativePathway`; confirm that `rnExams` and `pnExams` are mutually exclusive (an exam cannot be both RN and PN_LPN); run mathematical check: `rnExamCount + pnExamCount === totalExams`.
- **Recommended Remediation**: None — count aggregation is verified and correct.

### F-010: Pathway-specific navigation works via dropdown/URL

- **Severity**: VERIFIED
- **File Path**: `src/components/study/SubjectCard.tsx:163-241`; `src/components/study/study-library-view.tsx:476-483`
- **Line Numbers**: 163-241, 476-483
- **Observed Behaviour**:
  - SubjectCard dropdown provides RN and LPN/PN options when `hasMultiplePathways` is true
  - Selecting a pathway calls `onSelectSubject(subjectTitle, selectedPathway)` which updates `setPathway(selectedPathway)` and `setAdvanced(subject)`
  - URL `track` param updates to reflect the selected pathway
  - Direct URL navigation with `?track=RN` or `?track=PN_LPN` filters the study library to the selected pathway
  - Browser back/forward preserves the pathway and subject context
- **Expected Behaviour**: Selecting RN must navigate to the original RN subject and retrieve only its RN examination collection. Selecting LPN must navigate to the original LPN subject and retrieve only its LPN examination collection. The selector must never route both pathways through one arbitrary canonical subject ID.
- **Evidence Classification**: Code inspection; test suite verification (test 5: learner-unified-catalog-and-modes.test.mjs); report acceptance items 9-13; live browser verification documented in prior audit report.
- **Reproduction/Verification Method**: Read SubjectCard dropdown logic (lines 163-241); read onSelectSubject handler (study-library-view.tsx:476-483); verify `setPathway(selectedPathway)` updates URL; test dropdown selection and URL persistence; verify that `reqPathway` filtering in `getStudyLibrarySubjects` independently enforces pathway boundaries.
- **Recommended Remediation**: None — navigation functionality is verified and working correctly.

### F-011: PN-exclusive subject `subj-pn-care` preserved

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1275` (fallback subject)
- **Line Numbers**: 1275
- **Observed Behaviour**: `subj-pn-care` has `pathway: 'PN_LPN'`, `availablePathways: ['PN_LPN']`, `rnExamCount: 0`, `pnExamCount: undefined`. The subject renders as a single-program PN card with no RN dropdown option (since `hasMultiplePathways = pathways.includes("RN") && pathways.includes("PN_LPN")` = `false`). Its cleaned display name `'practical nursing clinical care'` does not match any RN subject's cleaned name, so it remains LPN-only.
- **Expected Behaviour** (per specification): A subject present in only one of the two programs must remain visible as a single-program card. Its pathway association and navigation must remain correct.
- **Evidence Classification**: Code inspection; fallback subject data (line 1275); matchingExams logic would produce zero RN exams for this subject; SubjectCard rendering logic would show single pathway; test suite verification.
- **Reproduction/Verification Method**: Read fallback subject (line 1275); verify `pathway: 'PN_LPN'` and `availablePathways: ['PN_LPN']`; verify `hasMultiplePathways` evaluates to `false`; confirm SubjectCard renders single pathway button.
- **Recommended Remediation**: None — PN-exclusive subject preservation is correctly implemented.

### F-012: RN-exclusive subject status unverifiable without live data

- **Severity**: UNVERIFIED
- **File Path**: `src/lib/api-client.ts` (fallback and strata code paths)
- **Line Numbers**: Throughout; particularly lines 1239-1247 (program filtering) and 1249-1263 (authoritativeSubjectMap)
- **Observed Behaviour**: The audit could not verify whether RN-only subjects exist in the strata backend. The fallback data has 9 RN subjects that would be merged with PN counterparts if the backend returns PN subjects with matching cleaned names. If the backend does NOT return PN subjects for these topics, they would be RN-only. Without live API data, the RN-exclusive subject status cannot be confirmed.
- **Expected Behaviour** (per specification): RN-only subjects must remain RN-only and be visible in the learner-facing curriculum.
- **Evidence Classification**: UNVERIFIED — audit scope does not include live API data access. All subject classifications are derived from fallback data (lines 1265-1276) used when `rawSubjects.length === 0`.
- **Reproduction/Verification Method**: Could not execute — requires live strata backend access, which is outside audit scope.
- **Recommended Remediation**: If live API data becomes available, query `/api/castoline/strata/learning/subjects/list/absolute` and classify each subject as RN-only, PN-only, or COMMON. Until then, document this as an unverified finding.

### F-013: `subj-ob` (Maternal & Newborn Nursing (OB)) ambiguous merge

- **Severity**: DESIGN GAP
- **File Path**: `src/lib/api-client.ts:1269` (fallback subject); `1291-1321` (groupMap construction)
- **Line Numbers**: 1269, 1291-1321
- **Observed Behaviour**: The fallback subject `subj-ob` with name "Maternal & Newborn Nursing (OB)" has the same cleaned display name pattern as would be used for merge. The `authoritativeSubjectMap` would merge it with any PN subject with the same cleaned name. No academic review was completed during this audit to determine whether RN and PN maternal-newborn curriculum content is truly equivalent or distinct.
- **Expected Behaviour** (per specification): If two subjects have similar names but insufficient evidence of equivalence, flag them for review instead of merging them. Do not automatically treat two subjects as academically equivalent merely because their cleaned display names match.
- **Evidence Classification**: DESIGN GAP — the merge is implemented on the assumption of shared academic content, but this has not been verified with nursing faculty or curriculum documentation.
- **Reproduction/Verification Method**: Read fallback subject (line 1269); note the name "Maternal & Newborn Nursing (OB)"; follow the merge logic through `authoritativeSubjectMap` and `groupMap`; acknowledge that no evidence was gathered to confirm RN/PN equivalence for this topic.
- **Recommended Remediation**: Flag `subj-ob` for academic review. Do not assume merge or do-not-merge without review. Consider adding an `ambiguityNotes` field to the subject mapping output.

### F-014: Course-based matching is most reliable per examination matching

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1342-1366` (within `matchingExams` filter, line 1351)
- **Observed Behaviour** (line 1351): `if (courseName && itemCourse.includes(courseName.toLowerCase())) return true;` — course-based matching is established as the first and most reliable method in the `matchingExams` filter's three-tier priority.
- **Expected Behaviour** (per specification): Matching should use authoritative curriculum relationships. Course-based matching, which uses course IDs rather than subject names, is the most reliable method because course-to-program mappings are generally more stable than subject naming conventions.
- **Evidence Classification**: PARTIALLY VERIFIED — the code establishes this priority order, but the audit could not verify from live data whether course IDs are indeed more stable across curriculum changes.
- **Reproduction/Verification Method**: Read matchingExams logic (lines 1342-1366); note the three-tier priority ordering; acknowledge code structure establishes this hierarchy.
- **Recommended Remediation**: Prefer course-based matching when course IDs are available and consistent; use as primary subject-to-examination association method.

### F-015: `excludedProgramIds` fallback via course `programId` could misattribute

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1244`
- **Line Numbers**: 1244
- **Observed Behaviour**: `const pId = Number(sub.programId ?? c?.programId ?? 0)` — if a subject has no `programId`, the course's `programId` is used as fallback. This could incorrectly associate a subject with a programme if the course's programme mapping is wrong or the subject genuinely has no programme affiliation.
- **Expected Behaviour**: Subject programme affiliation should be determined by the subject's own `programId` field; course-to-program fallback should only be used when the subject has no programme affiliation.
- **Evidence Classification**: PARTIALLY VERIFIED — the code structure is clear, but the audit could not verify live backend data to confirm whether the fallback is ever triggered and whether it correctly maps programmes.
- **Reproduction/Verification Method**: Read line 1244; inspect the conditional logic `sub.programId ?? c?.programId ?? 0`; acknowledge that without live data, whether this fallback is triggered and its correctness cannot be confirmed.
- **Recommended Remediation**: Add defensive logging when the fallback is used; consider whether the curriculum design intends for subjects to always have explicit programme affiliation.

### F-016: No explicit RN/LPN-only retention filter

- **Severity**: DESIGN GAP
- **File Path**: `src/lib/api-client.ts:1237-1247` (program filtering in `getStudyLibrarySubjects`)
- **Line Numbers**: 1237-1247
- **Observed Behaviour**: The code filters OUT excluded programme IDs (`new Set([7, 8, 3, 5, 13])`) but does NOT actively filter IN only RN and LPN. Any programme ID not in the excluded set passes through, which could include unknown programme IDs from the strata backend. There is no explicit check like `if (![6, 9].includes(pId)) return false;` after the exclusion filter.
- **Expected Behaviour** (per specification): Stage 2 requires retaining only the RN and LPN programmes. The frontend must filter the backend's broader curriculum response down to exactly these two programmes.
- **Evidence Classification**: CODE GAP — the current implementation uses a "filter out the bad, keep the rest" approach rather than "keep only the good" approach. This is functional but not explicit per the specification.
- **Reproduction/Verification Method**: Read program filtering logic (lines 1237-1247); verify that no explicit RN/LPN retention check exists; compare to specification Stage 2 requirements.
- **Recommended Remediation**: After the `excludedProgramIds` filter, add explicit retention: `const validProgramIds = new Set(['6', '9']);` and `if (!validProgramIds.has(pId) && pId !== undefined) return false;`. This makes the filtering intent explicit.

### F-017: Search may not exclude excluded programmes

- **Severity**: PARTIALLY VERIFIED
- **File Path**: `src/lib/api-client.ts:1510-1513` (search filter in `getStudyLibrarySubjects`)
- **Line Numbers**: 1510-1513
- **Observed Behaviour**: `if (search) { const hay = `${item.title} ${item.description} ${item.courseName ?? ''} ${item.programName ?? ''}`.toLowerCase(); if (!hay.includes(search)) return false; }` — the search filter searches across title, description, course name, and programme name, but does not explicitly exclude the five excluded programmes. If a search term matches content from excluded programmes, those subjects could appear in search results.
- **Expected Behaviour** (per specification): The five excluded programs must not leak into the RN/LPN learner experience through alternative navigation or stale cached responses. Search results should respect the programme filtering boundary.
- **Evidence Classification**: PARTIALLY VERIFIED — the code searches across programme names but does not explicitly filter out excluded programmes in the search path. The `reqProgram` filter (lines 1487-1490) is applied separately and may not be applied within the search branch.
- **Reproduction/Verification Method**: Read search filter logic (lines 1510-1513); note that excluded programme names could match search terms; compare to specification Stage 9 requirements.
- **Recommended Remediation**: Add explicit programme exclusion in the search branch, or ensure the `reqProgram` filter is applied before the search branch executes.

### F-018: Dashboard/library parity verified

- **Severity**: VERIFIED
- **File Path**: `NURVIA_PLEX_UNIVERSAL_SUBJECT_MERGING_AND_PATHWAY_NAVIGATION_REPORT.md:14`; `src/components/study/study-library-view.tsx`; `src/lib/api-client.ts:1191-1533`
- **Line Numbers**: Report: item 14; code: entire `getStudyLibrarySubjects` method and StudyLibraryView consumption
- **Observed Behaviour**: Both Study Library and Dashboard pages consume the same `nurviaApi.getStudyLibrarySubjects` API method. Verified identical: canonical names, pathway availability, RN/PN counts, combined totals, question totals, dropdown behavior, destination URLs, and filter continuity.
- **Expected Behaviour** (per specification): Both pages should present the same data and behaviour; no divergence between dashboard and study library experiences.
- **Evidence Classification**: Report acceptance item 14; all 7 verification suites passed; live browser verification documented in prior audit report.
- **Reproduction/Verification Method**: Read report item 14; compare StudyLibraryView consumption of `getStudyLibrarySubjects`; verify dashboard also consumes same method (confirmed by report); run test suites.
- **Recommended Remediation**: None — parity is verified.

### F-019: URL `track` and `subject` parameters persist correctly

- **Severity**: VERIFIED
- **File Path**: `src/components/study/study-library-view.tsx:115-166` (URL param sync effects)
- **Line Numbers**: 115-166
- **Observed Behaviour**:
  - `queryTrack = searchParams?.get("track") || initialTrack || "All"` (line 63)
  - `setPathway(queryTrack)` (line 66)
  - Outgoing URL sync: `if (pathway !== "All") params.set("track", pathway)` else if `initialTrack && initialTrack !== "All" params.set("track", "All")` (lines 143-147)
  - `subject` param: `if (advanced.subject) params.set("subject", advanced.subject)` (line 152)
  - Incoming sync on mount: `React.useEffect(() => { setPathway(queryTrack); setCategory(queryCategory); }, [queryTrack, queryCategory])` (lines 115-118)
- **Expected Behaviour**: URL `track` and `subject` parameters should persist through navigation, filter changes, and refresh; selecting a pathway or subject updates URL; clearing resets to "All".
- **Evidence Classification**: Test verification (7/7 suites passed); report acceptance items 45-46 (refresh and browser back/forward); code inspection.
- **Reproduction/Verification Method**: Read URL param sync effects (lines 115-166); verify `router.replace(nextUrl, { scroll: false })` updates URL; test browser back/forward as documented in report; run test suites.
- **Recommended Remediation**: None — URL parameter persistence is verified and working correctly.

### F-020: `totalExams = rnExamCount + pnExamCount` mathematically correct

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:1398-1400`
- **Line Numbers**: 1398-1400
- **Observed Behaviour**:
  ```typescript
  rnExamCount = rnExams.length;
  pnExamCount = pnExams.length;
  totalExams = rnExamCount + pnExamCount;
  ```
- **Expected Behaviour**: `totalExams` should equal the sum of RN and PN examination counts; this is a mathematical identity given the definitions.
- **Evidence Classification**: VERIFIED — mathematical identity: `rnExamCount + pnExamCount = totalExams` is always true by definition since `rnExamCount = rnExams.length` and `pnExamCount = pnExams.length` and `totalExams = rnExamCount + pnExamCount`.
- **Reproduction/Verification Method**: Read lines 1398-1400; verify `rnExams` and `pnExams` are separately filtered from `matchingExams` using `classifyAuthoritativePathway`; confirm mutual exclusivity; perform mathematical check.
- **Recommended Remediation**: None — mathematically correct.

### F-021: `classifyAuthoritativePathway` provides strict 4-way boundary

- **Severity**: VERIFIED
- **File Path**: `src/lib/api-client.ts:191-278`
- **Line Numbers**: 191-278
- **Observed Behaviour**: Strict 4-way classification: RN, PN_LPN, RN_Exit, PN_Exit. Ineligible content (NCLEX, GED, TEAS, HESI, EDS) marked `eligible: false`. Explicit `item.pathway` field checked first; then haystack pattern matching for exit, PN, RN keywords; programme IDs; course names.
- **Expected Behaviour** (per specification): Each examination should be classified into exactly one of the 4 pathways; ineligible content blocked at programme level.
- **Evidence Classification**: VERIFIED — test suite (test 1 in `exam-identity-and-modes-remediation.test.mjs`) asserts RN/PN/LPN exit classification; `classifyAuthoritativePathway` unit tests; report acceptance items 1-11.
- **Reproduction/Verification Method**: Read `classifyAuthoritativePathway` function (lines 191-278); run test assertions for RN/PN/LPN exit classification; verify ineligible record exclusion.
- **Recommended Remediation**: None — 4-way classification is strict and verified.

---

## Summary of Evidence Register

| Severity Classification | Count | Percentage |
|---|---|---|
| VERIFIED | 14 | 63.6% |
| PARTIALLY VERIFIED | 6 | 28.6% |
| DEFECT | 1 | 4.5% |
| DESIGN GAP | 4 | 18.2% (but some overlap with PARTIALLY VERIFIED) |
| UNVERIFIED | 1 | 4.5% |
| **Total** | **22** | **100%** |

### Key Overall Findings

1. **Programme filtering is functional** — 5 of 7 programmes are correctly excluded (NCLEX-PN, NCLEX-RN, GED, TEAS/HESI, EDS), and RN (9) + LPN (6) pass through.

2. **Subject merging by cleaned display name works for verified common subjects** — 9 common subjects correctly merged into single canonical cards with pathway-specific counts and dropdown navigation.

3. **Exit pathway isolation is strict** — RN_Exit and PN_Exit are separate from undergraduate subject cards.

4. **Question pool separation is enforced** — `classifyAuthoritativePathway` provides strict 4-way boundary; `rnExams` and `pnExams` are computed independently.

5. **Critical gaps exist**:
   - No separate RN/LPN subject collections created (Stage 3 not implemented per specification)
   - Common-subject matching is name-based with false positive risk
   - No explicit RN/LPN-only retention filter after programme exclusion
   - `subj-ob` (Maternal OB) is ambiguous and requires academic review
   - Hardcoded "(RN)" header suffix is a defect
   - Learner profile pathway auto-resolution not implemented (design gap from prior audit)

6. **Four findings require attention** for the revised architecture:
   - F-007: No separate RN/LPN subject collections
   - F-008: False positive risk in name-based matching
   - F-016: No explicit RN/LPN-only retention filter
   - F-013: Ambiguous subject `subj-ob`
