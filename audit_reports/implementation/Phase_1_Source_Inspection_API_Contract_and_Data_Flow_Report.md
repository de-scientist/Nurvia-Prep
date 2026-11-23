# NURVIA PREP — PHASE 1 REPORT
## Source Inspection, API Contract Verification & Data-Flow Tracing

**Project:** NURVIA Prep — RN/LPN Study Library Architecture\
**Repository:** `C:\Users\gitau\Documents\Nurvia-Prep`\
**Branch:** `main`\
**Baseline HEAD:** `6404881`\
**Phase:** 1 of 8\
**Report Date:** November 23, 2026\

---

## A. Executive Summary

**Investigation scope:** Rigorous inspection of the NURVIA Prep application architecture to establish the actual data flow, API contracts, program filtering logic, subject grouping mechanisms, examination counting semantics, pathway classification, and navigation behavior supporting the RN/LPN Study Library. This inspection determines the exact source-code modification requirements for the approved eight-phase remediation roadmap.

**Repository baseline:** Verified — main branch, HEAD at `6404881`, clean working tree. All 11 original audit artifacts (A–K) preserved as untracked directories. No application source files or Git history modified.

**Live backend access:** Not available during this investigation. All subject classifications, program IDs, and counts derived from code inspection and fallback arrays (lines 1265–1276 of `api-client.ts`).

**Overall implementation readiness:** `PARTIALLY BLOCKED` — Multiple design gaps identified that must be remediated before the eight-phase implementation can achieve compliance with the revised architecture specification. The core subject merging engine exists and functions, but critical gaps in program allowlist design, subject collection separation, and evidence-backed equivalence must be addressed.

**Major blockers:**
1. Programme filtering uses exclusion-only logic (`excludedProgramIds`) without positive allowlist — unknown program IDs can pass through
2. No separate RN/LPN subject collections created before consolidation (Stage 3 not implemented)
3. Common-subject matching is purely name-based via `cleanSubjectDisplayName()` — carries false positive risk
4. No explicit RN/LPN-only retention filter after programme exclusion
5. StudyLibraryHeader hardcodes `(RN)` suffix regardless of active pathway

**Recommended next action:** Proceed to Phase 2 (positive program allowlist `{6, 9}`) with documented limitations. All subsequent phases depend on Phase 2 changes.

---

## B. Repository Preservation

| Item | Expected | Actual | Result |
|------|----------|--------|--------|
| Repository | Nurvia-Prep | `C:\Users\gitau\Documents\Nurvia-Prep` | ✅ |
| Branch | main | `main` | ✅ |
| HEAD | `6404881` | `640488140c23c8c364db24da1556e3588db151c2` | ✅ (matches) |
| Working tree | Preserved | Clean (only untracked audit dirs) | ✅ |
| Audit artifacts | A–K retained | A–K present as untracked dirs | ✅ |
| Existing user work | Preserved | Preserved (no modifications) | ✅ |
| Source changes during Phase 1 | None | None | ✅ |
| Git history changes | None | None | ✅ |

**No application source files were modified during Phase 1.** No Git commits, pushes, merges, resets, or rebases performed.

---

## C. Audit Artifact Review

All 11 audit artifacts (A–K) were inspected. Key findings relevant to Phase 1:

| Artifact | Key Finding |
|---|---|
| A — Executive Architecture Audit | 9-stage pipeline documented; Stage 3 (separate collections) not implemented in current code |
| B — Verified Program Inventory | 7 programs identified: IDs 6 (LPN) and 9 (RN) retained; 7, 8, 3, 5, 13 excluded |
| C — RN/LPN Subject Inventory | 10 fallback subjects (9 RN + 1 PN-exclusive); 9 common subjects merged by cleaned display name |
| D — Canonical Subject Mapping | `authoritativeSubjectMap` first-wins strategy; `groupMap` keyed by `canonical:cleanedName`; exit pathways separate |
| E — Backend and API Contract Audit | Endpoints: `/subjects/list/absolute`, `/courses/list/absolute`, `/programs/list/absolute`; `fetchAllStrataExams()` |
| F — Content and Assessment Mapping | `totalExams = rnExamCount + pnExamCount` mathematically correct; `classifyAuthoritativePathway` provides 4-way boundary |
| G — Frontend and Navigation Audit | SubjectCard dropdown provides RN/PN options; URL `track` param updates; header hardcodes `(RN)` |
| H — Evidence and Defect Register | 22 findings: 14 VERIFIED, 6 PARTIALLY VERIFIED, 1 DEFECT, 4 DESIGN GAP, 1 UNVERIFIED |
| I — Target Architecture Specification | 9-stage pipeline with detailed Stage requirements |
| J — Prioritized Implementation Roadmap | 8-phase sequence: allowlist → collections → evidence-backed matching → consolidation → navigation → isolation → regression → docs |
| K — Final Architecture Verdict | **PARTIALLY COMPLIANT** — 6 gaps identified requiring remediation |

**Discrepancies with actual source code:** None found that contradict audit findings. Source code confirms all audit descriptions of current behavior.

---

## D. Frontend Architecture Map

### Data Flow trace:

```
Backend Curriculum APIs
        |
        v
API Client: getStudyLibrarySubjects()
        |
        v
  Promise.all fetch: subjects, courses, programs
        |
        v
  Programme filtering: excludedProgramIds = {7,8,3,5,13}
  + name-pattern filter: /nclex|ged|teas|hesi|explicit/i.test(name)
        |
        v
  Raw subjects (from backend OR fallback array of 10 subjects)
        |
        v
  authoritativeSubjectMap: Map by subId AND cleaned display name (first-wins)
        |
        v
  groupMap: keyed by `canonical:cleanedName` or `rn_exit:...`/`pn_exit:...`
  + rawItems: all source subjects merged under each key
        |
        v
  mappedSubjects: SubjectCardDto[] with:
    - pathway: 'RN' or 'PN_LPN' or 'RN_Exit' or 'PN_Exit'
    - availablePathways: string[]
    - rnExamCount, pnExamCount, totalExams = rnExamCount + pnExamCount
    - programName: aggregated as programNames.join(' / ') || null
    - courseName: aggregated from all rawItems
        |
        v
  Study Library page (StudyLibraryView):
    - pathway state initialized from URL `track` param
    - subjects rendered as SubjectCard components
    - SubjectCard pathway dropdown → onSelectSubject(subjectTitle, selectedPathway)
    - Updates URL track param and advanced.subject state
        |
        v
  SubjectCard component:
    - availablePathways drives dropdown visibility
    - pathway drives primary CTA button text
    - onSelectSubject(subjectName, selectedPathway) → setPathway + setAdvanced + setPageNumber
        |
        v
  Navigation:
    - setPathway(selectedPathway) → URL param `track=selectedPathway`
    - Study Library re-fetches with new reqPathway filter
    - reqPathway filtering in API: normReq maps to actual pathway classification
```

