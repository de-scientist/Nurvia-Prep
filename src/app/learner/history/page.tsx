"use client";

import * as React from "react";
import Link from "next/link";
import { LearnerShell } from "@/components/layout/learner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Play, FileBarChart, Lock, Sparkles } from "lucide-react";
import { nurviaApi } from "@/lib/api-client";
import { ExamAttemptSummaryDto } from "@/lib/api-types";

interface DisplayAttempt {
  id: string;
  examId: string;
  title: string;
  pathway?: string;
  date: string;
  score: string;
  mode: string;
  duration: string;
  status: string;
  passed?: boolean | null;
  canReview: boolean;
}

export default function AttemptHistoryPage() {
  const [attempts, setAttempts] = React.useState<DisplayAttempt[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [loadFailed, setLoadFailed] = React.useState<boolean>(false);

  React.useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const res = await nurviaApi.getAttemptHistory();
        if (res.success && res.data) {
          setAttempts(
            res.data.map((a: ExamAttemptSummaryDto) => {
              const dateStr = a.submittedAtUtc || a.startedAtUtc;
              const formattedDate = dateStr
                ? new Date(dateStr).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Recent";

              return {
                id: a.attemptId,
                examId: a.examId,
                title: a.examTitle,
                pathway: a.pathway ? String(a.pathway).replace(/_/g, " ") : undefined,
                date: formattedDate,
                score:
                  a.scorePercentage !== undefined && a.scorePercentage !== null
                    ? `${a.scorePercentage.toFixed(1)}%`
                    : a.status === "InProgress"
                      ? "In Progress"
                      : "Pending",
                mode: a.status === "InProgress" ? "Active Attempt" : "Official Exam",
                duration:
                  a.status === "InProgress"
                    ? "In Progress"
                    : a.submittedAtUtc
                      ? `${a.totalQuestions} Questions`
                      : "Ended",
                status: a.status,
                passed: a.passed,
                canReview: a.canReview ?? a.allowReview !== false,
              };
            })
          );
        } else {
          setLoadFailed(true);
        }
      } catch (err) {
        console.error("Failed to load attempt history", err);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <LearnerShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="teal">Record of Attempts</Badge>
            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-foreground">
              Attempt History
            </h1>
            <p className="text-xs sm:text-sm text-foreground-secondary">
              Authoritative examination records, recorded scores, and review access governed by exam configuration.
            </p>
          </div>
          <Link href="/learner/performance">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <FileBarChart className="w-3.5 h-3.5 text-brand-teal" />
              View Performance Analytics
            </Button>
          </Link>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-foreground-secondary font-semibold">
                <tr>
                  <th className="p-4">Exam / Practice Set</th>
                  <th className="p-4">Date Recorded</th>
                  <th className="p-4">Status / Mode</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Scope</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-foreground-muted">
                      Loading attempt records from QuizNurse server...
                    </td>
                  </tr>
                ) : attempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-foreground-muted">
                      {loadFailed
                        ? "Attempt history could not be loaded. Please try again later."
                        : "No examination attempts recorded yet."}
                    </td>
                  </tr>
                ) : (
                  attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-foreground">{a.title}</p>
                        {a.pathway && (
                          <span className="text-[11px] text-foreground-muted">{a.pathway}</span>
                        )}
                      </td>
                      <td className="p-4 text-foreground-muted">{a.date}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-[10px]">
                          {a.mode}
                        </Badge>
                      </td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        {a.score}
                      </td>
                      <td className="p-4 text-foreground-muted">{a.duration}</td>
                      <td className="p-4 text-right">
                        {a.status !== "InProgress" ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link href={`/learner/attempts/${encodeURIComponent(a.id)}`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                Summary
                              </Button>
                            </Link>
                            {a.canReview ? (
                              <>
                                <Link href={`/exam-session?attemptId=${encodeURIComponent(a.id)}&mode=Review`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 hover:text-brand-teal"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Review</span>
                                  </Button>
                                </Link>
                                <Link href={`/exam-session?attemptId=${encodeURIComponent(a.id)}&mode=Tutor`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-brand-teal hover:bg-brand-teal/10"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Tutor</span>
                                  </Button>
                                </Link>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled
                                title="Review is disabled by this exam's backend configuration (allowReview is false)."
                                className="h-7 text-xs gap-1 text-foreground-muted cursor-not-allowed"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Review Locked</span>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Link href={`/exam-session?attemptId=${encodeURIComponent(a.id)}&mode=Exam`}>
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-7 text-xs gap-1 bg-brand-teal text-white hover:bg-brand-tealDark"
                            >
                              <Play className="w-3 h-3" />
                              <span>Resume</span>
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </LearnerShell>
  );
}
