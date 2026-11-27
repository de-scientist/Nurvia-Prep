/**
 * Exit Exam Provider Grouping and Chronological Ordering Test Suite
 * Mandatory Requirement 4 Verification:
 *
 * 1. ATI 2026 precedes ATI 2025, 2024, and 2023.
 * 2. All ATI exams appear before HESI 2026.
 * 3. HESI exams follow the sequence 2026, 2025, 2024, 2023.
 * 4. Default All Exit Exams ordering does not interleave ATI and HESI.
 * 5. ATI-only filtering preserves ATI chronological order.
 * 6. HESI-only filtering preserves HESI chronological order.
 * 7. Sorting is applied before pagination.
 * 8. Missing academic-year values do not incorrectly precede valid years.
 * 9. The ordering is deterministic when multiple exams share the same year.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

console.log("=== REQUIREMENT 4: EXIT EXAM PROVIDER GROUPING & ORDERING TESTS ===");

const {
  compareExitExams,
  extractExamYear,
  isAtiBody,
  isHesiBody,
  isExitExam,
  sortExitExams,
  filterExitExams,
  paginateExitExams,
  getOrderedExitExams,
} = await import("../src/lib/utils/exams/compareExams.ts");

// Sample Exit Exam Dataset (Available years 2026 down to 2023 for both providers)
const sampleAti2026 = { id: "ati-01", category: "ATI", academicYear: 2026, title: "ATI Comprehensive Predictor 2026", pathway: "RN_Exit" };
const sampleAti2025 = { id: "ati-02", category: "ATI", academicYear: 2025, title: "ATI Comprehensive Predictor 2025", pathway: "RN_Exit" };
const sampleAti2024 = { id: "ati-03", category: "ATI", academicYear: 2024, title: "ATI Comprehensive Predictor 2024", pathway: "RN_Exit" };
const sampleAti2023 = { id: "ati-04", category: "ATI", academicYear: 2023, title: "ATI Comprehensive Predictor 2023", pathway: "RN_Exit" };

const sampleHesi2026 = { id: "hesi-01", category: "HESI", academicYear: 2026, title: "HESI RN Exit Exam 2026", pathway: "RN_Exit" };
const sampleHesi2025 = { id: "hesi-02", category: "HESI", academicYear: 2025, title: "HESI RN Exit Exam 2025", pathway: "RN_Exit" };
const sampleHesi2024 = { id: "hesi-03", category: "HESI", academicYear: 2024, title: "HESI RN Exit Exam 2024", pathway: "RN_Exit" };
const sampleHesi2023 = { id: "hesi-04", category: "HESI", academicYear: 2023, title: "HESI RN Exit Exam 2023", pathway: "RN_Exit" };

// ---------------------------------------------------------------------------
// Test 1: ATI 2026 precedes ATI 2025, 2024, and 2023
// ---------------------------------------------------------------------------
console.log("\n--- Test 1: ATI 2026 precedes ATI 2025, 2024, and 2023 ---");
{
  const atiJumbled = [sampleAti2024, sampleAti2026, sampleAti2023, sampleAti2025];
  const sorted = sortExitExams(atiJumbled);
  const years = sorted.map((e) => extractExamYear(e));

  assert.deepStrictEqual(years, [2026, 2025, 2024, 2023], "ATI exams must sequence 2026, 2025, 2024, 2023");
  assert.strictEqual(sorted[0].id, "ati-01", "ATI 2026 must appear first");
  assert.strictEqual(sorted[1].id, "ati-02", "ATI 2025 must appear second");
  assert.strictEqual(sorted[2].id, "ati-03", "ATI 2024 must appear third");
  assert.strictEqual(sorted[3].id, "ati-04", "ATI 2023 must appear fourth");
  console.log("[PASS] Test 1: ATI 2026 strictly precedes 2025, 2024, and 2023.");
}

// ---------------------------------------------------------------------------
// Test 2: All ATI exams appear before HESI 2026
// ---------------------------------------------------------------------------
console.log("\n--- Test 2: All ATI exams appear before HESI 2026 ---");
{
  // Even the oldest ATI exam (2023) must precede the newest HESI exam (2026)
  const diffOldestAtiVsNewestHesi = compareExitExams(sampleAti2023, sampleHesi2026);
  assert.ok(diffOldestAtiVsNewestHesi < 0, "ATI 2023 must precede HESI 2026");

  const diffNewestHesiVsOldestAti = compareExitExams(sampleHesi2026, sampleAti2023);
  assert.ok(diffNewestHesiVsOldestAti > 0, "HESI 2026 must follow ATI 2023");

  const mixed = [sampleHesi2026, sampleAti2023, sampleAti2024, sampleAti2025, sampleAti2026];
  const sorted = sortExitExams(mixed);

  const hesiIndex = sorted.findIndex((e) => isHesiBody(e));
  assert.strictEqual(hesiIndex, 4, "HESI 2026 must appear after all 4 ATI exams");
  for (let i = 0; i < 4; i++) {
    assert.ok(isAtiBody(sorted[i]), `Position ${i} must be an ATI exam`);
  }
  console.log("[PASS] Test 2: All ATI exams appear strictly before HESI 2026.");
}

// ---------------------------------------------------------------------------
// Test 3: HESI exams follow the sequence 2026, 2025, 2024, 2023
// ---------------------------------------------------------------------------
console.log("\n--- Test 3: HESI exams follow the sequence 2026, 2025, 2024, 2023 ---");
{
  const hesiJumbled = [sampleHesi2023, sampleHesi2025, sampleHesi2024, sampleHesi2026];
  const sorted = sortExitExams(hesiJumbled);
  const years = sorted.map((e) => extractExamYear(e));

  assert.deepStrictEqual(years, [2026, 2025, 2024, 2023], "HESI exams must sequence 2026, 2025, 2024, 2023");
  assert.strictEqual(sorted[0].id, "hesi-01", "HESI 2026 must appear first");
  assert.strictEqual(sorted[1].id, "hesi-02", "HESI 2025 must appear second");
  assert.strictEqual(sorted[2].id, "hesi-03", "HESI 2024 must appear third");
  assert.strictEqual(sorted[3].id, "hesi-04", "HESI 2023 must appear fourth");
  console.log("[PASS] Test 3: HESI exams strictly follow the sequence 2026, 2025, 2024, 2023.");
}

// ---------------------------------------------------------------------------
// Test 4: Default All Exit Exams ordering does not interleave ATI and HESI
// ---------------------------------------------------------------------------
console.log("\n--- Test 4: Default All Exit Exams ordering does not interleave ATI and HESI ---");
{
  const mixedAll = [
    sampleHesi2025,
    sampleAti2023,
    sampleHesi2026,
    sampleAti2026,
    sampleHesi2023,
    sampleAti2024,
    sampleHesi2024,
    sampleAti2025,
  ];

  const sorted = sortExitExams(mixedAll);
  const providerSequence = sorted.map((e) => (isAtiBody(e) ? "ATI" : "HESI"));
  const expectedProviders = ["ATI", "ATI", "ATI", "ATI", "HESI", "HESI", "HESI", "HESI"];
  assert.deepStrictEqual(providerSequence, expectedProviders, "Provider sequence must be all ATI followed by all HESI");

  const yearSequence = sorted.map((e) => extractExamYear(e));
  const expectedYears = [2026, 2025, 2024, 2023, 2026, 2025, 2024, 2023];
  assert.deepStrictEqual(yearSequence, expectedYears, "Years must sequence 2026->2023 for ATI, then 2026->2023 for HESI");

  // Check no global year sort interleaving (global year sort would produce [2026, 2026, 2025, 2025...])
  for (let i = 0; i < 4; i++) {
    assert.ok(isAtiBody(sorted[i]), `Item ${i} must be ATI`);
  }
  for (let i = 4; i < 8; i++) {
    assert.ok(isHesiBody(sorted[i]), `Item ${i} must be HESI`);
  }
  console.log("[PASS] Test 4: Default All Exit Exams ordering does not interleave ATI and HESI.");
}

// ---------------------------------------------------------------------------
// Test 5: ATI-only filtering preserves ATI chronological order
// ---------------------------------------------------------------------------
console.log("\n--- Test 5: ATI-only filtering preserves ATI chronological order ---");
{
  const mixedAll = [
    sampleHesi2026,
    sampleAti2024,
    sampleHesi2024,
    sampleAti2026,
    sampleHesi2025,
    sampleAti2023,
    sampleAti2025,
    sampleHesi2023,
  ];

  const atiOnly = filterExitExams(sortExitExams(mixedAll), "ATI");
  assert.strictEqual(atiOnly.length, 4, "Must contain exactly 4 ATI exams");
  assert.ok(atiOnly.every((e) => isAtiBody(e)), "All filtered items must be ATI");

  const years = atiOnly.map((e) => extractExamYear(e));
  assert.deepStrictEqual(years, [2026, 2025, 2024, 2023], "ATI-only filter must preserve descending year order");
  console.log("[PASS] Test 5: ATI-only filtering preserves ATI chronological order.");
}

// ---------------------------------------------------------------------------
// Test 6: HESI-only filtering preserves HESI chronological order
// ---------------------------------------------------------------------------
console.log("\n--- Test 6: HESI-only filtering preserves HESI chronological order ---");
{
  const mixedAll = [
    sampleHesi2026,
    sampleAti2024,
    sampleHesi2024,
    sampleAti2026,
    sampleHesi2025,
    sampleAti2023,
    sampleAti2025,
    sampleHesi2023,
  ];

  const hesiOnly = filterExitExams(sortExitExams(mixedAll), "HESI");
  assert.strictEqual(hesiOnly.length, 4, "Must contain exactly 4 HESI exams");
  assert.ok(hesiOnly.every((e) => isHesiBody(e)), "All filtered items must be HESI");

  const years = hesiOnly.map((e) => extractExamYear(e));
  assert.deepStrictEqual(years, [2026, 2025, 2024, 2023], "HESI-only filter must preserve descending year order");
  console.log("[PASS] Test 6: HESI-only filtering preserves HESI chronological order.");
}

// ---------------------------------------------------------------------------
// Test 7: Sorting is applied before pagination
// ---------------------------------------------------------------------------
console.log("\n--- Test 7: Sorting is applied before pagination ---");
{
  const mixedAll = [
    sampleHesi2025,
    sampleAti2023,
    sampleHesi2026,
    sampleAti2026,
    sampleHesi2023,
    sampleAti2024,
    sampleHesi2024,
    sampleAti2025,
  ];

  // Paginate with page size = 3
  const page1 = getOrderedExitExams(mixedAll, { provider: "All", pageNumber: 1, pageSize: 3 });
  const page2 = getOrderedExitExams(mixedAll, { provider: "All", pageNumber: 2, pageSize: 3 });
  const page3 = getOrderedExitExams(mixedAll, { provider: "All", pageNumber: 3, pageSize: 3 });

  assert.strictEqual(page1.totalCount, 8, "Total count must be 8");
  assert.strictEqual(page1.totalPages, 3, "Total pages must be 3");

  // Page 1: Top 3 ATI exams (2026, 2025, 2024) - NO HESI records on Page 1!
  assert.deepStrictEqual(
    page1.items.map((e) => e.id),
    ["ati-01", "ati-02", "ati-03"],
    "Page 1 must contain only ATI 2026, 2025, 2024"
  );
  assert.ok(page1.items.every((e) => isAtiBody(e)), "Page 1 must contain ONLY ATI records");

  // Page 2: Remaining ATI exam (2023), followed by top HESI exams (2026, 2025)
  assert.deepStrictEqual(
    page2.items.map((e) => e.id),
    ["ati-04", "hesi-01", "hesi-02"],
    "Page 2 must contain ATI 2023, then HESI 2026, then HESI 2025"
  );
  assert.ok(isAtiBody(page2.items[0]), "First item on page 2 must be remaining ATI 2023 record");
  assert.ok(isHesiBody(page2.items[1]), "Second item on page 2 must be HESI 2026");
  assert.ok(isHesiBody(page2.items[2]), "Third item on page 2 must be HESI 2025");

  // Page 3: Remaining HESI exams (2024, 2023)
  assert.deepStrictEqual(
    page3.items.map((e) => e.id),
    ["hesi-03", "hesi-04"],
    "Page 3 must contain HESI 2024, HESI 2023"
  );

  // Result count calculation from filtered dataset
  const atiPaged = getOrderedExitExams(mixedAll, { provider: "ATI", pageNumber: 1, pageSize: 3 });
  assert.strictEqual(atiPaged.totalCount, 4, "Filtered result count must reflect ATI only (4 items)");
  assert.strictEqual(atiPaged.totalPages, 2, "Filtered totalPages must reflect ATI only (2 pages)");

  console.log("[PASS] Test 7: Sorting is applied before pagination; pagination never causes HESI records to precede remaining ATI records.");
}

// ---------------------------------------------------------------------------
// Test 8: Missing academic-year values do not incorrectly precede valid years
// ---------------------------------------------------------------------------
console.log("\n--- Test 8: Missing academic-year values do not incorrectly precede valid years ---");
{
  const examNullYear = { id: "ati-null", category: "ATI", academicYear: null, title: "ATI RN Predictor Undated" };
  const examUndefinedYear = { id: "ati-undef", category: "ATI", academicYear: undefined, title: "ATI RN Predictor Missing Year" };
  const examEmptyYear = { id: "ati-empty", category: "ATI", academicYear: "", title: "ATI RN Predictor Empty Year" };
  const examDated2023 = { id: "ati-2023", category: "ATI", academicYear: 2023, title: "ATI RN Predictor 2023" };
  const examDated2024WithOldTitle = {
    id: "ati-2024-auth",
    category: "ATI",
    academicYear: 2024,
    title: "ATI RN Comprehensive Exit 2026 Old Version",
    createdAt: "2026-11-20T10:00:00Z",
  };

  // 1. Authoritative field rule: Must use academicYear 2024, NOT title 2026 and NOT createdAt
  assert.strictEqual(
    extractExamYear(examDated2024WithOldTitle),
    2024,
    "Authoritative academicYear field must take precedence over title parsing and createdAt"
  );

  // 2. Missing values return 0 and do not infer from title when dedicated field exists
  const examNullWithYearInTitle = { id: "ati-null-title", category: "ATI", academicYear: null, title: "ATI Exit Exam 2026" };
  assert.strictEqual(
    extractExamYear(examNullWithYearInTitle),
    0,
    "Dedicated academicYear=null must not fallback to title parsing"
  );
  assert.strictEqual(extractExamYear(examNullYear), 0, "Null academicYear returns 0");
  assert.strictEqual(extractExamYear(examUndefinedYear), 0, "Undefined academicYear returns 0");
  assert.strictEqual(extractExamYear(examEmptyYear), 0, "Empty academicYear returns 0");

  // 3. Sorting order: Valid years (2024, 2023) MUST precede missing academic year records
  const mixedYears = [examNullYear, examDated2023, examUndefinedYear, examDated2024WithOldTitle, examEmptyYear];
  const sorted = sortExitExams(mixedYears);

  assert.strictEqual(sorted[0].id, "ati-2024-auth", "Valid year 2024 must be first");
  assert.strictEqual(sorted[1].id, "ati-2023", "Valid year 2023 must be second");

  // Missing year records must follow after all dated records
  const remainingIds = sorted.slice(2).map((e) => e.id);
  assert.ok(
    remainingIds.includes("ati-null") &&
    remainingIds.includes("ati-undef") &&
    remainingIds.includes("ati-empty"),
    "All undated records must appear after all dated records"
  );

  // Ensure an undated ATI record does NOT precede a dated ATI record
  assert.ok(compareExitExams(examDated2023, examNullYear) < 0, "Dated 2023 must precede null year");
  assert.ok(compareExitExams(examNullYear, examDated2023) > 0, "Null year must follow dated 2023");

  console.log("[PASS] Test 8: Missing academic-year values do not incorrectly precede valid years.");
}

// ---------------------------------------------------------------------------
// Test 9: The ordering is deterministic when multiple exams share the same year
// ---------------------------------------------------------------------------
console.log("\n--- Test 9: The ordering is deterministic when multiple exams share the same year ---");
{
  const examSameYear1 = { id: "ati-2025-b", category: "ATI", academicYear: 2025, title: "ATI Pharmacology Exit 2025" };
  const examSameYear2 = { id: "ati-2025-a", category: "ATI", academicYear: 2025, title: "ATI Fundamentals Exit 2025" };
  const examSameYear3 = { id: "ati-2025-c", category: "ATI", academicYear: 2025, title: "ATI Maternal Exit 2025", order: 1 };

  // Multiple runs with different starting orders
  const run1 = sortExitExams([examSameYear1, examSameYear2, examSameYear3]);
  const run2 = sortExitExams([examSameYear3, examSameYear1, examSameYear2]);
  const run3 = sortExitExams([examSameYear2, examSameYear3, examSameYear1]);

  const run1Ids = run1.map((e) => e.id);
  const run2Ids = run2.map((e) => e.id);
  const run3Ids = run3.map((e) => e.id);

  assert.deepStrictEqual(run1Ids, run2Ids, "Run 1 and Run 2 must yield identical deterministic ordering");
  assert.deepStrictEqual(run2Ids, run3Ids, "Run 2 and Run 3 must yield identical deterministic ordering");

  // Exam with explicit order=1 must come before exams without order
  assert.strictEqual(run1[0].id, "ati-2025-c", "Exam with order=1 must sort first among same year");
  // Secondary sort by title localeCompare: "ATI Fundamentals Exit 2025" before "ATI Pharmacology Exit 2025"
  assert.strictEqual(run1[1].id, "ati-2025-a", "Exam with alphabetically earlier title must sort second");
  assert.strictEqual(run1[2].id, "ati-2025-b", "Exam with alphabetically later title must sort third");

  console.log("[PASS] Test 9: Ordering is 100% deterministic when multiple exams share the same year.");
}

// ---------------------------------------------------------------------------
// Verification of UI View & API client compliance
// ---------------------------------------------------------------------------
console.log("\n--- Source Inspection: StudyLibraryView & API Client ---");
const studyViewSrc = fs.readFileSync(path.join(repoRoot, "src/components/study/study-library-view.tsx"), "utf8");
const apiClientSrc = fs.readFileSync(path.join(repoRoot, "src/lib/api-client.ts"), "utf8");

// View resets pagination on filter change
assert.ok(
  studyViewSrc.includes('setExitFilter((prev) => (prev === "ATI" ? "All" : "ATI"));\n                      setPageNumber(1);') ||
  studyViewSrc.includes('setExitFilter((prev) => (prev === "ATI" ? "All" : "ATI"));') && studyViewSrc.includes('setPageNumber(1);'),
  "Reset pagination when changing provider filter"
);

// Sorting is applied before pagination in api-client
assert.ok(
  apiClientSrc.includes("mappedItems.sort"),
  "api-client getStudyLibrary applies sort"
);
assert.ok(
  apiClientSrc.includes("mappedItems.slice"),
  "api-client getStudyLibrary paginates after sorting"
);
const getStudyLibSection = apiClientSrc.slice(apiClientSrc.indexOf("async getStudyLibrary("));
const sortPos = getStudyLibSection.indexOf("mappedItems.sort");
const slicePos = getStudyLibSection.indexOf("mappedItems.slice");
assert.ok(sortPos > 0 && slicePos > 0, "Both sorting and slice must exist in getStudyLibrary");
assert.ok(sortPos < slicePos, "Sorting must strictly precede pagination slice in getStudyLibrary");

console.log("[PASS] UI View & API Client adhere to provider grouping, ordering, and pagination requirements.");

console.log("\n=========================================================================");
console.log("ALL 9 EXIT EXAM PROVIDER GROUPING & ORDERING TESTS PASSED PERFECTLY!");
console.log("=========================================================================");
