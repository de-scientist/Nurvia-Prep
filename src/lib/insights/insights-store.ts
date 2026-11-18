import type {
  CommunityInsightsSummaryDto,
  CommunityExamOutcomeStatsDto,
} from '@/lib/api-types';

export interface ReportedExamResultRecord {
  id: string;
  examType: string;
  outcome: 'Pass' | 'Fail' | 'Waiting';
  examDate?: string;
  questionCount?: number;
  weeksStudied?: number;
  prepResources: string[];
  story?: string;
  createdAtUtc: string;
}

const INITIAL_REPORTED_RESULTS: ReportedExamResultRecord[] = [
  { id: 'res-1', examType: 'NCLEX-RN', outcome: 'Pass', questionCount: 85, weeksStudied: 8, prepResources: ['NURVIA Study Library', 'Mark Klimek Notes'], createdAtUtc: '2026-11-14T10:00:00Z' },
  { id: 'res-2', examType: 'NCLEX-RN', outcome: 'Pass', questionCount: 85, weeksStudied: 6, prepResources: ['NURVIA Study Library', 'Saunders'], createdAtUtc: '2026-11-12T14:30:00Z' },
  { id: 'res-3', examType: 'NCLEX-RN', outcome: 'Pass', questionCount: 150, weeksStudied: 12, prepResources: ['NURVIA Study Library', 'Archer', 'Mark Klimek Notes'], createdAtUtc: '2026-11-10T09:15:00Z' },
  { id: 'res-4', examType: 'NCLEX-RN', outcome: 'Pass', questionCount: 92, weeksStudied: 7, prepResources: ['NURVIA Study Library', 'UWorld'], createdAtUtc: '2026-11-08T16:00:00Z' },
  { id: 'res-5', examType: 'NCLEX-RN', outcome: 'Pass', questionCount: 85, weeksStudied: 8, prepResources: ['NURVIA Study Library', 'Bootcamp'], createdAtUtc: '2026-11-05T11:45:00Z' },
  { id: 'res-6', examType: 'NCLEX-RN', outcome: 'Fail', questionCount: 150, weeksStudied: 4, prepResources: ['Past papers'], createdAtUtc: '2026-11-04T12:00:00Z' },
  { id: 'res-7', examType: 'NCLEX-RN', outcome: 'Waiting', questionCount: 85, weeksStudied: 7, prepResources: ['NURVIA Study Library'], createdAtUtc: '2026-11-17T18:00:00Z' },
  { id: 'res-8', examType: 'NCLEX-PN', outcome: 'Pass', questionCount: 85, weeksStudied: 6, prepResources: ['NURVIA Study Library', 'Mark Klimek Notes'], createdAtUtc: '2026-11-11T13:20:00Z' },
  { id: 'res-9', examType: 'NCK Licensure', outcome: 'Pass', questionCount: 100, weeksStudied: 9, prepResources: ['NURVIA Study Library', 'NMC blueprint'], createdAtUtc: '2026-11-09T08:00:00Z' },
  { id: 'res-10', examType: 'NMC CBT', outcome: 'Pass', questionCount: 120, weeksStudied: 6, prepResources: ['NURVIA Study Library'], createdAtUtc: '2026-11-07T15:10:00Z' },
  { id: 'res-11', examType: 'HESI Exit', outcome: 'Pass', questionCount: 160, weeksStudied: 8, prepResources: ['HESI Specialty', 'NURVIA Study Library'], createdAtUtc: '2026-11-13T10:00:00Z' },
  { id: 'res-12', examType: 'ATI Predictor', outcome: 'Pass', questionCount: 180, weeksStudied: 10, prepResources: ['ATI Comprehensive', 'NURVIA Study Library'], createdAtUtc: '2026-11-15T09:00:00Z' },
];

class InsightsStore {
  private records: ReportedExamResultRecord[] = [...INITIAL_REPORTED_RESULTS];