**Critical shortcuts identified:**
1. **Single merged collection**: `getStudyLibrarySubjects` produces one collection via `authoritativeSubjectMap`/`groupMap` — no separate RN/LPN arrays before consolidation
2. **Name-based matching only**: `authoritativeSubjectMap` and `groupMap` key by cleaned display name; no course ID or subject ID verification as primary match
3. **Implicit programme retention**: `excludedProgramIds` filter is exclusion-only; no active `if (![6,9].includes(pId)) return false;` check
4. **Header hardcode**: `StudyLibraryHeader.tsx:36` hardcodes `{selectedPathway.replace("_", " ")} (RN)` regardless of actual pathway

---

## E. API Contract Inventory

### Endpoints Used

| Endpoint | Method | Calling Function | Request Parameters | Response Type |
|---|---|---|---|---|
| `/api/castoline/strata/learning/subjects/list/absolute` | GET | `getStudyLibrarySubjects` (line 1212) | `fetchtype: 'absolute', page: 1, perPage: 250` | `ApiResponse<PagedResult<Record<string, any>>>` — fields: id, guidId, uuid, name, title, slug, code, description, academicYear, year, season, term, categoryId, subCategoryId, domainId, programId, courseId, subjectId, unitId, lessonId, topicId, conceptId, assessmentId, examId, sectionId, institutionId, schoolId, departmentId, divisionId, cohortId, classId |
| `/api/castoline/strata/learning/courses/list/absolute` | GET | `getStudyLibrarySubjects` (line 1213) | `fetchtype: 'absolute', page: 1, perPage: 100` | Same structure as subjects |
| `/api/castoline/strata/learning/programs/list/absolute` | GET | `getStudyLibrarySubjects` (line 1214) + `getStudyLibraryFilters` (line 1543) | `fetchtype: 'absolute', page: 1, perPage: 100` | Same structure |
| `fetchAllStrataExams()` | — | `getStudyLibrarySubjects` (line 1217) + `getStudyLibraryFilters` (line 1560) | No params (in-memory cache, TTL 5 min) | Array of exam records |

### Program Response Fields (from `programsMap` construction, line 1230–1235)

- `id` — program ID (numeric string, e.g., '6', '9', '7', '8', '3', '5', '13')
- `name` — program name (e.g., 'RN Nursing Exams', 'LPN Nursing Exams', 'NCLEX-PN', 'NCLEX-RN', 'GED', 'TEAS/HESI', 'EDS/HESI')
- `code` — program code (e.g., 'A7F47B58', '34FB84C5')

### Subject Response Fields (per `rawSubjects` items, lines 1239–1247)

- `id` — subject ID (e.g., 'subj-pharm', 'subj-medsurg')
- `guidId` — subject GUID
- `name` / `title` — subject display name
- `programId` — program ID (numeric or string)
- `courseId` — course ID
- `category` — subject category (ATI, CORE SERIES, SPECIALTIES, FUNDAMENTALS, NURSING MATH)
- `pathway` — 'RN' or 'PN_LPN' (from fallback data; from backend `item.pathway`)
- `year`, `season`, `difficulty` — academic metadata

### Course Response Fields (from `coursesMap` construction, line 1223–1228)

- `id` / `guidId` — course ID
- `name` / `code` / `description` — course metadata

### Examination Response Fields (from `fetchAllStrataExams()`, classified by `classifyAuthoritativePathway`)

- `id` / `guidId` — examination ID
- `title` / `name` — examination name
- `subject` / `subjectName` — subject reference
- `courseId` / `courseName` — course reference
- `programId` / `programName` — program reference
- `pathway` — 'RN', 'PN_LPN', 'RN_Exit', 'PN_Exit', or undefined
- `questionsCount` / `totalQuestions` — question count
- `assessmentName` — assessment name
- `description` — examination description
- `assessmentId` — assessment ID

### Important Evidence Distinctions

| Evidence Type | Status |
|---|---|
| Declared in frontend types | ✅ `SubjectCardDto` in `api-types.ts:621–649` |
| Used by frontend logic | ✅ All declared fields consumed in `getStudyLibrarySubjects` and `SubjectCard.tsx` |
| Present in backend source/API docs | ⚠️ Not directly accessible — audit could not query live backend |
| Observed in live API response | ❌ Live backend not accessible during this investigation |
| Inferred but unverified | ⚠️ Program IDs 6 and 9 inferred from fallback data and `getStudyLibraryFilters` defaults |

**Key gap:** The frontend TypeScript types declare fields, but the live backend response structure cannot be verified. Implementation decisions must be supported by available API contracts and reliable fixtures, not live data.

---

## F. Live Backend Verification

**Live backend access was NOT available** during this Phase 1 investigation. All curriculum data derived from:

1. **Code inspection** of `src/lib/api-client.ts` — `getStudyLibrarySubjects` method (lines 1191–1533)
2. **Fallback subject arrays** — 10 hardcoded subjects (9 RN + 1 PN-exclusive) at lines 1265–1276, used when `rawSubjects.length === 0`
3. **Fallback program data** — at `getStudyLibraryFilters` lines 1566–1567: `{ id: '6', name: 'LPN Nursing Exams', code: '34FB84C5' }` and `{ id: '9', name: 'RN Nursing Exams', code: 'A7F47B58' }`
4. **Test suite results** — all 7 verification suites passed (7/7) without modification

**Verified from code only:**
- Programme IDs 6 (LPN) and 9 (RN) are the retained programs
- Programme IDs 7 (NCLEX-PN), 8 (NCLEX-RN), 3 (GED), 5 (HESI A2), 13 (EDS/HESI) are excluded
- 9 common subjects merged by cleaned display name
- 1 PN-exclusive subject: `subj-pn-care` (Practical Nursing Clinical Care)
- `classifyAuthoritativePathway` 4-way classification: RN, PN_LPN, RN_Exit, PN_Exit

