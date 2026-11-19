import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attemptStore } from '../src/lib/attempts/attempt-store.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function createTestAttempt(overrides = {}) {
  const attemptId = `test-sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const base = {
    attemptId,
    examId: 'exam-sec-1',
    examTitle: 'Adult Med-Surg Readiness Exam',
    userId: 'learner-owner-1',
    deliveryMode: 'Exam',
    layoutMode: 'Sequential',
    allowedLayouts: 'Both',
    timeLimitMinutes: 60,
    remainingSeconds: 3600,
    startedAtUtc: new Date().toISOString(),
    status: 'InProgress',
    allowReview: false,
    passingScorePercentage: 80,
    questions: [
      {
        id: 'q-mat-1',
        orderIndex: 1,
        stem: 'Select the priority finding.',
        questionType: 'MatrixSingleChoice',
        cognitiveSkill: 'ClinicalJudgment',
        clientNeedCategory: 'PhysiologicalAdaptation',
        options: [],
        exhibits: [],
        matrix: {
          id: 'mat-sec',
          rowCount: 1,
          columnCount: 2,
          rowHeaders: ['SpO2 86%'],
          columnHeaders: ['Critical', 'Expected'],
          responseType: 'singleChoice',
          cells: [
            { id: 'c1', numericId: 1, rowIndex: 0, columnIndex: 0, isCorrect: true, explanation: 'Hypoxemia requires urgent O2.' },
            { id: 'c2', numericId: 2, rowIndex: 0, columnIndex: 1, isCorrect: false, explanation: 'Not normal.' },
          ],
        },
        correctAnswerMeta: { correctCellIds: ['c1'] },
        generalRationale: 'Hypoxemia demands immediate airway and oxygenation priority.',
      },
      {
        id: 'q-sc-2',
        orderIndex: 2,
        stem: 'Which intervention takes priority?',
        questionType: 'SingleChoice',
        cognitiveSkill: 'TakeActions',
        clientNeedCategory: 'PhysiologicalAdaptation',
        options: [
          { id: 'o1', optionIndex: 1, optionText: 'Administer O2', displayOrder: 1, isCorrect: true, specificRationale: 'Airway/breathing priority.' },
          { id: 'o2', optionIndex: 2, optionText: 'Document', displayOrder: 2, isCorrect: false, specificRationale: 'Delayed care.' },
        ],
        exhibits: [],
        generalRationale: 'Oxygenation precedes documentation.',
      },
    ],
    savedResponses: {},
    tutorProgression: {},
    ...overrides,
  };
  attemptStore.setAttempt(base);
  return base;
}

describe('Examination Lifecycle, Permissions, Layouts & Security', () => {
  it('strictly strips answer keys, rationales, correctAnswerMeta, and matrix cell keys during active Exam mode', () => {
    const raw = createTestAttempt({ deliveryMode: 'Exam' });
    const sanitized = attemptStore.sanitizeForActiveSession(raw);

    assert.equal(sanitized.layoutMode, 'Sequential');
    assert.equal(sanitized.questions[0].generalRationale, undefined);
    assert.equal(sanitized.questions[0].correctAnswerMeta, undefined);
    for (const cell of sanitized.questions[0].matrix.cells) {
      assert.equal(cell.isCorrect, undefined, 'Matrix cell isCorrect must be stripped in Exam mode');
      assert.equal(cell.explanation, undefined, 'Matrix cell explanation must be stripped in Exam mode');
    }
    for (const opt of sanitized.questions[1].options) {
      assert.equal(opt.isCorrect, undefined);
      assert.equal(opt.specificRationale, undefined);
    }
  });

  it('refuses with 409 when review is requested for an unsubmitted InProgress attempt', () => {
    const raw = createTestAttempt({ status: 'InProgress', allowReview: true });
    const res = attemptStore.getAttemptReview('learner-owner-1', raw.attemptId);
    assert.equal(res.success, false);
    assert.equal(res.status, 409);
  });

  it('enforces allowReview: false on both submitAttempt and getAttemptReview without leaking reviewQuestions', () => {
    const raw = createTestAttempt({ allowReview: false, passingScorePercentage: 50 });
    attemptStore.autosaveResponse('learner-owner-1', raw.attemptId, {
      questionId: 'q-mat-1',
      responseJson: JSON.stringify({ SelectedCellId: 'c1' }),
      isFlagged: false,
    });

    const submitted = attemptStore.submitAttempt('learner-owner-1', raw.attemptId);
    assert.equal(submitted.success, true);
    assert.equal(submitted.data.reviewReleased, false);
    assert.equal(submitted.data.reviewQuestions.length, 0);
    assert.equal(submitted.data.scorePercentage, 50);
    assert.equal(submitted.data.passed, true);

    const rev = attemptStore.getAttemptReview('learner-owner-1', raw.attemptId);
    assert.equal(rev.success, true);
    assert.equal(rev.data.reviewReleased, false);
    assert.equal(rev.data.reviewQuestions.length, 0);
  });

  it('blocks unauthorized cross-learner access (anti-IDOR)', () => {
    const raw = createTestAttempt({ userId: 'learner-A' });
    assert.equal(attemptStore.getAttempt('learner-B', raw.attemptId), null);
    const saveRes = attemptStore.autosaveResponse('learner-B', raw.attemptId, {
      questionId: 'q-sc-2',
      responseJson: JSON.stringify({ SelectedOptionId: 'o1' }),
      isFlagged: false,
    });
    assert.equal(saveRes.status, 403);
  });

  it('enforces CSRF, Tutor permission, Review permission, and defaults Sequential layout in UI', () => {
    const startRoute = readRel('src/app/api/attempts/start/[examId]/route.ts');
    assert.ok(startRoute.includes('validateSameOriginRequest'));
    assert.ok(startRoute.includes('TUTOR_NOT_PERMITTED'));

    const tutorEvalRoute = readRel('src/app/api/attempts/[attemptId]/tutor/evaluate/route.ts');
    assert.ok(tutorEvalRoute.includes('TUTOR_NOT_PERMITTED'));
    assert.ok(tutorEvalRoute.includes('validateSameOriginRequest'));

    const reviewContentRoute = readRel('src/app/api/exams/[examId]/review-content/route.ts');
    assert.ok(reviewContentRoute.includes('REVIEW_NOT_PERMITTED'));

    const sessionPage = readRel('src/app/exam-session/page.tsx');
    assert.ok(!sessionPage.includes('setIsLayoutModalOpen(true)'), 'Must NOT block exam start with layout modal');
    assert.ok(sessionPage.includes('layoutParam === "AllInOne" ? "AllInOne" : "Sequential"'));
    assert.ok(sessionPage.includes('setDeliveryMode("Review");\n    setLayout(layoutParam === "Sequential" ? "Sequential" : "AllInOne")'));

    const examShell = readRel('src/components/layout/exam-shell.tsx');
    assert.ok(!examShell.includes('Result: 2.0 tabs'), 'Must replace fake static 2.0 tabs output with working calculator');
    assert.ok(examShell.includes('Examination Mode Switcher'));
    assert.ok(examShell.includes('Question Layout'));
  });
});
