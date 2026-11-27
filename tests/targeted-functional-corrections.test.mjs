/**
 * Targeted Functional Corrections Verification Suite
 * Covers:
 * 1. Tutor evaluation policy enforcement and route authorization
 * 2. Assessment vs Tutor mode separation and integrity
 * 3. SATA exact-selection-count validation derived from authoritative backend answer data
 * 4. Exam-body filtering isolation (ATI vs HESI mutual exclusivity)
 * 5. Homepage hero copy ("Turn Practice Into ATI, HESI, and Examplify Readiness")
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import ts from "typescript";

const repoRoot = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export default {};",
        shortCircuit: true,
      };
    }
    if (specifier.startsWith("@/")) {
      const base = path.resolve(repoRoot, "src", specifier.slice(2));
      for (const ext of ["", ".ts", ".tsx", ".mjs", ".js"]) {
        const candidate = ext ? `${base}${ext}` : base;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, "/")}`).href,
            shortCircuit: true,
          };
        }
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file://")
    ) {
      const parentDir = path.dirname(
        new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, "$1")
      );
      const base = path.resolve(parentDir, specifier);
      for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
        const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, "/")}`).href,
            shortCircuit: true,
          };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      const filePath = new URL(url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
      const source = fs.readFileSync(filePath, "utf8");
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: filePath,
      });
      return { format: "module", source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const {
  isSataQuestion,
  extractRequiredSataCount,
  validateSataSelection,
  getSelectedOptionCount,
} = await import("../src/lib/attempts/sata-validation.ts");

const {
  classifyAuthoritativePathway,
  inferExamCategory,
  nurviaApi,
} = await import("../src/lib/api-client.ts");

const {
  simplifyExamBodyLabel,
  getExamBodyLabel,
} = await import("../src/components/study/StudyLibraryCategoryTabs.tsx");

const { attemptStore } = await import("../src/lib/attempts/attempt-store.ts");

console.log("=== TARGETED FUNCTIONAL CORRECTIONS TEST SUITE ===");

// -------------------------------------------------------------
// 1. TUTOR EVALUATION POLICY & ROUTE AUTHORIZATION
// -------------------------------------------------------------
console.log("\n--- 1. Tutor Evaluation Policy Authorization ---");

// Test attemptStore evaluation when modePermissions.canTutor permits
const testLearnerId = "test-learner-tutor-eval";
const attemptIdSupported = "test-attempt-tutor-supported";
const attemptIdUnsupported = "test-attempt-tutor-unsupported";

const mockQuestions = [
  {
    id: "q-1",
    numericId: 101,
    guidId: "guid-q-1",
    stem: "A client with heart failure presents with dyspnea. What is the priority nursing action?",
    questionType: "SingleChoice",
    sectionName: "Cardiology",
    options: [
      { id: "opt-1", numericId: 1, optionIndex: 1, optionText: "Elevate the head of the bed", isCorrect: true, specificRationale: "High Fowler's facilitates lung expansion and eases work of breathing." },
      { id: "opt-2", numericId: 2, optionIndex: 2, optionText: "Place client flat", isCorrect: false, specificRationale: "Lying flat worsens pulmonary congestion." },
    ],
    generalRationale: "Priority interventions for dyspnea in HF start with positioning to optimize oxygenation.",
  },
  {
    id: "q-2-sata",
    numericId: 102,
    guidId: "guid-q-2",
    stem: "Which signs indicate digoxin toxicity? Select all that apply.",
    questionType: "MultipleSelect",
    sectionName: "Pharmacology",
    options: [
      { id: "sata-1", numericId: 11, optionIndex: 1, optionText: "Anorexia and nausea", isCorrect: true, specificRationale: "Early gastrointestinal symptoms are common." },
      { id: "sata-2", numericId: 12, optionIndex: 2, optionText: "Visual disturbances (yellow-green halos)", isCorrect: true, specificRationale: "Classic visual halos denote toxicity." },
      { id: "sata-3", numericId: 13, optionIndex: 3, optionText: "Bradycardia", isCorrect: true, specificRationale: "Digoxin delays AV node conduction." },
      { id: "sata-4", numericId: 14, optionIndex: 4, optionText: "Hypertension", isCorrect: false, specificRationale: "Hypertension is not a characteristic sign." },
    ],
    correctAnswerMeta: {
      correctOptionIds: ["sata-1", "sata-2", "sata-3"],
    },
    generalRationale: "Digoxin toxicity presents with GI upset, bradyarrhythmias, and xanthopsia.",
  },
];

// Seed supported attempt (canTutor = true, deliveryMode initially Exam)
attemptStore.setAttempt({
  attemptId: attemptIdSupported,
  examId: "exam-supported",
  examNumericId: 1,
  examTitle: "Adult Health Exam",
  pathway: "RN",
  userId: testLearnerId,
  deliveryMode: "Exam",
  layoutMode: "Sequential",
  allowedLayouts: "Both",
  isTimed: false,
  timeLimitMinutes: 60,
  remainingSeconds: 3600,
  startedAtUtc: new Date().toISOString(),
  status: "InProgress",
  configuredQuestionCount: 2,
  passingScorePercentage: 75,
  attemptNumber: 1,
  modePermissions: {
    canExam: true,
    canReview: true,
    canTutor: true,
  },
  isDurableBackendSynced: true,
  integrityWarnings: [],
  questions: mockQuestions,
  savedResponses: {},
  tutorProgression: {},
  tutorConversations: {},
  tutorPracticeChecks: {},
});

// Seed unsupported attempt (canTutor = false)
attemptStore.setAttempt({
  attemptId: attemptIdUnsupported,
  examId: "exam-unsupported",
  examNumericId: 2,
  examTitle: "Benchmark Strict Exam",
  pathway: "RN",
  userId: testLearnerId,
  deliveryMode: "Exam",
  layoutMode: "Sequential",
  allowedLayouts: "Both",
  isTimed: true,
  timeLimitMinutes: 60,
  remainingSeconds: 3600,
  startedAtUtc: new Date().toISOString(),
  status: "InProgress",
  configuredQuestionCount: 2,
  passingScorePercentage: 75,
  attemptNumber: 1,
  modePermissions: {
    canExam: true,
    canReview: false,
    canTutor: false,
    tutorReason: "Tutor mode is not permitted for proctored benchmark exams.",
  },
  isDurableBackendSynced: true,
  integrityWarnings: [],
  questions: mockQuestions,
  savedResponses: {},
  tutorProgression: {},
  tutorConversations: {},
  tutorPracticeChecks: {},
});

// Evaluate supported question
const evalRes = attemptStore.evaluateTutorAnswer(
  testLearnerId,
  attemptIdSupported,
  "q-1",
  JSON.stringify({ SelectedOptionId: "opt-1" })
);
assert.strictEqual(evalRes.success, true, "Tutor evaluation must succeed when policy allows Tutor");
assert.strictEqual(evalRes.data?.isCorrect, true);
assert.ok(evalRes.data?.optionRationales?.length === 2);
const updatedAttempt = attemptStore.getAttempt(testLearnerId, attemptIdSupported);
assert.strictEqual(updatedAttempt?.deliveryMode, "Tutor", "Attempt deliveryMode should synchronize to Tutor upon evaluation");
assert.strictEqual(Object.keys(updatedAttempt?.savedResponses ?? {}).length, 0, "Examination savedResponses must remain unmodified by Tutor evaluation");
console.log("[PASS] Supported examination successfully evaluates in Tutor Mode without contaminating examination responses.");

// Verify unsupported examination route rejection contract
const evalRouteSrc = fs.readFileSync(path.join(repoRoot, "src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts"), "utf8");
assert.ok(
  evalRouteSrc.includes("loaded.attempt.modePermissions && !loaded.attempt.modePermissions.canTutor"),
  "Evaluate route checks authoritative canTutor policy"
);
assert.ok(
  evalRouteSrc.includes("TUTOR_NOT_PERMITTED"),
  "Evaluate route rejects unauthorized attempts with TUTOR_NOT_PERMITTED"
);
console.log("[PASS] Unsupported examination policy enforcement is preserved with TUTOR_NOT_PERMITTED rejection.");

// -------------------------------------------------------------
// 2. TUTOR & ASSESSMENT SEPARATION
// -------------------------------------------------------------
console.log("\n--- 2. Tutor and Assessment Mode Separation ---");

const examSessionSrc = fs.readFileSync(path.join(repoRoot, "src/app/exam-session/page.tsx"), "utf8");

// Assessment mode preserves restrictions:
// TutorModePanel is rendered only in Tutor deliveryMode
assert.ok(
  examSessionSrc.includes('deliveryMode === "Tutor" &&\n            attemptId &&'),
  "TutorModePanel must only render when deliveryMode is Tutor"
);

// Assessment mode suppresses rationales and answers review before submission
assert.ok(
  examSessionSrc.includes('isReview={deliveryMode === "Tutor" && !isSubmitted ? false : showReview}'),
  "Assessment area must not show answers before submission"
);

// Switching to Exam sets deliveryMode Exam and stage assessment
assert.ok(
  examSessionSrc.includes('setDeliveryMode("Exam");\n      setStage("assessment");'),
  "Switching to Exam mode strictly resets deliveryMode to Exam and stage to assessment"
);

console.log("[PASS] Assessment restrictions remain intact and Tutor learning controls are isolated to Tutor mode.");

// -------------------------------------------------------------
// 3. SATA EXACT-SELECTION-COUNT VALIDATION
// -------------------------------------------------------------
console.log("\n--- 3. SATA Exact-Selection-Count Validation ---");

const sataQuestion = mockQuestions[1]; // 3 correct options: sata-1, sata-2, sata-3

// Derive count from backend data
const derivedCount = extractRequiredSataCount(sataQuestion);
assert.strictEqual(derivedCount, 3, "Required count must equal 3 derived from backend correct answers");

// Test zero selections -> rejected with toast message
const zeroCheck = validateSataSelection(sataQuestion, JSON.stringify([]));
assert.strictEqual(zeroCheck.isValid, false);
assert.strictEqual(zeroCheck.requiredCount, 3);
assert.strictEqual(zeroCheck.selectedCount, 0);
assert.strictEqual(zeroCheck.message, "Please select exactly 3 answers before submitting.");

// Test 2 selections (fewer than 3) -> rejected
const twoCheck = validateSataSelection(sataQuestion, JSON.stringify(["sata-1", "sata-2"]));
assert.strictEqual(twoCheck.isValid, false);
assert.strictEqual(twoCheck.requiredCount, 3);
assert.strictEqual(twoCheck.selectedCount, 2);
assert.strictEqual(twoCheck.message, "Please select exactly 3 answers before submitting.");

// Test 4 selections (more than 3) -> rejected
const fourCheck = validateSataSelection(sataQuestion, JSON.stringify(["sata-1", "sata-2", "sata-3", "sata-4"]));
assert.strictEqual(fourCheck.isValid, false);
assert.strictEqual(fourCheck.requiredCount, 3);
assert.strictEqual(fourCheck.selectedCount, 4);
assert.strictEqual(fourCheck.message, "Please select exactly 3 answers before submitting.");

// Test exact 3 selections -> allowed
const exactCheck = validateSataSelection(sataQuestion, JSON.stringify(["sata-1", "sata-2", "sata-3"]));
assert.strictEqual(exactCheck.isValid, true);
assert.strictEqual(exactCheck.requiredCount, 3);
assert.strictEqual(exactCheck.selectedCount, 3);

// Test SingleChoice question is unaffected
const scCheck = validateSataSelection(mockQuestions[0], JSON.stringify({ SelectedOptionId: "opt-1" }));
assert.strictEqual(scCheck.isValid, true);
assert.strictEqual(scCheck.requiredCount, null);

console.log("[PASS] SATA validation enforces exact backend-derived count, displays correct toast message, and leaves other question types unaffected.");

// -------------------------------------------------------------
// 4. EXAM-BODY FILTERING ISOLATION (ATI vs HESI)
// -------------------------------------------------------------
console.log("\n--- 4. Exam-Body Filtering Isolation (ATI vs HESI) ---");

// Label simplification word boundaries:
assert.equal(simplifyExamBodyLabel("ATI Comprehensive Examination"), "ATI");
assert.equal(simplifyExamBodyLabel("HESI Comprehensive Examination"), "HESI");
assert.equal(simplifyExamBodyLabel("Pharmacology Medication Administration"), "Pharmacology Medication Administration");
assert.equal(simplifyExamBodyLabel("Pediatric Calculations & Dosage"), "Pediatric Calculations & Dosage");
assert.equal(simplifyExamBodyLabel("Kaplan Cat Practice"), "KAPLAN");
assert.equal(simplifyExamBodyLabel("RN Exit Predictor"), "EXIT");

// Mutual exclusivity in inferExamCategory:
const atiItem = {
  id: "ati-item-1",
  title: "ATI RN Adult Health Proctored Examination",
  courseName: "ATI Preparation",
  assessmentName: "ATI Adult Health Assessment",
};
assert.strictEqual(inferExamCategory(atiItem), "ATI");

const hesiItem = {
  id: "hesi-item-1",
  title: "HESI RN Exit Examination Medication Practice",
  courseName: "HESI Remediation",
  assessmentName: "HESI Specialty Assessment",
};
assert.strictEqual(inferExamCategory(hesiItem), "HESI");

// Verify that an exam classified as HESI does not match ATI filter
const hesiExamCategory = inferExamCategory(hesiItem);
assert.notStrictEqual(hesiExamCategory, "ATI", "HESI item category must not equal ATI");

// Verify that an exam classified as ATI does not match HESI filter
const atiExamCategory = inferExamCategory(atiItem);
assert.notStrictEqual(atiExamCategory, "HESI", "ATI item category must not equal HESI");

console.log("[PASS] ATI and HESI exam bodies are strictly mutually exclusive and word boundaries prevent substring misclassification.");

// -------------------------------------------------------------
// 5. HOMEPAGE HERO COPY
// -------------------------------------------------------------
console.log("\n--- 5. Homepage Hero Copy ---");

const pageTsx = fs.readFileSync(path.join(repoRoot, "src/app/page.tsx"), "utf8");
const homeTsx = fs.readFileSync(path.join(repoRoot, "src/app/(web)/pages/home/home.tsx"), "utf8");

assert.ok(
  pageTsx.includes('Turn Practice Into <span className="text-brand-teal">ATI</span>') &&
  pageTsx.includes('<span className="text-brand-teal">HESI</span>, and <span className="text-brand-teal">Examplify</span> Readiness'),
  "src/app/page.tsx must contain 'Turn Practice Into ATI, HESI, and Examplify Readiness'"
);
assert.ok(!pageTsx.includes("General</span> Readiness"), "src/app/page.tsx must not contain 'General Readiness'");

assert.ok(
  homeTsx.includes('Turn Practice Into <span className="text-[#0D9488]">ATI</span>') &&
  homeTsx.includes('<span className="text-[#0D9488]">HESI</span>, and <span className="text-[#0D9488]">Examplify</span> Readiness'),
  "src/app/(web)/pages/home/home.tsx must contain 'Turn Practice Into ATI, HESI, and Examplify Readiness'"
);
assert.ok(!homeTsx.includes("General</span> Readiness"), "src/app/(web)/pages/home/home.tsx must not contain 'General Readiness'");

console.log("[PASS] Homepage hero copy accurately displays 'Turn Practice Into ATI, HESI, and Examplify Readiness'.");

console.log("\nALL TARGETED FUNCTIONAL CORRECTIONS TESTS PASSED SUCCESSFULLY!");
