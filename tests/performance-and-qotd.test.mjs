import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePerformanceSummary } from '../src/lib/analytics/performance-analytics.ts';
import {
  QOTD_TIMEZONE,
  getUtcDateKey,
  selectDailyIndex,
  computeConsecutiveUtcStreak,
  sanitizeDailyQuestionForPreSubmit,
} from '../src/lib/qotd/daily-question-core.mjs';
import { qotdStore } from '../src/lib/qotd/qotd-store.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Performance Intelligence & Question of the Day (QOTD)', () => {
  it('returns truthful empty metrics (null averageScore) when zero graded attempts exist', () => {
    const emptySummary = computePerformanceSummary([]);
    assert.equal(emptySummary.averageScore, null);
    assert.equal(emptySummary.bestScore, null);
    assert.equal(emptySummary.passRate, null);
    assert.equal(emptySummary.scoredAttempts, 0);
    assert.ok(emptySummary.recommendations.length >= 1);
  });

  it('computes authoritative average score, RN vs PN track comparison, and chronological progression', () => {
    const attempts = [
      {
        attemptId: 'att-active',
        examId: 'e0',
        examTitle: 'Unfinished Quiz',
        pathway: 'RN',
        status: 'InProgress',
        startedAtUtc: '2026-11-18T10:00:00.000Z',
        totalQuestions: 50,
      },
      {
        attemptId: 'att-2',
        examId: 'e2',
        examTitle: 'PN Pharmacology',
        pathway: 'PN_LPN',
        examCategory: 'SPECIALTIES',
        subjectName: 'Pharmacology',
        status: 'Graded',
        startedAtUtc: '2026-11-17T08:00:00.000Z',
        submittedAtUtc: '2026-11-17T09:00:00.000Z',
        scorePercentage: 85,
        totalQuestions: 20,
        totalCorrect: 17,
        totalWrong: 3,
      },
      {
        attemptId: 'att-1',
        examId: 'e1',
        examTitle: 'RN Med-Surg',
        pathway: 'RN',
        examCategory: 'FUNDAMENTALS',
        subjectName: 'Med-Surg',
        status: 'Submitted',
        startedAtUtc: '2026-11-15T08:00:00.000Z',
        submittedAtUtc: '2026-11-15T09:00:00.000Z',
        scorePercentage: 65,
        totalQuestions: 20,
        totalCorrect: 13,
        totalWrong: 7,
      },
    ];

    const summary = computePerformanceSummary(attempts);
    assert.equal(summary.averageScore, 75);
    assert.equal(summary.bestScore, 85);
    assert.equal(summary.latestScore, 85);
    assert.equal(summary.passRate, 50);
    assert.equal(summary.inProgressAttempts, 1);
    assert.equal(summary.totalCorrect, 30);
    assert.equal(summary.totalWrong, 10);
    assert.equal(summary.progression[0].attemptId, 'att-1');
    assert.equal(summary.progression[1].attemptId, 'att-2');
    assert.ok(summary.byTrack.some((t) => t.track === 'RN Track'));
    assert.ok(summary.byTrack.some((t) => t.track === 'PN / LPN Track'));
    assert.equal(summary.byCategory[0].category, 'Med-Surg');
  });

  it('selects daily QOTD deterministically by UTC day, prevents pre-submit leaks, and computes consecutive streak', () => {
    assert.equal(QOTD_TIMEZONE, 'UTC');
    const dayKey = getUtcDateKey(new Date('2026-11-19T12:00:00.000Z'));
    assert.equal(dayKey, '2026-11-19');
    assert.equal(selectDailyIndex('2026-11-19', 10), selectDailyIndex('2026-11-19', 10));

    // Consecutive chain: 19, 18, 17 => 3; skipped 16 => 15 doesn't count!
    const streak = computeConsecutiveUtcStreak(
      ['2026-11-19', '2026-11-18', '2026-11-17', '2026-11-15'],
      '2026-11-19'
    );
    assert.equal(streak, 3);

    // Broken streak if last answer was > 1 day ago
    assert.equal(computeConsecutiveUtcStreak(['2026-11-16'], '2026-11-19'), 0);

    const mockRecord = {
      id: 'qotd-x',
      dateStr: '2026-11-19',
      title: 'Test',
      stem: 'Stem?',
      category: 'Cat',
      examContext: 'NCLEX',
      cognitiveSkill: 'TakeActions',
      clientNeedCategory: 'PhysiologicalIntegrity',
      totalAnswers: 10,
      correctAnswers: 7,
      generalRationale: 'SECRET RATIONALE',
      options: [
        { id: 'a', letter: 'A', text: 'Opt A', isCorrect: true, specificRationale: 'SECRET OPT' },
      ],
    };

    const preSubmit = sanitizeDailyQuestionForPreSubmit(mockRecord, { hasAnswered: false });
    assert.equal(preSubmit.explanation, undefined);
    assert.equal(preSubmit.options[0].isCorrect, undefined);
    assert.equal(preSubmit.options[0].rationale, undefined);

    const postSubmit = sanitizeDailyQuestionForPreSubmit(mockRecord, {
      hasAnswered: true,
      userSelectedOptionId: 'a',
      userIsCorrect: true,
      correctOptionId: 'a',
    });
    assert.equal(postSubmit.explanation, 'SECRET RATIONALE');
    assert.equal(postSubmit.options[0].isCorrect, true);

    // Store dedup & post-submit reveal check
    const uid = `qotd-test-user-${Date.now()}`;
    const q = qotdStore.getTodayQuestion(uid);
    assert.equal(q.explanation, undefined);
    const sub1 = qotdStore.submitAnswer(uid, q.id, q.options[0].id);
    const sub2 = qotdStore.submitAnswer(uid, q.id, q.options[0].id);
    assert.equal(sub1.totalAnswered, 1);
    assert.equal(sub2.totalAnswered, 1, 'Duplicate submission on same UTC day must not double-count');
    assert.equal(sub1.userStreak, 1);

    // Ensure nclex/study removes fake hardcoded streak = 5
    const nclexStudySrc = readRel('src/app/nclex/study/page.tsx');
    assert.ok(!nclexStudySrc.includes('useState(5)'), 'Must not hardcode fake streak=5');
    assert.ok(!nclexStudySrc.includes('1,840 practice questions'), 'Must not display fabricated KPI counts');
  });
});
