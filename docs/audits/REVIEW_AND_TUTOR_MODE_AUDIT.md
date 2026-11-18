# NURVIA-PREP — REVIEW & TUTOR MODE FUNCTIONAL RESTORATION AUDIT

**Document Identifier:** NURVIA-AUDIT-REVIEW-TUTOR-002  
**Project:** Nurvia-Prep (NCLEX & Clinical Examination Platform)  
**Security Classification:** Restricted / Internal Engineering Audit  
**Authoritative Environment:** Next.js 15 App Router (`src/app/exam-session/page.tsx`), Dedicated BFF Routes (`src/app/api/attempts/*`), In-Memory Attempt Store (`src/lib/attempts/attempt-store.ts`)  
**Status:** Remediated & Fully Validated  

---

## 1. EXECUTIVE OBJECTIVE

This forensic audit evaluates the functional restoration, architectural integrity, and UX execution of:
1. **Automatic Review Mode Transition:** Seamless transition immediately following exam submission.
2. **Review Mode Experience:** Authoritative analysis interface displaying graded outcomes, rationales, exhibits, and navigation.
3. **Tutor Mode Experience:** 6-stage progressive clinical learning flow delivering hints, option elimination, and immediate feedback.

---

## 2. AUTOMATIC REVIEW TRANSITION ARCHITECTURE

### 2.1 The Legacy Problem
Previously, when learners submitted an examination, the application either displayed a dead-end submission modal, redirected learners back to the home dashboard, or attempted to push to a non-existent route (`/exam-review?attemptId=...`), forcing learners to navigate through learner history and click multiple times to locate their results.

### 2.2 The Remediated Seamless Transition Flow
In `src/app/exam-session/page.tsx`, `handleSubmitExam` now executes an authoritative, single-turn state transition:

```
[Learner Clicks 'Confirm & Submit']
              │
              ▼
[Flush Pending Autosaves] ──► (Awaits all debounced timeout promises)
              │
              ▼
[BFF Submission Call] ──► POST /api/attempts/:attemptId/submit
              │
              ▼
[Authoritative Grading] ──► Deterministic scoring in attemptStore
              │
              ▼
[Direct In-Memory Hydration]
  ├── hydrateFromReview(response.data)
  ├── setIsSubmitted(true)
  ├── setDeliveryMode("Review")
  └── setCurrentIndex(0)
              │
              ▼
[URL Canonicalization] ──► window.history.replaceState(null, "", "/exam-session?attemptId=...&mode=Review")
              │
              ▼
[Interactive Review Mode Rendered Instantly with Zero Extra Clicks]
```

### 2.3 Submission Failure Safety
If the BFF submission fails (e.g. network timeout or invalid attempt state):
- The modal remains open.
- The learner's answers are preserved in state.
- A high-visibility error message is rendered directly inside the submission modal:
  ```tsx
  {submissionError && (
    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-semibold">Submission could not be completed</p>
        <p>{submissionError}</p>
      </div>
    </div>
  )}
  ```
- The learner can safely retry `"Confirm & Submit"` without losing responses.

---

## 3. REVIEW MODE FUNCTIONAL SPECIFICATIONS

### 3.1 Performance Intelligence Header
In Review Mode, `ExamShell` receives comprehensive attempt results:
- **Examination Title & Nursing Category:** Displays the official exam name (e.g., *NCLEX-RN Adult Health Medical-Surgical*).
- **Final Score & Passing Status:** Clear indicator of earned points and percentage (e.g., `Score: 82% · Passed`).
- **Review Progress Badge:** Shows current item index versus total items (`Review Item 1 of 65`).

### 3.2 Question Navigation Matrix
The Question Navigator grid provides instant visual state across all questions:
- **Green (Emerald) with CheckCircle2:** Correctly answered questions.
- **Red (Rose) with XCircle:** Incorrectly answered questions.
- **Slate (Muted) with MinusCircle:** Unanswered questions.
- **Amber Border / Dot:** Questions flagged for review by the learner.
- **Direct Click Navigation:** Clicking any grid item navigates directly to that question without page reload.

