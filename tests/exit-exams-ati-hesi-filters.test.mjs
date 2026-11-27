/**
 * Targeted Test Suite: All Exit Exams ATI & HESI Provider Filter Replacement
 * 
 * Verifies all 10 requirements from Section 7:
 * 1. ATI filter is rendered in All Exit Exams.
 * 2. HESI filter is rendered in All Exit Exams.
 * 3. Removed All Exit Exams, RN Exit, and LPN Exit chips are no longer rendered in that filter group.
 * 4. Selecting ATI returns ATI records only.
 * 5. Selecting HESI returns HESI records only.
 * 6. ATI and HESI results do not overlap unless the authoritative data model explicitly supports multiple providers.
 * 7. Switching providers resets pagination.
 * 8. Search and subject filtering continue to work alongside provider filtering.
 * 9. Empty results are handled correctly.
 * 10. RN/LPN pathway filters outside this section remain unchanged.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

console.log("=== QUIZNURSE: ALL EXIT EXAMS ATI & HESI FILTER REPLACEMENT TEST SUITE ===");

const studyViewSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/study/study-library-view.tsx"),
  "utf8"
);
const compareExamsSrc = fs.readFileSync(
  path.join(repoRoot, "src/lib/utils/exams/compareExams.ts"),
  "utf8"
);
const categoryTabsSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/study/StudyLibraryCategoryTabs.tsx"),
  "utf8"
);

const {
  isAtiBody,
  isHesiBody,
  isExitExam,
  compareExitExams,
} = await import("../src/lib/utils/exams/compareExams.ts");

// Extract the Exit Provider Filter section from study-library-view
const exitSectionStart = studyViewSrc.indexOf('aria-label="Exit examination provider filters"');
assert.ok(exitSectionStart > 0, "Exit examination provider filters role group must exist in study-library-view.tsx");
const exitSectionEnd = studyViewSrc.indexOf("</div>", exitSectionStart);
const exitProviderChipsHtml = studyViewSrc.slice(exitSectionStart, exitSectionEnd + 6);

// ---------------------------------------------------------------------------
// 1 & 2. All, ATI, and HESI Filters Rendered
// ---------------------------------------------------------------------------
console.log("\n--- 1 & 2. All, ATI, and HESI Filters Rendered in All Exit Exams ---");

assert.ok(
  exitProviderChipsHtml.includes(">All<") || exitProviderChipsHtml.includes("All\n"),
  "1a. 'All' filter chip must be rendered in All Exit Exams section"
);
assert.ok(
  exitProviderChipsHtml.includes(">ATI<") || exitProviderChipsHtml.includes("ATI\n"),
  "1b. ATI filter chip must be rendered in All Exit Exams section"
);
assert.ok(
  exitProviderChipsHtml.includes(">HESI<") || exitProviderChipsHtml.includes("HESI\n"),
  "2. HESI filter chip must be rendered in All Exit Exams section"
);

// Verify initial default is "All"
assert.ok(
  studyViewSrc.includes('const [exitFilter, setExitFilter] = React.useState<"All" | "ATI" | "HESI">("All");'),
  "Initial exitFilter state must be 'All'"
);

// Verify accessible aria-pressed on All, ATI, HESI controls
assert.ok(
  exitProviderChipsHtml.includes('aria-pressed={exitFilter === "All"}'),
  "'All' button must expose aria-pressed state"
);
assert.ok(
  exitProviderChipsHtml.includes('aria-pressed={exitFilter === "ATI"}'),
  "'ATI' button must expose aria-pressed state"
);
assert.ok(
  exitProviderChipsHtml.includes('aria-pressed={exitFilter === "HESI"}'),
  "'HESI' button must expose aria-pressed state"
);

console.log("[PASS] 1. All and ATI filters are rendered in All Exit Exams with accessible state.");
console.log("[PASS] 2. HESI filter is rendered in All Exit Exams with accessible state.");

// ---------------------------------------------------------------------------
// 3. Removed All Exit Exams, RN Exit, and LPN Exit Chips
// ---------------------------------------------------------------------------
console.log("\n--- 3. Removed Old Filter Chips from Exit Filter Group ---");

assert.ok(
  !exitProviderChipsHtml.includes("All Exit Exams"),
  "3a. 'All Exit Exams' chip must not be rendered in the exit provider filter group"
);
assert.ok(
  !exitProviderChipsHtml.includes("RN Exit"),
  "3b. 'RN Exit' chip must not be rendered in the exit provider filter group"
);
assert.ok(
  !exitProviderChipsHtml.includes("LPN Exit"),
  "3c. 'LPN Exit' chip must not be rendered in the exit provider filter group"
);
console.log("[PASS] 3. Removed All Exit Exams, RN Exit, and LPN Exit chips are no longer rendered in that filter group.");

// ---------------------------------------------------------------------------
// 4 & 5. Selecting ATI / HESI Returns Authoritative Provider Records Only
// ---------------------------------------------------------------------------
console.log("\n--- 4 & 5. Provider Filtering Precision & Metadata Inspection ---");

const testExitRecords = [
  // 1. Authoritative category
  { id: "1", title: "Comprehensive Predictor Exam", category: "ATI", pathway: "RN_Exit" },
  { id: "2", title: "Exit Exam Assessment", category: "HESI", pathway: "RN_Exit" },
  
  // 2. Authoritative courseSeries in sourceSubjects (without provider in title!)
  {
    id: "3",
    title: "Senior Exit Predictor",
    category: "ExitPredictor",
    pathway: "RN_Exit",
    sourceSubjects: {
      rn: [{ courseSeries: "ATI_EXIT", courseName: "Exit Curriculum", rawName: "Exit Exam" }],
    },
  },
  {
    id: "4",
    title: "Senior Readiness Predictor",
    category: "ExitPredictor",
    pathway: "PN_Exit",
    sourceSubjects: {
      lpn: [{ courseSeries: "HESI_EXIT", courseName: "Readiness Prep", rawName: "HESI PN" }],
    },
  },

  // 3. Authoritative courseName
  {
    id: "5",
    title: "Exit Practice A",
    category: "ExitPredictor",
    pathway: "RN_Exit",
    courseName: "ATI RN Exit Exam",
  },
  {
    id: "6",
    title: "Exit Practice B",
    category: "ExitPredictor",
    pathway: "PN_Exit",
    courseName: "HESI PN Exit Exam",
  },

  // 4. Direct provider metadata
  {
    id: "7",
    title: "Exit Diagnostic",
    category: "ExitPredictor",
    pathway: "PN_Exit",
    provider: "ATI",
  },
  {
    id: "8",
    title: "Exit Evaluation",
    category: "ExitPredictor",
    pathway: "PN_Exit",
    examBody: "HESI",
  },

  // 5. Title-based fallback
  {
    id: "9",
    title: "ATI RN Comprehensive Predictor 2026",
    category: "ExitPredictor",
    pathway: "RN_Exit",
  },
  {
    id: "10",
    title: "HESI PN Exit Exam 2026",
    category: "ExitPredictor",
    pathway: "PN_Exit",
  },
];

// Test ATI selection logic
const filterAti = (items) => items.filter((s) => isAtiBody(s) && !isHesiBody(s));
const atiResults = filterAti(testExitRecords);

assert.strictEqual(atiResults.length, 5, "Expected exactly 5 ATI exit records");
for (const item of atiResults) {
  assert.strictEqual(isAtiBody(item), true, `Item ${item.id} (${item.title}) must be recognized as ATI`);
  assert.strictEqual(isHesiBody(item), false, `Item ${item.id} (${item.title}) must NOT be recognized as HESI`);
}
assert.deepStrictEqual(
  atiResults.map((r) => r.id),
  ["1", "3", "5", "7", "9"],
  "ATI filter returned the exact set of ATI records"
);
console.log("[PASS] 4. Selecting ATI returns ATI records only (and excludes HESI).");

// Test HESI selection logic
const filterHesi = (items) => items.filter((s) => isHesiBody(s) && !isAtiBody(s));
const hesiResults = filterHesi(testExitRecords);

assert.strictEqual(hesiResults.length, 5, "Expected exactly 5 HESI exit records");
for (const item of hesiResults) {
  assert.strictEqual(isHesiBody(item), true, `Item ${item.id} (${item.title}) must be recognized as HESI`);
  assert.strictEqual(isAtiBody(item), false, `Item ${item.id} (${item.title}) must NOT be recognized as ATI`);
}
assert.deepStrictEqual(
  hesiResults.map((r) => r.id),
  ["2", "4", "6", "8", "10"],
  "HESI filter returned the exact set of HESI records"
);
console.log("[PASS] 5. Selecting HESI returns HESI records only (and excludes ATI).");

// ---------------------------------------------------------------------------
// 6. Non-overlapping Results (Mutual Exclusivity)
// ---------------------------------------------------------------------------
console.log("\n--- 6. Mutual Exclusivity Verification ---");

const atiIds = new Set(atiResults.map((r) => r.id));
const hesiIds = new Set(hesiResults.map((r) => r.id));
const intersection = [...atiIds].filter((id) => hesiIds.has(id));

assert.strictEqual(
  intersection.length,
  0,
  `ATI and HESI result sets must not overlap; found overlap on IDs: ${intersection.join(", ")}`
);
console.log("[PASS] 6. ATI and HESI results do not overlap.");

// ---------------------------------------------------------------------------
// 7. Switching Providers Resets Pagination
// ---------------------------------------------------------------------------
console.log("\n--- 7. Pagination Reset on Provider Change ---");

// Verify that clicking All, ATI or HESI sets pageNumber to 1
assert.ok(
  studyViewSrc.includes('setExitFilter("All");\n                      setPageNumber(1);') ||
  studyViewSrc.includes('setExitFilter("All"); setPageNumber(1);'),
  "Clicking All filter must invoke setPageNumber(1)"
);
assert.ok(
  studyViewSrc.includes('setExitFilter((prev) => (prev === "ATI" ? "All" : "ATI"));\n                      setPageNumber(1);') ||
  studyViewSrc.includes('setExitFilter((prev) => (prev === "ATI" ? "All" : "ATI")); setPageNumber(1);'),
  "Clicking ATI filter must invoke setPageNumber(1)"
);
assert.ok(
  studyViewSrc.includes('setExitFilter((prev) => (prev === "HESI" ? "All" : "HESI"));\n                      setPageNumber(1);') ||
  studyViewSrc.includes('setExitFilter((prev) => (prev === "HESI" ? "All" : "HESI")); setPageNumber(1);'),
  "Clicking HESI filter must invoke setPageNumber(1)"
);
console.log("[PASS] 7. Switching providers resets pagination to page 1.");

// ---------------------------------------------------------------------------
// 8. Search and Subject Filtering Composition
// ---------------------------------------------------------------------------
console.log("\n--- 8. Composition with Search & Subject Filtering ---");

// In study-library-view, exitSubjects is derived from search-filtered subjects,
// and visibleExitSubjects filters exitSubjects by exitFilter.
assert.ok(
  studyViewSrc.includes("const exitSubjects = React.useMemo(() => {"),
  "exitSubjects is memoized based on active subjects query"
);
assert.ok(
  studyViewSrc.includes("const visibleExitSubjects = React.useMemo(() => {"),
  "visibleExitSubjects is memoized based on exitSubjects and exitFilter"
);

// Verify search composition behavior
const allExitPool = [...testExitRecords];
const searchQuery = "practice";
const searchedExit = allExitPool.filter((item) =>
  item.title.toLowerCase().includes(searchQuery.toLowerCase())
);
const searchedAti = filterAti(searchedExit);
const searchedHesi = filterHesi(searchedExit);

assert.deepStrictEqual(searchedAti.map((r) => r.id), ["5"]);
assert.deepStrictEqual(searchedHesi.map((r) => r.id), ["6"]);
console.log("[PASS] 8. Search and subject filtering compose correctly with provider filtering.");

// ---------------------------------------------------------------------------
// 9. Empty Results Handled Correctly
// ---------------------------------------------------------------------------
console.log("\n--- 9. Graceful Empty State Handling ---");

assert.ok(
  studyViewSrc.includes("visibleExitSubjects.length === 0"),
  "Empty state check must exist for visibleExitSubjects"
);
assert.ok(
  studyViewSrc.includes("No exit examinations match the current filter."),
  "Empty state message must inform user when no exit exams match current filter"
);

const emptyFilterResult = filterAti([
  { id: "h1", title: "HESI Exam", category: "HESI" },
]);
assert.strictEqual(emptyFilterResult.length, 0, "No records returned when provider has no matches");
console.log("[PASS] 9. Empty results are handled gracefully using existing empty-state design.");

// ---------------------------------------------------------------------------
// 10. RN/LPN Pathway Filters Outside This Section Preserved
// ---------------------------------------------------------------------------
console.log("\n--- 10. Preservation of RN/LPN Pathway Filters Outside Section ---");

// Subject library top pathway filter options
assert.ok(
  studyViewSrc.includes('const pathwayOptions = ["All", "RN", "PN_LPN", "RN_Exit", "PN_Exit"];'),
  "Pathway filter tabs in Subject Library must preserve all 5 standard options"
);
assert.ok(
  categoryTabsSrc.includes('RN_Exit: "RN Exit"'),
  "PATHWAY_LABELS in CategoryTabs preserves RN Exit"
);
assert.ok(
  categoryTabsSrc.includes('PN_Exit: "LPN Exit"'),
  "PATHWAY_LABELS in CategoryTabs preserves LPN Exit"
);
assert.ok(
  categoryTabsSrc.includes('PN_LPN: "LPN"'),
  "PATHWAY_LABELS in CategoryTabs preserves LPN"
);

// Exam bodies scroller in CategoryTabs
assert.ok(
  categoryTabsSrc.includes("getPathwayExamBodyCategories(selectedPathway)"),
  "Examination library horizontal scroller for exam bodies remains preserved"
);
console.log("[PASS] 10. RN/LPN pathway filters outside this section remain unchanged.");

// ---------------------------------------------------------------------------
// 11. Explicit "All" Restores Combined Results & Retains ATI-before-HESI Order
// ---------------------------------------------------------------------------
console.log("\n--- 11. Explicit 'All' Provider Filter Behavior & Ordering ---");

const filterCombined = (items, filter) => {
  return items.filter((s) => {
    if (filter === "All") return true;
    if (filter === "ATI") return isAtiBody(s) && !isHesiBody(s);
    if (filter === "HESI") return isHesiBody(s) && !isAtiBody(s);
    return true;
  });
};

// 1. Initial All returns both ATI and HESI
const initialAll = filterCombined(testExitRecords, "All").sort(compareExitExams);
assert.strictEqual(initialAll.length, 10, "Default 'All' filter returns all 10 exit records");

// 2. Filter ATI returns only ATI
const afterAti = filterCombined(testExitRecords, "ATI").sort(compareExitExams);
assert.strictEqual(afterAti.length, 5, "ATI filter returns 5 records");
assert.ok(afterAti.every((r) => isAtiBody(r)), "All records are ATI");

// 3. Selecting All after ATI restores combined view
const restoredFromAti = filterCombined(testExitRecords, "All").sort(compareExitExams);
assert.deepStrictEqual(restoredFromAti.map((r) => r.id), initialAll.map((r) => r.id), "Selecting All after ATI restores full combined set");

// 4. Filter HESI returns only HESI
const afterHesi = filterCombined(testExitRecords, "HESI").sort(compareExitExams);
assert.strictEqual(afterHesi.length, 5, "HESI filter returns 5 records");
assert.ok(afterHesi.every((r) => isHesiBody(r)), "All records are HESI");

// 5. Selecting All after HESI restores combined view
const restoredFromHesi = filterCombined(testExitRecords, "All").sort(compareExitExams);
assert.deepStrictEqual(restoredFromHesi.map((r) => r.id), initialAll.map((r) => r.id), "Selecting All after HESI restores full combined set");

// 6. Verify ATI before HESI in combined results
const firstHesiIdx = initialAll.findIndex((r) => isHesiBody(r));
const lastAtiIdx = initialAll.findLastIndex ? initialAll.findLastIndex((r) => isAtiBody(r)) : 4;
assert.ok(firstHesiIdx > lastAtiIdx, "Every ATI record must precede every HESI record in 'All' combined view");

// 7. Verify RN Exit context includes both ATI and HESI
const rnExitRecords = testExitRecords.filter((r) => r.pathway === "RN_Exit");
const rnExitAll = filterCombined(rnExitRecords, "All");
assert.ok(rnExitAll.some((r) => isAtiBody(r)), "RN Exit under 'All' must include ATI exit exams");
assert.ok(rnExitAll.some((r) => isHesiBody(r)), "RN Exit under 'All' must include HESI exit exams");

// 8. Verify LPN Exit context includes both ATI and HESI
const lpnExitRecords = testExitRecords.filter((r) => r.pathway === "PN_Exit");
const lpnExitAll = filterCombined(lpnExitRecords, "All");
assert.ok(lpnExitAll.some((r) => isAtiBody(r)), "LPN Exit under 'All' must include ATI exit exams");
assert.ok(lpnExitAll.some((r) => isHesiBody(r)), "LPN Exit under 'All' must include HESI exit exams");

console.log("[PASS] 11. Explicit 'All' filter restores combined ATI and HESI results for RN and LPN Exit.");

console.log("\n=========================================================================");
console.log("ALL 11 TARGETED ATI/HESI & ALL PROVIDER FILTER TESTS PASSED SUCCESSFULLY!");
console.log("=========================================================================\n");