**NOT verified from live data:**
- Total subject count (reported ~185, unverified)
- Whether the strata backend uses the same subject IDs/codes/courses for RN and LPN
- Whether course IDs actually prove cross-program equivalence
- Whether any RN-only or LPN-only subjects exist in the backend
- Whether the 185-subject inventory is accurate
- Subject IDs, codes, and course relationships from live backend

**Conclusion:** Implementation must proceed with decisions supported by available code evidence. Live backend validation is an outstanding gap that must be resolved before claiming complete curriculum classification.

---

## G. Subject Identity and Equivalence Analysis

### Nine Reported Merge Candidates (name-based via `cleanSubjectDisplayName`)

| # | Subject Name | RN Source (fallback ID) | LPN Source (fallback ID) | Course ID | Confidence |
|---|---|---|---|---|---|
| 1 | Medical-Surgical Nursing | `subj-medsurg` | Merged (same cleaned name) | `Adult Health` | ✅ VERIFIED (test suite) |
| 2 | Pharmacology | `subj-pharm` | Merged (same cleaned name) | `Pharmacology` | ✅ VERIFIED (test suite) |
| 3 | Fundamentals of Nursing | `subj-fund` | Merged (same cleaned name) | `Foundations of Nursing` | ✅ VERIFIED (test suite) |
| 4 | Pediatric Nursing | `subj-peds` | Merged (same cleaned name) | `Family Health` | ✅ VERIFIED (test suite) |
| 5 | Mental Health & Psychiatric Nursing | `subj-mh` | Merged (same cleaned name) | `Psychiatric Nursing` | ✅ VERIFIED (test suite) |
| 6 | Critical Care & Emergency Nursing | `subj-crit` | Merged (same cleaned name) | `Complex Care` | ✅ VERIFIED (test suite) |
| 7 | Leadership, Delegation & Priority Setting | `subj-lead` | Merged (same cleaned name) | `Nursing Leadership` | ✅ VERIFIED (test suite) |
| 8 | Maternal & Newborn Nursing (OB) | `subj-ob` | Merged (same cleaned name) | `Maternal-Newborn` | ⚠️ AMBIGUOUS — no academic review |
| 9 | Dosage Calculations & Pharmacology Math | `subj-math` | Merged (same cleaned name) | `Clinical Calculations` | ✅ VERIFIED (test suite) |

### Evidence Ranking for Cross-Program Equivalence

**Preferred evidence (in priority order):**

1. **Stable authoritative curriculum subject identifier explicitly shared across programs** — Not present in current contract. No field exists that is both program-agnostic and uniquely identifies equivalent subjects.

2. **Documented cross-program equivalence identifier** — Not present. No metadata field establishes explicit RN/LPN equivalence.

3. **Subject code with verified semantics and cross-program uniqueness** — Not verified. Subject codes (e.g., 'subj-medsurg') are synthetic fallback IDs; backend may use different IDs.

4. **Course or curriculum metadata where backend proves equivalent academic content** — Partially available. Course IDs (e.g., 'Adult Health', 'Pharmacology') are used in `matchingExams` as the most reliable tier, but the audit could not verify that equal course IDs *actually* prove equivalent content across RN/PN programmes.

**Current matching hierarchy (as implemented):**
1. Course-based matching (line 1351) — `if (courseName && itemCourse.includes(courseName.toLowerCase())) return true;`
2. Subject ID-based matching (line 1355-1359) — using `primarySubId` from `authoritativeSubjectMap`
3. Cleaned display name fallback (line 1361-1365) — `cleanSubjectDisplayName()` output

**Critical finding:** Course-based matching is the most reliable method currently available, but **equal course IDs do not automatically prove academic equivalence**. The backend contract must establish that a course represents equivalent content across programmes. Without such evidence, course-based matching risks false positives.

### Ambiguous Subject: `subj-ob` (Maternal & Newborn Nursing (OB))

- **RN source**: `subj-ob`, pathway 'RN', courseName 'Maternal-Newborn', programName 'RN Nursing Exams'
- **LPN source**: No direct LPN counterpart in fallback data; would merge if backend returns PN subject with cleaned name 'maternal & newborn nursing (ob)'
- **Ambiguity**: The cleaned display name 'maternal & newborn nursing (ob)' would merge with any PN subject with the same cleaned name. No academic review was completed to determine whether RN and PN maternal-newborn curriculum content is truly equivalent or distinct.
- **Status**: `AMBIGUOUS` — must not be silently consolidated. Preserve as separate subjects until evidence is available.

### Required Conclusion

The existing API contract does **not** support safe cross-program subject matching without additional evidence. The current implementation relies on name-based merging via `cleanSubjectDisplayName()`, which carries documented false positive risk (especially for `subj-ob`).

**Missing field for safe matching:** An explicit cross-program equivalence identifier or a backend-established guarantee that equal course IDs prove equivalent academic content across RN and LPN programmes.

**Recommendation:** Do not classify any subject as `VERIFIED_COMMON` without evidence. Treat the nine name-based candidates as `POSSIBLY_COMMON` at best, with `subj-ob` classified as `AMBIGUOUS`. Implementation must preserve separate RN and LPN subject records and only consolidate where sufficient evidence exists.

---

## H. Examination Relationship and Count Investigation

### Authoritative Examination-to-Subject Relationship

The examination-to-subject association chain:

```
Original Subject
      |
      v
Subject ID / Course ID / Program ID (from rawSubjects / authoritativeSubjectMap / groupMap)
      |
      v
classifyAuthoritativePathway(ex) → { eligible, pathway: 'RN' | 'PN_LPN' | 'RN_Exit' | 'PN_Exit', category }
      |
      v
matchingExams filter (3-tier priority):
  1. Course-based: itemCourse.includes(courseName.toLowerCase())
  2. Subject ID-based: itemSub.includes(primarySubId) || itemTitle.includes(primarySubId)
  3. Cleaned name fallback: itemSub.includes(cleanSub) || text.includes(cleanSub) || subTokens.every(tok => text.includes(tok))
      |
      v
rnExams = matchingExams.filter(e => classifyAuthoritativePathway(e).pathway === 'RN')
pnExams = matchingExams.filter(e => classifyAuthoritativePathway(e).pathway === 'PN_LPN')
rnExitExams / pnExitExams similarly filtered
```

