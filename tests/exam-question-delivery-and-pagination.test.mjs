import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApiUrl } from '../src/lib/api-url.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Nurvia Exam Question Delivery, Pagination & Backend Contracts', () => {
  it('routes all BFF exam, qotd, and study-library routes to same-origin Next.js handlers', () => {
    for (const p of [
      '/api/attempts/start/exam-123',
      '/api/attempts/history',
      '/api/exams/exam-123/review-content',
      '/api/qotd/today',
      '/api/study-library/exam-123',
    ]) {
      const resolved = buildApiUrl(p);
      assert.equal(resolved, p, `Expected local BFF pass-through for ${p}, got ${resolved}`);
      assert.ok(!resolved.includes('/api/backend/'), `Must not rewrite ${p} to /api/backend/`);
    }
  });

  it('configures Castoline dynamic pagination and current/live endpoints in contracts and strata proxy', () => {
    const contractsSrc = readRel('src/lib/lexmacasto/contracts.ts');
    assert.ok(contractsSrc.includes('/api/castoline/strata/assessment/exams/list/current'));
    assert.ok(contractsSrc.includes('/api/castoline/strata/assessment/exams/list/live'));
    assert.ok(contractsSrc.includes('/api/castoline/strata/assessment/exams/results/list/distinct'));
    assert.ok(contractsSrc.includes('dynamicPage'));
    assert.ok(contractsSrc.includes('dynamicPerPage'));
    assert.ok(contractsSrc.includes('dynamicSearch'));

    const strataProxySrc = readRel('src/app/api/strata/[resource]/route.ts');
    for (const param of [
      'dynamicPage',
      'dynamicPerPage',
      'dynamicSearch',
      'identifier',
      'dynamicExamLayout',
      'dynamicExamMode',
      'dynamicAttemptNumber',
    ]) {
      assert.ok(strataProxySrc.includes(param), `Strata proxy allowlist must include ${param}`);
    }
  });

  it('implements multi-page live exam pagination, deduplication, and non-fabricated integrity checks', () => {
    const loaderSrc = readRel('src/lib/attempts/live-exam-loader.ts');
    assert.ok(loaderSrc.includes("buildStrataEndpointPath('examsLive'"), 'Must fetch from exams/list/live');
    assert.ok(loaderSrc.includes('seenQuestionIds.has(dedupeKey)'), 'Must deduplicate question IDs across pages');
    assert.ok(
      loaderSrc.includes('collectedQuestions.length >= configuredCount') &&
        loaderSrc.includes('collectedQuestions.length < configuredQuestionCount'),
      'Must continue pagination until full configured count'
    );
    assert.ok(loaderSrc.includes('contentIntegrityError'), 'Must surface content integrity warnings when backend omits options');
    assert.ok(loaderSrc.includes('strata~'), 'Must produce durable strata~<examGuid>~<attemptNumber> identifiers');
    assert.ok(!loaderSrc.includes('Auscultate the apical pulse'), 'Must never inject hardcoded clinical fallback questions');
  });

  it('enforces real single-exam lookup without fake question counts or hardcoded review counts', () => {
    const detailRouteSrc = readRel('src/app/api/study-library/[id]/route.ts');
    assert.ok(
      detailRouteSrc.includes('buildStrataEndpointPath(') && detailRouteSrc.includes("'examCurrent'"),
      'Must use exams/list/current for single exam lookup'
    );
    assert.ok(!detailRouteSrc.includes('reviewCount: 12'), 'Must not fabricate reviewCount: 12');
    assert.ok(!detailRouteSrc.includes('|| 50'), 'Must not fabricate || 50 totalQuestions');
    assert.ok(!detailRouteSrc.includes('canReview: true'), 'Must not hardcode canReview: true');
  });

  it('removes global questions/list/absolute fallbacks from client startAttempt and getExamReviewContent', () => {
    const apiClientSrc = readRel('src/lib/api-client.ts');
    const startIdx = apiClientSrc.indexOf('async startAttempt(');
    const historyIdx = apiClientSrc.indexOf('async getAttemptHistory(');
    assert.ok(startIdx !== -1 && historyIdx !== -1 && historyIdx > startIdx);
    const slice = apiClientSrc.slice(startIdx, historyIdx);
    assert.ok(!slice.includes("this.getStrata<Record<string, any>>('questions'"), 'Must not fall back to un-scoped questions/list/absolute');
    assert.ok(slice.includes('/api/exams/${encodeURIComponent(examId)}/review-content'));
    assert.ok(slice.includes('REVIEW_NOT_PERMITTED'));
  });
});
