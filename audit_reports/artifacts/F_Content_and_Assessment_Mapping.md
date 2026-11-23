# F. Content and Assessment Mapping

## Learning Content Classification

This artifact maps how study resources, questions, quizzes and assessments are classified and retrieved across the RN/PN curriculum boundary.

### 1. Study Resource Categories

The following resource types exist in the system, and their classification was inspected:

| Resource Type | Location | Classification Rule | Status |
|---|---|---|---|
| **Study Sets** (examination practice sets) | `getStudyLibrary` API (api-client.ts:1014-1188) | Classified by `classifyAuthoritativePathway` → pathway (RN/PN_LPN/RN_Exit/PN_Exit); category (ATI/HESI/RegularCourse/Certification/ExitPredictor) | VERIFIED |
| **Subject Cards** (curriculum catalogue) | `getStudyLibrarySubjects` API (api-client.ts:1191-1533) | Unified by cleaned display name; `availablePathways` indicates RN/PN coverage; `pathway` indicates primary pathway | VERIFIED |
| **Questions** (question bank) | `getQuestions` API (api-client.ts:663-690) | Each QuestionDto has explicit `pathway: NursingPathway` field; classification by `classifyAuthoritativePathway` | VERIFIED |
| **Exams** (practice examinations) | `getExams` API (api-client.ts:724-800) | Each ExamDto has explicit `pathway: NursingPathway`; filtered by `classifyAuthoritativePathway` | VERIFIED |
| **Lectures** (learning materials) | `/api/lectures` (api-client.ts:958-959) | No pathway classification; access level: 'Public' | N/A (not RN/PN specific) |
| **Study Guides** | `src/app/study-guide/` routes | No explicit pathway; likely programme-agnostic | NOT INSPECTED (beyond scope) |
| **Flashcards** | Community/learning resources | No explicit RN/PN classification in DTO | NOT INSPECTED |
| **Care Plans** | Community/learning resources | No explicit RN/PN classification in DTO | NOT INSPECTED |

### 2. Question-Bank and Examination Classification

Each examination record in the strata backend carries explicit pathway classification. The `classifyAuthoritativePathway` function (api-client.ts:191-278) is the authoritative classifier:

**4-Pathway Boundary Enforcement**:

| Pathway | Identification Logic |
|---|---|
| **RN** | `/\brn\b|registered\s*nurse/i.test(haystack)` || `progId === 9` || `/rn\b/i.test(progName) || /rn\b/i.test(courseName)` (if not PN or Exit) |
| **PN_LPN** | `/\b(pn|lpn|practical)\b/i.test(haystack)` || `assId === 5 || progId === 6` || `/lpn\b/i.test(progName) || /lpn\b/i.test(courseName)` (if not Exit) |
| **RN_Exit** | `/exit|predictor|capstone/i.test(haystack)` || `assId === 10` | Always RN_Exit if exit pattern detected (PN takes precedence only if !isRN) |
| **PN_Exit** | `/exit|predictor|capstone/i.test(haystack)` && `isPN && !isRN` || `assId === 10` && PN pattern | PN_Exit only if PN and not RN |

**Critical integrity finding**:

> **Common subjects do NOT accidentally combine RN and PN question pools.**

The `matchingExams` computation in `getStudyLibrarySubjects` (api-client.ts:1342-1366) first identifies which examinations belong to the subject group (by course, subject name, or ID matching), then separately filters:

```typescript
const rnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'RN');
const pnExams = matchingExams.filter((e) => classifyAuthoritativePathway(e).pathway === 'PN_LPN');
```

Each examination is classified independently via `classifyAuthoritativePathway`. The RN and PN counts are derived from **separate filters** on the same matching exam set. This means:

- If a unified "Medical-Surgical Nursing" subject has 35 RN exams and 27 PN exams, those are the actual counts of examinations classified as RN vs PN in the strata backend.
- The question pools are not merged; each examination retains its own pathway classification.
- Rationales and performance analytics are also pathway-tagged (via `ExamAttemptSummaryDto.pathway`).

### 3. Common Subject Identity Coexistence with Different Content

The audit assessed whether common subject identity can coexist with different:

| Content Dimension | RN Variant | PN Variant | Coexistence Status |
|---|---|---|---|
| **Learning objectives** | Not directly accessible without live data | Not directly accessible | **POTENTIALLY DIFFERENT** - Objectives may vary by programme; the unified card shows combined examination counts but does not display objectives separately per pathway |
| **Content depth** | Med-Surg: "Advanced" difficulty | Med-Surg: "Advanced" difficulty (same fallback) | **SAME** - Both share the same difficulty rating from the primary subject record |
| **Clinical responsibilities** | Not displayed on subject card | Not displayed on subject card | **NOT SEPARATED** - No pathway-specific clinical responsibility labeling |
| **Question difficulty** | Per-exam difficulty levels (Foundational/Intermediate/Advanced) | Per-exam difficulty levels | **PRESERVED** - Each exam retains its own difficulty; combined `totalQuestions` is sum of both pathways |
| **Assessment blueprints** | Not inspected at topic level | Not inspected at topic level | **NOT VERIFIED** - Blueprint subject distribution JSON not accessible without live data |
| **Question difficulty and eligibility** | `classifyAuthoritativePathway` ensures RN eligibility | `classifyAuthoritativePathway` ensures PN_LPN eligibility | **PRESERVED** - Separate classification per examination |
| **Assessment blueprints** | See above | See above | **NOT VERIFIED** |
| **Rationales** | Per-question rationales in review mode | Per-question rationales in review mode | **PRESERVED** - Each question has its own rationale; not merged across pathways |
| **Performance analytics** | `ExamAttemptSummaryDto` tagged with pathway | `ExamAttemptSummaryDto` tagged with pathway | **PRESERVED** - Progress tagged per attempt's pathway |

### 4. Learner Progress Association

**How learner progress remains correctly associated with the learner's actual programme and curriculum version:**

| Progress Element | Pathway Association | Verification |
|---|---|---|
| **Attempt ID** | Unique per attempt; no inherent pathway | VERIFIED |
| **Exam ID** | Carries explicit `pathway` field from `ExamDto` | VERIFIED |
| **Subject name** | Stored as `subjectName?: string` on `ExamAttemptSummaryDto` | VERIFIED |
| **Pathway field** | `ExamAttemptSummaryDto.pathway?: NursingPathway | string` | VERIFIED - Each summary carries the pathway of the attempt |
| **Score percentage** | Calculated per-attempt; no pathway aggregation | VERIFIED |
| **Time spent** | Per-attempt; no aggregation across pathways | VERIFIED |

**Key mechanism**: When a learner starts an attempt via `startAttempt(examId, options)`, the `examId` carries the pathway classification. The attempt summary subsequently records the pathway. When progress is displayed (dashboards, learner workspace), it is filtered/facetted by the learner's authenticated pathway (from `UserProfileDto.pathway`).

**Potential gap**: If a learner switches pathways for a common subject (via the SubjectCard dropdown), their existing progress tagged with the original pathway is not lost, but new attempts would be tagged with the newly selected pathway. There is no mechanism to re-tag historical progress.

### 5. Summary of Content Integrity

| Integrity Dimension | Status | Evidence |
|---|---|---|
| **No RN/PN question pool merging** | VERIFIED | `classifyAuthoritativePathway` separates exams; `rnExams`/`pnExams` computed separately |
| **Per-exam difficulty preserved** | VERIFIED | Each exam retains its own difficulty level; combined `totalQuestions` sums both pathways |
| **Rationales pathway-independent** | VERIFIED | Each question has its own rationale; not merged across pathways |
| **Performance analytics tagged** | VERIFIED | `ExamAttemptSummaryDto.pathway` preserves association |
| **Assessment blueprints** | UNVERIFIED | `subjectDistributionJson` not inspected without live data |
| **Learning objectives separated** | UNVERIFIED | Not displayed on subject card; would require live data inspection |
| **Clinical responsibilities separated** | UNVERIFIED | Not displayed on subject card; would require curriculum review |
| **Content depth consistency** | PARTIALLY VERIFIED | Difficulty ratings are shared from primary subject record; may not reflect pathway-specific depth |

### 6. Key Finding

**The system correctly prevents RN and PN question pools from being accidentally combined.** The `classifyAuthoritativePathway` function provides strict 4-way classification, and all content retrieval paths (`getStudyLibrary`, `getExams`, `getQuestions`) apply this classification consistently. Each examination, question, and attempt retains its individual pathway identity.

However, **learners on a unified subject card see combined totals** (`totalExams = rnExamCount + pnExamCount`, `totalQuestions = sum of both pathways`). This is intentional UI design - the learner can see the full scope of the subject across both programmes, but can filter to their specific pathway via the dropdown. The integrity is maintained because the backend independently filters by pathway, and the frontend merely displays the combined scope with pathway-specific navigation.

### 7. Outstanding Uncertainties

| Uncertainty | Impact | Recommended Investigation |
|---|---|---|
| Learning objectives per pathway | High | Inspect strata backend `subjects` records for `objectives` field; compare RN vs PN variants |
| Assessment blueprint subject distribution | Medium | Query `/api/castoline/strata/assessment/exams/list/absolute` for exam records with `subjectDistributionJson` |
| Clinical responsibility labeling | Medium | Review nursing curriculum documentation for RN vs PN clinical responsibility differences |
| Study guide pathway classification | Low | Inspect `src/app/study-guide/` routes and contents |
| Lecture pathway access control | Low | Verify `/api/lectures` access levels and whether RN/PN distinctions exist |
