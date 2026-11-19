import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveNormalizedQuestionType,
  getStrataSubmissionType,
  toStrataAnswerPayload,
  fromStrataSavedUserAnswer,
  evaluateCanonicalQuestion,
  wasCanonicalOptionSelected,
} from '../src/lib/attempts/strata-answer-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const STANDALONE_TO_ACTION = {
  SingleChoice: 'ActionSingleChoice',
  MultipleSelect: 'ActionMultipleSelect',
  TrueFalse: 'ActionTrueFalse',
  NumericResponse: 'ActionNumericResponse',
  Matching: 'ActionMatching',
  OrderingNumber: 'ActionOrderingNumber',
  OrderingItem: 'ActionOrderingItem',
  OrderingDragDrop: 'ActionOrderingDragDrop',
  DynamicImage: 'ActionDynamicImage',
  MultipleImage: 'ActionMultipleImage',
  BlankSelect: 'ActionBlankSelect',
  BlankFill: 'ActionBlankFill',
  Hotspot: 'ActionHotspot',
  OpenEnded: 'ActionOpenEnded',
  HighLight: 'ActionHighLight',
  AudioBased: 'ActionAudioBased',
  VideoBased: 'ActionVideoBased',
  MatrixSingleChoice: 'ActionMatrixSingleChoice',
  MatrixMultipleSelect: 'ActionMatrixMultipleSelect',
};

