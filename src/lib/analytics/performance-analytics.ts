/**
 * NURVIA-PREP — Authoritative Performance Intelligence & Analytics Engine
 *
 * Computes all learner performance metrics, time-series progression, track comparisons,
 * category mastery breakdowns, and personalized study recommendations strictly from
 * authoritative backend `ExamAttemptSummaryDto[]` records. Never fabricates scores.
 */

import type { ExamAttemptSummaryDto } from '@/lib/api-types';

export interface ScoreProgressionPoint {
  attemptId: string;
  label: string;
  fullDate: string;
  examTitle: string;
  score: number;
  passingScore: number;
  passed: boolean;
  pathway: string;
  category: string;
}

export interface CategoryPerformanceItem {
  category: string;
  attempts: number;
  averageScore: number;
  passRate: number;
}

export interface TrackPerformanceItem {
  track: string;
  attempts: number;
  averageScore: number;
  passRate: number;
}

export interface PerformanceRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'positive' | 'info';
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface PerformanceSummary {
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  scoredAttempts: number;
  averageScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
  passRate: number | null;
  passedCount: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnanswered: number;
  progression: ScoreProgressionPoint[];
  byCategory: CategoryPerformanceItem[];
  byTrack: TrackPerformanceItem[];
  recommendations: PerformanceRecommendation[];
}

export function normalizeTrackLabel(pathway?: string | null, examTitle?: string | null): string {
  const raw = `${pathway ?? ''} ${examTitle ?? ''}`.toLowerCase();
  const isPnLpn =
    raw.includes('pn_lpn') ||
    raw.includes('pn_exit') ||
    raw.includes('lpn') ||
    raw.includes('practical nurse') ||
    /\bpn\b/.test(raw);
  const isRn =
    raw.includes('rn_exit') ||
    raw.includes('registered nurse') ||
    /\brn\b/.test(raw);

  if (isPnLpn && raw.includes('exit')) {
    return 'PN / LPN Exit';
  }
  if (isRn && raw.includes('exit')) {
    return 'RN Exit';
  }
  if (isPnLpn) {
    return 'PN / LPN Track';
  }
  if (raw.includes('nursingmath') || raw.includes('dosage')) {
    return 'Dosage Calculations';
  }
  if (isRn) {
    return 'RN Track';
  }
  const cleanedPathway = pathway
    ? String(pathway)
        .replace(/nclex[-_\s]*/gi, '')
        .replace(/_/g, ' ')
        .trim()
    : '';
  return cleanedPathway || 'General Track';
}

export function formatCategoryLabel(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'General Assessment';
  const cleaned = raw
    .replace(/nclex[-_\s]*/gi, '')
    .trim();
  if (!cleaned) return 'General Assessment';
  if (cleaned === 'NursingMath' || cleaned === 'NURSING MATH') return 'Nursing Math & Dosage';
  if (cleaned === 'RegularCourse') return 'Core Nursing Course';
  if (cleaned === 'ExitPredictor') return 'Exit & Readiness Predictor';
  return cleaned.replace(/_/g, ' ');
}

/**
 * Computes authoritative performance intelligence across recorded learner attempts.
 */