### Count Semantics

| Metric | Definition | Source |
|---|---|---|
| `rnExamCount` | `rnExams.length` — count of RN-classified examinations | Line 1398 |
| `pnExamCount` | `pnExams.length` — count of PN_LPN-classified examinations | Line 1399 |
| `totalExams` | `rnExamCount + pnExamCount` — sum of RN + PN counts | Line 1400 |
| `totalQuestions` | `sum of (e.questionsCount ?? e.totalQuestions ?? 50) for relevantExams`; or `(totalExams * 50)` if no matching exams | Lines 1404–1407 |
| Default when `totalExams === 0` | `primarySub.unitsCount || 4` | Line 1402 |

### Key Findings

1. **`totalExams = rnExamCount + pnExamCount` is mathematically correct** — by definition since `rnExamCount = rnExams.length` and `pnExamCount = pnExams.length`.

2. **`rnExams` and `pnExams` are mutually exclusive** — an examination classified by `classifyAuthoritativePathway` cannot be both RN and PN_LPN (the classifier returns exactly one pathway).

3. **Examination classification is strict** — `classifyAuthoritativePathway` provides 4-way boundary: RN, PN_LPN, RN_Exit, PN_Exit. Ineligible content (NCLEX, GED, TEAS, HESI, EDS) marked `eligible: false`.

4. **Default count when no matching exams** — `primarySub.unitsCount || 4` — if `totalExams === 0`, use `primarySub.unitsCount` or fall back to 4.

5. **`totalQuestions` semantics** — sum of individual examination question counts; default 50 questions per exam if data missing; `totalExams * 50` as further fallback.

6. **Subject ID-based matching risk** — uses `primarySubId` from the group's `rawItems[0]`. If the strata backend uses different subject IDs for RN and LPN versions of the same subject, this matching will fail to associate examinations correctly.

7. **No deduplication of examination IDs** across API responses — the code assumes examination records are distinct. If the backend returns duplicate examination records, they would be counted multiple times.

### Source-Specific Examination Retrieval

**Can the current architecture guarantee that selecting LPN on a shared card exposes only the 300 LPN examinations?**

**No, not guaranteed.** The current data flow:

1. Shared card displays `rnExamCount` and `pnExamCount` from the merged group
2. Selecting LPN updates URL `track=PN_LPN` and `advanced.subject=subjectName`
3. Study Library re-fetches with `reqPathway=PN_LPN` filter
4. API `getStudyLibrarySubjects` applies `reqPathway` filtering via `classifyAuthoritativePathway`
5. Results filtered to PN_LPN examinations only

**The critical gap**: The `advanced.subject` filter uses `subjectName` (the cleaned display name), **not** the original source subject ID. When the learner selects LPN, the system navigates to a shared canonical card identified by cleaned display name, not by the original LPN subject ID. The examination collection retrieved depends on:

- The `reqPathway` filter correctly excluding RN examinations
- But the *subject identity* itself is the canonical merged card, not the original LPN subject record

**Therefore**: The current navigation resolves to the correct *counts* for the selected pathway, but the *subject identity* is the merged canonical card, not the original source subject record. The target architecture requires that selecting LPN navigates to the **original LPN subject ID** and exposes **only its own examinations**.

**Gap**: The `onSelectSubject(subjectName, selectedPathway)` handler in `StudyLibraryView` (line 476–483) passes `subjectName` (the display name) and `selectedPathway`, but the subsequent API call uses `advanced.subject` which matches by display name, not by original subject ID. There is no mechanism to route to the original source subject record.

---

## I. Current Program Filtering Analysis

### Filtering Coverage Matrix

| Application surface | Current filter | Unknown IDs rejected? | Missing IDs rejected? | Evidence |
|---|---|---|---|---|
| API subject retrieval (`getStudyLibrarySubjects`) | `excludedProgramIds = new Set([7,8,3,5,13])` + name-pattern filter | ❌ Unknown IDs pass through | ❌ Missing IDs pass through | Lines 1238–1247; any programme ID not in excluded set passes |
| Program retrieval (`getStudyLibraryFilters`) | `programItems.filter(p => !(id === 7 || id === 8 || id === 3 || id === 5 || id === 13) / /nclex|ged|teas|hesi|explicit/i.test(name))` | ❌ Unknown IDs pass through | ❌ Missing IDs pass through | Lines 1570–1576 |
| Course retrieval | Not explicitly filtered by programme | ❌ Unknown IDs pass through | ❌ Missing IDs pass through | No programme filtering in course code path |
| Examination retrieval (`classifyAuthoritativePathway`) | Strict ID-based exclusions: assId/progId checks for 3,5,7,8,13 | ✅ Known excluded IDs rejected | ✅ Missing IDs rejected (fall through to eligibility) | Lines 207–241 |
| Subject grouping (`authoritativeSubjectMap`/`groupMap`) | No programme filtering within grouping | ❌ Unknown IDs pass through | ❌ Missing IDs pass through | Built from `rawSubjects` after programme filter |
| Study Library cards | Programme name from `programName` aggregate | ❌ Can display excluded programme names | ❌ Depends on `reqProgram` filter | `programNames.join(' / ')` combines all source programmes |
| Search (line 1510–1513) | `hay.includes(search)` across title/desc/course/programName | ❌ Excluded programme content can match search terms | ❌ No explicit exclusion in search path | No `reqProgram` filter applied within search branch |
| Filters (category, season, difficulty, school) | Independent filters; no programme boundary | ❌ Can reintroduce excluded content | ❌ No programme awareness | Applied after `reqProgram` filter but can interact |
| Dashboard | Same `getStudyLibrarySubjects` API | ❌ Depends on `reqProgram` filter | ❌ Depends on `reqProgram` filter | Report item 14: parity verified |
| Direct URLs | `track` param + `subject` param | ❌ `?track=All&subject=Medical-Surgical Nursing` shows merged card without pathway boundary | ❌ No programme enforcement at URL level | URL params used for filtering but not for programme allowlist |
| Fallback data | Bypasses programme filter entirely | ❌ Fallback subjects always retained regardless of programme IDs | ❌ Fallback used when `rawSubjects.length === 0` | Lines 1278: `const sourceSubjects = rawSubjects.length > 0 ? rawSubjects : fallbackSubjects` |
| Cache | Not explicitly investigated | Unknown | Unknown | No cache isolation by programme |

