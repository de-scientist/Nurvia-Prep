# E. Backend and API Contract Audit

## API Endpoints for Curriculum Data

The following strata endpoints serve the curriculum data required by `getStudyLibrarySubjects`:

| Endpoint | Resource | Fetch Type | Auth | Purpose |
|---|---|---|---|---|
| `/api/castoline/strata/learning/subjects/list/absolute` | subjects | absolute | No | Primary subject data source |
| `/api/castoline/strata/learning/courses/list/absolute` | courses | absolute | No | Course metadata for subject-course matching |
| `/api/castoline/strata/learning/programs/list/absolute` | programs | absolute | No | Programme metadata and ID associations |

### Subject Endpoint Response Structure

**Expected fields** (from `StrataRecord` contract, contracts.ts:551-583):
- `id`, `guidId`, `uuid`, `name`, `title`, `slug`, `code`, `description`
- `academicYear`, `year`, `season`, `term`
- `categoryId`, `subCategoryId`, `domainId`, `programId`, `courseId`
- `subjectId`, `unitId`, `lessonId`, `topicId`, `conceptId`
- `assessmentId`, `examId`, `sectionId`, `institutionId`, `schoolId`
- `departmentId`, `divisionId`, `cohortId`, `classId`

**Actual usage in `getStudyLibrarySubjects`** (lines 1211-1263):
- `sub.id`, `sub.guidId`, `sub.name`, `sub.title`, `sub.courseId`, `sub.programId`
- `coursesMap` keyed by `c.id` or `c.guidId`
- `programsMap` keyed by `p.id` or `p.guidId`
- `cleanSubjectDisplayName(sub.name ?? sub.title)`

### Programme ID Sources and Verification

| Program ID | Source | Confirmation |
|---|---|---|
| **6** | `getStudyLibraryFilters` default programs (line 1567) | ✅ `{ id: '6', name: 'LPN Nursing Exams', code: '34FB84C5' }` |
| **7** | `excludedProgramIds` (line 1238) | ✅ Excluded — NCLEX-PN |
| **8** | `excludedProgramIds` (line 1238) | ✅ Excluded — NCLEX-RN |
| **9** | `getStudyLibraryFilters` default programs (line 1566) | ✅ `{ id: '9', name: 'RN Nursing Exams', code: 'A7F47B58' }` |
| **13** | `excludedProgramIds` (line 1238) | ✅ Excluded — EDS/HESI |
| **3** | `excludedProgramIds` (line 1238) | ✅ Excluded — GED |
| **5** | `excludedProgramIds` (line 1238) | ✅ Excluded — TEAS/HESI |

**Unverified**: Program IDs not in `{3, 5, 6, 7, 8, 9, 13}`. The strata backend could return subjects with other program IDs. Without live API data, we cannot confirm the full set of program IDs.

### Course-to-Programme Resolution

**Current logic** (line 1244):
```typescript
const pId = Number(sub.programId ?? c?.programId ?? 0)
```

**How it works**:
1. First attempt: use `sub.programId` directly from the subject record
2. Fallback: if `sub.programId` is empty/falsy, use `c?.programId` from the associated course
3. Double-fallback: default to `0`

**Potential issue**: If a subject has no `programId` but has a `courseId`, the course's `programId` is used. This could incorrectly associate a subject with a programme if the course's programme mapping is wrong or outdated.

**Example from fallback data**:
- RN subjects have `programName: 'RN Nursing Exams'` and implicitly program ID 9
- PN-exclusive subject `subj-pn-care` has `programName: 'LPN Nursing Exams'` and implicitly program ID 6
- If a strata backend subject has `courseId` pointing to a course with `programId: 6` but `programId: 9` on the subject itself, the fallback logic (`sub.programId ?? c?.programId`) would use `9` (since `9` is truthy), which is correct. But if the subject had `programId: 0` or empty, it would fall through to the course's programme ID.

### Examination Counting Semantics

**`totalQuestions` computation** (lines 1405-1407):
```typescript
const relevantExams = rnExams.concat(pnExams);
totalQuestions = relevantExams.length > 0
  ? relevantExams.reduce((sum, e) => sum + Number(e.questionsCount ?? e.totalQuestions ?? 50), 0)
  : (totalExams * 50);
```

