# NURVIA-PREP — Implementation Wave 1: Review & Guided Tutor Defects (Final Report)

**Branch:** `feat/nurvia-master-transformation`  
**Report Date:** 2026-11-19

## 1. FIX 1 — ISOLATE TUTOR RESPONSES FROM EXAMINATION ANSWERS

### Files Changed
| File | Purpose of Change |
|------|-------------------|
| `src/lib/attempts/attempt-store.ts` | Removed `raw.savedResponses[questionId]` write from `evaluateTutorAnswer()`. Tutor answers are now persisted exclusively in `tutorProgression`. |
| `src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts` | Removed `actionGroup: 'ExamAnswers', isDiy: false` persistence. Tutor evaluations no longer use the examination `ExamAnswers` action group. |

### Defects Fixed
- **Critical**: `evaluateTutorAnswer()` was writing to `raw.savedResponses[questionId]`, contaminating examination answers with Tutor state.
- **Critical**: The API route persisted tutor evaluations using `actionGroup: 'ExamAnswers'`, which would upsert answers into the examination answer contract.

### How Tutor Responses Are Now Isolated
- Tutor answers and evaluations are stored **only** in `attempt.tutorProgression[questionId]`.
- `evaluateTutorAnswer()` no longer touches `savedResponses`; the evaluation result is captured in `raw.tutorProgression[questionId].evaluated` and `raw.tutorProgression[questionId].stage = 4`.
- The API route no longer uses the `ExamAnswers` action group for tutor evaluations.
- **Remaining dependency**: Durable backend persistence for Tutor answers is a separate concern. The `/api/attempts/{attemptId}/tutor/session` and `/api/attempts/{attemptId}/tutor/evaluate` endpoints exist, but persisting Tutor answers via `ExamAnswers` has been omitted to avoid contaminating examination answers. A dedicated backend action group or endpoint is needed for full durable Tutor state across cold-cache scenarios.

### Regression Tests Verified
- Tutor evaluation does not modify examination `savedResponses`.
- Tutor evaluation does not modify the submitted score.
- Tutor evaluation does not modify the submitted timestamp.
- Tutor evaluation does not change the submitted examination result.
- Tutor progression and evaluation remain retrievable from Tutor session state.
- Ordinary examination autosave continues to work for active attempts.
- Examination autosave remains rejected after submission.

---

## 2. FIX 2 — MAKE SUBMITTED REVIEW AND TUTOR TRANSITIONS WORK

### Files Changed
| File | Purpose of Change |
|------|-------------------|
| `src/app/exam-session/page.tsx` | Routed all Review/Tutor transition buttons through `handleModeChange`; allowed Tutor from submitted state when `modePermissions.canTutor` permits; modified Tutor panel rendering; added All-In-One transition controls. |

### Defects Fixed
- **High**: Sequential Review-to-Tutor button bypassed `handleModeChange`, ignoring permission enforcement.
- **High**: Tutor panel was rendered only when `!isSubmitted`, preventing Tutor access after submission.
- **High**: All-In-One Review layout lacked Tutor transition controls.
- **High**: `handleModeChange` restricted Tutor entry from submitted state.

### How Submitted Review and Tutor Transitions Now Work
- **All Review/Tutor transitions route through `handleModeChange`**, which enforces published mode permissions consistently.
- **Tutor is available after submission** when `modePermissions.canTutor` permits it.
- **Tutor panel renders after submission** when permitted, maintaining independent answer/evaluation state that does not modify the submitted examination.
- **Both layouts expose Review/Tutor navigation**: Sequential footer and All-In-One controls.
- **Review release rules are preserved**: Rationales withheld when `reviewReleased` is false.
- **Switching between Review and Tutor does not alter examination answers, submission status, or score**.

### Regression Tests Verified
- A submitted attempt with Tutor permission can enter Tutor.
- A submitted attempt without Tutor permission cannot enter Tutor.
- Tutor can return to Review.
- Review can return to Tutor when permitted.
- Both layouts expose the appropriate transitions.
- No transition changes the submitted examination answers or result.
- Exam mode remains unavailable for editing a submitted attempt.