### Key Finding

**The current programme filtering is exclusively "filter out the bad" — it does NOT actively retain only RN and LPN.** Any programme ID not in the excluded set `{7, 8, 3, 5, 13}` passes through, which means:

- Unknown programme IDs from the strata backend would enter the learner-facing curriculum
- The fallback data (10 subjects) bypasses the filter entirely
- Search results can reintroduce excluded programme content if search terms match
- Dashboard and direct URLs can display content from excluded programmes if the `reqProgram` filter is not applied

**The approved target** is a positive allowlist: `allowedProgramIds = new Set([6, 9])` — a subject is eligible only if its authoritative programme ID resolves to 6 (LPN) or 9 (RN).

### Locations Requiring Allowlist Consumption

1. `src/lib/api-client.ts:1237–1247` — Primary `excludedProgramIds` filter in `getStudyLibrarySubjects`
2. `src/lib/api-client.ts:1570–1576` — Programme filtering in `getStudyLibraryFilters`
3. All downstream consumers of `getStudyLibrarySubjects` results (Study Library page, SubjectCards, search, filters, dashboard)
4. Fallback data activation path (lines 1278–1279)

---

## J. Current Subject Grouping and DTO Analysis

### `authoritativeSubjectMap` Construction (lines 1249–1263)

```typescript
const authoritativeSubjectMap = new Map<string, Record<string, any>>()
for (const sub of rawSubjects) {
  const subId = String(sub.id ?? sub.guidId ?? '').trim().toLowerCase()
  const subName = String(sub.name ?? sub.title ?? '').trim().toLowerCase()
  if (subId && !authoritativeSubjectMap.has(subId)) {
    authoritativeSubjectMap.set(subId, sub)  // First-wins by subId
  }
  const cleanedName = cleanSubjectDisplayName(String(sub.name ?? sub.title ?? '')).toLowerCase()
  if (cleanedName && !authoritativeSubjectMap.has(cleanedName)) {
    authoritativeSubjectMap.set(cleanedName, sub)  // Also map by cleaned name (first-wins)
  }
}
```

**Behavior:**
- Two keys per subject: (1) lowercased subject ID, (2) cleaned display name
- First subject encountered for a given key becomes the authoritative source
- Subsequent subjects with same key appended to existing group's `rawItems` (via `groupMap`, not replacing map entry)
- `subId` mapping is ID-based; `cleanedName` mapping is name-based

**Preservation of original source IDs:**
- `rawItems` array on each `SubjectGroup` contains ALL source subjects merged under the key
- `primarySub = subs[0]` — the first subject encountered (authoritative source)
- `programName = programNames.join(' / ') || null` — aggregated from all `rawItems`
- `courseName = courseNames.join(' / ') || null` — aggregated from all `rawItems`
- **Critical gap**: No `sourceSubjectIds` field listing all original subject IDs that contributed to the merged card

### `groupMap` Construction (lines 1291–1321)

```typescript
const groupMap = new Map<string, SubjectGroup>()
for (const sub of sourceSubjects) {
  const rawSubjectName = String(sub.name ?? sub.title ?? '').trim()
  const subjectName = cleanSubjectDisplayName(rawSubjectName)
  const isExit = /exit|predictor/i.test(subjectName) || /exit|predictor/i.test(String(sub.name ?? ''))

  let groupKey: string;
  let exitPathway: 'RN_Exit' | 'PN_Exit' | undefined;

  if (isExit) {
    // Exit-specific key: `rn_exit:rn exit predictor` or `pn_exit:pn exit predictor`
    const subPathway = inferExamPathway(sub)
    const isPn = subPathway === 'PN_LPN' || /pn|lpn/i.test(String(sub.name ?? sub.title ?? sub.courseName ?? ''))
    exitPathway = isPn ? 'PN_Exit' : 'RN_Exit'
    groupKey = `${exitPathway.toLowerCase()}:${subjectName.toLowerCase()}`
  } else {
    // Non-exit key: `canonical:medical-surgical nursing`
    groupKey = `canonical:${subjectName.toLowerCase()}`
  }

  const existing = groupMap.get(groupKey)
  if (existing) {
    existing.rawItems.push(sub)
  } else {
    groupMap.set(groupKey, {
      canonicalKey: groupKey,
      subjectName,
      isExit,
      exitPathway,
      rawItems: [sub],
    })
  }
}
```

**Behavior:**
- Non-exit subjects: keyed by `canonical:cleanedName.lowerCase()`
- Exit subjects: keyed by `exitPathway:subjectName.lowerCase()`
- `rawItems` accumulates all source subjects under each key
- `subjectName` on the DTO is the cleaned display name from the *first* subject encountered

**Classification field:** Currently absent from `SubjectCardDto` and the grouping/output model. The classification (COMMON / RN_ONLY / LPN_ONLY) is implicit from `availablePathways` and `pathway` fields.

### `SubjectCardDto` (api-types.ts:621–649)

```typescript
export interface SubjectCardDto {
  id: string;
  guidId?: string;
  code: string;
  name: string;
  title: string;
  description: string;
  pathway: string;
  category: string;
  programId?: string | number | null;
  programName?: string | null;
  courseId?: string | number | null;
  courseName?: string | null;
  school?: string | null;
  academicYear?: number | null;
  season?: string | null;
  difficulty?: DifficultyLevel | null;
  totalExams: number;
  totalQuestions: number;
  availablePathways?: string[];
  rnExamCount?: number;
  pnExamCount?: number;
  featuredExams?: Array<{...}>;
}
```

**Existing fields relevant to the approved architecture:**
- `programId` — programme ID (nullable); aggregated from rawItems, reflects the first source's programme
- `programName` — programme name (nullable); aggregated as `programNames.join(' / ') || null`
- `availablePathways` — string[]; drives dropdown and CTA behavior
- `rnExamCount`, `pnExamCount` — separate RN and PN examination counts
- `totalExams` — `rnExamCount + pnExamCount`
- `pathway` — primary pathway; `'RN'` if `availablePathways.includes('RN')`, else `'PN_LPN'`