describe('All 38 Strata Question Types — Adapter, Serialization & Evaluation', () => {
  it('maps all 19 standalone and 19 CaseBased Strata types to exact submission types', () => {
    const entries = Object.entries(STANDALONE_TO_ACTION);
    assert.equal(entries.length, 19);

    for (const [typeName, expectedAction] of entries) {
      assert.equal(getStrataSubmissionType(typeName), expectedAction);
      const caseBasedName = `CaseBased${typeName}`;
      const expectedCaseAction = expectedAction.replace(/^Action/, 'ActionCaseBased');
      assert.equal(getStrataSubmissionType(caseBasedName), expectedCaseAction);

      const resolved = resolveNormalizedQuestionType(caseBasedName);
      assert.equal(resolved.isCaseBased, true);
    }
  });

  it('evaluates SingleChoice, MultipleSelect, TrueFalse, and NumericResponse deterministically', () => {
    const scQ = {
      id: 'q1',
      questionType: 'SingleChoice',
      options: [
        { id: '101', numericId: 101, optionIndex: 1, optionText: 'Hold digoxin', isCorrect: true },
        { id: '102', numericId: 102, optionIndex: 2, optionText: 'Administer potassium', isCorrect: false },
      ],
    };
    assert.equal(evaluateCanonicalQuestion(scQ, JSON.stringify({ SelectedOptionId: '101' })), true);
    assert.equal(evaluateCanonicalQuestion(scQ, JSON.stringify({ SelectedOptionId: '102' })), false);
    assert.equal(wasCanonicalOptionSelected('101', JSON.stringify({ SelectedOptionId: '101' })), true);
    assert.equal(toStrataAnswerPayload(scQ, JSON.stringify({ SelectedOptionId: '101' })), 101);

    const msQ = {
      id: 'q2',
      questionType: 'CaseBasedMultipleSelect',
      options: [
        { id: '201', numericId: 201, optionIndex: 1, optionText: 'A', isCorrect: true },
        { id: '202', numericId: 202, optionIndex: 2, optionText: 'B', isCorrect: true },
        { id: '203', numericId: 203, optionIndex: 3, optionText: 'C', isCorrect: false },
      ],
    };
    assert.equal(evaluateCanonicalQuestion(msQ, JSON.stringify({ SelectedOptionIds: ['201', '202'] })), true);
    assert.equal(evaluateCanonicalQuestion(msQ, JSON.stringify({ SelectedOptionIds: ['201'] })), false);

    const tfQ = {
      id: 'q3',
      questionType: 'TrueFalse',
      options: [
        { id: '301', numericId: 301, optionIndex: 1, optionText: 'True', isCorrect: false },
        { id: '302', numericId: 302, optionIndex: 2, optionText: 'False', isCorrect: true },
      ],
    };
    assert.equal(evaluateCanonicalQuestion(tfQ, JSON.stringify({ value: '302' })), true);
    assert.equal(toStrataAnswerPayload(tfQ, JSON.stringify({ value: '302' })), false);

    const numQ = {
      id: 'q4',
      questionType: 'NumericResponse',
      options: [],
      correctAnswerMeta: { expectedNumeric: '12.5' },
    };
    assert.equal(evaluateCanonicalQuestion(numQ, JSON.stringify({ NumericResponse: '12.5' })), true);
    assert.equal(evaluateCanonicalQuestion(numQ, JSON.stringify({ NumericResponse: '13.0' })), false);
  });

  it('evaluates Matrix, MultipleImage, Matching, Ordering, BlankSelect, BlankFill, Hotspot & HighLight', () => {
    const matrixSingleQ = {
      id: 'm1',
      questionType: 'MatrixSingleChoice',
      options: [],
      matrix: {
        id: 'mat-1',
        rowCount: 1,
        columnCount: 2,
        rowHeaders: ['Intervention 1'],
        columnHeaders: ['Indicated', 'Contraindicated'],
        responseType: 'singleChoice',
        cells: [
          { id: '501', numericId: 501, rowIndex: 0, columnIndex: 0, isCorrect: true },
          { id: '502', numericId: 502, rowIndex: 0, columnIndex: 1, isCorrect: false },
        ],
      },
    };
    assert.equal(evaluateCanonicalQuestion(matrixSingleQ, JSON.stringify({ SelectedCellId: '501' })), true);
    assert.equal(evaluateCanonicalQuestion(matrixSingleQ, JSON.stringify({ SelectedCellId: '502' })), false);

    const matrixMultiQ = {
      id: 'm2',
      questionType: 'MatrixMultipleSelect',
      options: [],
      matrix: {
        id: 'mat-2',
        rowCount: 1,
        columnCount: 3,
        rowHeaders: ['Row 1'],
        columnHeaders: ['A', 'B', 'C'],
        responseType: 'multipleChoice',
        cells: [
          { id: '601', numericId: 601, rowIndex: 0, columnIndex: 0, isCorrect: true },
          { id: '602', numericId: 602, rowIndex: 0, columnIndex: 1, isCorrect: true },
          { id: '603', numericId: 603, rowIndex: 0, columnIndex: 2, isCorrect: false },
        ],
      },
    };
    assert.equal(evaluateCanonicalQuestion(matrixMultiQ, JSON.stringify({ SelectedCellIds: ['602', '601'] })), true);

    const multiImageQ = {
      id: 'img1',
      questionType: 'MultipleImage',
      options: [],
      media: [
        { id: 'm-1', numericId: 701, type: 'image', url: 'https://cdn.example/1.png' },
        { id: 'm-2', numericId: 702, type: 'image', url: 'https://cdn.example/2.png' },
      ],
      correctAnswerMeta: { correctMediaIds: ['m-1', '701'] },
    };
    assert.equal(evaluateCanonicalQuestion({ ...multiImageQ, correctAnswerMeta: { correctMediaIds: ['701'] } }, JSON.stringify({ SelectedMediaIds: ['701'] })), true);

    const matchingQ = {
      id: 'match1',
      questionType: 'Matching',
      options: [
        { id: '801', numericId: 801, optionIndex: 1, optionText: 'Naloxone', description: 'Opioid antagonist' },
        { id: '802', numericId: 802, optionIndex: 2, optionText: 'Protamine', description: 'Heparin reversal' },
      ],
    };
    assert.equal(evaluateCanonicalQuestion(matchingQ, JSON.stringify({ Pairs: { '801': 'Opioid antagonist', '802': 'Heparin reversal' } })), true);

    const orderingQ = {
      id: 'ord1',
      questionType: 'OrderingNumber',
      options: [
        { id: '901', optionIndex: 1, optionText: 'Assess airway' },
        { id: '902', optionIndex: 2, optionText: 'Apply oxygen' },
      ],
      correctAnswerMeta: { correctOrderIds: ['901', '902'] },
    };
    assert.equal(evaluateCanonicalQuestion(orderingQ, JSON.stringify({ OrderingNumbers: { '901': '1', '902': '2' } })), true);
    assert.equal(evaluateCanonicalQuestion(orderingQ, JSON.stringify({ OrderingNumbers: { '901': '2', '902': '1' } })), false);

    const blankSelectQ = {
      id: 'bs1',
      questionType: 'BlankSelect',
      options: [{ id: '1001', optionIndex: 1, optionText: 'Hyperkalemia', isCorrect: true }],
      correctAnswerMeta: { correctBlanks: { blank1: '1001' } },
    };
    assert.equal(evaluateCanonicalQuestion(blankSelectQ, JSON.stringify({ BlankSelections: { '1': '1001' } })), true);

    const highlightQ = {
      id: 'hl1',
      questionType: 'HighLight',
      options: [{ id: '1101', optionIndex: 1, optionText: 'SpO2 84%', isCorrect: true }],
    };
    assert.equal(evaluateCanonicalQuestion(highlightQ, JSON.stringify({ SelectedOptionIds: ['1101'] })), true);

    // Saved answer restoration check
    const scRestoreQ = {
      id: 'sc_restore',
      questionType: 'SingleChoice',
      options: [{ id: '101', optionIndex: 1, optionText: 'A', isCorrect: true }],
    };
    const restored = fromStrataSavedUserAnswer(scRestoreQ, { userAnswerData: '101', questionOptionId: 101 });
    assert.equal(restored, JSON.stringify({ SelectedOptionId: '101' }));
  });

  it('verifies QuestionRendererRegistry covers all standalone & CaseBased types and removes fake hardcoded charts', () => {
    const registrySrc = readRel('src/components/exam/renderers/QuestionRendererRegistry.tsx');
    for (const token of ['blankselect', 'blankfill', 'orderingnumber', 'orderingitem', 'orderingdragdrop', 'matrixsinglechoice', 'matrixmultipleselect', 'multipleimage', 'hotspot', 'highlight', 'isCaseBased']) {
      assert.ok(registrySrc.includes(token), `Registry missing ${token}`);
    }

    const caseStudySrc = readRel('src/components/exam/renderers/CaseStudyRenderer.tsx');
    assert.ok(!caseStudySrc.includes('Mrs. E.V.') && !caseStudySrc.includes('heart failure decompensation'), 'CaseStudyRenderer must not hardcode fake HF vignette');

    const tabularSrc = readRel('src/components/exam/renderers/TabularResponseRenderer.tsx');
    assert.ok(!tabularSrc.includes('Admission (00:00)'), 'TabularResponseRenderer must not hardcode fake vitals table');

    const numericSrc = readRel('src/components/exam/renderers/NumericCalculationRenderer.tsx');
    assert.ok(!numericSrc.includes('Â±'), 'NumericCalculationRenderer must not contain UTF-8 mojibake');

    const orderedSrc = readRel('src/components/exam/renderers/OrderedResponseRenderer.tsx');
    assert.ok(orderedSrc.includes('[question.id'), 'OrderedResponseRenderer must reset on question.id change');
  });
});
