import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeExhibits,
  resolveAuthoritativeExhibitId,
  isCaseStudyQuestion,
  resolveAuthoritativeCaseStudyId,
  normalizeCaseStudies,
  groupQuestionsByCaseStudy,
  getCaseStudyNavigation,
  deduplicateQuestions,
} from '../src/lib/content/case-study-normalizer-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Clinical Case Study & Exhibit Duplication Defect Remediation', () => {

  // 1. A case with one Nurses' Notes exhibit
  it('1. A case with one Nurses\' Notes exhibit: preserves title, content, and ordering', () => {
    const raw = [
      {
        id: 'exh-nn-1',
        guidId: 'guid-nn-001',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: 'Patient admitted at 0800 via ED with severe dyspnea and bilateral lower extremity edema.',
        displayOrder: 1,
      },
    ];

    const normalized = normalizeExhibits(raw);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].id, 'guid-nn-001');
    assert.equal(normalized[0].title, "Nurses' Notes");
    assert.ok(normalized[0].content.includes('dyspnea and bilateral lower extremity edema'));
    assert.equal(normalized[0].displayOrder, 1);
  });

  // 2. A case with multiple distinct exhibit types
  it('2. A case with multiple distinct exhibit types: preserves all exhibits in original order', () => {
    const raw = [
      {
        id: 'exh-notes',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: '1400: Patient alert and oriented x4. Crackles noted at lung bases.',
      },
      {
        id: 'exh-vitals',
        type: 'VitalSigns',
        title: 'Vital Signs',
        content: 'BP 164/92 mmHg, HR 102 bpm, RR 24/min, SpO2 91% on room air, Temp 37.1 C.',
      },
      {
        id: 'exh-labs',
        type: 'LabResults',
        title: 'Laboratory Results',
        content: 'BNP 850 pg/mL (elevated), Potassium 3.8 mEq/L, Sodium 138 mEq/L, BUN 24 mg/dL.',
      },
      {
        id: 'exh-orders',
        type: 'ProviderOrders',
        title: 'Provider Orders',
        content: 'Administer furosemide 40 mg IV STAT. Oxygen at 2 L/min via nasal cannula.',
      },
    ];

    const normalized = normalizeExhibits(raw);
    assert.equal(normalized.length, 4);
    assert.deepEqual(
      normalized.map((e) => e.title),
      ["Nurses' Notes", 'Vital Signs', 'Laboratory Results', 'Provider Orders']
    );
    assert.deepEqual(
      normalized.map((e) => e.displayOrder),
      [1, 2, 3, 4]
    );
  });

  // 3. A case containing two distinct exhibits with identical display titles
  it('3. A case containing two distinct exhibits with identical display titles: preserves both distinct notes', () => {
    const raw = [
      {
        id: 'note-0700',
        guidId: 'guid-note-0700',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: '0700: Patient admitted from PACU post-op cholecystectomy. Dressing dry and intact.',
        displayOrder: 1,
      },
      {
        id: 'note-1100',
        guidId: 'guid-note-1100',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: '1100: Patient reports incisional pain rated 8/10. Administered prescribed hydromorphone IV.',
        displayOrder: 2,
      },
    ];

    const normalized = normalizeExhibits(raw);
    assert.equal(normalized.length, 2, 'Must not drop legitimate distinct notes sharing display title');
    assert.equal(normalized[0].id, 'guid-note-0700');
    assert.equal(normalized[1].id, 'guid-note-1100');
    assert.equal(normalized[0].title, "Nurses' Notes");
    assert.equal(normalized[1].title, "Nurses' Notes");
    assert.ok(normalized[0].content.includes('0700: Patient admitted'));
    assert.ok(normalized[1].content.includes('1100: Patient reports incisional pain'));
  });

  // 4. Duplicate references to the same exhibit identifier
  it('4. Duplicate references to the same exhibit identifier: eliminates duplicate tab cleanly', () => {
    const raw = [
      {
        id: 'exh-nn-shared',
        guidId: 'guid-shared-note',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: '0800: Client admitted to progressive care with heart failure exacerbation.',
      },
      {
        id: 'exh-nn-shared',
        guidId: 'guid-shared-note',
        type: 'NursesNotes',
        title: "Nurses' Notes",
        content: '0800: Client admitted to progressive care with heart failure exacerbation.',
      },
      {
        id: 'exh-vitals-1',
        guidId: 'guid-vitals-1',
        type: 'VitalSigns',
        title: 'Vital Signs',
        content: 'BP 158/90 mmHg, HR 98, RR 22, SpO2 93%.',
      },
    ];

    const normalized = normalizeExhibits(raw);
    assert.equal(normalized.length, 2, 'Duplicate exhibit reference must be deduplicated to 1');
    assert.equal(normalized[0].title, "Nurses' Notes");
    assert.equal(normalized[1].title, 'Vital Signs');
    assert.equal(normalized[0].id, 'guid-shared-note');
    assert.equal(normalized[1].id, 'guid-vitals-1');
  });

  // 5. Two distinct case studies with similar titles
  it('5. Two distinct case studies with similar titles: preserves both distinct case studies', () => {
    const rawCases = [
      {
        id: 'case-cardiac-adult',
        guidId: 'guid-case-cardiac-adult',
        title: 'Clinical Case Study: Acute Chest Pain',
        scenario: 'A 65-year-old male presents with substernal chest pressure radiating to left jaw.',
        exhibits: [{ id: 'exh-ecg-1', title: '12-Lead ECG', content: 'ST elevation in leads II, III, aVF.' }],
      },
      {
        id: 'case-cardiac-peds',
        guidId: 'guid-case-cardiac-peds',
        title: 'Clinical Case Study: Acute Chest Pain',
        scenario: 'A 14-year-old female presents with pleuritic chest pain worsened by deep inspiration.',
        exhibits: [{ id: 'exh-echo-1', title: 'Echocardiogram', content: 'Mild pericardial effusion noted.' }],
      },
    ];

    const normalized = normalizeCaseStudies(rawCases);
    assert.equal(normalized.length, 2, 'Distinct case studies with matching titles must never be merged');
    assert.equal(normalized[0].id, 'guid-case-cardiac-adult');
    assert.equal(normalized[1].id, 'guid-case-cardiac-peds');
    assert.ok(normalized[0].scenario.includes('65-year-old male'));
    assert.ok(normalized[1].scenario.includes('14-year-old female'));
  });

  // 6. Duplicate references to the same case-study identifier
  it('6. Duplicate references to the same case-study identifier: merges into one case study instance', () => {
    const rawCases = [
      {
        caseStudyId: 'cs-pneumonia-01',
        title: 'Community-Acquired Pneumonia Case',
        scenario: 'An 82-year-old resident of an assisted living facility is admitted with fever.',
        exhibits: [
          { id: 'exh-cxr', title: 'Chest X-Ray', content: 'Right lower lobe consolidation.' },
        ],
      },
      {
        caseStudyId: 'cs-pneumonia-01',
        title: 'Community-Acquired Pneumonia Case',
        scenario: 'An 82-year-old resident of an assisted living facility is admitted with fever.',
        exhibits: [
          { id: 'exh-cxr', title: 'Chest X-Ray', content: 'Right lower lobe consolidation.' },
          { id: 'exh-cbc', title: 'CBC with Differential', content: 'WBC 18.4 x 10^3/uL, Bands 12%.' },
        ],
      },
    ];

    const normalized = normalizeCaseStudies(rawCases);
    assert.equal(normalized.length, 1, 'Duplicate case study references must yield exactly one case');
    assert.equal(normalized[0].id, 'cs-pneumonia-01');
    assert.equal(normalized[0].exhibits.length, 2, 'Legitimate exhibits must be merged and normalized');
    assert.deepEqual(
      normalized[0].exhibits.map((e) => e.title),
      ['Chest X-Ray', 'CBC with Differential']
    );
  });

  // 7. Multiple questions legitimately sharing one case study
  it('7. Multiple questions legitimately sharing one case study: groups questions under single case study', () => {
    const questions = [
      {
        id: 'q-step-1',
        questionType: 'CaseBasedSingleChoice',
        caseStudyId: 'case-unfolding-stroke-01',
        caseTitle: 'Acute Ischemic Stroke Simulation',
        metaStem: 'A 71-year-old female is brought by EMS with sudden right-sided hemiparesis.',
        stem: 'Step 1: Which assessment finding is the priority cue?',
        exhibits: [
          { id: 'exh-neuro', title: 'Neurological Assessment', content: 'NIHSS score 14.' },
          { id: 'exh-ct', title: 'Non-Contrast Head CT', content: 'No acute intracranial hemorrhage.' },
        ],
      },
      {
        id: 'q-step-2',
        questionType: 'CaseBasedMultipleSelect',
        caseStudyId: 'case-unfolding-stroke-01',
        caseTitle: 'Acute Ischemic Stroke Simulation',
        metaStem: 'A 71-year-old female is brought by EMS with sudden right-sided hemiparesis.',
        stem: 'Step 2: Identify 3 contraindications to IV thrombolytic therapy.',
        exhibits: [
          { id: 'exh-neuro', title: 'Neurological Assessment', content: 'NIHSS score 14.' },
          { id: 'exh-ct', title: 'Non-Contrast Head CT', content: 'No acute intracranial hemorrhage.' },
        ],
      },
      {
        id: 'q-step-3',
        questionType: 'CaseBasedSingleChoice',
        caseStudyId: 'case-unfolding-stroke-01',
        caseTitle: 'Acute Ischemic Stroke Simulation',
        metaStem: 'A 71-year-old female is brought by EMS with sudden right-sided hemiparesis.',
        stem: 'Step 3: What is the target blood pressure range prior to alteplase administration?',
        exhibits: [
          { id: 'exh-neuro', title: 'Neurological Assessment', content: 'NIHSS score 14.' },
          { id: 'exh-ct', title: 'Non-Contrast Head CT', content: 'No acute intracranial hemorrhage.' },
        ],
      },
    ];

    const groups = groupQuestionsByCaseStudy(questions);
    assert.equal(groups.length, 1, 'All 3 unfolding questions must belong to 1 case study group');
    assert.equal(groups[0].isCaseStudy, true);
    assert.equal(groups[0].caseStudyId, 'case-unfolding-stroke-01');
    assert.equal(groups[0].questions.length, 3);
    assert.equal(groups[0].caseStudy.exhibits.length, 2, 'Shared exhibits are normalized to 2 items');
  });

  // 8. Exhibit ordering and tab switching
  it('8. Exhibit ordering and tab switching: stable displayOrder, unique keys, and index bounds', () => {
    const raw = [
      { id: 'ex-1', title: 'Provider Orders', content: 'Bed rest with bathroom privileges.', displayOrder: 1 },
      { id: 'ex-2', title: 'Vital Signs Flowsheet', content: '0800: BP 120/80. 1200: BP 118/78.', displayOrder: 2 },
      { id: 'ex-3', title: "Nurses' Progress Notes", content: 'Patient ambulating without assistance.', displayOrder: 3 },
    ];

    const normalized = normalizeExhibits(raw);
    assert.equal(normalized[0].title, 'Provider Orders');
    assert.equal(normalized[1].title, 'Vital Signs Flowsheet');
    assert.equal(normalized[2].title, "Nurses' Progress Notes");

    // Keys are unique and deterministic
    const keys = normalized.map((ex, idx) => ex.id ? `exhibit-id-${ex.id}` : `exhibit-idx-${idx}`);
    assert.equal(new Set(keys).size, 3, 'Every exhibit tab must have a strictly unique key');

    // Tab index bounds check
    const activeIndex = 1;
    assert.ok(activeIndex >= 0 && activeIndex < normalized.length);
    assert.equal(normalized[activeIndex].title, 'Vital Signs Flowsheet');
  });

  // 9. Case-study navigation across questions
  it('9. Case-study navigation across questions: calculates positions and transitions', () => {
    const examQuestions = [
      { id: 'q1', questionType: 'SingleChoice', stem: 'Standalone question 1' },
      { id: 'q2', questionType: 'CaseBasedSingleChoice', caseStudyId: 'cs-pediatric', stem: 'Peds Case Q1' },
      { id: 'q3', questionType: 'CaseBasedMultipleSelect', caseStudyId: 'cs-pediatric', stem: 'Peds Case Q2' },
      { id: 'q4', questionType: 'CaseBasedSingleChoice', caseStudyId: 'cs-pediatric', stem: 'Peds Case Q3' },
      { id: 'q5', questionType: 'MultipleSelect', stem: 'Standalone question 2' },
      { id: 'q6', questionType: 'CaseBasedSingleChoice', caseStudyId: 'cs-geriatric', stem: 'Geri Case Q1' },
      { id: 'q7', questionType: 'CaseBasedSingleChoice', caseStudyId: 'cs-geriatric', stem: 'Geri Case Q2' },
    ];

    // Nav for standalone q1
    const navQ1 = getCaseStudyNavigation(examQuestions, 0);
    assert.equal(navQ1.isCaseStudy, false);

    // Nav for q2 (Peds Case, Item 1 of 3)
    const navQ2 = getCaseStudyNavigation(examQuestions, 1);
    assert.equal(navQ2.isCaseStudy, true);
    assert.equal(navQ2.caseStudyId, 'cs-pediatric');
    assert.equal(navQ2.totalQuestionsInCase, 3);
    assert.equal(navQ2.questionIndexInCase, 0);
    assert.equal(navQ2.isFirstInCase, true);
    assert.equal(navQ2.isLastInCase, false);
    assert.equal(navQ2.nextCaseQuestionIndex, 5, 'Next case starts at index 5 (Geri Case Q1)');

    // Nav for q4 (Peds Case, Item 3 of 3)
    const navQ4 = getCaseStudyNavigation(examQuestions, 3);
    assert.equal(navQ4.isCaseStudy, true);
    assert.equal(navQ4.questionIndexInCase, 2);
    assert.equal(navQ4.isFirstInCase, false);
    assert.equal(navQ4.isLastInCase, true);

    // Nav for q6 (Geri Case, Item 1 of 2)
    const navQ6 = getCaseStudyNavigation(examQuestions, 5);
    assert.equal(navQ6.isCaseStudy, true);
    assert.equal(navQ6.caseStudyId, 'cs-geriatric');
    assert.equal(navQ6.totalQuestionsInCase, 2);
    assert.equal(navQ6.questionIndexInCase, 0);
    assert.equal(navQ6.prevCaseQuestionIndex, 1, 'Previous case starts at index 1 (Peds Case Q1)');
  });

  // 10. API responses containing duplicate references
  it('10. API responses containing duplicate references: normalizes raw backend questionContents', () => {
    // Simulating backend Strata payload with duplicate questionContents rows from SQL join
    const rawBackendQuestion = {
      id: 4502,
      guidId: 'guid-q-4502',
      type: 'CaseBasedSingleChoice',
      questionText: 'Which clinical intervention is indicated immediately?',
      metaQuestionText: 'A 56-year-old patient in ICU with acute respiratory distress syndrome...',
      questionContents: [
        {
          id: 901,
          guidId: 'guid-exh-notes',
          title: "Nurses' Notes",
          description: '0600: Patient intubated. PaO2/FiO2 ratio 120.',
          prerequisites: 'CaseBasedData',
        },
        {
          id: 901,
          guidId: 'guid-exh-notes', // Duplicate row returned by backend join
          title: "Nurses' Notes",
          description: '0600: Patient intubated. PaO2/FiO2 ratio 120.',
          prerequisites: 'CaseBasedData',
        },
        {
          id: 902,
          guidId: 'guid-exh-abg',
          title: 'Arterial Blood Gas',
          description: 'pH 7.28, PaCO2 52, PaO2 62, HCO3 24.',
          prerequisites: 'CaseBasedData',
        },
      ],
    };

    const normalizedExhibits = normalizeExhibits(rawBackendQuestion.questionContents);
    assert.equal(normalizedExhibits.length, 2, 'Backend join duplicate must be normalized to 2 distinct exhibits');
    assert.equal(normalizedExhibits[0].id, 'guid-exh-notes');
    assert.equal(normalizedExhibits[0].title, "Nurses' Notes");
    assert.equal(normalizedExhibits[1].id, 'guid-exh-abg');
    assert.equal(normalizedExhibits[1].title, 'Arterial Blood Gas');
  });

  // 11. Component rendering verification: CaseStudyRenderer deduplication & exam-session outer suppression
  it('11. UI rendering verification: CaseStudyRenderer deduplication and suppression of redundant outer exhibit box', () => {
    const caseStudyRendererSrc = readRel('src/components/exam/renderers/CaseStudyRenderer.tsx');
    assert.ok(
      caseStudyRendererSrc.includes('normalizeExhibits('),
      'CaseStudyRenderer must invoke normalizeExhibits to deduplicate exhibit tabs'
    );
    assert.ok(
      caseStudyRendererSrc.includes('suppressCaseContext'),
      'CaseStudyRenderer must support suppressCaseContext for grouped rendering'
    );

    const examSessionSrc = readRel('src/app/exam-session/page.tsx');
    assert.ok(
      examSessionSrc.includes('!isCaseStudyQuestion(q.questionType)'),
      'exam-session must suppress redundant outer EHR Clinical Exhibits box for all Case Study types'
    );
    assert.ok(
      examSessionSrc.includes('normalizeExhibits('),
      'exam-session must normalize exhibits across hydration and rendering'
    );
  });

  // 12. Question type resolution: ClinicalCaseStudy recognized as case-based
  it('12. Question type resolution: ClinicalCaseStudy, UnfoldingCaseStudy, and 9 recognized as case-based', () => {
    for (const type of ['ClinicalCaseStudy', 'UnfoldingCaseStudy', 'CaseStudy', 'CaseBasedSingleChoice', 9]) {
      assert.equal(
        isCaseStudyQuestion(type),
        true,
        `Expected ${type} to be recognized as case study question`
      );
    }

    assert.equal(isCaseStudyQuestion('SingleChoice'), false);
    assert.equal(isCaseStudyQuestion('MultipleResponse'), false);
    assert.equal(isCaseStudyQuestion('Hotspot'), false);
  });
});
