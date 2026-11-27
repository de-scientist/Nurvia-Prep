/**
 * Exit Examination Classification, Capstone, and Exam Body Filters Test Suite
 * Covers:
 * 1. Capstone classification: Capstone is an ordinary subject, NOT an Exit examination
 * 2. Exit examination ordering: ATI Exit first, then HESI Exit
 * 3. Descending chronological ordering: 2026 before 2025 before 2024
 * 4. Exact 6 Exam Body filter categories per pathway (RN vs LPN)
 * 5. Strict mutual exclusivity: RN has GENERAL (no KAP-LAN), LPN has KAP-LAN (no GENERAL)
 * 6. Responsive non-scrolling wrapping layout
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

console.log("=== EXIT EXAMINATIONS, CAPSTONE & EXAM BODY FILTERS TEST SUITE ===");

// 1. Capstone Subject Classification Verification
console.log("\n--- 1. Capstone Subject Classification ---");
const currConsolSrc = fs.readFileSync(
  path.join(repoRoot, "src/lib/study-library/curriculum-consolidation.ts"),
  "utf8"
);
const apiClientSrc = fs.readFileSync(
  path.join(repoRoot, "src/lib/api-client.ts"),
  "utf8"
);

assert.ok(
  currConsolSrc.includes("EXIT_NAME_PATTERN = /\\b(exit|predictor)\\b/i"),
  "EXIT_NAME_PATTERN must not include capstone"
);
assert.ok(
  apiClientSrc.includes("titleExit = /\\b(exit|predictor)\\b/i.test(rawTitle) && !/\\bcapstone\\b/i.test(rawTitle)"),
  "api-client titleExit must not match capstone"
);
assert.ok(
  apiClientSrc.includes("!/\\bcapstone\\b/i.test"),
  "api-client isExit must explicitly exclude capstone"
);
console.log("[PASS] Capstone is strictly classified as an ordinary subject, never an Exit examination.");

// 2. Exit Examination Classification & Ordering Verification
console.log("\n--- 2. Exit Examination Ordering (ATI First, Then HESI, Descending Year) ---");
const {
  compareExitExams,
  isExitExam,
  isAtiBody,
  isHesiBody,
  extractExamYear,
} = await import("../src/lib/utils/exams/compareExams.ts");

// Verify Year Extraction
assert.strictEqual(extractExamYear({ title: "ATI RN Comprehensive Exit 2026" }), 2026);
assert.strictEqual(extractExamYear({ title: "HESI PN Exit Exam Fall 2025" }), 2025);
assert.strictEqual(extractExamYear({ academicYear: "2024", title: "ATI Exit" }), 2024);
assert.strictEqual(extractExamYear({ title: "Regular Exam with No Year" }), 0);

// Verify Capstone is never an Exit exam
assert.strictEqual(isExitExam({ title: "RN Nursing Capstone Senior Practicum" }), false);
assert.strictEqual(isExitExam({ title: "ATI Exit Predictor Exam 2026" }), true);
assert.strictEqual(isExitExam({ title: "HESI Exit Exam 2025" }), true);

// Verify Sorting Order: ATI first, then HESI, then descending year
const sampleExitExams = [
  { id: "hesi-2024", title: "HESI RN Exit Exam 2024", category: "HESI" },
  { id: "ati-2024", title: "ATI RN Comprehensive Predictor 2024", category: "ATI" },
  { id: "hesi-2026", title: "HESI RN Exit Exam 2026", category: "HESI" },
  { id: "ati-2026", title: "ATI RN Comprehensive Predictor 2026", category: "ATI" },
  { id: "ati-2025", title: "ATI RN Comprehensive Predictor 2025", category: "ATI" },
  { id: "hesi-2025", title: "HESI RN Exit Exam 2025", category: "HESI" },
];

const sorted = [...sampleExitExams].sort(compareExitExams);
const sortedTitles = sorted.map((e) => e.title);

assert.deepStrictEqual(sortedTitles, [
  "ATI RN Comprehensive Predictor 2026",
  "ATI RN Comprehensive Predictor 2025",
  "ATI RN Comprehensive Predictor 2024",
  "HESI RN Exit Exam 2026",
  "HESI RN Exit Exam 2025",
  "HESI RN Exit Exam 2024",
]);
console.log("[PASS] Exit examinations correctly sort ATI first, then HESI, in descending chronological order.");

// 3. Exam Body Filters Verification
console.log("\n--- 3. Pathway-Specific Exam Body Filters ---");
const {
  RN_EXAM_BODY_CATEGORIES,
  LPN_EXAM_BODY_CATEGORIES,
  getPathwayExamBodyCategories,
} = await import("../src/lib/utils/exams/compareExams.ts");

// RN Expected Array
const expectedRn = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "GENERAL EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
];

// LPN Expected Array
const expectedLpn = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "KAP-LAN EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
];

assert.deepStrictEqual([...RN_EXAM_BODY_CATEGORIES], expectedRn, "RN categories must match exact specification");
assert.deepStrictEqual([...LPN_EXAM_BODY_CATEGORIES], expectedLpn, "LPN categories must match exact specification");
assert.strictEqual(RN_EXAM_BODY_CATEGORIES.length, 6, "RN must have exactly six categories");
assert.strictEqual(LPN_EXAM_BODY_CATEGORIES.length, 6, "LPN must have exactly six categories");

// Pathway exclusivity
assert.ok(!RN_EXAM_BODY_CATEGORIES.includes("KAP-LAN EXAMS"), "RN must NEVER display KAP-LAN EXAMS");
assert.ok(RN_EXAM_BODY_CATEGORIES.includes("GENERAL EXAMS"), "RN must display GENERAL EXAMS");
assert.ok(!LPN_EXAM_BODY_CATEGORIES.includes("GENERAL EXAMS"), "LPN must NEVER display GENERAL EXAMS");
assert.ok(LPN_EXAM_BODY_CATEGORIES.includes("KAP-LAN EXAMS"), "LPN must display KAP-LAN EXAMS");

// Dynamic resolver
assert.deepStrictEqual(getPathwayExamBodyCategories("RN"), expectedRn);
assert.deepStrictEqual(getPathwayExamBodyCategories("PN_LPN"), expectedLpn);
assert.deepStrictEqual(getPathwayExamBodyCategories("LPN"), expectedLpn);

// 4. Verify Horizontal Scroller in CategoryTabs for Exam Body Filters (Section 5.1)
console.log("\n--- 4. Horizontal Scrolling Filter Strip Layout ---");
const categoryTabsSrc = fs.readFileSync(
  path.join(repoRoot, "src/components/study/StudyLibraryCategoryTabs.tsx"),
  "utf8"
);

assert.ok(
  categoryTabsSrc.includes("overflow-x-auto"),
  "Exam Body filters must contain a horizontal scroller (overflow-x-auto)"
);
assert.ok(
  categoryTabsSrc.includes("whitespace-nowrap shrink-0"),
  "Exam Body filter chips must not wrap individually (whitespace-nowrap shrink-0)"
);
console.log("[PASS] Exam Body filters use a compact horizontal scroller with smooth scrolling and unobtrusive scrollbar.");

console.log("\nALL EXIT, CAPSTONE & EXAM BODY FILTER TESTS PASSED!");
