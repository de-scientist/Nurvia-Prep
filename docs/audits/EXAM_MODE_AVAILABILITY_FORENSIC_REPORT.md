# NURVIA-PREP — EXAM MODE AVAILABILITY FORENSIC INVESTIGATION REPORT

**Document ID:** `EXAM_MODE_AVAILABILITY_FORENSIC_REPORT`  
**Date:** November 18, 2026  
**Status:** Remediated & Verified  
**Governing Directive:** ADD. INTEGRATE. ENHANCE. NEVER DEDUCT.  

---

## 1. EXECUTIVE SUMMARY

An examination availability investigation was conducted on the Nurvia-Prep platform following reports that all examination modes were disabled and displayed as **"Unavailable"** for published examinations in the learner library, accompanied by the literal notice:

> *"Available modes are governed by the published exam configuration."*

Specifically, for examination ID `f008abec-5664-4d7d-aa6b-4bc12282c26e`:
- **Title:** `Examplify NUR 4334 Childbearing Family MidTerm DABSN Fall 26 Version-1`
- **Questions:** 13
- **Duration:** 250 minutes
- **Year:** 2026
- **Rating:** 98
- **URL:** `http://localhost:3000/learner/library/f008abec-5664-4d7d-aa6b-4bc12282c26e`

The forensic analysis confirmed that the examination was published, active, and contained 13 valid NCLEX-style questions on the authoritative remote backend (`https://explicitbackend.com` / `http://108.61.9.189:8008`). However, a frontend DTO mismatch and rigid boolean evaluation logic caused all three delivery modes (`Exam`, `Review`, `Tutor`) to evaluate to `false`, rendering the examination completely unlaunchable in the UI.

The root cause has been remediated at the client and component layers while strictly preserving the remote backend's authoritative publication policies.

---

## 2. LITERAL NOTICE ORIGIN & COMPONENT IDENTIFICATION

| Attribute | Forensic Value |
|---|---|
| **Literal Notice Text** | `"Available modes are governed by the published exam configuration."` |
| **Source File** | `src/components/study/StudySetCardActions.tsx` (Line 102) & `src/components/study/StudySetDetails.tsx` (Line 188) |
| **Rendering Components** | `<StudySetCardActions />` and `<StudySetDetails />` |
| **Availability Evaluation Function** | `isModeEnabled(modeAllowed, target)` |
| **Governing Property** | `studySet.modeAllowed` |
| **Three Actual Mode Identifiers** | `"Exam"`, `"Review"`, `"Tutor"` (canonical source casing) |

### Discovered Mode Identifiers in Codebase:
1. **`Exam`**: Timed or untimed summative examination session without real-time rationales.
2. **`Review`**: Post-exam or self-study review session displaying correct answers and verified rationales.
3. **`Tutor`**: Formative practice mode providing immediate rationale feedback after each question.

---

## 3. COMPLETE EXAMINATION DATA FLOW TRACE

The forensic investigation traced the lifecycle of examination data from remote persistence to the learner's interactive UI:

```text
[Remote Strata Backend: 108.61.9.189:8008 / explicitbackend.com]
        |
        | GET /api/castoline/strata/assessment/exams/list/absolute?fetchtype=absolute
        v
[Raw Remote JSON Record (Exam ID 2101 / GUID f008abec...)]
  {
    "id": 2101,
    "guidId": "f008abec-5664-4d7d-aa6b-4bc12282c26e",
    "title": "Examplify NUR 4334 Childbearing Family MidTerm DABSN Fall 26 Version-1",
    "tag": "Exam",
    "type": "Examination",
    "status": "Active",
    "questionsCount": 13,
    "duration": 250,
    "year": 2026,
    "rating": 98,
    "allowReview": false,
    "isTimed": false
    // NOTE: 'modeAllowed' property is completely ABSENT from remote response!
  }
        |
        v
[Frontend API Client: src/lib/api-client.ts]
  - Defect 1: getExams and getStudyLibrary defaulted missing modeAllowed to 'Both'.
  - Defect 2: getStudySetDetail had an early mock bailout returning unprovisionedResponse.
        |
        v
[Card / Details Components: StudySetCardActions.tsx & StudySetDetails.tsx]
  - Defect 3: Evaluation check was:
      isModeEnabled = (modeAllowed === 'All' || modeAllowed === target)
  - When modeAllowed was 'Both':
      canExam   = ('Both' === 'All' || 'Both' === 'Exam')   => FALSE
      canReview = ('Both' === 'All' || 'Both' === 'Review') => FALSE
      canTutor  = ('Both' === 'All' || 'Both' === 'Tutor')  => FALSE
        |
        v
[Rendered UI]
  - All 3 buttons rendered disabled with label: "Unavailable"
  - Explanatory footnote rendered: "Available modes are governed by the published exam configuration."
```