**Count type**: Questions per examination, summed across both RN and PN pathways.

**Default value**: `50` questions per exam if neither `questionsCount` nor `totalQuestions` is present on the examination record.

**`totalExams` computation** (lines 1398-1400):
```typescript
rnExamCount = rnExams.length;
pnExamCount = pnExams.length;
totalExams = rnExamCount + pnExamCount;
```

**Count type**: Number of examinations, not questions. `totalExams = rnExamCount + pnExamCount` is the sum of RN examination count + PN examination count.

**Default value**: `primarySub.unitsCount || 4` if no matching examinations are found (`totalExams === 0`).

**`rnExamCount`/`pnExamCount`**: Simply the length of the separately filtered `rnExams`/`pnExams` arrays. Each examination is classified independently by `classifyAuthoritativePathway`.

### Pagination and Caching

**Pagination** (lines 1194-1195):
- `pageNumber`: `Math.max(1, Number(params?.pageNumber ?? params?.page ?? 1) || 1)`
- `pageSize`: `Math.max(1, Math.min(100, Number(params?.pageSize ?? params?.perPage ?? 12) || 12))`

**Default page**: 1, default page size: 12 subjects per page.

**Caching**: No explicit caching mechanism in `getStudyLibrarySubjects`. The `fetchAllStrataExams()` method (called on line 1217) has its own in-memory cache with TTL of 5 minutes (api-client.ts:454-457), but `getStudyLibrarySubjects` does not cache its results.

**Implication for Stage 9 (Curriculum Isolation)**: If a learner's session caches `getStudyLibrarySubjects` results and later navigates to a different pathway, the cached subjects may not reflect the new pathway filtering. The URL `track` parameter and `reqPathway` filtering are applied on each API call, so URL-driven pathway changes should work correctly. But stale local state could cause issues.

### Subject-to-Examination Matching Logic

**Priority order** (lines 1342-1366):