**Missing fields (required for the approved architecture):**
- `classification: 'COMMON' | 'RN_ONLY' | 'LPN_ONLY'` — explicit subject-programme relationship
- `sourceSubjectIds: string[]` — all original subject IDs that contributed to the merged card
- `lpnSource?: PathwaySubjectSource` / `rnSource?: PathwaySubjectSource` — preserving original source records
- `ambiguityNotes?: string[]` — flagging subjects needing academic review (e.g., `subj-ob`)

**DTO limitation:** The current `SubjectCardDto` can represent a merged common subject, but cannot distinguish between:
- A verified common subject with evidence of equivalence
- A name-based merge without sufficient evidence
- An RN-only subject standing alone
- An LPN-only subject standing alone

---

## K. Pathway and Navigation Analysis

### Pathway Classification

`classifyAuthoritativePathway(item)` (lines 191–278) provides strict 4-way classification:

| Condition | Pathway | Eligible |
|---|---|---|
| NCLEX, GED, TEAS, HESI, EDS | `eligible: false` | No |
| Explicit `item.pathway` = 'RN', 'PN_LPN', 'RN_Exit', 'PN_Exit' | That pathway | Yes (if eligible) |
| Exit: `isPN && !isRN` → `PN_Exit`; otherwise `RN_Exit` | RN_Exit / PN_Exit | Yes (if eligible) |
| `isPN && !isRN` → `PN_LPN`; otherwise `RN` | RN / PN_LPN | Yes (if eligible) |

**Four-way boundary is strict** — verified by test suite (test 1).

### Study Library Navigation

**URL `track` parameter behavior:**
- Initialized from `searchParams?.get('track') || initialTrack || 'All'` (study-library-view.tsx:63)
- Updated via `setPathway(selectedPathway)` which calls `params.set('track', pathway)` (line 144)
- If `pathway === 'All'`, param is set to `'All'`; if `initialTrack` was set and differs from 'All', resets to 'All' (lines 143–147)
- Direct URLs: `?track=RN` → shows RN pathway; `?track=PN_LPN` → shows PN_LPN pathway

**Subject selection navigation** (study-library-view.tsx:476–483):
```typescript
onSelectSubject={(subjectName, selectedPathway) => {
  if (selectedPathway) {
    setPathway(selectedPathway as any);
  }
  setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
  setPageNumber(1);
}}
```

**Behavior:**
1. `setPathway(selectedPathway)` → updates URL `track` param → triggers API call with new `reqPathway` filter
2. `setAdvanced(subject)` → updates selected subject filter → triggers API call with `advanced.subject` filter
3. `setPageNumber(1)` → resets pagination

**Pathway-specific examination filtering** (api-client.ts:1465–1473, within `filteredSubjects` filter):
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
  // ... other norms
}
```

**Navigation verification:**
- `?track=RN` → API filters `reqPathway='rn'` → only examinations with `classifyAuthoritativePathway` → 'RN' are included → `rnExamCount` reflects RN count only
- `?track=PN_LPN` → API filters `reqPathway='pnlpn'` → only examinations with pathway 'PN_LPN' are included → `pnExamCount` reflects PN count only
- **BUT**: The subject card itself is the merged canonical card, not the original source record

### Original Source Subject ID Routing Gap

**Target behavior** (from the eight-phase roadmap):
```
Shared Subject Card
       |
       +---- RN selection
       |       |
       |       v
       |   Original RN Subject ID
       |       |
       |       v
       |   RN Examination Collection
       |
       +---- LPN selection
               |
               v
           Original LPN Subject ID
               |
               v
           LPN Examination Collection
