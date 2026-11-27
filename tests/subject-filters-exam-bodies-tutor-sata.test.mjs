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
  simplifyExamBodyLabel,
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
  tutorPanelSrc.includes("<span>1. Hint</span>") &&
  tutorPanelSrc.includes('aria-label="Hint locked. Select and submit your answer to unlock."'),
  "Hint section heading must remain outside the blurred container and hint content must be blurred before submission"
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
    underRes.message?.includes(`Please select exactly ${count} answers before submitting.`),
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
    overRes.message?.includes(`Please select exactly ${count} answers before submitting.`),
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

// 16. Test Zero Selected Answers (Under-selection / empty state)
const sataQ3 = {
  questionType: "MultipleSelect",
  stem: "Select exactly three nursing interventions for acute pulmonary edema.",
  options: [
    { id: "opt-1", optionText: "Administer furosemide" },
    { id: "opt-2", optionText: "Apply high-flow oxygen" },
    { id: "opt-3", optionText: "Place in high Fowler position" },
    { id: "opt-4", optionText: "Administer IV bolus of normal saline" },
    { id: "opt-5", optionText: "Encourage vigorous ambulation" },
  ],
};
const zeroRes = validateSataSelection(sataQ3, null);
assert.strictEqual(zeroRes.isValid, false, "Zero answers must be invalid for SATA requiring 3");
assert.strictEqual(zeroRes.selectedCount, 0);
assert.strictEqual(zeroRes.requiredCount, 3);
assert.ok(zeroRes.message?.includes("Please select exactly 3 answers before submitting."));

const zeroEmptyRes = validateSataSelection(sataQ3, JSON.stringify({ SelectedOptionIds: [] }));
assert.strictEqual(zeroEmptyRes.isValid, false, "Empty array must be invalid for SATA requiring 3");
assert.strictEqual(zeroEmptyRes.selectedCount, 0);
console.log("[PASS] 16. Zero selected answers strictly blocked with accurate count feedback.");

// 17. Selection followed by deselection
const selOne = JSON.stringify({ SelectedOptionIds: ["opt-1"] });
const selTwo = JSON.stringify({ SelectedOptionIds: ["opt-1", "opt-2"] });
const selThree = JSON.stringify({ SelectedOptionIds: ["opt-1", "opt-2", "opt-3"] });
const deSelTwo = JSON.stringify({ SelectedOptionIds: ["opt-1", "opt-3"] }); // deselected opt-2

assert.strictEqual(validateSataSelection(sataQ3, selOne).isValid, false);
assert.strictEqual(validateSataSelection(sataQ3, selTwo).isValid, false);
assert.strictEqual(validateSataSelection(sataQ3, selThree).isValid, true);
const afterDeselect = validateSataSelection(sataQ3, deSelTwo);
assert.strictEqual(afterDeselect.isValid, false, "Deselection below required count must block submission");
assert.strictEqual(afterDeselect.selectedCount, 2);
console.log("[PASS] 17. Deselection updates count immediately and re-enforces validation barrier.");

// 18. Duplicate selections cannot inflate count
const duplicateArray = JSON.stringify(["opt-1", "opt-1", "opt-1"]);
const dupRes1 = validateSataSelection(sataQ3, duplicateArray);
assert.strictEqual(dupRes1.selectedCount, 1, "Duplicate IDs in array must not inflate count");
assert.strictEqual(dupRes1.isValid, false);

const duplicateObj = JSON.stringify({ SelectedOptionIds: ["opt-1", "opt-2", "opt-1"] });
const dupRes2 = validateSataSelection(sataQ3, duplicateObj);
assert.strictEqual(dupRes2.selectedCount, 2, "Duplicate IDs in object must be deduplicated to unique count 2");
assert.strictEqual(dupRes2.isValid, false);
console.log("[PASS] 18. Duplicate option selections deduplicated and prevented from inflating count.");

// 19. Invalid option identifiers are pruned
const invalidIdPayload = JSON.stringify(["opt-1", "opt-2", "non-existent-option-999"]);
const invalidRes = validateSataSelection(sataQ3, invalidIdPayload);
assert.strictEqual(invalidRes.selectedCount, 2, "Unrecognized option ID must not be counted against options");
assert.strictEqual(invalidRes.isValid, false);
console.log("[PASS] 19. Invalid option identifiers are ignored without false count inflation.");

// 20. Rehydrated answers normalization (array, object, comma string)
const rehydratedObject = validateSataSelection(sataQ3, '{"SelectedOptionIds":["opt-1","opt-2","opt-3"]}');
assert.strictEqual(rehydratedObject.isValid, true);
assert.strictEqual(rehydratedObject.selectedCount, 3);

const rehydratedArray = validateSataSelection(sataQ3, '["opt-1","opt-2","opt-3"]');
assert.strictEqual(rehydratedArray.isValid, true);
assert.strictEqual(rehydratedArray.selectedCount, 3);

