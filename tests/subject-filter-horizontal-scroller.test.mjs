// tests/subject-filter-horizontal-scroller.test.mjs
// QUIZNURSE — Subject & Examination Filter Horizontal Scroller Verification Suite

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const readRel = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

console.log("=== QUIZNURSE: SUBJECT & EXAMINATION FILTER HORIZONTAL SCROLLER SUITE ===\n");

const categoryTabsSrc = readRel("src/components/study/StudyLibraryCategoryTabs.tsx");
const studyViewSrc = readRel("src/components/study/study-library-view.tsx");

// ---------------------------------------------------------------------------
// 1. Exam Bodies Horizontal Scroller (StudyLibraryCategoryTabs.tsx)
// ---------------------------------------------------------------------------
console.log("--- 1. Exam Bodies Scroller Layout & Properties ---");

assert.ok(
  categoryTabsSrc.includes("flex-nowrap"),
  "Exam Bodies scroller container must explicitly specify 'flex-nowrap' to prevent multi-line wrapping"
);

assert.ok(
  categoryTabsSrc.includes("overflow-x-auto"),
  "Exam Bodies scroller container must specify 'overflow-x-auto' to enable horizontal scrolling"
);

assert.ok(
  categoryTabsSrc.includes("overflow-y-hidden"),
  "Exam Bodies scroller container must specify 'overflow-y-hidden' to prevent vertical scrolling"
);

assert.ok(
  categoryTabsSrc.includes("whitespace-nowrap"),
  "Exam Bodies scroller container must specify 'whitespace-nowrap' to keep labels on a single row"
);

assert.ok(
  categoryTabsSrc.includes("w-full"),
  "Exam Bodies scroller must take full available width (w-full)"
);

assert.ok(
  categoryTabsSrc.includes("min-w-0"),
  "Exam Bodies scroller container must allow shrinking within flex parents (min-w-0)"
);

assert.ok(
  categoryTabsSrc.includes("gap-2"),
  "Exam Bodies scroller container must maintain consistent spacing between chips (gap-2)"
);

assert.ok(
  categoryTabsSrc.includes("whitespace-nowrap shrink-0"),
  "Exam Bodies chips must include 'whitespace-nowrap shrink-0' to prevent compression and wrapping"
);

assert.ok(
  categoryTabsSrc.includes('role="tablist"'),
  "Exam Bodies scroller must declare role='tablist'"
);

assert.ok(
  categoryTabsSrc.includes('aria-label="Filter examinations by category"'),
  "Exam Bodies scroller must declare aria-label='Filter examinations by category'"
);

assert.ok(
  categoryTabsSrc.includes("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"),
  "Exam Bodies filter chips must include visible focus ring for keyboard navigation"
);

console.log("[PASS] 1. Exam Bodies horizontal scroller layout, chips and accessibility verified.");

// ---------------------------------------------------------------------------
// 2. Subject Library Horizontal Scroller (study-library-view.tsx)
// ---------------------------------------------------------------------------
console.log("\n--- 2. Subject Library Horizontal Scroller Layout & Properties ---");

// Scoped container inspection for subject filters
const subjectScrollerMatch = studyViewSrc.match(
  /<div\s+className="([^"]*)"\s+role="tablist"[^>]*aria-label="Available subject filters"[\s\S]*?availableSubjectFilters\.map[\s\S]*?<\/div>/
);

assert.ok(
  subjectScrollerMatch,
  "Subject filter container with aria-label='Available subject filters' and availableSubjectFilters.map must exist"
);

const subjectContainerClasses = subjectScrollerMatch[1];

assert.ok(
  subjectContainerClasses.includes("flex-nowrap"),
  "Subject filter container must include 'flex-nowrap' for single-line display"
);

assert.ok(
  subjectContainerClasses.includes("overflow-x-auto"),
  "Subject filter container must include 'overflow-x-auto' for horizontal scrolling"
);

assert.ok(
  subjectContainerClasses.includes("overflow-y-hidden"),
  "Subject filter container must include 'overflow-y-hidden' to prevent vertical scrolling"
);

assert.ok(
  subjectContainerClasses.includes("whitespace-nowrap"),
  "Subject filter container must include 'whitespace-nowrap'"
);

assert.ok(
  subjectContainerClasses.includes("w-full"),
  "Subject filter container must include 'w-full'"
);

assert.ok(
  subjectContainerClasses.includes("min-w-0"),
  "Subject filter container must include 'min-w-0' to allow shrinking in flex contexts"
);

