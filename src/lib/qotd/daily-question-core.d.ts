import type { QotdQuestionDto } from '@/lib/api-types';

export const QOTD_TIMEZONE: 'UTC';

export function getUtcDateKey(date?: Date): string;
export function getSecondsUntilNextUtcDay(now?: Date): number;
export function fnv1aHash(input: string): number;
export function selectDailyIndex(dateKey: string, poolSize: number): number;
export function computeConsecutiveUtcStreak(dateKeys: string[], referenceDateKey?: string): number;

export function sanitizeDailyQuestionForPreSubmit<
  TRecord extends {
    id: string;
    dateStr: string;
    title: string;
    stem: string;
    category: string;
    examContext: string;
    cognitiveSkill: unknown;
    clientNeedCategory: unknown;
    totalAnswers: number;
    correctAnswers: number;
    generalRationale: string;
    options: Array<{
      id: string;
      letter: string;
      text: string;
      isCorrect: boolean;
      specificRationale: string;
    }>;
  },
>(
  record: TRecord,
  opts?: {
    hasAnswered?: boolean;
    userSelectedOptionId?: string;
    userIsCorrect?: boolean;
    correctOptionId?: string;
    dateKey?: string;
    source?: 'published_bank' | 'backend' | 'unavailable';
    persistenceScope?: 'session_local' | 'backend_persisted';
  }
): QotdQuestionDto;

export class PublishedBankDailyQuestionProvider {
  readonly source: 'published_bank';
  selectQuestion<T extends { id: string; dateStr: string }>(pool: T[], dateKey?: string): T | null;
}

export class BackendDailyQuestionProvider {
  readonly source: 'backend';
  constructor(
    fetcher?: (dateKey: string) => Promise<unknown | null>,
    fallbackProvider?: PublishedBankDailyQuestionProvider
  );
  getDailyQuestion<T extends { id: string; dateStr: string }>(
    pool: T[],
    dateKey?: string
  ): Promise<{ question: T | null; source: 'published_bank' | 'backend' }>;
}
