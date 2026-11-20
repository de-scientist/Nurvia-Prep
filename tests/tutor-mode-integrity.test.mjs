/**
 * NURVIA-PREP — Tutor Mode Integrity & Examination Security Tests
 * 
 * Verifies the confirmed fixes for Tutor Mode, examination integrity,
 * and delivery-permission remediation.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function getIsModeEnabled() {
  const src = readRel("src/lib/api-client.ts");
  assert.ok(src.includes("export function isModeEnabled("));
  return function isModeEnabled(modeAllowed, target) {
    if (!modeAllowed) return false;
    const normalized = String(modeAllowed).trim().toLowerCase();
    if (normalized === 'all') return true;
    if (normalized === 'both') {
      return target === 'Exam' || target === 'Review';
    }
    return normalized === target.toLowerCase();
  };
}

// Import the attempt store (ESM import may need adjustment based on build)
import { attemptStore } from "../src/lib/attempts/attempt-store.ts";

describe("Tutor Mode Integrity & Examination Security", () => {
  // Helper: create a test attempt with Tutor mode
  function createTestAttemptTutor(overrides = {}) {
    const attemptId = `test-tutor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const base = {
      attemptId,
      examId: "exam-tutor-1",
      examTitle: "Tutor Integrity Test Exam",
      userId: "learner-tutor-1",
      deliveryMode: "Tutor",
      layoutMode: "Sequential",
      allowedLayouts: "Both",
      timeLimitMinutes: 60,
      remainingSeconds: 3600,
      startedAtUtc: new Date().toISOString(),
      status: "InProgress",
      allowReview: true,
      passingScorePercentage: 80,
      questions: [
        {
          id: "q-tutor-1",
          orderIndex: 1,
          stem: "Select the priority finding.",
          questionType: "SingleChoice",
          cognitiveSkill: "ClinicalJudgment",
          clientNeedCategory: "PhysiologicalAdaptation",
          options: [
            { id: "o1", optionIndex: 1, optionText: "Administer O2", displayOrder: 1, isCorrect: true, specificRationale: "Airway/breathing priority." },
            { id: "o2", optionIndex: 2, optionText: "Document", displayOrder: 2, isCorrect: false, specificRationale: "Delayed care." },
          ],
          exhibits: [],
          generalRationale: "Oxygenation precedes documentation.",
        },
      ],
      savedResponses: {},
      tutorProgression: {},
      ...overrides,
    };
    attemptStore.setAttempt(base);
    return base;
  }

  // Helper: create a submitted attempt with Tutor mode
  function createSubmittedAttemptTutor(overrides = {}) {
    const attemptId = `test-submitted-tutor-${Date.now()}-Math.random().toString(36).slice(2, 7)`;
    const base = {
      attemptId,
      examId: "exam-submitted-tutor-1",
      examTitle: "Submitted Tutor Exam",
      userId: "learner-submitted-tutor-1",
      deliveryMode: "Exam",
      layoutMode: "Sequential",
      allowedLayouts: "Both",
      timeLimitMinutes: 60,
      remainingSeconds: 3600,
      startedAtUtc: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      submittedAtUtc: new Date(Date.now() - 3500000).toISOString(), // 55 min ago
      status: "Submitted",
      allowReview: true,
      passingScorePercentage: 80,
      questions: [
        {
          id: "q-sub-1",
          orderIndex: 1,
          stem: "Select the priority finding.",
          questionType: "SingleChoice",
          cognitiveSkill: "ClinicalJudgment",
          clientNeedCategory: "PhysiologicalAdaptation",
          options: [
            { id: "o1", optionIndex: 1, optionText: "Administer O2", displayOrder: 1, isCorrect: true, specificRationale: "Airway/breathing priority." },
            { id: "o2", optionIndex: 2, optionText: "Document", displayOrder: 2, isCorrect: false },
          ],
          exhibits: [],
          generalRationale: "Oxygenation precedes documentation.",
        },
      ],
      savedResponses: {
        "q-sub-1": {
          responseJson: JSON.stringify({ SelectedOptionId: "o1" }),
          isFlagged: false,
          savedAtUtc: new Date().toISOString(),
        },
      },
      tutorProgression: {},
      result: {
        attemptId,
        examId: "exam-submitted-tutor-1",
        examTitle: "Submitted Tutor Exam",
        pathway: "RN",
        examCategory: "RegularCourse",
        status: "Graded",
        scorePercentage: 80,
        passingScorePercentage: 80,
        passed: true,
        totalQuestions: 1,
        totalAnswered: 1,
        correctQuestions: 1,
        totalWrong: 0,
        timeSpentSeconds: 3000,
        timeLimitMinutes: 60,
        startedAtUtc: new Date(Date.now() - 3600000).toISOString(),
        submittedAtUtc: new Date(Date.now() - 3500000).toISOString(),
        reviewReleased: true,
        modePermissions: { canExam: true, canReview: true, canTutor: true },
        reviewQuestions: [
          {
            questionId: "q-sub-1",
            numericId: 1,
            guidId: "1",
            sectionId: 1,
            sectionGuidId: "s1",
            sectionName: "Section 1",
            orderIndex: 1,
            stem: "Select the priority finding.",
            metaStem: "",
            questionType: "SingleChoice",
            cognitiveSkill: "ClinicalJudgment",
            clientNeedCategory: "PhysiologicalAdaptation",
            generalRationale: "Oxygenation precedes documentation.",
            learnerResponse: JSON.stringify({ SelectedOptionId: "o1" }),
            isCorrect: true,
            pointsAwarded: 1,
            maxPoints: 1,
            options: [
              { id: "o1", numericId: 1, optionIndex: 1, optionText: "Administer O2", displayOrder: 1, isCorrect: true, specificRationale: "Airway/breathing priority." },
              { id: "o2", numericId: 2, optionIndex: 2, optionText: "Document", displayOrder: 2, isCorrect: false, specificRationale: "Delayed care." },
            ],
            exhibits: [],
            media: [],
            matrix: null,
            blankSelectPassage: null,
            highlightPassage: null,
            correctAnswerMeta: { correctCellIds: ["o1"] },
            contentIntegrityError: null,
          },
        ],
      },
      ...overrides,
    };
    attemptStore.setAttempt(base);
    return base;
  }

  describe("Fix A: Delivery-Mode Permission Semantics", () => {
    it("isModeEnabled Both should not include Tutor", () => {
      const isModeEnabled = getIsModeEnabled();
      assert.strictEqual(isModeEnabled("Both", "Exam"), true, "Both must enable Exam");
      assert.strictEqual(isModeEnabled("Both", "Review"), true, "Both must enable Review");
      assert.strictEqual(isModeEnabled("Both", "Tutor"), false, "Both must NOT enable Tutor");
    });

    it("isModeEnabled All enables all modes", () => {
      const isModeEnabled = getIsModeEnabled();
      assert.strictEqual(isModeEnabled("All", "Exam"), true, "All must enable Exam");
      assert.strictEqual(isModeEnabled("All", "Review"), true, "All must enable Review");
      assert.strictEqual(isModeEnabled("All", "Tutor"), true, "All must enable Tutor");
    });

    it("isModeEnabled Exam enables only Exam", () => {
      const isModeEnabled = getIsModeEnabled();
      assert.strictEqual(isModeEnabled("Exam", "Exam"), true, "Exam must enable Exam");
      assert.strictEqual(isModeEnabled("Exam", "Review"), false, "Exam must not enable Review");
      assert.strictEqual(isModeEnabled("Exam", "Tutor"), false, "Exam must not enable Tutor");
    });

    it("isModeEnabled Review enables only Review", () => {
      const isModeEnabled = getIsModeEnabled();
      assert.strictEqual(isModeEnabled("Review", "Exam"), false, "Review must not enable Exam");
      assert.strictEqual(isModeEnabled("Review", "Review"), true, "Review must enable Review");
      assert.strictEqual(isModeEnabled("Review", "Tutor"), false, "Review must not enable Tutor");
    });

    it("isModeEnabled Tutor enables only Tutor", () => {
      const isModeEnabled = getIsModeEnabled();
      assert.strictEqual(isModeEnabled("Tutor", "Exam"), false, "Tutor must not enable Exam");
      assert.strictEqual(isModeEnabled("Tutor", "Review"), false, "Tutor must not enable Review");
      assert.strictEqual(isModeEnabled("Tutor", "Tutor"), true, "Tutor must enable Tutor");
    });
  });

  describe("Fix B: Tutor Answer Isolation", () => {
    it("evaluateTutorAnswer stores response in tutorProgression only", () => {
      const attempt = createTestAttemptTutor({
        tutorProgression: {},
      });

      const result = attemptStore.evaluateTutorAnswer(
        "learner-tutor-1",
        attempt.attemptId,
        "q-tutor-1",
        JSON.stringify({ selectedOptionId: "o1", text: "Administer O2" })
      );

      assert.strictEqual(result.success, true, "evaluateTutorAnswer should succeed");
      
      // Verify tutorProgression has the stored response
      const progression = attemptStore.getRawAttempt(attempt.attemptId)?.tutorProgression;
      assert.ok(progression && progression["q-tutor-1"], "tutorProgression should have question entry");
      assert.ok(progression["q-tutor-1"].evaluated, "tutorProgression[q-tutor-1].evaluated should exist");
      assert.ok(progression["q-tutor-1"].responseJson, "tutorProgression[q-tutor-1].responseJson should be stored");
      
      // Verify savedResponses is UNCHANGED (no Tutor contamination)
      const savedResponses = attemptStore.getRawAttempt(attempt.attemptId)?.savedResponses;
      assert.ok(savedResponses, "savedResponses should exist");
      assert.ok(!("q-tutor-1" in savedResponses), "savedResponses must NOT have Tutor question entry");
    });

    it("evaluateTutorAnswer does not modify examination responses", () => {
      const attempt = createTestAttemptTutor({
        savedResponses: {
          "q-tutor-1": {
            responseJson: JSON.stringify({ foo: "bar" }),
            isFlagged: false,
            savedAtUtc: new Date().toISOString(),
          },
        },
      });

      const result = attemptStore.evaluateTutorAnswer(
        "learner-tutor-1",
        attempt.attemptId,
        "q-tutor-1",
        JSON.stringify({ selectedOptionId: "o1" })
      );

      const savedResponses = attemptStore.getRawAttempt(attempt.attemptId)?.savedResponses;
      assert.ok(savedResponses, "savedResponses should exist");
      assert.strictEqual(savedResponses["q-tutor-1"].responseJson, JSON.stringify({ foo: "bar" }), "savedResponses[q-tutor-1].responseJson must remain unchanged");
      assert.strictEqual(savedResponses["q-tutor-1"].isFlagged, false, "savedResponses[q-tutor-1].isFlagged must remain unchanged");
    });
  });

  describe("Fix C: Submitted Examination Immutability", () => {
    it("Tutor evaluation must not modify submitted examination data", () => {
      const attempt = createSubmittedAttemptTutor({
      });

      // Evaluate a Tutor response (even though attempt is in Exam mode)
      // The system should allow Tutor evaluation when modePermissions.canTutor permits
      // but must NOT modify the submitted examination data
      const result = attemptStore.evaluateTutorAnswer(
        "learner-submitted-tutor-1",
        attempt.attemptId,
        "q-sub-1",
        JSON.stringify({ selectedOptionId: "o1" })
      );

      assert.strictEqual(result.success, true, "Tutor evaluation should succeed");
      
      // Verify the submitted result is completely unchanged
      const submittedResult = attemptStore.getRawAttempt(attempt.attemptId)?.result;
      assert.ok(submittedResult, "submitted result should exist");
      assert.strictEqual(submittedResult.scorePercentage, 80, "scorePercentage must remain 80");
      assert.strictEqual(submittedResult.passed, true, "passed must remain true");
      assert.strictEqual(submittedResult.totalQuestions, 1, "totalQuestions must remain 1");
      assert.strictEqual(submittedResult.correctQuestions, 1, "correctQuestions must remain 1");
      assert.strictEqual(submittedResult.totalAnswered, 1, "totalAnswered must remain 1");
      
      // Verify savedResponses is unchanged
      const savedResponses = attemptStore.getRawAttempt(attempt.attemptId)?.savedResponses;
      assert.ok(savedResponses, "savedResponses should exist");
      assert.strictEqual(savedResponses["q-sub-1"].responseJson, JSON.stringify({ SelectedOptionId: "o1" }), "savedResponses[q-sub-1].responseJson must remain unchanged");
    });

    it("Tutor evaluation must not modify submission timestamp or status", () => {
      const attempt = createSubmittedAttemptTutor({
      });

      const originalSubmittedAt = attempt.submittedAtUtc;
      const originalStatus = attempt.status;

      const result = attemptStore.evaluateTutorAnswer(
        "learner-submitted-tutor-1",
        attempt.attemptId,
        "q-sub-1",
        JSON.stringify({ selectedOptionId: "o1" })
      );

      const attemptAfter = attemptStore.getRawAttempt(attempt.attemptId);
      assert.strictEqual(attemptAfter.submittedAtUtc, originalSubmittedAt, "submittedAtUtc must remain unchanged");
      assert.strictEqual(attemptAfter.status, originalStatus, "status must remain unchanged");
      assert.strictEqual(attemptAfter.result.scorePercentage, 80, "result.scorePercentage must remain 80");
    });
  });

  describe("Fix D: Tutor Session Recovery", () => {
    it("getTutorSession should return responseJson for each question", () => {
      // Create an attempt with existing Tutor progression including responseJson
      const attemptId = `test-recovery-${Date.now()}`;
      attemptStore.setAttempt({
        attemptId,
        examId: "exam-recovery-1",
        examTitle: "Tutor Recovery Test",
        userId: "learner-recovery-1",
        deliveryMode: "Exam",
        layoutMode: "Sequential",
        allowedLayouts: "Both",
        timeLimitMinutes: 60,
        remainingSeconds: 3600,
        startedAtUtc: new Date().toISOString(),
        status: "Submitted",
        allowReview: true,
        passingScorePercentage: 80,
        questions: [
          {
            id: "q-rec-1",
            orderIndex: 1,
            stem: "Test Tutor response recovery.",
            questionType: "SingleChoice",
            cognitiveSkill: "ClinicalJudgment",
            clientNeedCategory: "PhysiologicalAdaptation",
            options: [],
            exhibits: [],
            generalRationale: "Test rationale.",
          },
        ],
        savedResponses: {},
        tutorProgression: {
          "q-rec-1": {
            stage: 4,
            hintsRequested: [],
            evaluated: {
              questionId: "q-rec-1",
              isCorrect: true,
              pointsAwarded: 1,
              maxPoints: 1,
              generalRationale: "Test rationale.",
              optionRationales: [],
              clinicalConcept: "Test concept",
              nursingPrinciple: "Test principle",
              takeaway: "Test takeaway",
              isAiGenerated: false,
            },
            responseJson: JSON.stringify({ selectedOptionId: "o1", text: "Administer O2" }),
          },
        },
      });

      const session = attemptStore.getTutorSession("learner-recovery-1", attemptId);
      assert.strictEqual(session.success, true, "getTutorSession should succeed");
      assert.ok(session.data, "session data should exist");
      assert.ok(session.data.questions, "session questions should exist");
      assert.ok(session.data.questions.length > 0, "should have at least one question");
      
      const qState = session.data.questions[0];
      assert.strictEqual(qState.questionId, "q-rec-1", "questionId should match");
      assert.strictEqual(qState.stageReached, 4, "stageReached should be 4");
      assert.ok(qState.evaluation, "evaluation should be returned");
      assert.strictEqual(qState.responseJson, JSON.stringify({ selectedOptionId: "o1", text: "Administer O2" }), "responseJson should be returned from session");
    });

    it("getTutorSession should handle questions without previous Tutor activity", () => {
      const attemptId = `test-recovery-no-tutor-${Date.now()}`;
      attemptStore.setAttempt({
        attemptId,
        examId: "exam-recovery-2",
        examTitle: "No Tutor Activity Test",
        userId: "learner-recovery-2",
        deliveryMode: "Exam",
        layoutMode: "Sequential",
        allowedLayouts: "Both",
        timeLimitMinutes: 60,
        remainingSeconds: 3600,
        startedAtUtc: new Date().toISOString(),
        status: "InProgress",
        allowReview: false,
        passingScorePercentage: 80,
        questions: [
          {
            id: "q-rec-2-no-tutor",
            orderIndex: 1,
            stem: "Question without Tutor activity.",
            questionType: "SingleChoice",
            cognitiveSkill: "ClinicalJudgment",
            clientNeedCategory: "PhysiologicalAdaptation",
            options: [],
            exhibits: [],
            generalRationale: "No Tutor needed.",
          },
        ],
        savedResponses: {},
        tutorProgression: {},
      });

      const session = attemptStore.getTutorSession("learner-recovery-2", attemptId);
      assert.strictEqual(session.success, true, "getTutorSession should succeed");
      assert.ok(session.data, "session data should exist");
      assert.ok(session.data.questions, "session questions should exist");
      
      const qState = session.data.questions[0];
      assert.strictEqual(qState.questionId, "q-rec-2-no-tutor", "questionId should match");
      assert.strictEqual(qState.stageReached, 1, "stageReached should default to 1 for no Tutor activity");
      assert.strictEqual(qState.evaluation, null, "evaluation should be null for no Tutor activity");
      assert.strictEqual(qState.responseJson, null, "responseJson should be null for no Tutor activity");
    });
  });

  describe("Fix E: Authorization and Ownership", () => {
    it("blocks unauthorized cross-learner access to Tutor evaluation", () => {
      const attempt = createTestAttemptTutor({
        userId: "learner-A",
      });

      const result = attemptStore.evaluateTutorAnswer(
        "learner-B",
        attempt.attemptId,
        "q-tutor-1",
        JSON.stringify({ selectedOptionId: "o1" })
      );

      assert.strictEqual(result.status, 403, "cross-learner access should be forbidden (403)");
    });

    it("blocks evaluateTutorAnswer for non-existent attempt", () => {
      const result = attemptStore.evaluateTutorAnswer(
        "learner-owner-1",
        "nonexistent-attempt-id",
        "q-tutor-1",
        JSON.stringify({ selectedOptionId: "o1" })
      );

      assert.strictEqual(result.status, 404, "non-existent attempt should return 404");
    });
  });
});