  getSummary(): CommunityInsightsSummaryDto {
    const totalResults = this.records.length;
    const decided = this.records.filter((r) => r.outcome === 'Pass' || r.outcome === 'Fail');
    const passed = decided.filter((r) => r.outcome === 'Pass').length;
    const passPercentageOverall = decided.length > 0 ? Math.round((passed / decided.length) * 100) : 0;

    const weeksList = this.records.map((r) => r.weeksStudied).filter((w): w is number => typeof w === 'number' && w > 0);
    const averageStudyWeeks = weeksList.length > 0 ? Number((weeksList.reduce((a, b) => a + b, 0) / weeksList.length).toFixed(1)) : 7.3;

    // Outcomes by question count (for NCLEX)
    const brackets = [
      { name: '85 Questions (Minimum)', min: 85, max: 85 },
      { name: '86 – 100 Questions', min: 86, max: 100 },
      { name: '101 – 130 Questions', min: 101, max: 130 },
      { name: '131 – 150 Questions (Maximum)', min: 131, max: 150 },
    ];

    const outcomesByQuestionCount = brackets.map((b) => {
      const inBracket = this.records.filter((r) => {
        if (!r.questionCount) return false;
        return r.questionCount >= b.min && r.questionCount <= b.max;
      });
      return {
        questionBracket: b.name,
        passed: inBracket.filter((r) => r.outcome === 'Pass').length,
        failed: inBracket.filter((r) => r.outcome === 'Fail').length,
      };
    });

    // Popular resources among passers
    const resourceMap = new Map<string, { total: number; passed: number }>();
    for (const r of this.records) {
      for (const res of r.prepResources) {
        const current = resourceMap.get(res) || { total: 0, passed: 0 };
        current.total += 1;
        if (r.outcome === 'Pass') current.passed += 1;
        resourceMap.set(res, current);
      }
    }

    const mostUsedResources = Array.from(resourceMap.entries())
      .map(([resourceName, data]) => ({
        resourceName,
        userCount: data.total,
        passPercentage: Math.round((data.passed / data.total) * 100),
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 8);

    // By Exam breakdown
    const examMap = new Map<string, { passed: number; failed: number; waiting: number }>();
    for (const r of this.records) {
      const stats = examMap.get(r.examType) || { passed: 0, failed: 0, waiting: 0 };
      if (r.outcome === 'Pass') stats.passed += 1;
      else if (r.outcome === 'Fail') stats.failed += 1;
      else if (r.outcome === 'Waiting') stats.waiting += 1;
      examMap.set(r.examType, stats);
    }

    const byExam: CommunityExamOutcomeStatsDto[] = Array.from(examMap.entries()).map(([examName, stats]) => ({
      examName,
      passed: stats.passed,
      failed: stats.failed,
      waiting: stats.waiting,
    }));

    return {
      totalResultsReported: totalResults,
      totalResults,
      averageStudyWeeks,
      passPercentageOverall,
      outcomesByQuestionCount,
      mostUsedResources,
      byExam,
      recentSharedResults: [...this.records].reverse().slice(0, 6),
    };
  }

  shareResult(data: {
    examType: string;
    outcome: 'Pass' | 'Fail' | 'Waiting';
    examDate?: string;
    questionCount?: number;
    weeksStudied?: number;
    prepResources: string[];
    story?: string;
  }): { success: boolean; message: string; recordId: string } {
    const newRecord: ReportedExamResultRecord = {
      id: `res-${Date.now()}`,
      examType: data.examType,
      outcome: data.outcome,
      examDate: data.examDate,
      questionCount: data.questionCount,
      weeksStudied: data.weeksStudied,
      prepResources: data.prepResources || ['NURVIA Study Library'],
      story: data.story,
      createdAtUtc: new Date().toISOString(),
    };

    this.records.unshift(newRecord);
    return {
      success: true,
      message: 'Thank you for sharing your experience! Your contribution encourages fellow nursing candidates.',
      recordId: newRecord.id,
    };
  }
}

export const insightsStore = new InsightsStore();