assert.ok(
  subjectContainerClasses.includes("gap-2"),
  "Subject filter container must maintain consistent chip spacing (gap-2)"
);

// Individual subject chip inspection within subjectScrollerMatch
const subjectChipSection = subjectScrollerMatch[0];

assert.ok(
  subjectChipSection.includes("shrink-0"),
  "Subject filter chips must include 'shrink-0' to prevent compression"
);

assert.ok(
  subjectChipSection.includes("whitespace-nowrap"),
  "Subject filter chips must include 'whitespace-nowrap'"
);

assert.ok(
  subjectChipSection.includes('role="tab"'),
  "Subject filter chips must retain role='tab'"
);

assert.ok(
  subjectChipSection.includes('type="button"'),
  "Subject filter chips must retain type='button'"
);

assert.ok(
  subjectChipSection.includes("aria-selected={isActive}"),
  "Subject filter chips must retain aria-selected state"
);

assert.ok(
  subjectChipSection.includes("setSelectedSubjectFilter"),
  "Subject filter chips must retain setSelectedSubjectFilter click handler"
);

assert.ok(
  subjectChipSection.includes("simplifySubjectName(subName)"),
  "Subject filter chips must display simplifySubjectName(subName)"
);

assert.ok(
  subjectChipSection.includes("focus-visible:ring-brand-teal") || subjectChipSection.includes("focus-visible:ring-2"),
  "Subject filter chips must have visible keyboard focus styling"
);

console.log("[PASS] 2. Subject Library horizontal scroller layout, chips, and accessibility verified.");

// ---------------------------------------------------------------------------
// 3. Category Definitions & Strict Ordering
// ---------------------------------------------------------------------------
console.log("\n--- 3. Category Definitions & Strict Ordering ---");

const {
  RN_EXAM_BODY_CATEGORIES,
  LPN_EXAM_BODY_CATEGORIES,
  getPathwayExamBodyCategories,
} = await import("../src/lib/utils/exams/compareExams.ts");

const expectedRn = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "GENERAL EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
];

const expectedLpn = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "KAP-LAN EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
];

// Check RN exact categories and order
assert.deepStrictEqual([...RN_EXAM_BODY_CATEGORIES], expectedRn, "RN pathway categories must match exact required order");
assert.strictEqual(RN_EXAM_BODY_CATEGORIES[0], "ATI EXAMS", "ATI EXAMS must be first for RN");
assert.strictEqual(RN_EXAM_BODY_CATEGORIES[1], "HESI EXAMS", "HESI EXAMS must be second for RN");
assert.strictEqual(RN_EXAM_BODY_CATEGORIES.length, 6, "RN must have exactly 6 categories");

// Check LPN exact categories and order
assert.deepStrictEqual([...LPN_EXAM_BODY_CATEGORIES], expectedLpn, "LPN pathway categories must match exact required order");
assert.strictEqual(LPN_EXAM_BODY_CATEGORIES[0], "ATI EXAMS", "ATI EXAMS must be first for LPN");
assert.strictEqual(LPN_EXAM_BODY_CATEGORIES[1], "HESI EXAMS", "HESI EXAMS must be second for LPN");
assert.strictEqual(LPN_EXAM_BODY_CATEGORIES.length, 6, "LPN must have exactly 6 categories");

// Check pathway exclusions
assert.ok(!RN_EXAM_BODY_CATEGORIES.includes("KAP-LAN EXAMS"), "RN must not include KAP-LAN EXAMS");
assert.ok(RN_EXAM_BODY_CATEGORIES.includes("GENERAL EXAMS"), "RN must include GENERAL EXAMS");
assert.ok(!LPN_EXAM_BODY_CATEGORIES.includes("GENERAL EXAMS"), "LPN must not include GENERAL EXAMS");
assert.ok(LPN_EXAM_BODY_CATEGORIES.includes("KAP-LAN EXAMS"), "LPN must include KAP-LAN EXAMS");

// Check dynamic resolver
assert.deepStrictEqual(getPathwayExamBodyCategories("RN"), expectedRn);
assert.deepStrictEqual(getPathwayExamBodyCategories("PN_LPN"), expectedLpn);
assert.deepStrictEqual(getPathwayExamBodyCategories("LPN"), expectedLpn);

console.log("[PASS] 3. Pathway-specific category definitions and strict ordering verified.");

// ---------------------------------------------------------------------------
// 4. Dedicated Scroller Isolation (No Global Page Overflow)
// ---------------------------------------------------------------------------
console.log("\n--- 4. Dedicated Scroller Isolation (No Global Page Overflow) ---");

