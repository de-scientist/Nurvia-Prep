# NURVIA-PREP — EXAMINATION LOADING & LIFECYCLE AUDIT

**Document Identifier:** NURVIA-AUDIT-EXAM-LOADING-001  
**Project:** Nurvia-Prep (NCLEX & Clinical Examination Platform)  
**Security Classification:** Restricted / Internal Engineering Audit  
**Authoritative Environment:** Next.js 15 App Router (`src/app/exam-session/page.tsx`), Protected LexmaCasto BFF  
**Status:** Remediated & Fully Validated  

---

## 1. EXECUTIVE SUMMARY

An exhaustive forensic audit of the examination loading experience, session initialization, layout negotiation, autosave lifecycle, and submit-to-review transition was conducted across the Nurvia-Prep platform.

Prior to remediation, the examination loading state suffered from critical architectural vulnerabilities and UX deficiencies:
1. **Generic / Unbranded Spinners:** The examination session relied on an unstructured `animate-spin` generic browser indicator that did not reflect the Nurvia clinical design system or communicate session context.
2. **Fabricated Progress & Stale States:** Attempt starts were vulnerable to hydration race conditions and unhandled rejection states, leading to indefinite blank or frozen loading screens when backend responses were delayed.
3. **Missing Lifecycle Stage Communication:** Learners were not informed of critical backend milestones (credential verification, question delivery, clinical exhibit indexing, workspace initialization).
4. **Dangerous Unbounded Retry Loops:** When an exam attempt failed to resolve from the remote backend, failure states lacked debounced retry guards, triggering repeated rapid clicks that generated duplicate synthetic attempt records and flooded upstream proxies.

Through this remediation, a production-grade clinical loading interface (`ExamLoadingScreen.tsx`) has been deployed, backed by deterministic lifecycle state tracking in `exam-session/page.tsx`.

---

## 2. EXAMINATION LIFECYCLE ARCHITECTURE TRACE

The authoritative examination lifecycle spans 12 distinct functional stages:

```
[Exam Catalogue / Study Library]
              │
              ▼
[Exam Detail & Mode Selection] (Exam | Tutor | Review)
              │
              ▼
[Layout Negotiation Modal] (Sequential vs. All-in-One)
              │
              ▼
[BFF Attempt Creation] (POST /api/attempts/start/:examId)
              │
              ▼
[Question Delivery & Sanitization] (Answer keys & rationales withheld in Exam Mode)
              │
              ▼
[Active Examination Workspace] (Single/Multi-choice, NGN Bow-Tie, Case Studies)
              │
              ▼
[Debounced Response Persistence] (PUT /api/attempts/:attemptId/responses)
              │
              ▼
[Submission Dialog & Reconciliation] (Flush pending debounced autosaves)
              │
              ▼
[Authoritative BFF Grading] (POST /api/attempts/:attemptId/submit)
              │
              ▼
[Deterministic Results Calculation] (Pass/Fail, Points, Subject Breakdown)
              │
              ▼
[Automatic Transition to Review Mode] (Hydration of graded review + URL canonicalization)
              │
              ▼
[Post-Submission Tutoring / Review Exploration] (On-demand Tutor Mode switch)
```

---

## 3. LOADING STAGE TAXONOMY & REAL LIFECYCLE MAPPING

The updated `ExamLoadingScreen` establishes 5 discrete lifecycle stages strictly linked to real asynchronous milestones. No artificial timers or simulated progress bars are employed:

| Stage Index | Canonical Stage Label | Underlying Technical Operation | Recovery / Error Boundary |
|---|---|---|---|
| **Stage 1** | *Preparing examination session...* | Parsing query parameters (`examId`, `attemptId`, `mode`, `layout`); validating client session tokens. | If parameter missing, immediately redirects or surfaces catalogue selector. |
| **Stage 2** | *Verifying clinical workspace access...* | Inspecting NextAuth session and HttpOnly Casto badge credentials via BFF auth bridge. | 401 triggers redirect to `/login`; role mismatches present friendly access boundary. |
| **Stage 3** | *Loading questions & clinical exhibits...* | Executing `nurviaApi.startAttempt` or `getExamReviewContent`; fetching Strata question payload. | Catches network/backend 404/500 and presents diagnostic toggle with debounced retry. |
| **Stage 4** | *Configuring examination workspace...* | Normalizing Microsoft Word HTML, indexing EHR exhibits, resolving cognitive skill taxonomy. | Sanitization errors fall back to raw text with no-leak guarantee. |
| **Stage 5** | *Finalizing session delivery...* | Mounting modular question renderers, synchronizing local storage buffers, activating timer. | Mount completion unblocks interactive workspace. |

---

## 4. UI/UX SPECIFICATIONS OF THE REMEDIATED LOADING SCREEN

Implemented in `src/components/exam/ExamLoadingScreen.tsx`:

- **Nurvia Brand Identity:** Prominently renders the official Nurvia Brand Mark (`<Logo width={160} height={42} priority />`) centered on a clinical surface background (`bg-surface`).
- **Main Animated Indicator:** A refined dual-ring radial pulsing SVG indicator utilizing Tailwind's `animate-spin` on the outer track (`border-brand-teal/20 border-t-brand-teal`) and an inner soft pulse (`bg-brand-teal/10 animate-pulse`), respecting CSS `prefers-reduced-motion`.
- **Examination Metadata Cards:** Displays an informative metadata grid including:
  - *Exam Mode:* High-contrast badges (`Exam Mode`, `Tutor Mode`, `Review Mode`).
  - *Question Allocation:* Total items count (`Item Allocation: N Questions`).
  - *Allocated Duration:* Calculated time limit (`Duration: N Minutes`).
- **Friendly Error Recovery & Diagnostics:**
  - When loading encounters an upstream failure (e.g., network drop, invalid exam ID), the spinner cleanly halts.
  - A reassuring clinical alert explains the condition without technical jargon (`"We were unable to load your examination materials at this moment."`).
  - Diagnostic details (status codes, endpoint URLs, error stack traces) are safely enclosed inside an expandable disclosure panel (`<summary>Technical Details</summary>`).
  - The `"Retry Loading Session"` action triggers a controlled retry with a debounced click guard, preventing rapid duplicate calls.

---

## 5. MOBILE & RESPONSIVE BEHAVIOR

The loading interface was verified across five viewport breakpoints:
1. **360px (Ultra-Compact Mobile):** Padding drops to `p-4`; metadata cards stack vertically; brand logo scales cleanly to 120px width without horizontal overflow.
2. **390px (Standard iOS/Android Mobile):** Single-column layout; action buttons provide 48px touch targets; zero viewport horizontal scroll (`scrollWidth === innerWidth`).
3. **768px (Tablet):** Metadata grid shifts to 2 columns; typography scales to `text-sm`; stage indicators display clear horizontal spacing.
4. **1024px (Laptop):** Centered card layout with max-width `max-w-md`; soft backdrop blur and subtle shadow border (`shadow-xl border-border`).
5. **1440px (Desktop / Clinical Workstation):** Proportional centering with generous whitespace and accessible contrast ratios compliant with WCAG 2.1 AA.

---

## 6. HYDRATION, IDOR & RACE CONDITION DEFENSES

- **Anti-Hydration Mismatch:** All dynamic timestamps and viewport measurements are deferred until after `React.useEffect` client mounting.
- **Strict Anti-IDOR:** Exam attempt initialization maps to server-side NextAuth credentials. Attempts started by learner `A` cannot be resumed, autosaved, or graded by learner `B`.
- **Autosave Race Prevention:** Active examination unmounting cancels all pending debounce timers via `autosaveTimeoutsRef.current`, preventing unmounted state updates or orphaned network requests.

---

## 7. AUDIT CONCLUSION & STATUS

The Examination Loading & Lifecycle experience has been transformed from an uninformative, vulnerable state into an authoritative, robust, and beautifully branded clinical assessment foundation.

**Audit Status:** **REMEDIATED & FULLY VERIFIED**