1. **Course-based matching** (most reliable) (line 1351):
   ```typescript
   if (courseName && itemCourse.includes(courseName.toLowerCase())) {
     return true;
   }
   ```
   - Uses `courseName` from the merged subject (aggregated from all `rawItems`)
   - Matches against `itemCourse` (examination's lowercase course ID)
   - **Most reliable** because course-to-program mapping is more stable than subject naming

2. **Subject ID-based matching** using authoritative map (lines 1355-1359):
   ```typescript
   const primarySubId = String(primarySub.id ?? primarySub.guidId ?? '').trim().toLowerCase();
   if (primarySubId && (itemSub.includes(primarySubId) || itemTitle.includes(primarySubId))) {
     return true;
   }
   ```
   - Uses `primarySub.id` (first subject in the group's `rawItems`)
   - Matches examination's `subject` field or `title` against the primary subject's ID
   - **Reliability depends on**: Whether the strata backend consistently uses subject IDs that correspond across RN and PN programmes

3. **Cleaned subject name fallback** (lines 1361-1365):
   ```typescript
   const cleanSub = subjectName.replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').trim().toLowerCase();
   const subTokens = cleanSub.split(/\s+/).filter((t: string) => t.length > 2);
   return itemSub.includes(cleanSub) || text.includes(cleanSub) || (subTokens.length > 0 && subTokens.every((tok: string) => text.includes(tok)));
   ```
   - Uses `cleanSubjectDisplayName()` output
   - Direct match: `itemSub.includes(cleanSub)`
   - Text match: `text.includes(cleanSub)` (examination's subject + title + description + assessment name)
   - Token match: all cleaned tokens must appear in the examination text
   - **Least reliable** — subject names are the most variable field

**Matching reliability ranking**: Course-based > Subject ID-based > Cleaned name-based

### Programme Filtering in `getStudyLibrary` (Filters, not Subjects)

**Separate from** `getStudyLibrarySubjects`, the `getStudyLibrary` method (used for examination catalog, not subject catalogue) has its own programme filtering (lines 1487-1490):
```typescript
if (reqProgram && reqProgram !== 'all') {
  const pr = String(item.programName ?? item.programId ?? '').toLowerCase();
  if (pr !== reqProgram && !pr.includes(reqProgram)) return false;
}
```

**Key difference**: This filters examinations, not subjects. The `reqProgram` check is inclusive (`includes`), meaning a programme named "RN Nursing Exams" would match a request for "RN". This is consistent with the subject filtering logic.

### API Contract Gaps and Unresolved Questions

| Gap | Impact | Severity |
|---|---|---|
| **Cannot verify strata backend programme IDs** | Cannot confirm the full set of programme IDs that exist in the backend | HIGH — affects programme filtering completeness |
| **Course-to-programme fallback logic** (line 1244) | Could incorrectly associate subjects with programmes if course mapping is wrong | MEDIUM |
| **Subject ID consistency across RN/PN** | Whether the strata backend uses the same subject IDs for common subjects in both programmes | MEDIUM — affects subject ID-based matching reliability |
| **Pagination completeness** | `getStudyLibrarySubjects` only fetches page 1 by default in the code flow; `fetchAllStrataExams()` is separate | LOW — the method is designed to handle pagination via params |
| **No explicit RN/LPN programme validation** | The code filters OUT excluded programmes but does NOT actively filter IN only RN and LPN | MEDIUM — any programme ID not in the excluded set passes through |
| **Fallback subject representativeness** | Fallback data (10 subjects) used when strata returns empty; may not reflect actual backend data | HIGH — audit cannot verify completeness without live data |
| **Programme name aggregation** (line 1337) | `programName = programNames.join(' / ') || null` combines all programme names | LOW — intended behavior for merged cards, but could confuse if one programme dominates |

### Backend Contract Verification Status

| Contract Element | Status | Evidence |
|---|---|---|
| Subject records have `programId` field | ✅ Partially verified | Fallback subjects have `programName`; code uses `sub.programId` |
| Examination records have `subject` field | ✅ Verified | `itemSub = String(ex.subject ?? ex.subjectName ?? '')` on line 1343 |
| Examination records have `courseId` field | ✅ Verified | `itemCourse = String(ex.courseId ?? '')` on line 1347 |
| `classifyAuthoritativePathway` provides 4-way classification | ✅ Verified | Test suite passes (test 1) |
| `excludedProgramIds = [7, 8, 3, 5, 13]` filters 5 programmes | ✅ Verified | Code inspection; test suites confirm NCLEX/GED/TEAS/HESI exclusion |
| `cleanSubjectDisplayName` normalizes names consistently | ✅ Verified | Test assertions in `learner-unified-catalog-and-modes.test.mjs` |
| `authoritativeSubjectMap` first-wins strategy | ✅ Verified | Code inspection; deterministic mapping |
| `SubjectCardDto` exposes `programName` as aggregated string | ✅ Verified | DTO inspection (api-types.ts:630-631) |
| `availablePathways` indicates RN/PN coverage | ✅ Verified | Code inspection and test suite |
| `rnExamCount`/`pnExamCount` are separate counts | ✅ Verified | Code inspection (lines 1398-1399) |
| `totalExams = rnExamCount + pnExamCount` | ✅ Verified | Code inspection (line 1400) |

### Summary

The backend API contracts are **largely consistent and well-defined**, with the following gaps that affect the revised audit requirements:

1. **Inability to verify full programme ID set** from the strata backend — the code assumes programme IDs 3, 5, 6, 7, 8, 9, 13 are the only ones, but this cannot be confirmed without live data.

2. **Course-to-programme fallback logic** (line 1244) could misattribute subjects if the strata backend's course-to-programme mappings differ from expectations.

3. **No explicit RN/LPN-only filtering** — the code excludes 5 programmes but does not actively retain only 2. Any programme ID outside the excluded set (including unknown IDs) would pass through.

4. **Fallback data representativeness** — the 10-subject fallback may not reflect the actual backend curriculum; the audit cannot claim complete verification based on fallback data alone.

**Recommendation**: If possible, query the strata backend to confirm the full set of programme IDs and subject records. If not possible, add explicit RN/LPN programme validation in the frontend pipeline to complement the existing exclusion filter.
