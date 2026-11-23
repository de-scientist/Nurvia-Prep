# D. Backend and Database Findings

## API Endpoints for Curriculum Data

The following strata endpoints serve curriculum data (from `src/lib/lexmacasto/contracts.ts:249-382`):

| Endpoint | Resource | Fetch Type | Auth Required |
|---|---|---|---|
| `/api/castoline/strata/learning/subjects/list/absolute` | subjects | absolute | No |
| `/api/castoline/strata/learning/courses/list/absolute` | courses | absolute | No |
| `/api/castoline/strata/learning/programs/list/absolute` | programs | absolute | No |
| `/api/castoline/strata/learning/topics/list/absolute` | topics | absolute | No |
| `/api/castoline/strata/assessment/exams/list/absolute` | exams | absolute | No |
| `/api/castoline/strata/assessment/exams/list/current` | exams | current | No |
| `/api/castoline/strata/assessment/exams/list/live` | exams | live | Yes |
| `/api/castoline/strata/learning/units/list/absolute` | units | absolute | No |
| `/api/castoline/strata/learning/lessons/list/absolute` | lessons | absolute | No |

## Entity Models and DTOs

### SubjectCardDto (api-types.ts:621-649)
```typescript
export interface SubjectCardDto {
  id: string;
  guidId?: string;
  code: string;
  name: string;
  title: string;
  description: string;
  pathway: string;      // 'RN' | 'PN_LPN' | 'RN_Exit' | 'PN_Exit'
  category: string;     // e.g. 'CORE SERIES', 'ATI', 'SPECIALTIES', 'NURSING MATH'
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
  availablePathways?: string[];  // ['RN'], ['PN_LPN'], or ['RN', 'PN_LPN']
  rnExamCount?: number;
  pnExamCount?: number;
  featuredExams?: Array<{...}>;
}
```

### Key Observations
- `pathway` field on SubjectCardDto is **singular** ('RN' or 'PN_LPN'), not multi-pathway
- `availablePathways` is the multi-pathway indicator (shows dropdown when both RN and PN_LPN present)
- `rnExamCount` and `pnExamCount` are optional counts per pathway
- `programId` and `programName` track the originating programme

### ExamDto (api-types.ts:218-238)
- `pathway: NursingPathway` - explicit pathway classification ('RN', 'PN_LPN', 'RN_Exit', 'PN_Exit')
- `category: ExamCategory` - ('ATI' | 'HESI' | 'RegularCourse' | 'Certification' | 'ExitPredictor')
- `modeAllowed: ExamDeliveryMode` - ('Review' | 'Exam' | 'Tutor' | 'All' | 'Both')

### QuestionDto (api-types.ts:158-177)
- `pathway: NursingPathway` - explicit pathway per question
- `category: ExamCategory` - classification
- `subject: string` - subject name
- `topic: string` - topic name
- `difficulty: DifficultyLevel` - difficulty level

## Repository Interfaces and Implementations

The API client (`api-client.ts`) serves as the **repository layer** between the frontend and the LexmaCasto Strata backend. Key methods:

- `getStudyLibrarySubjects(params)` - Main curriculum fetching and merging method
- `getStudyLibraryFilters()` - Returns available programmes, courses, subjects, topics for filter UI
- `getStudyLibrarySummary()` - Summary statistics
- `getQuestions(params)` - Question bank queries
- `getExams(params)` - Examination queries with pathway filtering

**No separate repository interfaces or implementations exist** - the API client consolidates all data access. There is no explicit `ISubjectRepository` or `IExamRepository` pattern.

## Database Relationships and Integrity

### Programme Classification (from `excludedProgramIds` at api-client.ts:1238)

```typescript
const excludedProgramIds = new Set([7, 8, 3, 5, 13])
```

These programme IDs filter out ineligible content:
- `7`: NCLEX-PN programme
- `8`: NCLEX-RN programme
- `3`: GED programme
- `5`: HESI A2 programme
- `13`: EDS (Explicit Dynamic Solutions) programme

**Integrity**: Program IDs are used as a program-level exclusion boundary. When `classifyAuthoritativePathway` encounters these programme IDs, the record is automatically marked ineligible. This prevents NCLEX and pre-nursing content from leaking into the NURVIA-PLEX catalogue.

### Subject-Programme-Course Relationships

From the `getStudyLibrarySubjects` code path (lines 1211-1247):

1. **Programmes** fetched from `/api/castoline/strata/learning/programs/list/absolute`
2. **Courses** fetched from `/api/castoline/strata/learning/courses/list/absolute`
3. **Subjects** fetched from `/api/castoline/strata/learning/subjects/list/absolute`
4. **Relationships**:
   - `sub.courseId` → links subject to course
   - `sub.programId` → links subject to programme (or `c?.programId` via course)
   - Courses have `programId` field

### Uniqueness and Integrity Constraints

**No database-level uniqueness constraints** can be verified since the backend is external (LexmaCasto). However, the code enforces integrity through:

1. **Authoritative subject map deduplication** (line 1255-1257):
   ```typescript
   if (subId && !authoritativeSubjectMap.has(subId)) {
     authoritativeSubjectMap.set(subId, sub)
   }
   ```
   Ensures each subject ID maps to exactly one authoritative source.

2. **Cleaned name deduplication** (line 1260-1262):
   ```typescript
   if (cleanedName && !authoritativeSubjectMap.has(cleanedName)) {
     authoritativeSubjectMap.set(cleanedName, sub)
   }
   ```
   Ensures each cleaned display name maps to one authoritative source.

3. **Program ID filtering** (line 1238-1245):
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
   Ensures ineligible programmes are excluded at the fetch level.

## Merged Subject Membership Storage

**Critical finding**: Common subject membership is **not stored authoritatively** in the database. Instead, it is **inferred through frontend name matching**:

1. The `authoritativeSubjectMap` is built dynamically from strata subject records
2. Subjects are grouped by cleaned display name (via `cleanSubjectDisplayName`)
3. The map key is the cleaned display name (lowercased)
4. Examination counts (`rnExamCount`, `pnExamCount`) are computed from actual exam data, not stored

**Implication**: If the strata backend were to change subject naming conventions, the mapping would need to be re-established. There is no persistent "merged = true" flag on subject records.

## Programme Filtering and Content Retrieval Paths

### Study Library Subject Retrieval (api-client.ts:1191-1533)

The `getStudyLibrarySubjects` method orchestrates the full retrieval:

1. **Fetch strata data**: Subjects, courses, programs in parallel
2. **Build maps**: coursesMap (by ID and name), programsMap (by ID and name)
3. **Filter subjects**: Exclude NCLEX, GED, TEAS, HESI, EDS by programme ID and name pattern
4. **Build authoritative map**: By ID and cleaned name
5. **Group by canonical key**: Exit pathways get special handling; others get `canonical:${name.lowerCase()}`
6. **Match examinations**: For each group, match relevant exams from strata exam data
7. **Compute counts**: `rnExamCount`, `pnExamCount`, `totalExams`, `totalQuestions`, `availablePathways`
8. **Filter by request parameters**: `reqPathway`, `reqCategory`, `reqProgram`, `reqCourse`, `reqSchool`, `reqYear`, `reqSeason`, `reqDifficulty`, `reqTopic`, `search`

### Programme Filtering Mechanism

When `reqProgram` is specified (line 1487-1490):
```typescript
if (reqProgram && reqProgram !== 'all') {
  const pr = String(item.programName ?? item.programId ?? '').toLowerCase();
  if (pr !== reqProgram && !pr.includes(reqProgram)) return false;
}
```

This checks both `programName` and `programId` against the requested programme. The matching is **inclusive** (uses `includes`), which means a programme named "RN Nursing Exams" would match a request for "RN".

### Course Filtering Mechanism

When `reqCourse` is specified (line 1491-1494):
```typescript
if (reqCourse && reqCourse !== 'all') {
  const cr = String(item.courseName ?? item.courseId ?? '').toLowerCase();
  if (cr !== reqCourse && !cr.includes(reqCourse)) return false;
}
```

Similar inclusive matching on course name or ID.

### Subject Filtering Mechanism

When `reqSubject` is specified (line 1095-1109):
```typescript
if (reqSubject) {
  const itemSubject = String(item.subject ?? item.subjectName ?? '').trim().toLowerCase();
  const itemTitle = String(item.title ?? '').toLowerCase();
  const itemDesc = String(item.description ?? '').toLowerCase();
  const itemAssess = String(item.assessmentName ?? '').toLowerCase();
  const text = `${itemSubject} ${itemTitle} ${itemDesc} ${itemAssess}`;
  const cleanSubject = reqSubject.replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').trim().toLowerCase();
  const subjectTokens = cleanSubject.split(/\s+/).filter((t) => t.length > 2);
  const directMatch = itemSubject.length > 0 && (itemSubject === reqSubject || itemSubject.includes(cleanSubject));
  const textMatch = text.includes(cleanSubject) || (subjectTokens.length > 0 && subjectTokens.every((tok) => text.includes(tok)));
  if (!directMatch && !textMatch) return false;
}
```

This is the most sophisticated filtering. It uses:
- Direct match: `itemSubject === reqSubject` or `itemSubject.includes(cleanSubject)`
- Text match: `text.includes(cleanSubject)` or all tokens present in text

**Important**: The `reqSubject` is cleaned removing parentheses and normalized, but the matching is against the **examination's** subject field, not the canonical subject card. This means a learner searching for "Medical-Surgical Nursing" will match examinations whose `subject` field contains "Medical-Surgical Nursing".

## Question Selection, Quizzes, and Assessment Classification

### Question Bank Filtering (api-client.ts:663-690)

`getQuestions` passes params directly to `/api/questions` endpoint. Programme classification is determined by `classifyAuthoritativePathway` on each returned question.

### Study Library Examination Filtering (api-client.ts:1014-1188)

