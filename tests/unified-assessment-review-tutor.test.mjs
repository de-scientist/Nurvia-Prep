import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        url: 'data:text/javascript,export default {};',
        shortCircuit: true,
      };
    }

    if (specifier.startsWith('@/')) {
      const base = path.resolve(ROOT, 'src', specifier.slice(2));
      for (const ext of ['', '.ts', '.tsx', '.mjs', '.js']) {
        const candidate = ext ? `${base}${ext}` : base;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }

    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file://')
    ) {
      const parentDir = path.dirname(
        new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, '$1')
      );
      const base = path.resolve(parentDir, specifier);
      for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
        const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const filePath = new URL(url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
      const source = fs.readFileSync(filePath, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.Preserve,
          esModuleInterop: true,
        },
        fileName: filePath,
      });
      return { format: 'module', source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const {
  isResponseAnswered,
  scoreCanonicalQuestion,
  resolveNormalizedQuestionType,
} = await import('../src/lib/attempts/strata-answer-adapter.ts');
const {
  canTransitionStage,
  computeReviewCounts,
  filterReviewQuestions,
  getStageAvailability,
  resolveQuestionReviewStatus,
} = await import('../src/lib/attempts/exam-experience-state.ts');
const {
  checkTutorPracticeForAttempt,
  decodeQuestionAnswers,
  generateTutorAssistForAttempt,
  getTutorConversationForAttempt,
  MAX_TUTOR_MESSAGES_PER_QUESTION,
} = await import('../src/lib/attempts/tutor-service.ts');
const { attemptStore } = await import('../src/lib/attempts/attempt-store.ts');
const { resolveExamModePermissions } = await import('../src/lib/attempts/live-exam-loader.ts');

function buildFullAttemptFixture(overrides = {}) {
  const attemptId = `tut-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const base = {
    attemptId,
    examId: 'exam-unified-1',
    examTitle: 'RN Comprehensive Priority Assessment',
    pathway: 'RN',
    examCategory: 'Readiness Exam',
    subjectName: 'Adult Health & Clinical Judgment',
    topicName: 'Sepsis & Airway Priorities',
    learningObjectives: ['Prioritize airway and perfusion cues in unstable patients.'],
    userId: 'learner-unified-owner',
    deliveryMode: 'Exam',
    layoutMode: 'Sequential',
    allowedLayouts: 'Both',
    isTimed: true,
    timeLimitMinutes: 60,
    remainingSeconds: 2400,
    startedAtUtc: '2026-11-20T10:00:00.000Z',
    submittedAtUtc: '2026-11-20T10:25:00.000Z',
    status: 'Graded',
    allowReview: true,
    passingScorePercentage: null,
    modePermissions: {
      canExam: true,
      canReview: true,
      canTutor: true,
      allowLayoutSwitching: true,
      allowModeSwitching: true,
      reviewReleased: true,
    },
    questions: [
      {
        id: 'q1-sc',
        orderIndex: 1,
        sectionName: 'Airway & Breathing',
        stem: '<p>A post-op patient develops inspiratory stridor and SpO2 88%. What is the priority nursing action?</p>',
        questionType: 'SingleChoice',
        cognitiveSkill: 'TakeAction',
        clientNeedCategory: 'PhysiologicalIntegrity',
        learningObjectives: ['Recognize acute upper airway obstruction and call rapid response.'],
        options: [
          {
            id: 'opt-wrong',
            optionIndex: 0,
            displayOrder: 0,
            optionText: 'Document findings and reassess in 30 minutes',
            isCorrect: false,
            specificRationale: 'Delaying care during inspiratory stridor risks complete airway occlusion.',
          },
          {
            id: 'opt-right',
            optionIndex: 1,
            displayOrder: 1,
            optionText: 'Maintain patent airway, apply O2, and notify rapid response immediately',
            isCorrect: true,
            specificRationale: 'Inspiratory stridor signals acute upper airway edema requiring immediate escalation.',
          },
        ],
        exhibits: [
          {
            id: 'ex-1',
            type: 'VitalSigns',
            title: 'Post-Op Vitals',
            content: 'HR 118 bpm, RR 28/min, BP 102/66 mmHg, SpO2 88% on room air',
            displayOrder: 0,
          },
        ],
        generalRationale: 'Inspiratory stridor after neck or airway surgery is a life-threatening airway emergency.',
      },
      {
        id: 'q2-sata',
        orderIndex: 2,
        sectionName: 'Infection & Sepsis',
        stem: '<p>Select all immediate actions included in the 1-hour sepsis bundle.</p>',
        questionType: 'MultipleSelect',
        cognitiveSkill: 'PrioritizeHypotheses',
        clientNeedCategory: 'PharmacologicalTherapies',
        options: [
          { id: 's1', optionIndex: 0, displayOrder: 0, optionText: 'Obtain blood cultures before antibiotics', isCorrect: true },
          { id: 's2', optionIndex: 1, displayOrder: 1, optionText: 'Measure serum lactate level', isCorrect: true },
          { id: 's3', optionIndex: 2, displayOrder: 2, optionText: 'Withhold IV fluids until morning rounds', isCorrect: false },
        ],
        exhibits: [],
        generalRationale: 'Early sepsis care prioritizes cultures, lactate measurement, broad-spectrum antibiotics, and fluid resuscitation.',
      },
    ],
    savedResponses: {
      'q1-sc': {
        responseJson: JSON.stringify({ SelectedOptionId: 'opt-wrong' }),
        isFlagged: true,
        savedAtUtc: '2026-11-20T10:10:00.000Z',
      },
    },
    result: {
      attemptId,
      examId: 'exam-unified-1',
      examTitle: 'RN Comprehensive Priority Assessment',
      status: 'Graded',
      startedAtUtc: '2026-11-20T10:00:00.000Z',
      submittedAtUtc: '2026-11-20T10:25:00.000Z',
      timeSpentSeconds: 1500,
      totalQuestions: 2,
      correctQuestions: 0,
      scorePercentage: 0,
      passingScorePercentage: null,
      passed: null,
      reviewReleased: true,
      reviewQuestions: [],
    },
    tutorProgression: {},
  };

  return { ...base, ...overrides };
}

describe('Unified Assessment, Review & Tutor Experience', () => {
  it('detects empty vs answered responses accurately across schemas', () => {
    assert.equal(isResponseAnswered(undefined), false);
    assert.equal(isResponseAnswered(null), false);
    assert.equal(isResponseAnswered(''), false);
    assert.equal(isResponseAnswered('null'), false);
    assert.equal(isResponseAnswered('[]'), false);
    assert.equal(isResponseAnswered('{}'), false);
    assert.equal(isResponseAnswered(JSON.stringify({ SelectedOptionIds: [] })), false);
    assert.equal(isResponseAnswered(JSON.stringify({ TextResponse: '   ' })), false);
    assert.equal(isResponseAnswered(JSON.stringify({ SelectedOptionId: 'opt-1' })), true);
    assert.equal(isResponseAnswered(JSON.stringify({ BooleanResponse: false })), true);
    assert.equal(isResponseAnswered(JSON.stringify({ NumericResponse: '0' })), true);
  });

  it('scores partial credit on SATA, MultipleTrueFalse, BowTie, DragAndDrop & BlankSelect without fabricating thresholds', () => {
    const sataQ = {
      id: 'sata-1',
      questionType: 'MultipleSelect',
      correctAnswerMeta: { allowPartialCredit: true },
      options: [
        { id: 'a', optionIndex: 0, optionText: 'A', isCorrect: true },
        { id: 'b', optionIndex: 1, optionText: 'B', isCorrect: true },
        { id: 'c', optionIndex: 2, optionText: 'C', isCorrect: false },
      ],
    };
    const partialSata = scoreCanonicalQuestion(sataQ, JSON.stringify({ SelectedOptionIds: ['a'] }));
    assert.equal(partialSata.isCorrect, false);
    assert.equal(partialSata.isPartiallyCorrect, true);
    assert.equal(partialSata.pointsAwarded, 1);
    assert.equal(partialSata.maxPoints, 2);

    const plusMinusZero = scoreCanonicalQuestion(sataQ, JSON.stringify({ SelectedOptionIds: ['a', 'c'] }));
    assert.equal(plusMinusZero.pointsAwarded, 0);

    const mtfQ = {
      id: 'mtf-1',
      questionType: 'MultipleTrueFalse',
      correctAnswerMeta: { allowPartialCredit: true },
      options: [
        { id: 'r1', optionIndex: 0, optionText: 'Row 1', isCorrect: true },
        { id: 'r2', optionIndex: 1, optionText: 'Row 2', isCorrect: false },
      ],
    };
    const mtfHalf = scoreCanonicalQuestion(
      mtfQ,
      JSON.stringify({ TrueFalseMap: { r1: 'True', r2: 'True' } })
    );
    assert.equal(mtfHalf.isPartiallyCorrect, true);
    assert.equal(mtfHalf.pointsAwarded, 1);
    assert.equal(mtfHalf.maxPoints, 2);

    const attempt = buildFullAttemptFixture({
      attemptId: `nofab-${Date.now()}`,
      status: 'InProgress',
      allowReview: true,
      passingScorePercentage: null,
      result: undefined,
    });
    attemptStore.setAttempt(attempt);
    attemptStore.autosaveResponse('learner-unified-owner', attempt.attemptId, {
      questionId: 'q1-sc',
      responseJson: JSON.stringify({ SelectedOptionId: 'opt-right' }),
      isFlagged: false,
    });
    const sub = attemptStore.submitAttempt('learner-unified-owner', attempt.attemptId);
    assert.equal(sub.success, true);
    assert.equal(sub.data.passingScorePercentage, null);
    assert.equal(sub.data.passed, null);
    assert.equal(sub.data.unansweredQuestions, 1);
    assert.equal(sub.data.correctQuestions, 1);
  });

  it('unlocks Review for eligible completed attempts via resolveExamModePermissions while keeping withheld exams locked', () => {
    // Standard Strata exam record without explicit allowReview=false -> canReview: true
    const defaultPerms = resolveExamModePermissions({ id: 101, title: 'RN Pharmacology' }, null, null);
    assert.equal(defaultPerms.canReview, true);
    assert.equal(defaultPerms.reviewReleased, true);

    // Even when modes array only lists Exam (and doesn't explicitly disable Review), completed review is unlocked
    const examModeOnlyPerms = resolveExamModePermissions(
      { id: 101, title: 'RN Pharmacology' },
      { reviewable: true },
      [{ id: 1, examId: 101, mode: 'Exam', isEnabled: true }]
    );
    assert.equal(examModeOnlyPerms.canReview, true);
    assert.equal(examModeOnlyPerms.reviewReleased, true);

    // Explicitly withheld review exam (allowReview: false) -> canReview: false, reviewReleased: false
    const withheldPerms = resolveExamModePermissions({ id: 102, allowReview: false }, null, null);
    assert.equal(withheldPerms.canReview, false);
    assert.equal(withheldPerms.reviewReleased, false);

    // Design reviewable: false -> locked
    const designWithheld = resolveExamModePermissions({ id: 103 }, { reviewable: false }, null);
    assert.equal(designWithheld.canReview, false);
    assert.equal(designWithheld.reviewReleased, false);

    // Mode explicitly disables Review (mode: 'Review', isEnabled: false) -> locked
    const modeDisabledReview = resolveExamModePermissions(
      { id: 104 },
      null,
      [{ id: 2, examId: 104, mode: 'Review', isEnabled: false }]
    );
    assert.equal(modeDisabledReview.canReview, false);
    assert.equal(modeDisabledReview.reviewReleased, false);
  });

  it('enforces explicit stage transitions and preserves Review filter counts', () => {
    const activeExamAvail = getStageAvailability({
      lifecycleStatus: 'InProgress',
      deliveryMode: 'Exam',
      reviewReleased: false,
      modePermissions: {
        canExam: true,
        canReview: true,
        canTutor: true,
        allowLayoutSwitching: true,
        allowModeSwitching: true,
        reviewReleased: false,
      },
      hasAttemptId: true,
    });
    assert.equal(activeExamAvail.assessment.canEnter, true);
    assert.equal(activeExamAvail.review.canEnter, false);
    assert.equal(activeExamAvail.tutor.canEnter, false);

    const submittedWithReview = getStageAvailability({
      lifecycleStatus: 'Graded',
      deliveryMode: 'Review',
      reviewReleased: true,
      modePermissions: {
        canExam: true,
        canReview: true,
        canTutor: false,
        allowLayoutSwitching: true,
        allowModeSwitching: true,
        reviewReleased: true,
      },
      hasAttemptId: true,
    });
    assert.equal(submittedWithReview.assessment.canEnter, false);
    assert.equal(submittedWithReview.results.canEnter, true);
    assert.equal(submittedWithReview.review.canEnter, true);
    assert.equal(submittedWithReview.tutor.canEnter, true);
    assert.equal(
      canTransitionStage('review', 'assessment', {
        lifecycleStatus: 'Graded',
        deliveryMode: 'Review',
        reviewReleased: true,
        hasAttemptId: true,
      }).allowed,
      false
    );

    const withheld = getStageAvailability({
      lifecycleStatus: 'Graded',
      deliveryMode: 'Exam',
      reviewReleased: false,
      hasAttemptId: true,
    });
    assert.equal(withheld.review.canEnter, false);
    assert.equal(withheld.tutor.canEnter, false);

    const reviewItems = [
      { id: '1', isCorrect: true, learnerResponse: '{"SelectedOptionId":"a"}', isFlagged: false },
      { id: '2', isCorrect: false, isPartiallyCorrect: true, pointsAwarded: 1, maxPoints: 2, learnerResponse: '{"SelectedOptionIds":["x"]}', isFlagged: true },
      { id: '3', isCorrect: false, learnerResponse: null, isFlagged: false },
    ];
    assert.equal(resolveQuestionReviewStatus(reviewItems[1]), 'partial');
    const counts = computeReviewCounts(reviewItems);
    assert.deepEqual(counts, {
      total: 3,
      correct: 1,
      partial: 1,
      incorrect: 1,
      unanswered: 1,
      flagged: 1,
    });
    assert.equal(filterReviewQuestions(reviewItems, 'Incorrect').map((i) => i.id).join(','), '2');
    assert.equal(filterReviewQuestions(reviewItems, 'Unanswered').map((i) => i.id).join(','), '3');
    assert.equal(filterReviewQuestions(reviewItems, 'Flagged').map((i) => i.id).join(','), '2');
  });

  it('validates Correct, Incorrect, Unanswered, Partial Credit, and answer summaries across all 18 question types', () => {
    const cases = [
      {
        type: 'SingleChoice',
        question: {
          id: 'q-sba',
          questionType: 'SingleChoice',
          options: [
            { id: 'o1', optionIndex: 0, optionText: 'Administer Epinephrine IM', isCorrect: true },
            { id: 'o2', optionIndex: 1, optionText: 'Observe for 1 hour', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'o1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'o2' }),
      },
      {
        type: 'MultipleSelect',
        question: {
          id: 'q-sata',
          questionType: 'MultipleSelect',
          correctAnswerMeta: { allowPartialCredit: true },
          options: [
            { id: 'o1', optionIndex: 0, optionText: 'Elevate head of bed', isCorrect: true },
            { id: 'o2', optionIndex: 1, optionText: 'Auscultate lung sounds', isCorrect: true },
            { id: 'o3', optionIndex: 2, optionText: 'Place flat supine', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionIds: ['o1', 'o2'] }),
        partialResp: JSON.stringify({ SelectedOptionIds: ['o1'] }),
        wrongResp: JSON.stringify({ SelectedOptionIds: ['o3'] }),
      },
      {
        type: 'TrueFalse',
        question: {
          id: 'q-tf',
          questionType: 'TrueFalse',
          options: [
            { id: 'true', optionIndex: 0, optionText: 'True', isCorrect: true },
            { id: 'false', optionIndex: 1, optionText: 'False', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ value: 'true' }),
        wrongResp: JSON.stringify({ value: 'false' }),
      },
      {
        type: 'FillInTheBlank',
        question: {
          id: 'q-fib',
          questionType: 'FillInTheBlank',
          options: [{ id: 'o1', optionIndex: 0, optionText: 'potassium', isCorrect: true }],
        },
        correctResp: JSON.stringify({ TextResponse: 'Potassium' }),
        wrongResp: JSON.stringify({ TextResponse: 'Calcium' }),
      },
      {
        type: 'ShortAnswer',
        question: {
          id: 'q-sa',
          questionType: 'ShortAnswer',
          options: [{ id: 'sa1', optionIndex: 0, optionText: 'epinephrine', isCorrect: true }],
        },
        correctResp: JSON.stringify({ TextResponse: 'epinephrine' }),
        wrongResp: JSON.stringify({ TextResponse: 'atropine' }),
      },
      {
        type: 'Matching',
        question: {
          id: 'q-match',
          questionType: 'Matching',
          options: [
            { id: 'm1', optionIndex: 0, optionText: 'Warfarin', description: 'INR', isCorrect: true },
            { id: 'm2', optionIndex: 1, optionText: 'Heparin', description: 'aPTT', isCorrect: true },
          ],
        },
        correctResp: JSON.stringify({ Pairs: { m1: 'INR', m2: 'aPTT' } }),
        wrongResp: JSON.stringify({ Pairs: { m1: 'aPTT', m2: 'INR' } }),
      },
      {
        type: 'OrderedResponse',
        question: {
          id: 'q-ord',
          questionType: 'OrderedResponse',
          correctAnswerMeta: { correctOrderIds: ['step1', 'step2'] },
          options: [
            { id: 'step1', optionIndex: 0, optionText: 'Stop infusion' },
            { id: 'step2', optionIndex: 1, optionText: 'Aspirate residual drug' },
          ],
        },
        correctResp: JSON.stringify({ OrderedOptionIds: ['step1', 'step2'] }),
        wrongResp: JSON.stringify({ OrderedOptionIds: ['step2', 'step1'] }),
      },
      {
        type: 'Hotspot',
        question: {
          id: 'q-hs',
          questionType: 'Hotspot',
          options: [
            { id: 'hs1', optionIndex: 0, optionText: 'Apical pulse 5th ICS MCL', isCorrect: true },
            { id: 'hs2', optionIndex: 1, optionText: 'Right clavicle', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionIds: ['hs1'] }),
        wrongResp: JSON.stringify({ SelectedOptionIds: ['hs2'] }),
      },
      {
        type: 'DragAndDrop',
        question: {
          id: 'q-dnd',
          questionType: 'DragAndDrop',
          correctAnswerMeta: { allowPartialCredit: true },
          options: [
            { id: 'd1', optionIndex: 0, optionText: 'Give oxygen', data: 'A', isCorrect: true },
            { id: 'd2', optionIndex: 1, optionText: 'Restrict airway', data: 'B', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ Buckets: { d1: 'A', d2: 'B' } }),
        partialResp: JSON.stringify({ Buckets: { d1: 'A', d2: 'A' } }),
        wrongResp: JSON.stringify({ Buckets: { d1: 'B', d2: 'A' } }),
      },
      {
        type: 'CaseBasedSingleChoice',
        question: {
          id: 'q-cs',
          questionType: 'CaseBasedSingleChoice',
          options: [
            { id: 'cs1', optionIndex: 0, optionText: 'Start IV crystalloids', isCorrect: true },
            { id: 'cs2', optionIndex: 1, optionText: 'Discharge patient', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'cs1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'cs2' }),
      },
      {
        type: 'NumericCalculation',
        question: {
          id: 'q-dosage',
          questionType: 'NumericCalculation',
          correctAnswerMeta: { expectedNumeric: '2.5' },
          options: [{ id: 'n1', optionIndex: 0, optionText: '2.5', isCorrect: true }],
        },
        correctResp: JSON.stringify({ NumericResponse: '2.5' }),
        wrongResp: JSON.stringify({ NumericResponse: '5.0' }),
      },
      {
        type: 'AudioBased',
        question: {
          id: 'q-audio',
          questionType: 'AudioBased',
          options: [
            { id: 'au1', optionIndex: 0, optionText: 'Inspiratory stridor', isCorrect: true },
            { id: 'au2', optionIndex: 1, optionText: 'Normal vesicular breath sounds', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'au1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'au2' }),
      },
      {
        type: 'VideoBased',
        question: {
          id: 'q-video',
          questionType: 'VideoBased',
          options: [
            { id: 'v1', optionIndex: 0, optionText: 'Maintain sterile field', isCorrect: true },
            { id: 'v2', optionIndex: 1, optionText: 'Turn back on sterile tray', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'v1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'v2' }),
      },
      {
        type: 'ImageBased',
        question: {
          id: 'q-img',
          questionType: 'ImageBased',
          options: [
            { id: 'im1', optionIndex: 0, optionText: 'Stage 3 pressure injury', isCorrect: true },
            { id: 'im2', optionIndex: 1, optionText: 'Intact skin', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'im1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'im2' }),
      },
      {
        type: 'MultipleImageSelection',
        question: {
          id: 'q-mimg',
          questionType: 'MultipleImageSelection',
          options: [
            { id: 'mi1', optionIndex: 0, optionText: 'Panel A', isCorrect: true },
            { id: 'mi2', optionIndex: 1, optionText: 'Panel B', isCorrect: true },
            { id: 'mi3', optionIndex: 2, optionText: 'Panel C', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionIds: ['mi1', 'mi2'] }),
        wrongResp: JSON.stringify({ SelectedOptionIds: ['mi3'] }),
      },
      {
        type: 'MatrixMultipleSelect',
        question: {
          id: 'q-matrix',
          questionType: 'MatrixMultipleSelect',
          matrix: {
            id: 'mx-1',
            rowCount: 1,
            columnCount: 2,
            rowHeaders: ['Administer O2'],
            columnHeaders: ['Indicated', 'Contraindicated'],
            cells: [
              { id: 'c1', rowIndex: 0, columnIndex: 0, isCorrect: true },
              { id: 'c2', rowIndex: 0, columnIndex: 1, isCorrect: false },
            ],
          },
          options: [],
        },
        correctResp: JSON.stringify({ SelectedCellIds: ['c1'] }),
        wrongResp: JSON.stringify({ SelectedCellIds: ['c2'] }),
      },
      {
        type: 'Highlight',
        question: {
          id: 'q-hl',
          questionType: 'Highlight',
          options: [
            { id: 'h1', optionIndex: 0, optionText: 'BP 84/50 mmHg', isCorrect: true },
            { id: 'h2', optionIndex: 1, optionText: 'Afebrile', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionIds: ['h1'] }),
        wrongResp: JSON.stringify({ SelectedOptionIds: ['h2'] }),
      },
      {
        type: 'BlankSelect',
        question: {
          id: 'q-bs',
          questionType: 'BlankSelect',
          options: [
            { id: 'b1', optionIndex: 0, label: '1', optionText: 'hypokalemia', isCorrect: true },
            { id: 'b2', optionIndex: 1, label: '1', optionText: 'hypernatremia', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ BlankSelections: { '1': 'b1' } }),
        wrongResp: JSON.stringify({ BlankSelections: { '1': 'b2' } }),
      },
      {
        type: 'BowTie',
        question: {
          id: 'q-bt',
          questionType: 'BowTie',
          correctAnswerMeta: { allowPartialCredit: true },
          options: [
            { id: 'a1', optionIndex: 0, label: 'Action', optionText: 'Administer O2', isCorrect: true },
            { id: 'a2', optionIndex: 1, label: 'Action', optionText: 'Restrict fluids', isCorrect: false },
            { id: 'c1', optionIndex: 2, label: 'Condition', optionText: 'Hypovolemic Shock', isCorrect: true },
            { id: 'p1', optionIndex: 3, label: 'Parameter', optionText: 'Urine output', isCorrect: true },
          ],
        },
        correctResp: JSON.stringify({ Actions: ['a1'], Condition: 'c1', Parameters: ['p1'] }),
        partialResp: JSON.stringify({ Actions: ['a1'], Condition: null, Parameters: [] }),
        wrongResp: JSON.stringify({ Actions: ['a2'], Condition: null, Parameters: [] }),
      },
      {
        type: 'MultipleTrueFalse',
        question: {
          id: 'q-mtf',
          questionType: 'MultipleTrueFalse',
          correctAnswerMeta: { allowPartialCredit: true },
          options: [
            { id: 'tf1', optionIndex: 0, optionText: 'Monitor potassium before digoxin', isCorrect: true },
            { id: 'tf2', optionIndex: 1, optionText: 'Give IV potassium bolus push', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ TrueFalseMap: { tf1: 'True', tf2: 'False' } }),
        partialResp: JSON.stringify({ TrueFalseMap: { tf1: 'True', tf2: 'True' } }),
        wrongResp: JSON.stringify({ TrueFalseMap: { tf1: 'False', tf2: 'True' } }),
      },
      {
        type: 'TabularResponse',
        question: {
          id: 'q-tab',
          questionType: 'TabularResponse',
          options: [
            { id: 'tb1', optionIndex: 0, optionText: 'Hold potassium-sparing diuretic', isCorrect: true },
            { id: 'tb2', optionIndex: 1, optionText: 'Increase potassium infusion', isCorrect: false },
          ],
        },
        correctResp: JSON.stringify({ SelectedOptionId: 'tb1' }),
        wrongResp: JSON.stringify({ SelectedOptionId: 'tb2' }),
      },
    ];

    assert.equal(cases.length >= 18, true, 'All 18 canonical renderer families must be verified');

    for (const c of cases) {
      const norm = resolveNormalizedQuestionType(c.question.questionType);
      assert.ok(norm.baseType.length > 0, `Expected baseType for ${c.question.questionType}`);

      // 1. Correct state
      const scoredCorrect = scoreCanonicalQuestion(c.question, c.correctResp);
      assert.equal(scoredCorrect.isCorrect, true, `Expected Correct for ${c.type}`);
      assert.equal(
        resolveQuestionReviewStatus({
          isCorrect: scoredCorrect.isCorrect,
          isPartiallyCorrect: scoredCorrect.isPartiallyCorrect,
          pointsAwarded: scoredCorrect.pointsAwarded,
          maxPoints: scoredCorrect.maxPoints,
          learnerResponse: c.correctResp,
        }),
        'correct',
        `Expected review status 'correct' for ${c.type}`
      );

      // 2. Incorrect state
      const scoredWrong = scoreCanonicalQuestion(c.question, c.wrongResp);
      assert.equal(scoredWrong.isCorrect, false, `Expected Incorrect for ${c.type}`);
      assert.equal(
        resolveQuestionReviewStatus({
          isCorrect: scoredWrong.isCorrect,
          isPartiallyCorrect: scoredWrong.isPartiallyCorrect,
          pointsAwarded: scoredWrong.pointsAwarded,
          maxPoints: scoredWrong.maxPoints,
          learnerResponse: c.wrongResp,
        }),
        'incorrect',
        `Expected review status 'incorrect' for ${c.type}`
      );

      // 3. Unanswered state
      const scoredEmpty = scoreCanonicalQuestion(c.question, null);
      assert.equal(scoredEmpty.isCorrect, false, `Expected Unanswered to score false for ${c.type}`);
      assert.equal(
        resolveQuestionReviewStatus({
          isCorrect: scoredEmpty.isCorrect,
          isPartiallyCorrect: scoredEmpty.isPartiallyCorrect,
          pointsAwarded: scoredEmpty.pointsAwarded,
          maxPoints: scoredEmpty.maxPoints,
          learnerResponse: null,
        }),
        'unanswered',
        `Expected review status 'unanswered' for ${c.type}`
      );
      const decodedEmpty = decodeQuestionAnswers(c.question, null, true);
      assert.equal(
        decodedEmpty.learnerSummary,
        'No response submitted (Unanswered).',
        `Expected unanswered summary for ${c.type}`
      );

      // 4. Partial credit state (if applicable)
      if (c.partialResp) {
        const scoredPartial = scoreCanonicalQuestion(c.question, c.partialResp);
        assert.equal(scoredPartial.isPartiallyCorrect, true, `Expected partial credit for ${c.type}`);
        assert.equal(
          resolveQuestionReviewStatus({
            isCorrect: scoredPartial.isCorrect,
            isPartiallyCorrect: scoredPartial.isPartiallyCorrect,
            pointsAwarded: scoredPartial.pointsAwarded,
            maxPoints: scoredPartial.maxPoints,
            learnerResponse: c.partialResp,
          }),
          'partial',
          `Expected review status 'partial' for ${c.type}`
        );
      }

      // 5. Distinct authoritative vs learner answer summaries
      const decodedWrong = decodeQuestionAnswers(c.question, c.wrongResp, true);
      assert.ok(decodedWrong.authoritativeSummary.length > 0, `Authoritative answer summary must be non-empty for ${c.type}`);
      assert.ok(decodedWrong.learnerSummary.length > 0, `Learner answer summary must be non-empty for ${c.type}`);
      assert.notEqual(
        decodedWrong.authoritativeSummary,
        decodedWrong.learnerSummary,
        `Wrong learner answer summary must differ from authoritative key for ${c.type}`
      );
    }
  });

  it('supports all 7 Tutor actions + custom follow-up + isolated practice without mutating submitted answers or scores', async () => {
    const attempt = buildFullAttemptFixture();
    const savedBefore = JSON.stringify(attempt.savedResponses);
    const resultBefore = JSON.stringify(attempt.result);
    const submittedAtBefore = attempt.submittedAtUtc;
    const statusBefore = attempt.status;

    const actions = [
      'explain_question',
      'why_my_answer_incorrect',
      'why_correct_better',
      'explain_each_option',
      'teach_concept',
      'similar_practice',
      'summarize_takeaway',
    ];

    let practicePrompt = null;
    for (const action of actions) {
      const res = await generateTutorAssistForAttempt(attempt, 'learner-unified-owner', {
        questionId: 'q1-sc',
        action,
      });
      assert.equal(res.ok, true, `Action ${action} failed`);
      assert.equal(res.data.message.isAiGenerated, false);
      assert.ok(res.data.message.sections && res.data.message.sections.length > 0);
      if (action === 'similar_practice') {
        practicePrompt = res.data.message.practicePrompt;
        assert.ok(practicePrompt);
        assert.equal(practicePrompt.practiceId, 'q2-sata');
        assert.equal(practicePrompt.isIsolatedPractice, true);
      }
    }

    const customRes = await generateTutorAssistForAttempt(attempt, 'learner-unified-owner', {
      questionId: 'q1-sc',
      action: 'custom_question',
      userMessage: 'Why is calling rapid response better than documenting first?',
    });
    assert.equal(customRes.ok, true);
    assert.ok(customRes.data.conversation.length === 16);

    const practiceCheck = checkTutorPracticeForAttempt(attempt, 'learner-unified-owner', {
      questionId: 'q1-sc',
      practiceQuestionId: practicePrompt.practiceId,
      responseJson: JSON.stringify({ SelectedOptionIds: ['s1', 's2'] }),
    });
    assert.equal(practiceCheck.ok, true);
    assert.equal(practiceCheck.data.isCorrect, true);
    assert.equal(practiceCheck.data.isolatedFromAttempt, true);

    const history = getTutorConversationForAttempt(attempt, 'learner-unified-owner', 'q1-sc');
    assert.equal(history.ok, true);
    assert.equal(history.data.conversation.length, 16);

    // Strictly invariant attempt record check
    assert.equal(JSON.stringify(attempt.savedResponses), savedBefore);
    assert.equal(JSON.stringify(attempt.result), resultBefore);
    assert.equal(attempt.submittedAtUtc, submittedAtBefore);
    assert.equal(attempt.status, statusBefore);
  });

  it('enforces IDOR, active Exam lock, withheld Review lock, pre-evaluation lock, practice lock, turn cap, and route security', async () => {
    // 1. Anti-IDOR
    const gradedAttempt = buildFullAttemptFixture();
    const idorRes = await generateTutorAssistForAttempt(gradedAttempt, 'other-learner', {
      questionId: 'q1-sc',
      action: 'explain_question',
    });
    assert.equal(idorRes.ok, false);
    assert.equal(idorRes.status, 403);

    // 2. Active Exam lock
    const activeExam = buildFullAttemptFixture({
      status: 'InProgress',
      deliveryMode: 'Exam',
      submittedAtUtc: undefined,
      result: undefined,
    });
    const activeLock = await generateTutorAssistForAttempt(activeExam, 'learner-unified-owner', {
      questionId: 'q1-sc',
      action: 'explain_question',
    });
    assert.equal(activeLock.ok, false);
    assert.equal(activeLock.status, 403);
    assert.equal(activeLock.errorCode, 'TUTOR_LOCKED_DURING_ACTIVE_EXAM');

    // 3. Review withheld lock
    const withheldAttempt = buildFullAttemptFixture({ allowReview: false });
    const withheldRes = await generateTutorAssistForAttempt(withheldAttempt, 'learner-unified-owner', {
      questionId: 'q1-sc',
      action: 'explain_question',
    });
    assert.equal(withheldRes.ok, false);
    assert.equal(withheldRes.status, 403);
    assert.equal(withheldRes.errorCode, 'TUTOR_REVIEW_WITHHELD');

    // 4. Active Tutor pre-evaluation & cross-question practice lock
    const activeTutor = buildFullAttemptFixture({
      status: 'InProgress',
      deliveryMode: 'Tutor',
      submittedAtUtc: undefined,
      result: undefined,
      tutorProgression: {},
    });
    const evalFirst = await generateTutorAssistForAttempt(activeTutor, 'learner-unified-owner', {
      questionId: 'q1-sc',
      action: 'why_correct_better',
    });
    assert.equal(evalFirst.ok, false);
    assert.equal(evalFirst.status, 409);
    assert.equal(evalFirst.errorCode, 'EVALUATE_FIRST');

    const crossPracticeLock = checkTutorPracticeForAttempt(activeTutor, 'learner-unified-owner', {
      questionId: 'q1-sc',
      practiceQuestionId: 'q2-sata',
      responseJson: JSON.stringify({ SelectedOptionIds: ['s1'] }),
    });
    assert.equal(crossPracticeLock.ok, false);
    assert.equal(crossPracticeLock.status, 409);
    assert.equal(crossPracticeLock.errorCode, 'PRACTICE_ITEM_LOCKED');

    // 5. Turn cap enforcement (MAX_TUTOR_MESSAGES_PER_QUESTION = 30)
    const capAttempt = buildFullAttemptFixture();
    capAttempt.tutorConversations = {
      'q1-sc': Array.from({ length: MAX_TUTOR_MESSAGES_PER_QUESTION }, (_, i) => ({
        id: `m-${i}`,
        role: i % 2 === 0 ? 'learner' : 'tutor',
        content: 'test',
        source: 'grounded_clinical_coach',
        providerLabel: 'NURVIA Grounded Clinical Coach',
        isAiGenerated: false,
        officialDisclaimer: 'test',
        createdAtUtc: '2026-11-20T10:30:00.000Z',
      })),
    };
    const capRes = await generateTutorAssistForAttempt(capAttempt, 'learner-unified-owner', {
      questionId: 'q1-sc',
      action: 'summarize_takeaway',
    });
    assert.equal(capRes.ok, false);
    assert.equal(capRes.status, 429);
    assert.equal(capRes.errorCode, 'TUTOR_TURN_LIMIT_REACHED');

    // 6. Cold-cache privilege escalation regression guard on Tutor route handlers
    for (const rel of [
      'src/app/api/attempts/[attemptId]/tutor/assist/route.ts',
      'src/app/api/attempts/[attemptId]/tutor/conversations/route.ts',
      'src/app/api/attempts/[attemptId]/tutor/practice-check/route.ts',
    ]) {
      const src = readRel(rel);
      assert.ok(
        src.includes('ensureAttemptLoaded(learner, attemptId, siteMeta)'),
        `${rel} must call ensureAttemptLoaded without forcing 'Tutor' mode`
      );
      assert.ok(
        !src.includes("ensureAttemptLoaded(learner, attemptId, siteMeta, 'Tutor')"),
        `${rel} must not bypass active Exam mode permissions on cold cache`
      );
    }

    // 7. Objective C & F: Review unlocking for completed attempts & ContextualTutorWorkspace answer-state rendering
    const loaderSrc = readRel('src/lib/attempts/live-exam-loader.ts');
    assert.ok(
      loaderSrc.includes('const explicitReviewDisabled =') &&
        loaderSrc.includes('const canReview = !explicitReviewDisabled'),
      'resolveExamModePermissions in live-exam-loader.ts must unlock Review unless explicitly disabled'
    );

    const historyRouteSrc = readRel('src/app/api/attempts/history/route.ts');
    assert.ok(
      historyRouteSrc.includes("canReview: status !== 'InProgress' ? allowReview !== false : false"),
      '/api/attempts/history must unlock canReview for completed attempts unless allowReview is false'
    );

    const singularAttemptPageSrc = readRel('src/app/learner/attempt/page.tsx');
    assert.ok(singularAttemptPageSrc.includes('ReviewWorkspace'), '/learner/attempt must expose ReviewWorkspace');
    assert.ok(singularAttemptPageSrc.includes('ContextualTutorWorkspace'), '/learner/attempt must expose ContextualTutorWorkspace');

    const tutorWorkspaceSrc = readRel('src/components/exam/ContextualTutorWorkspace.tsx');
    assert.ok(
      tutorWorkspaceSrc.includes('QuestionRendererRegistry') &&
        tutorWorkspaceSrc.includes('data-testid="tutor-answer-state-banner"'),
      'ContextualTutorWorkspace must render full QuestionRendererRegistry answer-state breakdown when keysReleased is true'
    );
  });
});