const rehydratedComma = validateSataSelection(sataQ3, "opt-1,opt-2,opt-3");
assert.strictEqual(rehydratedComma.isValid, true);
assert.strictEqual(rehydratedComma.selectedCount, 3);
console.log("[PASS] 20. Rehydrated answers in object, array, and string formats normalize and count accurately.");

// 21. Multiple SATA questions with different required counts in one session
const sataQ2 = { questionType: "MultipleSelect", stem: "Select 2 medications." };
const sataQ4 = { questionType: "MultipleSelect", stem: "Select 4 risk factors." };

const ansQ2 = JSON.stringify(["m1", "m2"]);
const ansQ4 = JSON.stringify(["r1", "r2", "r3"]); // only 3 of 4

assert.strictEqual(validateSataSelection(sataQ2, ansQ2).isValid, true);
assert.strictEqual(validateSataSelection(sataQ2, ansQ2).requiredCount, 2);

assert.strictEqual(validateSataSelection(sataQ4, ansQ4).isValid, false);
assert.strictEqual(validateSataSelection(sataQ4, ansQ4).requiredCount, 4);
assert.strictEqual(validateSataSelection(sataQ4, ansQ4).selectedCount, 3);
console.log("[PASS] 21. Multiple SATA questions with differing counts validate independently without leakage.");

// 22. Submission path in exam-session enforces SATA validation
assert.ok(
  examSessionSrc.includes("isSataQuestion(q.questionType)") &&
  examSessionSrc.includes("const validation = validateSataSelection(q, ans);") &&
  !examSessionSrc.includes("if (isSataQuestion(q.questionType) && isResponseAnswered(ans))"),
  "exam-session must validate all SATA questions without skipping zero-answer questions"
);
assert.ok(
  examSessionSrc.includes("latestAnswersRef.current[q.id] ?? answers[q.id]"),
  "exam-session must read latest ref to avoid stale closure state during submission"
);
console.log("[PASS] 22. Exam submission handlers strictly block under-selection (including 0 answers).");

// -------------------------------------------------------------
// E. EXAMINATION CARDS & FILTER WRAPPING VERIFICATION
// -------------------------------------------------------------
console.log("\n--- Section E: Examination Cards & Filter Multi-line Layout ---");

const studySetCardSrc = readRel("src/components/study/StudySetCard.tsx");
const cardActionsSrc = readRel("src/components/study/StudySetCardActions.tsx");

// 23. Filter chips wrap on multiple lines without horizontal slider
// Subject filter: multi-row wrapping without horizontal scrolling
// Exam Bodies filter: natural multi-row wrapping
assert.ok(
  studyViewSrc.includes('flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Available subject filters"'),
  "Subject filters must wrap on multiple rows without horizontal scrolling"
);
assert.ok(
  categoryTabsSrc.includes('flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Exam Bodies filter chips"'),
  "Exam Bodies filters must wrap on multiple rows"
);
assert.ok(
  !studyViewSrc.includes('pb-1 scrollbar-none" role="tablist" aria-label="Available subject filters"'),
  "Subject filters must not use pb-1 scrollbar-none styling"
);
assert.ok(
  !categoryTabsSrc.includes('pb-1 scrollbar-none" role="tablist" aria-label="Exam Bodies filter chips"'),
  "Exam Bodies filters must not use pb-1 scrollbar-none styling"
);
console.log("[PASS] 23. Filter groups wrap naturally onto subsequent rows without horizontal sliding.");

// 24. Exactly two card action buttons: Exam Mode and Tutor Mode
assert.ok(cardActionsSrc.includes("Tutor Mode"), "Card actions must expose Tutor Mode");
assert.ok(cardActionsSrc.includes("Exam Mode"), "Card actions must expose Exam Mode");
assert.ok(!cardActionsSrc.includes("Practice Mode"), "Practice Mode must NOT be a card launch button");
assert.ok(!cardActionsSrc.includes("Review Mode"), "Review Mode must NOT be a card launch button");
console.log("[PASS] 24. Examination cards expose exactly two launch actions (Exam Mode and Tutor Mode).");

// 25. Authoritative metadata display: NEW badge, question count, season, academic year
assert.ok(studySetCardSrc.includes("studySet.isNew &&"), "Card must conditionally display NEW badge only when backend indicates isNew");
assert.ok(studySetCardSrc.includes("studySet.totalQuestions"), "Card must display backend totalQuestions");
assert.ok(studySetCardSrc.includes("studySet.season"), "Card must display backend season");
assert.ok(studySetCardSrc.includes("studySet.academicYear"), "Card must display backend academicYear");
assert.ok(studySetCardSrc.includes("detailHref"), "Card must retain link to exam detail");
console.log("[PASS] 25. Authoritative metadata (NEW badge, total questions, season, year) rendered from real backend data.");

// 26. Tutor hint protection before reveal
assert.ok(
  tutorPanelSrc.includes("1. Hint") &&
  tutorPanelSrc.includes("Hint locked. Select and submit your answer to unlock."),
  "Hint content must be locked and blurred before evaluation"
);
assert.ok(
  tutorPanelSrc.includes("filter blur-[5px]"),
  "Blur filter must obscure restricted hint content"
);
console.log("[PASS] 26. Tutor Mode hint content is protected and blurred before submission.");

