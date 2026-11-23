# A. Revised Architecture Specification

## Executive Overview

This specification documents the definitive frontend-driven RN/LPN curriculum filtering and subject consolidation architecture for NURVIA Prep. The architecture processes the backend's full curriculum response (all seven programs, reportedly 185 subjects) and filters it down to the two learner-facing programs: Registered Nursing (RN) and Licensed Practical Nursing (LPN).

### Core Design Principle

**The frontend is responsible for filtering the backend's broader curriculum response, isolating the two relevant program collections, identifying genuinely common subjects, consolidating their presentation, and preserving independent program-specific examination collections.**

The backend continues to serve all seven programs; the frontend decides which subjects and examinations learners can access.

### Processing Pipeline (9 Stages)

#### Stage 1 — Retrieve the Authoritative Curriculum

The frontend (`getStudyLibrarySubjects` in `src/lib/api-client.ts`) retrieves three strata collections in parallel:

1. **Subjects**: `/api/castoline/strata/learning/subjects/list/absolute` — raw subject records
2. **Courses**: `/api/castoline/strata/learning/courses/list/absolute` — course metadata
3. **Programs**: `/api/castoline/strata/learning/programs/list/absolute` — program metadata

**Current behavior**:
- Line 1211-1215: `const [subjectsRes, coursesRes, programsRes] = await Promise.all([...])`
- Line 1217: `const allRawExams = await this.fetchAllStrataExams()` — fetches all strata examinations
- Line 1218: Filters exams through `classifyAuthoritativePathway(ex).eligible` — the strict 4-way boundary

**Unresolved during this audit**: The actual number of subjects returned from the strata backend could not be verified without live API access. The fallback subject array (lines 1265-1276) contains 10 subjects (9 RN + 1 PN-exclusive) and is used when `rawSubjects.length === 0`.

**Evidence gap**: Without live API data, we cannot confirm the reported 185 subjects across 7 programs. The code structure suggests the backend could return any number of subjects; the frontend must handle whatever is returned.

#### Stage 2 — Filter the Programs

**Current behavior** (lines 1237-1247):
```typescript
const excludedProgramIds = new Set([7, 8, 3, 5, 13])
const rawSubjects = (subjectsRes.success && subjectsRes.data ? subjectsRes.data.items : []).filter((sub) => {
  const name = String(sub.name ?? sub.title ?? '').trim();
  if (/nclex|ged|teas|hesi|explicit/i.test(name)) return false;
  const cId = sub.courseId ? String(sub.courseId) : '';
  const c = cId ? coursesMap.get(cId) : undefined;
  const pId = Number(sub.programId ?? c?.programId ?? 0);
  if (excludedProgramIds.has(pId)) return false;
  return true;
});
```

**Program ID mapping** (from `getStudyLibraryFilters` defaults, lines 1564-1569):
- Program ID 9: `'RN Nursing Exams'` — Registered Nursing program
- Program ID 6: `'LPN Nursing Exams'` — Licensed Practical Nursing program

**Program exclusion logic**:
- Program IDs 7, 8, 3, 5, 13 are explicitly excluded (NCLEX-PN, NCLEX-RN, GED, HESI A2, EDS)
- Program IDs NOT in the excluded set pass through (including 6 and 9 for RN/LPN)

**Current behavior result**: Subjects from programs 6 (LPN) and 9 (RN) are retained. Subjects from programs 7, 8, 3, 5, 13 are excluded. Subjects from other program IDs (if any exist in the strata backend) also pass through, which may be a gap.

**Critical question**: Does the strata backend return subjects with program IDs other than 6, 9, and the excluded set? This cannot be verified without live data.

#### Stage 3 — Filter the Subjects

**Current behavior**: After program filtering (Stage 2), the `rawSubjects` array contains only subjects whose program ID is not in `excludedProgramIds`. No additional subject-level program filtering is applied beyond the program ID check.

**RN/LPN collection creation**: The specification requires TWO independent collections:
- RN subjects (from program ID 9 or RN-identified subjects)
- LPN subjects (from program ID 6 or PN_LPN-identified subjects)

**Current gap**: The code does NOT create separate RN and LPN collections. It produces one merged collection via the `authoritativeSubjectMap` and `groupMap` logic (lines 1249-1321). The `programName` on the resulting `SubjectCardDto` (line 1337) is computed as `programNames.join(' / ') || null`, which combines all programme names from the source subjects — this is a combined display, not a filter.