// The page wrapper must not set horizontal scrolling
const rootMatch = studyViewSrc.match(/return\s*\(\s*<div\s+className="([^"]+)"/);
assert.ok(rootMatch, "Root view container must be identifiable");
assert.ok(
  !rootMatch[1].includes("overflow-x-auto") && !rootMatch[1].includes("overflow-x-scroll"),
  "study-library-view root container must NOT set horizontal overflow on page layout"
);

// Pathway filters container remains flex-wrap, not horizontally scrollable
const pathwayRowMatch = studyViewSrc.match(
  /<div[^>]*role="tablist"[^>]*aria-label="Available pathway filters"[^>]*>/
);
assert.ok(pathwayRowMatch, "Pathway filters row must exist");
assert.ok(
  pathwayRowMatch[0].includes("flex-wrap"),
  "Pathway filters row must remain flex-wrap"
);
assert.ok(
  !pathwayRowMatch[0].includes("overflow-x-auto"),
  "Pathway filters row must not have horizontal scrolling"
);

// Only the dedicated subject filter strip in study-library-view has overflow-x-auto
const allOverflowOccurrences = [...studyViewSrc.matchAll(/overflow-x-auto/g)];
assert.strictEqual(
  allOverflowOccurrences.length,
  1,
  "study-library-view must have exactly one isolated scroller for the subject filters"
);

console.log("[PASS] 4. Dedicated scroller isolation and global overflow protection confirmed.");

// ---------------------------------------------------------------------------
// 5. Subject Library Desktop Visible Scrollbar Verification
// ---------------------------------------------------------------------------
console.log("\n--- 5. Subject Library Desktop Visible Scrollbar Verification ---");

const globalsCssSrc = readRel("src/app/globals.css");

// Check that scrollbar-hiding utilities are removed from subject scroller
assert.ok(
  !subjectContainerClasses.includes("no-scrollbar"),
  "Subject filter container must NOT include 'no-scrollbar' utility"
);
assert.ok(
  !subjectContainerClasses.includes("[scrollbar-width:none]"),
  "Subject filter container must NOT include '[scrollbar-width:none]'"
);
assert.ok(
  !subjectContainerClasses.includes("[&::-webkit-scrollbar]:hidden"),
  "Subject filter container must NOT include '[&::-webkit-scrollbar]:hidden'"
);

// Check that scoped scrollbar class is present
assert.ok(
  subjectContainerClasses.includes("subject-filter-scrollbar"),
  "Subject filter container must include scoped 'subject-filter-scrollbar' class"
);

// Check scoped CSS definition in globals.css
assert.ok(
  globalsCssSrc.includes(".subject-filter-scrollbar"),
  "globals.css must define scoped .subject-filter-scrollbar class"
);

// Verify Clinical Warmth palette tokens in scoped scrollbar styles
assert.ok(
  globalsCssSrc.includes("#0A6265") && globalsCssSrc.includes("#F1F6F4"),
  "Scrollbar must style thumb with Deep Teal (#0A6265) and track with Eucalyptus Mist (#F1F6F4)"
);
assert.ok(
  globalsCssSrc.includes("#193B42"),
  "Scrollbar hover state must use Forest Slate (#193B42)"
);
assert.ok(
  globalsCssSrc.includes("#D6E9E3"),
  "Scrollbar thumb border must use Soft Sage (#D6E9E3)"
);

// Verify Chromium (Webkit) scrollbar rules are present
assert.ok(
  globalsCssSrc.includes(".subject-filter-scrollbar::-webkit-scrollbar"),
  "globals.css must support Chromium-based browsers with webkit-scrollbar"
);
assert.ok(
  globalsCssSrc.includes(".subject-filter-scrollbar::-webkit-scrollbar-thumb"),
  "globals.css must style webkit-scrollbar-thumb"
);
assert.ok(
  globalsCssSrc.includes(".subject-filter-scrollbar::-webkit-scrollbar-track"),
  "globals.css must style webkit-scrollbar-track"
);

// Verify Exam Bodies scroller remains unaffected
assert.ok(
  categoryTabsSrc.includes("no-scrollbar"),
  "Exam Bodies scroller in StudyLibraryCategoryTabs.tsx must remain unaffected and retain its styling"
);

console.log("[PASS] 5. Subject Library desktop scrollbar visibility and clinical styling verified.");

console.log("\nALL HORIZONTAL SCROLLER SPECIFICATION TESTS PASSED!");