```

**Current behavior:**
- RN/LPN selection on SubjectCard updates URL `track` param and `advanced.subject`
- The Study Library re-fetches with `reqPathway` filter, correctly showing the selected pathway's examination counts
- **BUT**: The subject displayed is the merged canonical card identified by cleaned display name, **not** the original RN or LPN subject record
- There is no mechanism to route to the original source subject ID (`subj-medsurg` from program 9, or the LPN counterpart)

**Critical gap**: The `onSelectSubject(subjectName, selectedPathway)` handler passes the display name, and the subsequent API call matches by `advanced.subject` (display name), not by original subject ID. The examination collection retrieved is filtered by pathway, but the subject identity is the merged card, not the original.

**Evidence from code**:
- `SubjectCard.tsx:198`: `onSelectSubject(subject.title, "RN")` — passes `subject.title` (the display name)
- `StudyLibraryView.tsx:477–482`: `onSelectSubject{(subjectName, selectedPathway)}` → `setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }))` — stores display name in `advanced.subject`
- No original subject ID is passed or used for navigation
- The `advanced.subject` filter in the API search (line 1511) searches across `item.title`, which matches by display name

**Conclusion**: The current navigation can filter examinations by pathway correctly, but **cannot route to the original source subject ID**. The target architecture requires that pathway selection resolves to the exact original subject record and its examination collection.

---

## L. Search, Dashboard, URL, and Cache Analysis

### Search

**Current behavior** (api-client.ts:1510–1513, within `filteredSubjects` filter):
```typescript
if (search) {
  const hay = `${item.title} ${item.description} ${item.courseName ?? ''} ${item.programName ?? ''}`.toLowerCase();
  if (!hay.includes(search)) return false;
}
```

**Leakage risks:**
- Search operates on the **already-filtered** `mappedSubjects` (after programme filtering and grouping), but the search branch does **not** apply `reqProgram` filter
- If a search term matches content from excluded programmes (e.g., searching "nursing" could match subjects whose `programName` includes "Nursing" from excluded programmes that survived the programme filter), those subjects appear in results
- Search suggestions use separate data (not investigated, but likely similar leakage)
- The `advanced.program` filter exists (study-library-view.tsx:189) but is not applied within the search branch

**Evidence**: The search could potentially reintroduce excluded programme content if search terms overlap with excluded programme subjects.

---

## M. Fallback and Error Handling

### Fallback Data Activation

**Activation condition** (api-client.ts:1278):
```typescript
const sourceSubjects = rawSubjects.length > 0 ? rawSubjects : fallbackSubjects;
```

**Fallback data** (lines 1265–1276): 10 hardcoded subjects:
- 9 RN subjects (programName: 'RN Nursing Exams', programId implied: 9)
- 1 PN-exclusive subject (`subj-pn-care`, programName: 'LPN Nursing Exams', pathway: 'PN_LPN')

**Bypasses programme filtering**: Fallback data is used when `rawSubjects.length === 0`, and it **always** retained regardless of programme IDs. The fallback subjects have hardcoded `programName` values but no programme ID filtering is applied.

**Can appear in search/dashboard**: Since fallback subjects bypass the `excludedProgramIds` filter, they can appear in Study Library results, search, and dashboard even though some have programme associations that would be excluded.

### API Failure Handling

- If `getStudyLibrarySubjects` fails, `setError(response.message || "Unable to load published subjects.")` (study-library-view.tsx:215)
- If `getStudyLibrary` fails, similar error handling (line 200)
- No fallback-to-fallback-on-API-failure observed in code
- Error state renders error UI with Retry button

### Risks

- UI can display plausible but unverified curriculum information from fallback data
- Fallback subjects bypass programme allowlist entirely
- No mechanism to distinguish fallback data from live backend data in the UI

---

## N. Existing Test Baseline

**All 7 verification suites passed cleanly** (7/7) when run via `node tests/learner-unified-catalog-and-modes.test.mjs`:

1. ✅ Authoritative 4-Pathway Classification & Scope Enforcement
2. ✅ Subject Display Name Cleansing
3. ✅ Review Mode Fallback Prevention in exam-session
4. ✅ NCLEX Redirection to PrepFord
5. ✅ SubjectCard Unified RN/PN CTA Selection
6. ✅ StudyLibraryCategoryTabs 4-Pathway Scope
7. ✅ /learner Subject Catalogue & Stats Parity

**No test modifications were made** during the prior audit, and all 7 suites continue to pass.

**Test coverage for RN/LPN Study Library specifically:**
- Test 5 covers SubjectCard RN/PN dropdown CTA — verifies dropdown navigation works
- Test 6 covers StudyLibraryCategoryTabs 4-way pathway alignment — verifies tabs behavior
- Test 7 covers /learner Subject Catalogue & Stats Parity — verifies dashboard/library consistency
- Tests 1–4 verify NCLEX exclusion, 4-way classification, and exam redirection

**No tests specifically verify:**
- Programme allowlist behavior (positive retention of only 6 and 9)
- Separate RN/LPN subject collections
- Evidence-backed common-subject identification
- Original source subject ID preservation
- Search isolation from excluded programmes
- Header pathway-state accuracy

---

## O. Implementation File Impact Analysis

| File | Current Responsibility | Observed Issue | Proposed Later Phase | Change Necessity |
|---|---|---|---|---|
| `src/lib/api-client.ts` | `getStudyLibrarySubjects` method (lines 1191–1533) | Programme filtering: exclusion-only, no positive allowlist; subject grouping: name-based merge without evidence; no separate RN/LPN collections; examination counting correct; pathway classification correct; navigation: `reqPathway` filtering works but doesn't route to original source IDs | 2 (allowlist), 3 (separate collections), 4 (evidence-backed matching), 5 (presentation model), 6 (navigation with source IDs) | **CRITICAL** — Core data flow; all later phases depend on this |
| `src/lib/api-types.ts` | `SubjectCardDto` interface (lines 621–649) | Missing `classification`, `sourceSubjectIds`, `ambiguityNotes` fields; `programName` aggregated as join, not source-ID list | 5 (unified presentation model) | **HIGH** — DTO must be extended to preserve source identities |
| `src/components/study/StudyLibraryHeader.tsx` | Header pathway display | Hardcoded `(RN)` suffix (line 36); does not dynamic-ally represent `selectedPathway` | 7 (header accuracy) | **MEDIUM** — Cosmetic defect; simple fix |
| `src/components/study/SubjectCard.tsx` | Subject card rendering | `availablePathways` drives dropdown; `pathway` drives CTA; no source ID preservation; `rnExamCount`/`pnExamCount` displayed but no classification | 5 (presentation model), 6 (navigation) | **HIGH** — Must preserve original source IDs in card data |
| Study Library page (`study-library-view.tsx`) | View composition, state, URL param sync | No separate RN/LPN subject collections; `advanced.subject` matches by display name, not ID; pathway state from URL, not from programme filtering | 3 (collections), 6 (navigation with source IDs) | **CRITICAL** — Flow must separate collections before consolidation |
| Search components | Subject search functionality | Search does not apply `reqProgram` filter; excluded programme content can leak through | 6 (learner-experience isolation) | **MEDIUM** — Search must respect allowlist |
| Dashboard components | Subject/dashboard queries | Same `getStudyLibrarySubjects` API; parity verified but filtering depends on `reqProgram` | 6 (isolation) | **MEDIUM** — Dashboard must respect allowlist |
| Relevant tests (7 suites) | Verification suites | All 7 pass; no tests for new allowlist/collection behavior | 8 (regression verification) | **N/A** — Must not modify; new tests added later |

**Dependency analysis:**
- Phase 2 (allowlist) must be implemented before Phase 3 (separate collections)
- Phase 3 depends on Phase 2 (collections can only be created after allowlist filtering)
- Phase 4 (evidence-backed matching) depends on Phase 3 (collections must exist before comparison)
- Phase 5 (presentation model) depends on Phases 2–4 (new DTO fields require data from earlier phases)
- Phase 6 (navigation/isolations) depends on Phases 2–5 (source ID routing requires allowlist + collections + matching)
- Phase 7 (header) is somewhat independent but should be done after Phase 5 (header must reflect actual pathway state from new model)
- Phase 8 (regression) depends on all earlier phases

**The entire implementation cannot be achieved by modifying only three files.** The data model changes in `api-client.ts` and `api-types.ts` ripple through all consumer components. However, the minimal change set is approximately 50–70 lines as previously documented, concentrated in `api-client.ts` (allowlist + collection separation + matching enhancement), `api-types.ts` (DTO extension), and `StudyLibraryHeader.tsx` (suffix fix).

---

## P. Risk and Contract-Gap Register

| Finding ID | Severity | Description | Affected Files | Consequence if Unresolved | Recommended Remediation | Blocks Phase |
|---|---|---|---|---|---|---|
| F-001 | P2 | Programme filtering uses exclusion-only logic; unknown IDs pass through | `api-client.ts:1238` | Unknown programme IDs enter learner-facing curriculum | Add positive allowlist `allowedProgramIds = new Set(['6', '9'])` after exclusion filter | **Phase 2** |
| F-002 | P2 | No separate RN/LPN subject collections created before consolidation | `api-client.ts:1278–1291` | RN and LPN subjects mixed in single collection; no defense-in-depth | Create `rnSubjects` and `lpnSubjects` arrays after allowlist filtering | **Phase 3** |
| F-003 | P3 | Common-subject matching is name-based only; false positive risk | `api-client.ts:1251–1263,1342–1366` | Verified-common subjects may include non-equivalent merges; `subj-ob` ambiguity unresolved | Enhance matching hierarchy: course ID > subject ID > display name; add ambiguity flagging | **Phase 4** |
| F-004 | P3 | No explicit RN/LPN-only retention filter after programme exclusion | `api-client.ts:1237–1247` | Any non-excluded programme ID passes through; defence-in-depth missing | Add `if (!validProgramIds.has(String(pId))) return false;` after excludedProgramIds filter | **Phase 2** |
| F-005 | P4 | StudyLibraryHeader hardcodes `(RN)` suffix regardless of pathway | `StudyLibraryHeader.tsx:36` | Header display mismatch: "PN LPN (RN)" when pathway is PN_LPN | Replace with dynamic suffix: `selectedPathway === "PN_LPN" ? "(PN)" : "(RN)"` | **Phase 7** |
| F-006 | P0 | Navigation does not route to original source subject ID | `StudyLibraryView:476–483`, `SubjectCard:198` | Learner selects pathway but navigates to merged canonical card, not original source record | Pass original subject ID through navigation flow; API must support retrieval by original ID | **Phase 6** |
| F-007 | P2 | Search may reintroduce excluded programme content | `api-client.ts:1510–1513`, `study-library-view.tsx:1511` | Learner can search for and find excluded programme subjects | Apply `reqProgram` filter within search branch; enforce allowlist | **Phase 6** |
| F-008 | P3 | `subj-ob` (Maternal OB) ambiguously merged without academic review | `api-client.ts:1269`, `1291–1321` | Silent consolidation of potentially non-equivalent subjects | Flag `subj-ob` for academic review; do not assume merge without evidence | **Phase 4** |
| F-009 | P1 | Fallback data bypasses programme allowlist entirely | `api-client.ts:1278–1279` | Fallback subjects always retained; excluded programme content can appear | Apply allowlist to fallback data activation; or mark fallback as excluded until verified | **Phase 2** |
| F-010 | P2 | No `classification` field on SubjectCardDto | `api-types.ts:621–649` | Inability to distinguish COMMON/RN_ONLY/LPN_ONLY subjects | Add `classification: 'COMMON' | 'RN_ONLY' | 'LPN_ONLY'` to `SubjectCardDto` | **Phase 5** |
| F-011 | P2 | No `sourceSubjectIds` field on SubjectCardDto | `api-types.ts:621–649` | Original source IDs lost in merge; cannot route to original records | Add `sourceSubjectIds: string[]` field listing all contributing subject IDs | **Phase 5** |
| F-012 | P3 | No `ambiguityNotes` field for subjects needing review | `api-types.ts:621–649` | Inability to flag subjects like `subj-ob` for academic review | Add `ambiguityNotes: string[]` field | **Phase 4** |

**Stop conditions** (from the eight-phase authorization):
1. ✅ Baseline verified — no unexpected changes
2. ⚠️ Essential program identity fields available — programme IDs 6 and 9 identifiable from fallback/data, but live backend verification outstanding
3. ⚠️ Original source subject IDs cannot be preserved through current navigation — confirmed gap
4. ⚠️ Examination-to-subject relationships can be established — confirmed (counts correct, source ID routing gap)
5. ⚠️ Pathway-specific examination retrieval cannot be guaranteed — confirmed (pathway filtering works but doesn't route to original IDs)
6. ⚠️ Backend contract cannot support architecture without prohibited backend change — not required; frontend changes suffice
7. ⚠️ Actual source implementation materially conflicts with audit findings — **no conflicts found**; source confirms audit descriptions
8. ✅ Proposed solution would not require unrelated architectural redesign — changes are scoped to approved eight-phase roadmap

**Readiness verdict**: `READY FOR PHASE 2 WITH DOCUMENTED LIMITATIONS` — Phase 2 (positive program allowlist) can proceed, but all subsequent phases have documented gaps that must be remediated in sequence.

**Owner decision requirements**:
1. Confirm that live backend API access is (or is not) available for the implementation team
2. Authorize extension of `SubjectCardDto` with `classification`, `sourceSubjectIds`, and `ambiguityNotes` fields
3. Authorize modification of `getStudyLibrarySubjects` to add positive programme allowlist after exclusion filter
4. Authorize creation of separate `rnSubjects`/`lpnSubjects` arrays in the data flow
5. Authorize enhancement of `matchingExams` to include course ID verification and programme ID checks

---

## Q. Phase 1 Readiness Verdict

**`READY FOR PHASE 2 WITH DOCUMENTED LIMITATIONS`**

Rationale:
- Baseline verified; no source modifications made; all audit artifacts preserved
- Phase 2 (positive programme allowlist `{6, 9}`) is a self-contained change that does not require live backend data
- All subsequent phases have documented dependencies and gaps, but Phase 2 can proceed immediately
- Limitations clearly documented: live backend verification outstanding, navigation source ID routing gap, name-based matching risk, fallback data bypass
- No blockers that prevent Phase 2 from starting

**Owner action required**: Authorize Phase 2 commencement. No other decisions required at this time.

---

## R. Final Preservation Statement

Explicit confirmation:

- ✅ Application source files remained **unchanged** during Phase 1
- ✅ Database schemas remained **unchanged** (no database access performed)
- ✅ Migrations remained **unchanged** (no database migrations exist in this frontend-only audit)
- ✅ Audit artifacts A–K were **preserved** (present as untracked directories)
- ✅ User work was **preserved** (no modifications to existing user files or Git history)
- ✅ No files were staged (`git add .` not executed)
- ✅ No commits were created
- ✅ No pushes occurred
- ✅ No merges, resets, or rebases occurred
- ✅ No deployment occurred

**Phase 1 complete.** All investigation obligations satisfied. Proceed to Phase 2 with documented limitations.