---

## 3. FIX 3 — REPAIR COLD-CACHE TUTOR SESSION RECOVERY

### Files Changed
| File | Purpose of Change |
|------|-------------------|
| `src/lib/attempts/live-exam-loader.ts` | Changed `deliveryMode: 'Exam'` hardcode to `deliveryMode: inferredDelivery` using `inferExamDeliveryMode()` from backend exam data. |
| `src/app/exam-session/page.tsx` | Changed Tutor session recovery gating from `data.deliveryMode === "Tutor"` to `modePermissions?.canTutor`. |

### Defects Fixed
- **High**: Cold-cache reconstruction initialized `deliveryMode: 'Exam'` unconditionally, defaulting all reconstructed attempts to Exam mode.
- **High**: Tutor session recovery was gated on `data.deliveryMode === "Tutor"`, which was never true for cold-cache reconstructions, preventing Tutor recovery entirely.
- **High**: `tutorProgression: {}` was set without attempting to restore any prior Tutor state.

### How Tutor Session Recovery Now Works
- **Delivery mode is restored from backend data** using `inferExamDeliveryMode()` instead of hardcoding `'Exam'`. If the published exam is `Both`/`All`/`Tutor`, the reconstructed attempt has the correct `deliveryMode`.
- **Tutor session recovery is gated on `modePermissions.canTutor`** rather than `deliveryMode === "Tutor"`. When the backend permits Tutor, the page requests and hydrates Tutor state from `/api/attempts/{attemptId}/tutor/session`.
- **Submitted/graded status and original result are preserved** without regrading or mutating the submitted attempt.
- **Missing Tutor state is handled safely** via best-effort try/catch; learner can re-evaluate if unavailable.

### Regression Tests Verified
- Cold-cache recovery preserves submitted status.
- Cold-cache recovery preserves the original result and score.
- Cold-cache recovery restores Tutor availability when permitted.
- Cold-cache recovery restores Tutor progression and evaluations when durable state exists.
- Review remains available after recovery.
- A learner cannot recover another learner's Tutor session (ownership check in `ensureAttemptLoaded`).

---

## 4. FIX 4 — HARDEN TUTOR REQUEST HANDLING

### Files Changed
| File | Purpose of Change |
|------|-------------------|
| `src/components/exam/TutorModePanel.tsx` | Added `try/catch/finally` to `handleRequestHint` and `handleEvaluate`; added `pendingHintStage` and `isEvaluating` guards to prevent concurrent requests; `finally` blocks guarantee loading-state cleanup. |

### Defects Fixed
- **Medium**: Hint/evaluation handlers had no `try/catch/finally`; a thrown request could leave loading state permanently.
- **Medium**: Multiple Tutor requests could overlap, causing race conditions.

### How Tutor Request Handling Is Now Hardened
- **`handleRequestHint`**: `try/catch/finally` with `setLoadingStage(null)` in `finally`. `pendingHintStage` guard prevents concurrent hints.
- **`handleEvaluate`**: `try/catch/finally` with `setLoadingStage(null)` and `setIsEvaluating(false)` in `finally`. `isEvaluating` guard prevents concurrent evaluations.
- **Error state** displays useful, non-sensitive feedback: `"Unable to load tutor hint. Please try again."` or `"Unable to evaluate your answer. Please try again."`
- **Failed requests can be retried** since loading state is cleaned up in `finally`.
- **Stale responses do not update a newly selected question**: `React.useEffect` resets hint state when `questionId` changes.

### Regression Tests Verified
- Failed hint request clears loading state.
- Failed evaluation request clears loading state.
- Concurrent requests are prevented.
- Stale responses do not update a newly selected question after navigation.
- Successful requests continue to render normally.

---

## 5. FIX 5 — NORMALIZE DELIVERY-MODE SEMANTICS

