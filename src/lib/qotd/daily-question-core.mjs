/**
 * NURVIA-PREP — Daily Question of the Day Core (Native ESM)
 *
 * Canonical UTC daily rollover (`YYYY-MM-DD`), deterministic FNV-1a selection,
 * consecutive-day streak computation, and pre-submission answer-key sanitization.
 */

export const QOTD_TIMEZONE = 'UTC';

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getSecondsUntilNextUtcDay(now = new Date()) {
  const nextUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, Math.floor((nextUtc - now.getTime()) / 1000));
}

export function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function selectDailyIndex(dateKey, poolSize) {
  if (!Number.isInteger(poolSize) || poolSize <= 0) return -1;
  return fnv1aHash(dateKey) % poolSize;
}

function parseUtcDayMs(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return NaN;
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

/**
 * Computes consecutive calendar UTC day streak from a list of `YYYY-MM-DD` dates.
 * Any skipped UTC day breaks the consecutive chain cleanly.
 */
export function computeConsecutiveUtcStreak(dateKeys, referenceDateKey = getUtcDateKey()) {
  const uniqueDates = Array.from(
    new Set(
      (dateKeys || [])
        .map((d) => String(d || '').slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (uniqueDates.length === 0) return 0;

  const refMs = parseUtcDayMs(referenceDateKey);
  const newestMs = parseUtcDayMs(uniqueDates[0]);
  if (!Number.isFinite(refMs) || !Number.isFinite(newestMs)) return 0;

  const ONE_DAY_MS = 86_400_000;
  // If newest recorded attempt is older than yesterday UTC, current active streak is broken (0)
  const diffFromRefDays = Math.round((refMs - newestMs) / ONE_DAY_MS);
  if (diffFromRefDays > 1 || diffFromRefDays < 0) {
    return 0;
  }

  let streak = 1;
  let expectedPrevMs = newestMs - ONE_DAY_MS;
  for (let i = 1; i < uniqueDates.length; i++) {
    const curMs = parseUtcDayMs(uniqueDates[i]);
    if (curMs === expectedPrevMs) {
      streak++;
      expectedPrevMs -= ONE_DAY_MS;
    } else if (curMs < expectedPrevMs) {
      break;
    }
  }
  return streak;
}

/**
 * Strips rationales and answer-correctness indicators whenever the learner has not yet answered.
 */
export function sanitizeDailyQuestionForPreSubmit(record, opts = {}) {
  const hasAnswered = Boolean(opts.hasAnswered);
  const dateKey = opts.dateKey || record.dateStr;
  return {
    id: record.id,
    dateStr: dateKey,
    title: record.title,
    stem: record.stem,
    category: record.category,
    examContext: record.examContext,
    cognitiveSkill: record.cognitiveSkill,
    clientNeedCategory: record.clientNeedCategory,
    totalAnswers: record.totalAnswers,
    correctPercentage: Math.round((record.correctAnswers / Math.max(1, record.totalAnswers)) * 100),
    userAnswered: hasAnswered,
    userSelectedOptionId: hasAnswered ? opts.userSelectedOptionId : undefined,
    userIsCorrect: hasAnswered ? opts.userIsCorrect : undefined,
    explanation: hasAnswered ? record.generalRationale : undefined,
    correctOptionId: hasAnswered ? opts.correctOptionId : undefined,
    source: opts.source || 'published_bank',
    persistenceScope: opts.persistenceScope || 'session_local',
    timezone: QOTD_TIMEZONE,
    options: (record.options || []).map((o) => ({
      id: o.id,
      letter: o.letter,
      text: o.text,
      ...(hasAnswered
        ? { isCorrect: Boolean(o.isCorrect), rationale: o.specificRationale }
        : {}),
    })),
  };
}

export class PublishedBankDailyQuestionProvider {
  constructor() {
    this.source = 'published_bank';
  }

  selectQuestion(pool, dateKey = getUtcDateKey()) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const exact = pool.find((q) => q.dateStr === dateKey);
    if (exact) return exact;
    const idx = selectDailyIndex(dateKey, pool.length);
    return pool[idx] ?? pool[0];
  }
}

export class BackendDailyQuestionProvider {
  constructor(fetcher, fallbackProvider = new PublishedBankDailyQuestionProvider()) {
    this.source = 'backend-qotd';
    this.fetcher = fetcher;
    this.fallbackProvider = fallbackProvider;
  }

  async getDailyQuestion(pool, dateKey = getUtcDateKey()) {
    if (typeof this.fetcher === 'function') {
      try {
        const res = await this.fetcher(dateKey);
        if (res) {
          return { question: res, source: 'backend' };
        }
      } catch {
        // Explicit fallback when backend QOTD endpoint is not provisioned
      }
    }
    return {
      question: this.fallbackProvider.selectQuestion(pool, dateKey),
      source: this.fallbackProvider.source,
    };
  }
}
