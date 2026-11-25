/**
 * NURVIA-PREP — Tutor Mode Learning Interface & Frontend SATA Validation Tests
 * 
 * Verifies:
 * 1. Tutor Mode learning guidance 3-section structure (Hint, Correct Answers, Rationale).
 * 2. Replaced "Show Correct Answers" button and action semantics.
 * 3. Frontend SATA selection validation with exact count extraction and 1-selection fallback.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

import {
  isSataQuestion,
  getSelectedOptionCount,
  extractRequiredSataCount,
  validateSataSelection,
} from "../src/lib/attempts/sata-validation.ts";

describe("Phase 7 — Tutor Mode Learning Interface", () => {
  it("TutorModePanel source replaces Explain the Concept with Show Correct Answers", () => {
    const src = readRel("src/components/exam/TutorModePanel.tsx");
    assert.ok(
      src.includes("Show Correct Answers"),
      "TutorModePanel must include 'Show Correct Answers' button text"
    );
    assert.ok(
      !src.includes("Explain the Concept"),
      "TutorModePanel must NOT contain 'Explain the Concept' button"
    );
  });

  it("TutorModePanel orders learning guidance in exact sequence: 1. Hint, 2. Correct Answers, 3. Rationale", () => {
    const src = readRel("src/components/exam/TutorModePanel.tsx");
    const hintIdx = src.indexOf("1. Hint");
    const correctAnswersIdx = src.indexOf("2. Correct Answers");
    const rationaleIdx = src.indexOf("3. Rationale");

    assert.ok(hintIdx > 0, "Must contain '1. Hint'");
    assert.ok(correctAnswersIdx > 0, "Must contain '2. Correct Answers'");
    assert.ok(rationaleIdx > 0, "Must contain '3. Rationale'");

    assert.ok(
      hintIdx < correctAnswersIdx,
      "1. Hint must precede 2. Correct Answers"
    );
    assert.ok(
      correctAnswersIdx < rationaleIdx,
      "2. Correct Answers must precede 3. Rationale"
    );
  });

  it("TutorModePanel has locked notification message before valid answer submission", () => {
    const src = readRel("src/components/exam/TutorModePanel.tsx");
    const expectedMessage = "Select your answer before viewing the learning guidance.";
    assert.ok(
      src.includes(expectedMessage),
      `TutorModePanel must trigger message: '${expectedMessage}'`
    );
  });

  it("TutorModePanel renders blurred state with blur filter in unsubmitted state", () => {
    const src = readRel("src/components/exam/TutorModePanel.tsx");
    assert.ok(
      src.includes("blur-"),
      "TutorModePanel must apply blur styling to locked learning guidance"
    );
  });
});

describe("Phase 8 — Frontend SATA Selection Validation", () => {
  describe("isSataQuestion", () => {
    it("recognizes various SATA and MultiSelect representations", () => {
      assert.strictEqual(isSataQuestion("SelectAllThatApply"), true);
      assert.strictEqual(isSataQuestion("selectallthatapply"), true);
      assert.strictEqual(isSataQuestion("sata"), true);
      assert.strictEqual(isSataQuestion("MultipleSelect"), true);
      assert.strictEqual(isSataQuestion("multipleselect"), true);
      assert.strictEqual(isSataQuestion("MultipleResponse"), true);
      assert.strictEqual(isSataQuestion("SingleChoice"), false);
      assert.strictEqual(isSataQuestion("TrueFalse"), false);
      assert.strictEqual(isSataQuestion(null), false);
      assert.strictEqual(isSataQuestion(undefined), false);
    });
  });

  describe("getSelectedOptionCount", () => {
    it("parses array of strings or IDs", () => {
      assert.strictEqual(getSelectedOptionCount(JSON.stringify(["opt1", "opt2", "opt3"])), 3);
    });

    it("parses SelectedOptionIds object", () => {
      assert.strictEqual(
        getSelectedOptionCount(JSON.stringify({ SelectedOptionIds: ["o1", "o2"] })),
        2
      );
      assert.strictEqual(
        getSelectedOptionCount(JSON.stringify({ selectedOptionIds: ["o1", "o2", "o3", "o4"] })),
        4
      );
    });

    it("parses single selection object as 1", () => {
      assert.strictEqual(
        getSelectedOptionCount(JSON.stringify({ SelectedOptionId: "o1" })),
        1
      );
    });

    it("handles null and empty input gracefully", () => {
      assert.strictEqual(getSelectedOptionCount(null), 0);
      assert.strictEqual(getSelectedOptionCount(""), 0);
      assert.strictEqual(getSelectedOptionCount("invalid json"), 0);
    });
  });

  describe("extractRequiredSataCount", () => {
    it("extracts count from stem with 'Select 4 findings'", () => {
      const q = { stem: "The nurse reviews the chart. Select 4 findings that indicate complication." };
      assert.strictEqual(extractRequiredSataCount(q), 4);
    });

    it("extracts count from parenthetical '(Select 3)'", () => {
      const q = { stem: "Which interventions should the nurse anticipate? (Select 3)" };
      assert.strictEqual(extractRequiredSataCount(q), 3);
    });

    it("extracts count from 'Select all that apply. (Select 4)'", () => {
      const q = { instructions: "Select all that apply. (Select 4)", stem: "Manifestations of hyperkalemia." };
      assert.strictEqual(extractRequiredSataCount(q), 4);
    });

    it("extracts count from 'Choose 5 options'", () => {
      const q = { stem: "Choose 5 actions the nurse must take immediately." };
      assert.strictEqual(extractRequiredSataCount(q), 5);
    });

    it("extracts count from metadata if present and not in stem", () => {
      const q = {
        stem: "Select all that apply.",
        correctAnswerMeta: { correctOptionIds: ["a", "b", "c"] },
      };
      assert.strictEqual(extractRequiredSataCount(q), 3);
    });

    it("returns null if no specific count is mentioned", () => {
      const q = { stem: "Select all clinical findings that require follow-up." };
      assert.strictEqual(extractRequiredSataCount(q), null);
    });
  });

  describe("validateSataSelection", () => {
    it("passes non-SATA questions regardless of selection count", () => {
      const q = { questionType: "SingleChoice", stem: "What is the primary action?" };
      const res = validateSataSelection(q, JSON.stringify({ SelectedOptionId: "opt-1" }));
      assert.strictEqual(res.isValid, true);
    });

    it("enforces exact selection count when specified in stem (e.g. 4)", () => {
      const q = {
        questionType: "SelectAllThatApply",
        stem: "Select 4 findings that require immediate intervention.",
      };

      // 3 selected -> invalid
      const res3 = validateSataSelection(q, JSON.stringify(["o1", "o2", "o3"]));
      assert.strictEqual(res3.isValid, false);
      assert.strictEqual(res3.requiredCount, 4);
      assert.strictEqual(res3.selectedCount, 3);
      assert.strictEqual(res3.message, "Select 4 answers to continue. You have selected 3.");

      // 4 selected -> valid
      const res4 = validateSataSelection(q, JSON.stringify(["o1", "o2", "o3", "o4"]));
      assert.strictEqual(res4.isValid, true);
      assert.strictEqual(res4.requiredCount, 4);
      assert.strictEqual(res4.selectedCount, 4);

      // 5 selected -> invalid
      const res5 = validateSataSelection(q, JSON.stringify(["o1", "o2", "o3", "o4", "o5"]));
      assert.strictEqual(res5.isValid, false);
      assert.strictEqual(res5.requiredCount, 4);
      assert.strictEqual(res5.selectedCount, 5);
      assert.strictEqual(res5.message, "Select 4 answers to continue. You have selected 5.");
    });

    it("falls back to requiring at least 1 selection when required count is unspecified", () => {
      const q = {
        questionType: "SelectAllThatApply",
        stem: "Select all that apply.",
      };

      // 0 selected -> invalid
      const res0 = validateSataSelection(q, JSON.stringify([]));
      assert.strictEqual(res0.isValid, false);
      assert.strictEqual(res0.message, "Select at least 1 answer to continue.");

      // null answer -> invalid
      const resNull = validateSataSelection(q, null);
      assert.strictEqual(resNull.isValid, false);
      assert.strictEqual(resNull.message, "Select at least 1 answer to continue.");

      // 1 selected -> valid
      const res1 = validateSataSelection(q, JSON.stringify(["o1"]));
      assert.strictEqual(res1.isValid, true);

      // 2 selected -> valid
      const res2 = validateSataSelection(q, JSON.stringify(["o1", "o2"]));
      assert.strictEqual(res2.isValid, true);
    });
  });
});