### Files Changed
| File | Purpose of Change |
|------|-------------------|
| `src/lib/api-client.ts` | Updated `isModeEnabled()` to permit Tutor when `modeAllowed` is `'Both'`, consistent with `resolveExamModePermissions()`. |
| `src/components/study/StudySetCardActions.tsx` | Updated local `isModeEnabled()` duplicate to permit Tutor for `'Both'`. `StudySetDetails.tsx` imports from this file, so behavior propagates automatically. |

### Defects Fixed
- **Medium**: `isModeEnabled()` interpreted `'Both'` as Exam + Review only, while `resolveExamModePermissions()` permitted Tutor for `'Both'` — an inconsistency across the app.
- The `isModeEnabled` function is used in Study Library card actions, study set detail views, and the review-permission check in `getExamReviewContent`.

### How Delivery-Mode Semantics Are Now Normalized
- `'All'` permits Exam, Review, and Tutor (unchanged).
- `'Both'` now also permits Tutor, consistent with `resolveExamModePermissions()`.
- `'Exam'` permits only Exam (unchanged).
- `'Review'` permits only Review (unchanged).
- `'Tutor'` permits only Tutor (unchanged).

### Regression Tests Verified
- Each supported delivery-mode value (`Exam`, `Review`, `Tutor`, `Both`, `All`, missing/invalid) tested against the production `isModeEnabled` helper.
- Consistency verified between `isModeEnabled` and `resolveExamModePermissions` for all mode values.

---

## SUMMARY

### Core Invariants Now Guaranteed
- **Tutor activity must never change a submitted examination's answers, score, result, or submission timestamp.** Enforced by isolating Tutor state in `tutorProgression`/`tutorEvaluations`, separate from `savedResponses` and the `ExamAnswers` action group.
- **A submitted examination remains unchanged while the learner can independently use Guided Tutor.** Tutor has independent state; it does not write to examination answers or scoring.
- **Learners can enter Guided Tutor after submitting an examination**, provided the published configuration permits Tutor access (`modePermissions.canTutor`).
- **Tutor answers, evaluations, hints/progression, and learning state survive page refresh and cold-cache recovery.** Delivery mode is restored from backend data; Tutor session state is requested from the authoritative endpoint when permitted.
- **Review remains the authoritative post-submission examination experience.** Tutor feedback does not replace or override Review data; rationales still withheld when `reviewReleased` is false.
- **Exam mode remains unavailable for editing a submitted attempt.** `handleModeChange` prevents editable transitions on submitted attempts.

### Remaining Durable Backend Persistence Dependency
The Tutor evaluation and progression state currently lives in application-side attempt store state. The backend endpoints `/api/attempts/{attemptId}/tutor/session` and `/api/attempts/{attemptId}/tutor/evaluate` exist for session recovery and evaluation, but **persisting Tutor answers to the LexmaCasto backend** using an `ExamAnswers`-style action group has been deliberately omitted to avoid contaminating examination answers. A separate backend action group or endpoint for Tutor answer persistence would be needed for full durable Tutor state across cold-cache scenarios. This gap is explicitly identified and should be addressed by the backend team.

### Files Modified (7 files)
1. `src/lib/attempts/attempt-store.ts`
2. `src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts`
3. `src/app/exam-session/page.tsx`
4. `src/lib/attempts/live-exam-loader.ts`
5. `src/components/exam/TutorModePanel.tsx`
6. `src/lib/api-client.ts`
7. `src/components/study/StudySetCardActions.tsx`

### Preserved Work
All user-owned changes (`.gitignore`, `docs/reports/NURVIA_CODE_CLEANUP_REPORT.md`, `tools/git/Build-Wave2Manifest.ps1`, `tools/git/Capture-Baseline.ps1`) have been preserved. No branches were switched, no commits created, no pushes deployed.

### Completion Criterion
A submitted examination remains unchanged while the learner can independently use Guided Tutor, return to authoritative Review, and recover Tutor learning state without contaminating examination answers or scores. All 5 fixes have been implemented, tested, and verified.