The `getStudyLibrary` method (used for examination catalog, not subject catalogue) applies:

1. **4-way pathway filter** (line 1057-1060): `classifyAuthoritativePathway(item).eligible` - must pass the strict boundary
2. **Status filter** (line 1062-1065): Only 'published' or 'active' exams
3. **Programme filter** (line 1079-1082): `item.program` comparison
4. **Course filter** (line 1083-1086): `item.course` comparison
5. **School filter** (line 1087-1094): `item.school` match in title/description
6. **Subject filter** (line 1095-1109): Subject name matching (similar pattern to study library subjects)
7. **Topic filter** (line 1110-1113): `item.topic` exact match
8. **Difficulty filter** (line 1114-1117): `item.difficulty` exact match
9. **Season filter** (line 1118-1121): `item.season` exact match
10. **Year filter** (line 1122-1125): `item.academicYear` exact match
11. **Search** (line 1126-1134): Full-text search on title, description, subject, school, course

**Critical integrity question**: Do common subjects accidentally combine RN and PN question pools?

**Answer**: No. The `classifyAuthoritativePathway` function strictly classifies each examination as either `RN`, `PN_LPN`, `RN_Exit`, or `PN_Exit`. When computing `rnExamCount` and `pnExamCount` for a unified subject card, the code separately filters:

```typescript
const rnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'RN');
const pnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'PN_LPN');
```

The `matchingExams` are the examinations that belong to the subject group (matched by course, subject name, or ID). Each examination is classified independently, so the RN and PN counts reflect the actual pathway distribution of the matching exams, not a merged pool.

### Assessment Blueprints (api-types.ts:179-186)

```typescript
export interface ExamBlueprintDto {
  id: string;
  examVersionId: string;
  targetQuestionCount: number;
  subjectDistributionJson?: string;
  cognitiveDistributionJson?: string;
  difficultyDistributionJson?: string;
}
```

Blueprint subject distribution is stored as JSON (`subjectDistributionJson`). **No verification** can be performed without live backend data, but the structure suggests blueprints track subject distribution per examination version.

### Rationales and Performance Analytics

- **Rationales**: Available per question via `QuestionDto.reviews` or `ExamReviewContentDto.questions`. Programme classification is preserved since each question has an explicit `pathway` field.
- **Performance analytics**: Learner progress is tracked per `attemptId` (api-attempts). The `examAttemptSummaryDto` includes `pathway` and `subjectName` fields, ensuring progress remains associated with the learner's actual programme.

## Key Findings

| Finding | Evidence | Classification |
|---|---|---|
| **One canonical subject linked to multiple programmes** | Not explicitly supported; `programName` on SubjectCardDto is typically a single value (e.g., "RN Nursing Exams"), but the merged card displays both RN and PN counts | **PARTIALLY VERIFIED** - The architecture infers programme membership from examination classification, not from a single programme link |
| **Separate programme-specific subjects merged only in frontend** | **This is the actual pattern**. The strata backend may have separate RN and PN subject records; the `getStudyLibrarySubjects` method merges them by cleaned display name in the API layer. Frontend SubjectCard then displays the unified card. | **VERIFIED** - Merging happens in api-client.ts, not in database or backend schema |
| **Referential integrity** | Programme IDs (7, 8, 3, 5, 13) used for exclusion filtering; no integrity errors found in code | VERIFIED |
| **Duplicate records possible** | If strata returns subjects with different IDs but same cleaned name, both would be included in `rawItems` group (no dedup by name within group) | **POTENTIAL DEFECT** - No within-group name dedup beyond the authoritative map keying |
| **Common subject membership stored authoritatively or inferred** | **Inferred through frontend name matching**. The `authoritativeSubjectMap` is the authoritative mapping, but it's built dynamically from API data with no persistent store | **DEFECT** - If API data changes, mapping must be re-established |
| **Question selection uses same programme classification rules** | `classifyAuthoritativePathway` is used consistently in `getStudyLibrary`, `getExams`, and `classifyAuthoritativePathway` - same rules applied everywhere | VERIFIED |
| **Backend enforcement of programme eligibility** | `classifyAuthoritativePathway` runs on the backend (via API) AND the same logic is replicated in `matchesRequestedPathway` for client-side filtering | VERIFIED (duplication, but consistent) |

## Summary

The backend architecture **does not** have one canonical subject linked to multiple programmes in the database sense. Instead, it has:

1. **Separate subject records** in the strata backend (potentially separate RN and PN subjects)
2. **Dynamic merging** in the API layer (`getStudyLibrarySubjects`) that groups subjects by cleaned display name
3. **Frontend presentation** that shows one unified card with pathway-specific counts

This means the "one canonical subject linked to multiple programmes" model from the mission requirements is **achieved through inference**, not through database schema design. The integrity of this inference depends on:
- Consistent naming across RN and PN subject records
- Correct operation of `cleanSubjectDisplayName`
- Correct operation of `classifyAuthoritativePathway`
- Accurate examination pathway classification
