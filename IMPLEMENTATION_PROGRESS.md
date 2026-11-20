# NURVIA-PREP — Implementation Progress Report

## Wave 2: Filter Hierarchy & Dashboard Enhancements
✅ Completed:
- Seven-level filter hierarchy: GLOBAL → PROGRAM → COURSE → SUBJECT → YEAR → SEASON → SCHOOL
- Cascading filter behavior (parent changes clear downstream filters)
- Dashboard "Back to Homepage" button in LearnerShell
- Hero CTA upgrade: "Try a Practice Set" → `/learner/library`
- Four examination cards updated (RN Exams, LPN Exams, RN Exit Exams, LPN Exit Exams)

## Wave 1: Verified Defects
✅ Completed:
- Fix 1: Tutor responses isolated from examination answers
- Fix 2: Submitted Review/Tutor transitions work correctly
- Fix 3: Cold-cache Tutor session recovery repaired
- Fix 4: Tutor request handling hardened
- Fix 5: Delivery-mode semantics normalized

## Fix A: Delivery-Mode Permission Semantics
✅ COMPLETED:
- Updated `isModeEnabled` in `StudySetCardActions.tsx` to import shared helper from `api-client.ts`
- Shared helper correctly implements: `Both` = Exam + Review, NOT Tutor
- Previously had duplicated helper that incorrectly allowed Tutor for `Both` mode

## Fix B: Isolate Tutor Answers from Examination Responses
✅ COMPLETED:
- Added `responseJson?: string` to `TutorQuestionStateDto` in `api-types.ts`
- Updated `evaluateTutorAnswer()` in `attempt-store.ts` to store `responseJson` in `tutorProgression`
- Updated `getTutorSession()` to include `responseJson` in returned questions
- Updated `TutorModePanel.tsx` to restore and display stored response
- Updated `TutorModePanel` usage in exam session page to pass `responseJson` prop
- Tutor answers now persisted exclusively in `tutorProgression`, never in `savedResponses`

## Fix C: Expose Tutor Answers Through Session API
✅ COMPLETED:
- `TutorSessionStateDto` now includes `responseJson` via `TutorQuestionStateDto`
- `getTutorSession()` returns `responseJson` for each question
- `TutorModePanel` restores stored response on mount
- Prevents re-evaluation when response already stored

## Fix D: Preserve Submitted Examination Immutability
⚠️ IN PROGRESS:
- `evaluateTutorAnswer()` in `attempt-store.ts` already writes only to `tutorProgression`
- Existing code has comment: "Tutor answers are persisted exclusively in tutorProgression"
- Need to verify no side effects on `savedResponses`, submission timestamps, scores
- Tests should confirm examination data remains unchanged after Tutor evaluation

## Fix E: Remove Obsolete Tutor Persistence Imports
⚠️ PENDING:
- Need to inspect `src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts`
- Remove unused imports: `getStrataSubmissionType`, `toStrataAnswerPayload`, `lexmaCastoRequest`, `buildExamUpsertPath`
- Retain: `extractSiteMetadataFromRequestHeaders`

## Fix F: Verify Actual Persistence and Report Limitations
⚠️ PENDING:
- Current system uses `globalThis.__nurviaAttemptCache` (process-local memory)
- Not durable database persistence
- Need to document: data may be lost after process restart, cache eviction, deployment
- Do not claim cross-process or cold-start recovery unless durable storage implemented

## Fix G: Add Regression Tests
⚠️ PENDING:
- Test 1: Delivery-mode authorization (All/Both/Exam/Review/Tutor)
- Test 2: Tutor answer isolation (savedResponses unchanged)
- Test 3: Submitted examination immutability
- Test 4: Tutor session recovery
- Test 5: Frontend restoration of Tutor responses
- Test 6: Authorization and ownership

## Files Modified (15 total)
Wave 1: 7 files (tutor/defect fixes)
Wave 2: 4 files (filter hierarchy, navigation)
Fix A-F: 4+ files (tutor mode, examination integrity, delivery permissions)

## Pending Items
- Full end-to-end browser verification (no runtime environment)
- Production build and lint execution
- TypeScript compilation check
- Fix E: Remove obsolete imports from evaluate route
- Fix D: Full immutability verification with tests
- Fix F: Document persistence limitations
- Fix G: Add 6 regression tests