---

## 4. FORENSIC EVIDENCE TABLE FOR EXAM `f008abec-5664-4d7d-aa6b-4bc12282c26e`

| Investigation Field | Authoritative Remote Backend Evidence |
|---|---|
| **Exam ID / Database ID** | `2101` |
| **GUID ID** | `f008abec-5664-4d7d-aa6b-4bc12282c26e` |
| **Title** | `Examplify NUR 4334 Childbearing Family MidTerm DABSN Fall 26 Version-1` |
| **Remote Publication Status** | `Active` |
| **Tag** | `"Exam"` |
| **Type** | `"Examination"` |
| **Question Count** | `13` (Confirmed 13 NCLEX question records via Strata questions endpoint) |
| **Duration** | `250` minutes |
| **Review Release Policy** | `allowReview: false` (Authoritative backend setting) |
| **Is Timed** | `false` |
| **Remote `modeAllowed` Field** | **Missing / Undefined** in remote Strata DTO |
| **Previous Frontend Mapped Value** | `'Both'` (due to naive fallback) |
| **Previous Availability Decision** | `canExam = false`, `canReview = false`, `canTutor = false` |
| **Root Cause of Defect** | The value `'Both'` was not handled in `StudySetCardActions` and `StudySetDetails`. Furthermore, `inferExamDeliveryMode` was not inspecting `tag` and `allowReview`. |

---

## 5. INDEPENDENT MODE INSPECTION MATRIX

| Mode Identifier | UI Display Name | Authoritative Backend Config | Actual Backend Value | Remediated Frontend Value | Availability Decision | Launch Behavior & Endpoint | Status |
|---|---|---|---|---|---|---|---|
| **`Exam`** | `Exam` | `tag: "Exam"`, `status: "Active"` | `"Exam"` | `'Exam'` | **Enabled (`true`)** | Launches exam session via `/api/castoline/strata/assessment/attempt/start/absolute` | **AVAILABLE** |
| **`Review`** | `Review` | `allowReview` | `false` | Disabled (`false`) | **Disabled (`false`)** | Blocked server-side (`REVIEW_NOT_PERMITTED` 403) adhering to backend policy | **RESTRICTED BY CONFIG** |
| **`Tutor`** | `Tutor` | `tag` / `type` | `"Exam"` / `"Examination"` | Disabled (`false`) | **Disabled (`false`)** | Formative hints disabled for summative midterm examination | **RESTRICTED BY CONFIG** |

---

## 6. REMEDIATION IMPLEMENTED

1. **DTO Type Expansion (`src/lib/api-types.ts`):**
   - Added `'Both'` to the `ExamDeliveryMode` union (`'Review' | 'Exam' | 'Tutor' | 'All' | 'Both'`).
2. **Semantic Mode Inference (`src/lib/api-client.ts`):**
   - Implemented `inferExamDeliveryMode(item)`:
     - If `tag === 'Tutor'` -> `'Tutor'`
     - If `tag === 'Review'` -> `'Review'`
     - If `allowReview === true` -> `'Both'`
     - Default for active summative exams -> `'Exam'`
3. **Resilient Mode Availability Evaluation (`src/components/study/StudySetCardActions.tsx` & `StudySetDetails.tsx`):**
   - Updated `isModeEnabled(modeAllowed, target)`:
     ```typescript
     export function isModeEnabled(modeAllowed, target): boolean {
       if (!modeAllowed) return false;
       const normalized = String(modeAllowed).trim().toLowerCase();
       if (normalized === "all") return true;
       if (normalized === "both") {
         return target === "Exam" || target === "Review";
       }
       return normalized === target.toLowerCase();
     }
     ```
4. **Strata Integration in `getStudySetDetail` (`src/lib/api-client.ts`):**
   - Added fallback to remote Strata API (`/api/castoline/strata/assessment/exams/list/absolute?fetchtype=absolute`) when local exam route does not match, eliminating `unprovisionedResponse` crashes.
5. **Preservation of Authoritative Restriction Policies:**
   - Because the remote record explicitly specifies `allowReview: false`, `Review` mode is truthfully presented as restricted by published configuration. We did NOT fabricate fake review release.

---

## 7. VERIFICATION & TEST CONFIRMATION

- **Unit & Regression Test:** `tests/exam-mode-availability.test.mjs` (4/4 test suites passed).
- **Exam Launch Endpoint Consistency:** Launching `Exam` mode correctly triggers attempt initialization with valid learner credentials and question bank mapping.
- **Type Checking:** `npx tsc --noEmit` exited with code 0 (zero errors).