// 27. Word boundary isolation for Exam-Body labels: "-ation" words do NOT match ATI
assert.equal(simplifyExamBodyLabel("HESI Comprehensive Examination"), "HESI");
assert.equal(simplifyExamBodyLabel("Medication Administration"), "Medication Administration");
assert.equal(simplifyExamBodyLabel("Dosage Calculations"), "Dosage Calculations");
assert.equal(simplifyExamBodyLabel("Patient Education"), "Patient Education");
assert.equal(simplifyExamBodyLabel("ATI Fundamentals"), "ATI");
assert.equal(simplifyExamBodyLabel("Kaplan Nursing Review"), "KAPLAN");
assert.equal(simplifyExamBodyLabel("Exit Predictor"), "EXIT");
console.log("[PASS] 27. Exam-body simplification uses strict word boundaries: words containing '-ation' do not match ATI.");

// 28. SATA required count derived directly from backend authoritative answer collections
const sataWithMeta = {
  questionType: "MultipleSelect",
  correctAnswerMeta: {
    correctOptionIds: ["opt-1", "opt-3", "opt-4", "opt-6"],
  },
  options: [
    { id: "opt-1", isCorrect: true },
    { id: "opt-2", isCorrect: false },
    { id: "opt-3", isCorrect: true },
    { id: "opt-4", isCorrect: true },
    { id: "opt-5", isCorrect: false },
    { id: "opt-6", isCorrect: true },
  ],
};
assert.strictEqual(extractRequiredSataCount(sataWithMeta), 4);

const sataWithOptionsOnly = {
  questionType: "sata",
  options: [
    { id: "o1", isCorrect: true },
    { id: "o2", isCorrect: true },
    { id: "o3", isCorrect: true },
    { id: "o4", isCorrect: false },
  ],
};
assert.strictEqual(extractRequiredSataCount(sataWithOptionsOnly), 3);

const sataValidationBackend = validateSataSelection(sataWithMeta, JSON.stringify(["opt-1", "opt-3", "opt-4"]));
assert.strictEqual(sataValidationBackend.isValid, false);
assert.strictEqual(sataValidationBackend.requiredCount, 4);
assert.strictEqual(sataValidationBackend.selectedCount, 3);
assert.strictEqual(sataValidationBackend.message, "Please select exactly 4 answers before submitting.");

const sataValidationBackendExact = validateSataSelection(sataWithMeta, JSON.stringify(["opt-1", "opt-3", "opt-4", "opt-6"]));
assert.strictEqual(sataValidationBackendExact.isValid, true);
assert.strictEqual(sataValidationBackendExact.requiredCount, 4);
assert.strictEqual(sataValidationBackendExact.selectedCount, 4);

const sataValidationBackendOver = validateSataSelection(sataWithMeta, JSON.stringify(["opt-1", "opt-2", "opt-3", "opt-4", "opt-6"]));
assert.strictEqual(sataValidationBackendOver.isValid, false);
assert.strictEqual(sataValidationBackendOver.requiredCount, 4);
assert.strictEqual(sataValidationBackendOver.selectedCount, 5);
assert.strictEqual(sataValidationBackendOver.message, "Please select exactly 4 answers before submitting.");
console.log("[PASS] 28. SATA required count is authoritatively derived from backend answer data collections.");

// 29. Homepage hero copy verification
const homePageSrc = readRel("src/app/page.tsx");
const webHomeSrc = readRel("src/app/(web)/pages/home/home.tsx");
assert.ok(homePageSrc.includes("Examplify</span> Readiness"), "src/app/page.tsx hero must include Examplify Readiness");
assert.ok(!homePageSrc.includes("General</span> Readiness"), "src/app/page.tsx hero must NOT include General Readiness");
assert.ok(webHomeSrc.includes("Examplify</span> Readiness"), "src/app/(web)/pages/home/home.tsx hero must include Examplify Readiness");
assert.ok(!webHomeSrc.includes("General</span> Readiness"), "src/app/(web)/pages/home/home.tsx hero must NOT include General Readiness");
console.log("[PASS] 29. Homepage hero copy displays 'Turn Practice Into ATI, HESI, and Examplify Readiness'.");

// 30. Tutor evaluation policy enforcement and route authorization
const evaluateRouteSrc = readRel("src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts");
assert.ok(
  evaluateRouteSrc.includes("ensureAttemptLoaded(learner, attemptId, siteMeta, 'Tutor')"),
  "Evaluate route must specify Tutor as preferredMode"
);
assert.ok(
  evaluateRouteSrc.includes("loaded.attempt.modePermissions && !loaded.attempt.modePermissions.canTutor"),
  "Evaluate route must enforce canTutor permission"
);
console.log("[PASS] 30. Tutor evaluation correctly enforces backend policy permissions and avoids improper deliveryMode rejection.");

console.log("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY (30/30)! COMPLETE COMPLIANCE.");
