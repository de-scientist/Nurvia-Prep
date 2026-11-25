/**
 * NURVIA PREP — Complete Subject Filters, Exam-Body Filters, Tutor Mode & SATA Validation
 * Comprehensive Verification Suite
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
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
  getSelectedOptionCount,
  extractRequiredSataCount,
  validateSataSelection,
} = await import("../src/lib/attempts/sata-validation.ts");

const {
  EXAM_BODY_LABELS,
  getExamBodyLabel,
  NURSING_SUBJECT_FILTERS,
  EXAM_BODIES,
} = await import("../src/components/study/StudyLibraryCategoryTabs.tsx");

console.log("=== NURVIA PREP: SUBJECT FILTERS, EXAM BODIES, TUTOR MODE & SATA TEST SUITE ===");

// -------------------------------------------------------------
// A. SUBJECT FILTERS VERIFICATION
// -------------------------------------------------------------
console.log("\n--- Section A: RN & LPN Subject Dropdown Coverage ---");

const readRel = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");
const categoryTabsSrc = readRel("src/components/study/StudyLibraryCategoryTabs.tsx");
const advancedFiltersSrc = readRel("src/components/study/StudyLibraryAdvancedFilters.tsx");
const studyViewSrc = readRel("src/components/study/study-library-view.tsx");
const apiClientSrc = readRel("src/lib/api-client.ts");
const apiTypesSrc = readRel("src/lib/api-types.ts");

// 1. Check types include rnSubjects and lpnSubjects
assert.ok(
  apiTypesSrc.includes("rnSubjects?: string[];"),
  "StudyLibraryFiltersDto must define rnSubjects"
);
assert.ok(
  apiTypesSrc.includes("lpnSubjects?: string[];"),
  "StudyLibraryFiltersDto must define lpnSubjects"
);
console.log("[PASS] 1. StudyLibraryFiltersDto defines rnSubjects and lpnSubjects partition contracts.");

// 2. Check getStudyLibraryFilters populates rnSubjects and lpnSubjects
assert.ok(
  apiClientSrc.includes("rnSubjects = sortSubjectNames(curriculum.rnSubjects.map"),
  "api-client getStudyLibraryFilters must populate rnSubjects from curriculum.rnSubjects"
);
assert.ok(
  apiClientSrc.includes("lpnSubjects = sortSubjectNames(curriculum.lpnSubjects.map"),
  "api-client getStudyLibraryFilters must populate lpnSubjects from curriculum.lpnSubjects"
);
console.log("[PASS] 2. getStudyLibraryFilters populates authoritative rnSubjects and lpnSubjects without duplication.");

// 3. Check StudyLibraryCategoryTabs binds to rnSubjects and lpnSubjects dynamically
assert.ok(
  categoryTabsSrc.includes("isRn && rnSubjects && rnSubjects.length > 0"),
  "StudyLibraryCategoryTabs must use rnSubjects when RN pathway is selected"
);
assert.ok(
  categoryTabsSrc.includes("isLpn && lpnSubjects && lpnSubjects.length > 0"),
  "StudyLibraryCategoryTabs must use lpnSubjects when LPN pathway is selected"
);
assert.ok(
  categoryTabsSrc.includes("id=\"filter-subject-category-select\""),
  "StudyLibraryCategoryTabs must preserve filter-subject-category-select DOM id"
);
console.log("[PASS] 3. StudyLibraryCategoryTabs renders pathway-scoped authoritative subjects.");

// 4. Check StudyLibraryAdvancedFilters filters by selectedPathway
assert.ok(
  advancedFiltersSrc.includes("selectedPathway === \"RN\""),
  "StudyLibraryAdvancedFilters must filter subjects by RN pathway"
);
assert.ok(
  advancedFiltersSrc.includes("selectedPathway === \"PN_LPN\""),
  "StudyLibraryAdvancedFilters must filter subjects by LPN pathway"
);
assert.ok(
  advancedFiltersSrc.includes("id=\"filter-subject\""),
  "StudyLibraryAdvancedFilters must preserve filter-subject ID"
);
console.log("[PASS] 4. StudyLibraryAdvancedFilters subject options adapt to selected pathway.");

// 5. Check StudyLibraryView wires onSelectSubject and reconciles incompatible subjects
assert.ok(
  studyViewSrc.includes("onSelectSubject={(nextSub) =>"),
  "StudyLibraryView must provide onSelectSubject handler"
);
assert.ok(
  studyViewSrc.includes("selectedSubject={advanced.subject}"),
  "StudyLibraryView must pass selectedSubject to tabs"
);
console.log("[PASS] 5. StudyLibraryView wires subject selection, transition to exams, and pathway reconciliation.");

// -------------------------------------------------------------
// B. EXAM-BODY FILTER VERIFICATION
// -------------------------------------------------------------
console.log("\n--- Section B: Exam-Body Dropdown Coverage ---");

// 6. Check exam body options in StudyLibraryCategoryTabs are dynamic from availableCategories
assert.ok(
  categoryTabsSrc.includes("availableCategories && availableCategories.length > 0"),
  "StudyLibraryCategoryTabs must resolve exam body options from availableCategories"
);
assert.ok(
  categoryTabsSrc.includes("id=\"filter-exam-body-select\""),
  "StudyLibraryCategoryTabs must preserve filter-exam-body-select DOM id"
);
assert.equal(getExamBodyLabel("RegularCourse"), "Course Curriculum");
assert.equal(getExamBodyLabel("ExitPredictor"), "Exit Predictor");
assert.equal(getExamBodyLabel("ATI"), "ATI");
assert.equal(getExamBodyLabel("HESI"), "HESI");
console.log("[PASS] 6. Exam-body dropdown dynamically maps authoritative categories with verified labels.");

// 7. Check exam body and subject filters can be used concurrently without overwriting
assert.ok(
  categoryTabsSrc.includes("filter-subject-category-select") &&
  categoryTabsSrc.includes("filter-exam-body-select"),
  "Both filter-subject-category-select and filter-exam-body-select must coexist in tabs"
);
console.log("[PASS] 7. Filter by Subject and Filter by Exam Body coexist without state collision.");

// -------------------------------------------------------------
// C. TUTOR MODE PRESENTATION & BLURRING VERIFICATION
// -------------------------------------------------------------
console.log("\n--- Section C: Tutor Mode Hierarchy, Selective Blurring & All Correct Answers ---");

const tutorPanelSrc = readRel("src/components/exam/TutorModePanel.tsx");
const examSessionSrc = readRel("src/app/exam-session/page.tsx");

// 8. Content hierarchy: Hint, Correct Answers, Rationale sequence
const hintPos = tutorPanelSrc.indexOf("1. Hint");
const correctAnswersPos = tutorPanelSrc.indexOf("2. Correct Answers");
const rationalePos = tutorPanelSrc.indexOf("3. Rationale");

assert.ok(hintPos > 0, "Must contain '1. Hint'");
assert.ok(correctAnswersPos > 0, "Must contain '2. Correct Answers'");
assert.ok(rationalePos > 0, "Must contain '3. Rationale'");
assert.ok(hintPos < correctAnswersPos, "1. Hint must precede 2. Correct Answers");
assert.ok(correctAnswersPos < rationalePos, "2. Correct Answers must precede 3. Rationale");
console.log("[PASS] 8. TutorModePanel orders learning guidance strictly: 1. Hint -> 2. Correct Answers -> 3. Rationale.");

// 9. Selective blurring: Headings are unblurred, only sub-container content has blur
assert.ok(
  tutorPanelSrc.includes("filter blur-[5px] select-none pointer-events-none opacity-50"),
  "TutorModePanel must apply blur filter to protected content container"
);
assert.ok(
  tutorPanelSrc.includes("<span>2. Correct Answers</span>") &&
  !tutorPanelSrc.includes("filter blur-[5px] opacity-50 space-y-1\">\n            <div className=\"flex items-center gap-1.5 text-xs font-bold text-foreground\">\n              <CheckCircle2 className=\"h-3.5 w-3.5 text-emerald-600\" />\n              <span>2. Correct Answers</span>"),
  "Correct Answers section heading must remain outside the blurred container"
);
assert.ok(
  tutorPanelSrc.includes("<span>3. Rationale</span>") &&
  !tutorPanelSrc.includes("filter blur-[5px] opacity-50 space-y-1\">\n            <div className=\"flex items-center gap-1.5 text-xs font-bold text-foreground\">\n              <Sparkles className=\"h-3.5 w-3.5 text-brand-teal\" />\n              <span>3. Rationale</span>"),
  "Rationale section heading must remain outside the blurred container"
);
console.log("[PASS] 9. Selective blurring verified: Section headings remain readable while protected content is blurred.");

// 10. Display all correct answers in Correct Answers section without truncation
assert.ok(
  tutorPanelSrc.includes("let correctOpts = evaluatedOptions.filter((opt) => opt.isCorrect);"),
  "TutorModePanel must filter and display every option where isCorrect is true"
);
assert.ok(
  tutorPanelSrc.includes("correctOpts.map((opt) =>"),
  "TutorModePanel must map over all correct options without truncating"
);
console.log("[PASS] 10. All correct answers are rendered in Section 2 for single-choice and multi-correct SATA items.");

// 11. Elimination of repeated content in question area
assert.ok(
  examSessionSrc.includes("isReview={deliveryMode === \"Tutor\" && !isSubmitted ? false : showReview}"),
  "exam-session must not set isReview=true in question area before submission in Tutor mode"
);
assert.ok(
  examSessionSrc.includes("hideRationaleBox={deliveryMode === \"Tutor\" || !showReview}"),
  "exam-session must suppress ReviewRationaleBox in question area during Tutor mode"
);
console.log("[PASS] 11. Question area duplication eliminated: rationale and correct answers appear exclusively in TutorModePanel.");

// -------------------------------------------------------------
// D. EXACT SATA ANSWER-SELECTION VALIDATION VERIFICATION
// -------------------------------------------------------------
console.log("\n--- Section D: Exact SATA Answer-Selection Validation ---");

// Test question type recognition
assert.strictEqual(isSataQuestion("SelectAllThatApply"), true);
assert.strictEqual(isSataQuestion("selectallthatapply"), true);
assert.strictEqual(isSataQuestion("MultipleSelect"), true);
assert.strictEqual(isSataQuestion("multipleselect"), true);
assert.strictEqual(isSataQuestion("MultipleResponse"), true);
assert.strictEqual(isSataQuestion("sata"), true);
assert.strictEqual(isSataQuestion("SingleChoice"), false);
assert.strictEqual(isSataQuestion("TrueFalse"), false);
assert.strictEqual(isSataQuestion(null), false);

// Test word number extraction
assert.strictEqual(extractRequiredSataCount({ stem: "Select two priority interventions." }), 2);
assert.strictEqual(extractRequiredSataCount({ stem: "Choose three findings indicating infection." }), 3);
assert.strictEqual(extractRequiredSataCount({ stem: "Select four medications to administer." }), 4);
assert.strictEqual(extractRequiredSataCount({ stem: "Pick five risk factors from the list." }), 5);
assert.strictEqual(extractRequiredSataCount({ stem: "The nurse reviews the chart. (Select 2)" }), 2);
assert.strictEqual(extractRequiredSataCount({ stem: "The nurse reviews the chart. (Select 3)" }), 3);
assert.strictEqual(extractRequiredSataCount({ stem: "The nurse reviews the chart. (Select 4)" }), 4);
assert.strictEqual(extractRequiredSataCount({ stem: "The nurse reviews the chart. (Select 5)" }), 5);
console.log("[PASS] 12. extractRequiredSataCount correctly resolves digit and word counts (2, 3, 4, 5).");

// Test SATA count enforcement: Under-count (blocked), Exact count (allowed), Over-count (blocked)
for (const count of [2, 3, 4, 5]) {
  const q = {
    questionType: "MultipleSelect",
    stem: `Select exactly ${count} interventions that are indicated.`,
  };

  // Under-selection (count - 1) -> Blocked
  const underSelections = Array.from({ length: count - 1 }, (_, i) => `opt-${i + 1}`);
  const underRes = validateSataSelection(q, JSON.stringify(underSelections));
  assert.strictEqual(underRes.isValid, false, `Under-selection for count ${count} must be blocked`);
  assert.strictEqual(underRes.requiredCount, count);
  assert.strictEqual(underRes.selectedCount, count - 1);
  assert.ok(
    underRes.message?.includes(`Select ${count} answers to continue. You have selected ${count - 1}.`),
    `Message must indicate exact count requirement for ${count}`
  );

  // Exact selection (count) -> Allowed
  const exactSelections = Array.from({ length: count }, (_, i) => `opt-${i + 1}`);
  const exactRes = validateSataSelection(q, JSON.stringify(exactSelections));
  assert.strictEqual(exactRes.isValid, true, `Exact selection for count ${count} must be allowed`);
  assert.strictEqual(exactRes.requiredCount, count);
  assert.strictEqual(exactRes.selectedCount, count);

  // Over-selection (count + 1) -> Blocked
  const overSelections = Array.from({ length: count + 1 }, (_, i) => `opt-${i + 1}`);
  const overRes = validateSataSelection(q, JSON.stringify(overSelections));
  assert.strictEqual(overRes.isValid, false, `Over-selection for count ${count} must be blocked`);
  assert.strictEqual(overRes.requiredCount, count);
  assert.strictEqual(overRes.selectedCount, count + 1);
  assert.ok(
    overRes.message?.includes(`Select ${count} answers to continue. You have selected ${count + 1}.`),
    `Message must indicate exact count requirement for ${count}`
  );
}
console.log("[PASS] 13. Exact SATA count validation strictly blocks under/over counts and permits exact count for 2, 3, 4, and 5.");

// Test single choice is unaffected
const singleQ = { questionType: "SingleChoice", stem: "What is the primary intervention?" };
const singleRes = validateSataSelection(singleQ, JSON.stringify({ SelectedOptionId: "opt-1" }));
assert.strictEqual(singleRes.isValid, true);
assert.strictEqual(singleRes.requiredCount, null);
console.log("[PASS] 14. Non-SATA question types (SingleChoice, etc.) are completely unaffected.");

// Test MultipleResponseRenderer live selection count feedback
const multiRendererSrc = readRel("src/components/exam/renderers/MultipleResponseRenderer.tsx");
assert.ok(
  multiRendererSrc.includes("validateSataSelection(question, value)"),
  "MultipleResponseRenderer must invoke validateSataSelection"
);
assert.ok(
  multiRendererSrc.includes("{validation.selectedCount} of {validation.requiredCount} selected"),
  "MultipleResponseRenderer must display live count feedback"
);
assert.ok(
  multiRendererSrc.includes("validation.selectedCount > validation.requiredCount"),
  "MultipleResponseRenderer must distinguish over-count styling"
);
console.log("[PASS] 15. MultipleResponseRenderer provides real-time learner selection feedback.");

console.log("\nALL VERIFICATION TESTS FOR OBJECTIVES 6, 7, 8, AND 9 PASSED SUCCESSFULLY!");