**Required change**: The frontend must create two separate collections after program filtering:
- `rnSubjects`: subjects where `programId === 9` or the subject is RN-identified
- `lpnSubjects`: subjects where `programId === 6` or the subject is PN_LPN-identified

#### Stage 4 — Identify Genuinely Common Subjects

**Current behavior** (lines 1280-1321): The `authoritativeSubjectMap` and `groupMap` merge subjects by cleaned display name. The `first-wins` strategy means the first subject encountered for a given ID or cleaned name becomes the authoritative source; subsequent subjects with the same key are appended to the group's `rawItems`.

**Matching strategy**: Cleaned display name matching via `cleanSubjectDisplayName()`, which strips NCLEX/RN/PN suffixes, parentheses, and normalizes spacing.

**Critical design issue**: The current merge is name-based, not ID-based or structure-based. Two subjects with the same cleaned name (e.g., "Medical-Surgical Nursing") from RN and PN programs are merged into one card, but this could also merge distinct subjects that happen to have similar names.

**Required approach** (per specification):
1. After creating RN and LPN collections (Stage 3)
2. Compare subject names, codes, course relationships, and other metadata
3. Only merge if there is defensible evidence of academic equivalence
4. Flag subjects with similar names but insufficient evidence for review
5. Never merge solely on cleaned display name match

#### Stage 5 — Consolidate Common Subjects

**Current behavior** (lines 1323-1462): The `mappedSubjects` array returns `SubjectCardDto` items with:
- `pathway`: `'RN'` or `'PN_LPN'` (the primary pathway)
- `availablePathways`: `['RN']`, `['PN_LPN']`, or `['RN', 'PN_LPN']` (determines dropdown display)
- `rnExamCount`: count of RN-classified examinations
- `pnExamCount`: count of PN_LPN-classified examinations
- `totalExams`: `rnExamCount + pnExamCount`
- `totalQuestions`: sum of questions from matching exams

**Consolidation formula** (lines 1398-1400):
```typescript
rnExamCount = rnExams.length;
pnExamCount = pnExams.length;
totalExams = rnExamCount + pnExamCount;
```