export function computePerformanceSummary(attempts: ExamAttemptSummaryDto[]): PerformanceSummary {
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  const inProgressAttempts = safeAttempts.filter((a) => a.status === 'InProgress').length;
  const completedList = safeAttempts.filter((a) => a.status !== 'InProgress');
  const scoredList = completedList.filter(
    (a) => typeof a.scorePercentage === 'number' && Number.isFinite(a.scorePercentage)
  );

  // Sort chronological ascending for trend chart
  const chronologicalScored = [...scoredList].sort((a, b) => {
    const tA = new Date(a.submittedAtUtc || a.startedAtUtc || 0).getTime();
    const tB = new Date(b.submittedAtUtc || b.startedAtUtc || 0).getTime();
    return tA - tB;
  });

  const averageScore =
    scoredList.length > 0
      ? Math.round(
          (scoredList.reduce((acc, a) => acc + (a.scorePercentage ?? 0), 0) / scoredList.length) * 10
        ) / 10
      : null;

  const bestScore =
    scoredList.length > 0
      ? Math.round(Math.max(...scoredList.map((a) => a.scorePercentage ?? 0)) * 10) / 10
      : null;

  const latestScored = chronologicalScored[chronologicalScored.length - 1];
  const latestScore =
    latestScored && typeof latestScored.scorePercentage === 'number'
      ? Math.round(latestScored.scorePercentage * 10) / 10
      : null;

  let passedCount = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnanswered = 0;

  for (const a of scoredList) {
    const threshold = a.passingScorePercentage ?? 75;
    const isPassed = typeof a.passed === 'boolean' ? a.passed : (a.scorePercentage ?? 0) >= threshold;
    if (isPassed) passedCount++;

    const totalQ = a.totalQuestions || 0;
    if (typeof a.totalCorrect === 'number' && typeof a.totalWrong === 'number') {
      totalCorrect += a.totalCorrect;
      totalWrong += a.totalWrong;
      const answered = a.totalAnswered ?? a.totalCorrect + a.totalWrong;
      totalUnanswered += Math.max(0, totalQ - answered);
    } else if (totalQ > 0 && typeof a.scorePercentage === 'number') {
      const approxCorrect = Math.round((a.scorePercentage / 100) * totalQ);
      const answered = a.totalAnswered ?? totalQ;
      const clampedCorrect = Math.min(approxCorrect, answered);
      totalCorrect += clampedCorrect;
      totalWrong += Math.max(0, answered - clampedCorrect);
      totalUnanswered += Math.max(0, totalQ - answered);
    }
  }

  const passRate =
    scoredList.length > 0 ? Math.round((passedCount / scoredList.length) * 100) : null;

  const progression: ScoreProgressionPoint[] = chronologicalScored.map((a, idx) => {
    const dt = new Date(a.submittedAtUtc || a.startedAtUtc);
    const shortDate = Number.isNaN(dt.getTime())
      ? `#${idx + 1}`
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = Number.isNaN(dt.getTime()) ? 'Recorded date unavailable' : dt.toLocaleString();
    const score = Math.round((a.scorePercentage ?? 0) * 10) / 10;
    const threshold = a.passingScorePercentage ?? 75;
    return {
      attemptId: a.attemptId,
      label: shortDate,
      fullDate,
      examTitle: a.examTitle,
      score,
      passingScore: threshold,
      passed: typeof a.passed === 'boolean' ? a.passed : score >= threshold,
      pathway: normalizeTrackLabel(a.pathway, a.examTitle),
      category: formatCategoryLabel(a.subjectName || a.examCategory),
    };
  });

  // Group by category
  const catMap = new Map<string, ExamAttemptSummaryDto[]>();
  for (const a of scoredList) {
    const key = formatCategoryLabel(a.subjectName || a.topicName || a.examCategory);
    const arr = catMap.get(key) ?? [];
    arr.push(a);
    catMap.set(key, arr);
  }
  const byCategory: CategoryPerformanceItem[] = Array.from(catMap.entries())
    .map(([category, items]) => {
      const avg = items.reduce((s, x) => s + (x.scorePercentage ?? 0), 0) / items.length;
      const passed = items.filter(
        (x) => typeof x.passed === 'boolean' ? x.passed : (x.scorePercentage ?? 0) >= (x.passingScorePercentage ?? 75)
      ).length;
      return {
        category,
        attempts: items.length,
        averageScore: Math.round(avg * 10) / 10,
        passRate: Math.round((passed / items.length) * 100),
      };
    })
    .sort((a, b) => a.averageScore - b.averageScore);

  // Group by pathway track (RN vs PN / LPN)
  const trackMap = new Map<string, ExamAttemptSummaryDto[]>();
  for (const a of scoredList) {
    const track = normalizeTrackLabel(a.pathway, a.examTitle);
    const arr = trackMap.get(track) ?? [];
    arr.push(a);
    trackMap.set(track, arr);
  }
  const byTrack: TrackPerformanceItem[] = Array.from(trackMap.entries())
    .map(([track, items]) => {
      const avg = items.reduce((s, x) => s + (x.scorePercentage ?? 0), 0) / items.length;
      const passed = items.filter(
        (x) => typeof x.passed === 'boolean' ? x.passed : (x.scorePercentage ?? 0) >= (x.passingScorePercentage ?? 75)
      ).length;
      return {
        track,
        attempts: items.length,
        averageScore: Math.round(avg * 10) / 10,
        passRate: Math.round((passed / items.length) * 100),
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  // Personalized deterministic recommendations anchored in real data
  const recommendations: PerformanceRecommendation[] = [];

  if (inProgressAttempts > 0) {
    recommendations.push({
      id: 'resume-in-progress',
      priority: 'info',
      title: `Resume ${inProgressAttempts} Unfinished Attempt${inProgressAttempts > 1 ? 's' : ''}`,
      description:
        'You have active examination attempts waiting to be completed and submitted for official scoring.',
      href: '/learner/history',
      actionLabel: 'Open Attempt History',
    });
  }

  if (scoredList.length === 0) {
    recommendations.push({
      id: 'first-diagnostic',
      priority: 'info',
      title: 'Establish Your Clinical Baseline',
      description:
        'No scored attempts are recorded yet. Complete your first published exam to unlock score trends, domain breakdowns, and personalized study focus areas.',
      href: '/learner/exams',
      actionLabel: 'Browse Published Exams',
    });
  } else {
    const weakCategories = byCategory.filter((c) => c.averageScore < 75);
    if (weakCategories.length > 0) {
      const weakest = weakCategories[0];
      recommendations.push({
        id: 'weakest-category',
        priority: 'high',
        title: `Focus Remediation on ${weakest.category} (${weakest.averageScore}% avg)`,
        description: `Across ${weakest.attempts} recorded attempt${weakest.attempts > 1 ? 's' : ''}, your average score in ${weakest.category} is below the 75% benchmark. Revisit rationales or targeted study guides for this area.`,
        href: '/study-guides',
        actionLabel: 'Open Study Guides',
      });
    }

    if (chronologicalScored.length >= 2) {
      const firstScore = chronologicalScored[0].scorePercentage ?? 0;
      const lastScore = chronologicalScored[chronologicalScored.length - 1].scorePercentage ?? 0;
      const delta = Math.round((lastScore - firstScore) * 10) / 10;
      if (delta >= 5) {
        recommendations.push({
          id: 'upward-trend',
          priority: 'positive',
          title: `Positive Momentum (+${delta} percentage points)`,
          description: `Your recorded exam score improved from ${firstScore}% to ${lastScore}% across your recent attempts.`,
          href: '/learner/history',
          actionLabel: 'Review Recent Attempts',
        });
      } else if (delta <= -5) {
        recommendations.push({
          id: 'downward-trend',
          priority: 'medium',
          title: `Recent Score Dip (${delta} points)`,
          description: `Your most recent score (${lastScore}%) is lower than your earlier baseline (${firstScore}%). Review missed items before attempting high-stakes predictor exams.`,
          href: '/learner/history',
          actionLabel: 'Review Attempt History',
        });
      }
    }

    const strongCategories = byCategory.filter((c) => c.averageScore >= 80);
    if (strongCategories.length > 0) {
      const strongest = strongCategories[strongCategories.length - 1];
      recommendations.push({
        id: 'strongest-category',
        priority: 'positive',
        title: `Strong Mastery in ${strongest.category} (${strongest.averageScore}% avg)`,
        description: `You consistently exceed the passing threshold in ${strongest.category}. Keep daily recall sharp with Question of the Day.`,
        href: '/qotd',
        actionLabel: 'Solve Daily QOTD',
      });
    }
  }

  return {
    totalAttempts: safeAttempts.length,
    completedAttempts: completedList.length,
    inProgressAttempts,
    scoredAttempts: scoredList.length,
    averageScore,
    bestScore,
    latestScore,
    passRate,
    passedCount,
    totalCorrect,
    totalWrong,
    totalUnanswered,
    progression,
    byCategory,
    byTrack,
    recommendations,
  };
}
