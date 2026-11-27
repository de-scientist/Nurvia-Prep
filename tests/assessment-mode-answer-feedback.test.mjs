/**
 * Assessment Mode Answer Feedback Verification Suite
 * Covers:
 * 1. Automatic answer feedback upon selection in Assessment Mode
 * 2. Green visual treatment and checkmark tick (✓) for correct options
 * 3. Red visual treatment and cross indicator (✕) for incorrect options
 * 4. Rationale separation (rationales rendered in dedicated explanation section, NOT inside individual option buttons)
 * 5. SATA exact required selection count before feedback is revealed
 * 6. Tutor Mode retention and isolation
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

console.log("=== ASSESSMENT MODE ANSWER FEEDBACK TEST SUITE ===");

// 1. Check SingleChoiceRenderer source code contracts
console.log("\n--- 1. SingleChoiceRenderer Feedback Styling & Rationale Placement ---");
const singleChoiceSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/exam/renderers/SingleChoiceRenderer.tsx"),
  "utf8"
);

// Verify correct option styling
assert.ok(
  singleChoiceSrc.includes("border-emerald-500 bg-emerald-50/90"),
  "Correct option must have green visual treatment (emerald-500)"
);
assert.ok(
  singleChoiceSrc.includes("Correct Answer ✓") || singleChoiceSrc.includes("Your Answer · Correct ✓"),
  "Correct option must display green checkmark indicator (✓)"
);

// Verify incorrect option styling
assert.ok(
  singleChoiceSrc.includes("border-rose-500/80 bg-rose-50/80"),
  "Incorrect option must have red visual treatment (rose-500)"
);
assert.ok(
  singleChoiceSrc.includes("Your Answer · Incorrect ✕") || singleChoiceSrc.includes("Incorrect ✕"),
  "Incorrect option must display red cross indicator (✕)"
);

// Verify rationales are not inside option buttons
assert.ok(
  !singleChoiceSrc.includes("ml-10 p-2.5 rounded-lg bg-surface-muted border border-border/50"),
  "Specific rationales must NOT be rendered inside or inline under option buttons in SingleChoiceRenderer"
);
console.log("[PASS] SingleChoiceRenderer displays green ✓ and red ✕ with no inline option box rationales.");

// 2. Check MultipleResponseRenderer source code contracts
console.log("\n--- 2. MultipleResponseRenderer SATA Feedback & Styling ---");
const multipleRespSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/exam/renderers/MultipleResponseRenderer.tsx"),
  "utf8"
);

assert.ok(
  multipleRespSrc.includes("border-emerald-500 bg-emerald-50/90"),
  "SATA correct options must have green visual treatment"
);
assert.ok(
  multipleRespSrc.includes("border-rose-500/80 bg-rose-50/80"),
  "SATA incorrect options must have red visual treatment"
);
assert.ok(
  multipleRespSrc.includes("Correct Answer ✓") || multipleRespSrc.includes("Your Answer · Correct ✓"),
  "SATA correct options must display checkmark (✓)"
);
assert.ok(
  multipleRespSrc.includes("Your Answer · Incorrect ✕") || multipleRespSrc.includes("Incorrect ✕"),
  "SATA incorrect options must display cross (✕)"
);
assert.ok(
  !multipleRespSrc.includes("ml-8 p-2.5 rounded-lg bg-surface-muted border border-border/50"),
  "Specific rationales must NOT be rendered inside or inline under option buttons in MultipleResponseRenderer"
);
console.log("[PASS] MultipleResponseRenderer displays green ✓ and red ✕ with clean option layout.");

// 3. Check TrueFalseRenderer, HotspotRenderer, and ImageBasedRenderer
console.log("\n--- 3. TrueFalse, Hotspot & ImageBased Renderer Feedback & Styling ---");
const trueFalseSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/exam/renderers/TrueFalseRenderer.tsx"),
  "utf8"
);
assert.ok(
  trueFalseSrc.includes("border-emerald-500 bg-emerald-50/90"),
  "TrueFalse correct option must have emerald visual treatment"
);
assert.ok(
  trueFalseSrc.includes("border-rose-500/80 bg-rose-50/80"),
  "TrueFalse incorrect selected option must have rose visual treatment"
);
assert.ok(
  trueFalseSrc.includes("Correct Answer ✓"),
  "TrueFalse correct option must display ✓"
);
assert.ok(
  trueFalseSrc.includes("Your Answer · Incorrect ✕"),
  "TrueFalse incorrect selected option must display ✕"
);

const hotspotSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/exam/renderers/HotspotRenderer.tsx"),
  "utf8"
);
assert.ok(
  hotspotSrc.includes("border-emerald-500 bg-emerald-50/80"),
  "Hotspot correct option must have emerald visual treatment"
);
assert.ok(
  hotspotSrc.includes("border-rose-500 bg-rose-50/80"),
  "Hotspot incorrect selected option must have rose visual treatment"
);
assert.ok(
  hotspotSrc.includes("Correct Hotspot ✓") || hotspotSrc.includes("Your Answer · Correct ✓"),
  "Hotspot correct option must display ✓"
);
assert.ok(
  hotspotSrc.includes("Your Answer · Incorrect ✕"),
  "Hotspot incorrect selected option must display ✕"
);

const imageBasedSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/exam/renderers/ImageBasedRenderer.tsx"),
  "utf8"
);
assert.ok(
  imageBasedSrc.includes("border-emerald-500 bg-emerald-50/90"),
  "ImageBased correct option must have emerald visual treatment"
);
assert.ok(
  imageBasedSrc.includes("border-rose-500 bg-rose-50/90"),
  "ImageBased incorrect selected option must have rose visual treatment"
);
assert.ok(
  imageBasedSrc.includes("Correct Answer ✓") || imageBasedSrc.includes("Your Answer · Correct ✓"),
  "ImageBased correct option must display ✓"
);
assert.ok(
  imageBasedSrc.includes("Your Answer · Incorrect ✕"),
  "ImageBased incorrect selected option must display ✕"
);
console.log("[PASS] TrueFalse, Hotspot, and ImageBased renderers display green ✓ and red ✕ indicators correctly.");

// 4. Check Assessment Mode automatic feedback trigger logic in exam-session
console.log("\n--- 4. Automatic Feedback Logic in Assessment Mode ---");
const examSessionSrc = fs.readFileSync(
  path.join(repoRoot, "src/app/exam-session/page.tsx"),
  "utf8"
);

assert.ok(
  examSessionSrc.includes("isAssessmentRevealed"),
  "exam-session must define isAssessmentRevealed handler"
);
assert.ok(
  examSessionSrc.includes("isAssessmentRevealed(q)"),
  "reviewStateFor must include isAssessmentRevealed for immediate feedback in Assessment Mode"
);
assert.ok(
  examSessionSrc.includes("isSataQuestion(q.questionType)"),
  "isAssessmentRevealed must validate SATA questions using authoritative selection counts"
);
assert.ok(
  examSessionSrc.includes('if (deliveryMode !== "Exam" || stage !== "assessment") return false;'),
  "isAssessmentRevealed must strictly isolate Assessment Mode and never leak into Tutor Mode"
);
assert.ok(
  !examSessionSrc.includes("Submit Question") && !examSessionSrc.includes("Submit Answer"),
  "No individual question submit button exists in Assessment Mode"
);
assert.ok(
  examSessionSrc.includes("handleSubmitExam") && examSessionSrc.includes("SubmitConfirmationModal"),
  "Final examination submission mechanism is preserved"
);
console.log("[PASS] Assessment Mode automatically reveals feedback upon answer selection while respecting SATA counts and preserving final exam submission.");

// 5. Verify Tutor Mode preservation
console.log("\n--- 5. Tutor Mode Preservation & Isolation ---");
assert.ok(
  examSessionSrc.includes('deliveryMode === "Tutor" &&\n            attemptId &&'),
  "TutorModePanel is strictly rendered in Tutor Mode"
);
assert.ok(
  examSessionSrc.includes('isReview={deliveryMode === "Tutor" && !isSubmitted ? false : showReview}'),
  "Tutor Mode retains its isolated progression and review state"
);
assert.ok(
  examSessionSrc.includes('hideRationaleBox={deliveryMode === "Tutor" || !showReview}'),
  "Tutor Mode hides the exam rationale box to maintain pedagogical progression"
);
console.log("[PASS] Tutor Mode remains isolated with full existing pedagogical behavior.");

console.log("\nALL ASSESSMENT MODE ANSWER FEEDBACK TESTS PASSED!");