**Critical verification needed**:
- Are `rnExams` and `pnExams` truly independent collections? Yes — they are filtered from `matchingExams` using `classifyAuthoritativePathway(e).pathway === 'RN'` and `=== 'PN_LPN'` respectively.
- Does `totalExams = rnExamCount + pnExamCount` double-count? No, because the two filters are mutually exclusive (an exam can't be both RN and PN_LPN).

**Per-specification requirement**: The shared card must display `combinedExamCount = rnExamCount + lpnExamCount` and preserve both source subject IDs.

#### Stage 6 — Aggregate Examination Counts

**Current behavior** (lines 1398-1407):
```typescript
rnExamCount = rnExams.length;
pnExamCount = pnExams.length;
totalExams = rnExamCount + pnExamCount;
const relevantExams = rnExams.concat(pnExams);
totalQuestions = relevantExams.length > 0
  ? relevantExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0)
  : (totalExams * 50);
```

**Formula verification**:
- `combinedExamCount = rnExamCount + pnExamCount` — correct, per spec
- `totalQuestions` sums questions from both pathways — correct as presentation-level aggregate

**Per-specification requirement**: The aggregate is a presentation-level count; it must not imply that RN and LPN examination records have been physically merged. Each examination retains its own pathway classification.

#### Stage 7 — Pathway-Specific Navigation

**Current behavior** (SubjectCard.tsx, lines 163-241):
- When `hasMultiplePathways && hasExams`: renders dropdown with RN and LPN/LPN options
- Primary "Explore Subject" button uses `subject.pathway` (the primary pathway)
- Dropdown selects navigate to the appropriate collection

**Navigation logic** (study-library-view.tsx, lines 476-483):
```typescript
onSelectSubject={(subjectName, selectedPathway) => {
  if (selectedPathway) {
    setPathway(selectedPathway as any);
  }
  setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
  setPageNumber(1);
}}
```

**Per-specification requirement**: Selecting LPN must navigate to the original LPN subject and retrieve only its LPN examination collection. Selecting RN must navigate to the original RN subject and retrieve only its RN examination collection. The selector must never route both pathways through one arbitrary canonical subject ID.

**Current gap**: The dropdown navigates to a unified subject card, but the underlying examination retrieval must ensure the correct pathway-specific collection is fetched. The `setPathway(selectedPathway)` updates the URL `track` parameter, and the Study Library API applies `reqPathway` filtering.

#### Stage 8 — Preserve Exclusive Subjects

**Current behavior**:
- RN-only subjects (present only in the RN program) remain in the merged collection with `availablePathways: ['RN']`
- LPN-only subject `subj-pn-care` (Practical Nursing Clinical Care) has `pathway: 'PN_LPN'` and `availablePathways: ['PN_LPN']`

**Per-specification requirement**: A subject present in only one of the two programs must remain visible as a single-program card. Its pathway association and navigation must remain correct.

**Current status**: Partially working — exclusive subjects are visible, but the mechanism for preserving their independent identity within the merged collection needs verification.

#### Stage 9 — Enforce Curriculum Isolation Throughout the Learner Experience

**Inspection points** (from the specification):
- Study Library, Subject cards, Subject search, Category and pathway filters
- Learner dashboard, Study navigation, Subject detail pages
- Examination creation, Examination selection, Direct subject URLs
- Cached curriculum data

**Current filtering** (getStudyLibrarySubjects filteredSubjects, lines 1465-1515):
- `reqPathway` filtering applies `classifyAuthoritativePathway` per examination
- `reqProgram` filtering checks `item.programName ?? item.programId` against the requested program
- `reqCourse`, `reqSchool`, `reqYear`, `reqSeason`, `reqDifficulty` filters
- `search` full-text search

**Per-specification requirement**: The five excluded programs must not leak into the RN/LPN learner experience through alternative navigation or stale cached responses.

**Current gap**: The `reqProgram` filter (line 1487-1490) uses `includes` matching: `if (pr !== reqProgram && !pr.includes(reqProgram)) return false;`. This means a programme named "RN Nursing Exams" would match a request for "RN", but could also potentially match partial strings. More importantly, there's no defense against cached responses or alternative routes reintroducing excluded content.

### Expected Data Model (per specification)

The conceptual model:
```
UnifiedSubject
- canonicalSubjectKey
- displayName
- classification: COMMON | RN_ONLY | LPN_ONLY
- combinedExamCount
- availablePathways
- rnSubject
  - sourceSubjectId
  - sourceProgramId
  - examCount
  - sourceExamCollection
- lpnSubject
  - sourceSubjectId
  - sourceProgramId
  - examCount
  - sourceExamCollection
```

**Actual current model** (SubjectCardDto, api-types.ts:621-649):
- `id`, `guidId`, `code`, `name`, `title`, `description`, `pathway`, `category`
- `programId?: string | number | null`, `programName?: string | null`
- `courseId?: string | number | null`, `courseName?: string | null`
- `school?: string | null`, `academicYear?: number | null`, `season?: string | null`
- `difficulty?: DifficultyLevel | null`
- `totalExams`, `totalQuestions`
- `availablePathways?: string[]`
- `rnExamCount?: number`, `pnExamCount?: number`
- `featuredExams?: Array<{...}>`

**Recommendation**: The existing `SubjectCardDto` can be extended minimally to include the `classification` field and separate `rnSubject`/`lpnSubject` fields, but the smallest safe approach is to add the classification logic in the processing pipeline without new TypeScript interfaces, leveraging the existing DTO fields.

### Key Findings So Far

| Area | Status |
|---|---|
| Program filtering (Stage 2) | Partially working — IDs 7,8,3,5,13 excluded; IDs 6 & 9 pass through; gap: other program IDs may pass through |
| Subject filtering (Stage 3) | Not implemented as spec requires — no separate RN/LPN collections created |
| Common-subject matching (Stage 4) | Name-based merging via `authoritativeSubjectMap` — risk of false positives |
| Common-subject consolidation (Stage 5) | Works for count aggregation; `totalExams = rnExamCount + pnExamCount` verified |
| Examination aggregation (Stage 6) | Works correctly — separate filters for RN and PN exams |
| Pathway navigation (Stage 7) | Dropdown navigation exists; pathway-specific retrieval verified via URL `track` param |
| Exclusive subjects (Stage 8) | PN-exclusive `subj-pn-care` preserved; RN-only subjects status unknown |
| Curriculum isolation (Stage 9) | Program-level filtering exists; gaps in cache protection and alternative routes |

**Immediate remediation priorities**:
1. Create separate RN and LPN subject collections after program filtering
2. Replace name-based merging with evidence-backed common-subject identification
3. Preserve both source subject IDs on consolidated cards
4. Ensure pathway-specific navigation retrieves the correct original collection
5. Strengthen curriculum isolation across all entry points
