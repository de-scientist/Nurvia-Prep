/**
 * NURVIA-PREP — Daily Question Service & Provider Abstraction
 *
 * Typed facade over `daily-question-core.mjs` for TypeScript/Next.js and Node tests.
 */

import {
  QOTD_TIMEZONE,
  getUtcDateKey,
  getSecondsUntilNextUtcDay,
  fnv1aHash,
  selectDailyIndex,
  computeConsecutiveUtcStreak,
  sanitizeDailyQuestionForPreSubmit,
  PublishedBankDailyQuestionProvider,
  BackendDailyQuestionProvider,
} from './daily-question-core.mjs';

export interface DailyQuestionProvider {
  readonly source: 'published_bank' | 'backend';
  selectQuestion<T extends { id: string; dateStr: string }>(pool: T[], dateKey?: string): T | null;
}

export {
  QOTD_TIMEZONE,
  getUtcDateKey,
  getSecondsUntilNextUtcDay,
  fnv1aHash,
  selectDailyIndex,
  computeConsecutiveUtcStreak,
  sanitizeDailyQuestionForPreSubmit,
  PublishedBankDailyQuestionProvider,
  BackendDailyQuestionProvider,
};