### 3.3 Question Review Cards & Rationale Delivery
Every reviewed question displays:
- **Outcome Badge:** High-contrast `Correct`, `Incorrect`, or `Unanswered` badge at the card header.
- **Original Normalized Stem:** Rendered with `RichQuestionContent`, preserving clinical formatting.
- **Electronic Health Record (EHR) Clinical Exhibits:** Embedded clinical exhibits (Nurse's Notes, Vital Signs, Lab Results, Orders) remain fully accessible in Review Mode.
- **Option Correctness & Learner Selection:** Options clearly indicate:
  - Which option the learner selected (`wasSelected = true`).
  - Which option was correct (`isCorrect = true`).
  - Specific clinical rationale explaining *why* the choice is correct or incorrect.
- **General Clinical Rationale:** Comprehensive paragraph explaining core nursing principles and evidence-based guidance.

---

## 4. TUTOR MODE: 6-STAGE PROGRESSIVE CLINICAL LEARNING

Tutor Mode is designed as a formative learning environment that scaffolds critical thinking through six distinct pedagogical stages:

```
┌─────────────────────────────────────────────────────────────┐
│                     TUTOR MODE LIFECYCLE                    │
├─────────────────────────────────────────────────────────────┤
│ Stage 1: Question Presentation & Clinical Cue Recognition    │
│          (Learner reads stem, exhibits, and choices)        │
│                              │                              │
│ Stage 2: Cognitive Cue Hint (FirstHint)                     │
│          (Clues pointing toward priority nursing cues)      │
│                              │                              │
│ Stage 3: Guided Clinical Reasoning (GuidedReasoning)        │
│          (Scaffolding physiological hypotheses & risks)     │
│                              │                              │
│ Stage 4: Answer Selection & Evaluation                      │
│          (Learner selects answer & clicks 'Evaluate')       │
│                              │                              │
│ Stage 5: Detailed Clinical Rationale & Explanations         │
│          (Reveals option-by-option rationale & principles)  │
│                              │                              │
│ Stage 6: Key Clinical Takeaway & Transferable Principle     │
│          (Actionable clinical pearl for NCLEX readiness)    │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Implementation in `TutorModePanel.tsx`
- Mounted directly below the question renderer during active Tutor sessions.
- Allows progressive expansion of Stage 2 (`"Need a hint?"`) and Stage 3 (`"Guided Reasoning"`).
- Once the learner selects an answer and triggers evaluation:
  - Calls `POST /api/attempts/:attemptId/tutor/evaluate`.
  - Displays instant correctness badge (`Correct` or `Incorrect`).
  - Shows clinical explanation, individual option rationales, and the core nursing principle takeaway.
  - The Question Card dynamically updates its status in the question navigator.

---

## 5. SEAMLESS MODE SWITCHING

Learners can switch fluidly between modes during study sessions:
- **Review Mode to Tutor Mode:** When reviewing an attempt, a footer action `"Explore in Tutor Mode"` allows the learner to enter the interactive 6-stage guidance flow on difficult questions.
- **Tutor Mode to Review Mode:** A button `"Return to Full Review"` allows immediate return to the comprehensive review view.
- Response persistence is maintained continuously across transitions.

---

## 6. VERIFICATION & REGRESSION METRICS

- **BFF Attempt Store Testing:** Verified via `tests/nurvia-exam-experience-remediation.test.mjs`:
  - Exam mode confidentiality: answer keys withheld during active attempt.
  - Tutor mode progressive hints: FirstHint and GuidedReasoning generated.
  - Tutor answer evaluation: scoring, explanation, and takeaway returned.
  - Graded review retrieval: all rationales and correct keys populated.
  - Anti-IDOR enforcement: cross-badge retrieval rejected with 403/404.
- **Regression Suite:** All existing exam engine tests (`phase-e-exam-engine.test.mjs`, `learning-integration.test.mjs`, `exam-mode-availability.test.mjs`) passed with zero failures.

---

## 7. AUDIT CONCLUSION & STATUS

Review Mode and Tutor Mode are fully functional, resilient, secure against IDOR, and integrated with the authoritative Nurvia examination engine.

**Audit Status:** **REMEDIATED & FULLY VERIFIED**
