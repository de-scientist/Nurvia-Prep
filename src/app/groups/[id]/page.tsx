"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { StudyGroupDto } from "@/lib/api-types";
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Target,
} from "lucide-react";

export default function StudyGroupDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [group, setGroup] = React.useState<StudyGroupDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const fetchGroup = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await nurviaApi.getStudyGroup(id);
    if (res.success && res.data) {
      setGroup(res.data);
    }
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    void fetchGroup();
  }, [fetchGroup]);

  const handleJoin = async () => {
    if (!id) return;
    const res = await nurviaApi.joinStudyGroup(id);
    setToastMessage(res.message);
    void fetchGroup();
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLeave = async () => {
    if (!id) return;
    const res = await nurviaApi.leaveStudyGroup(id);
    setToastMessage(res.message);
    void fetchGroup();
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-brand-teal px-4 py-3 text-xs font-semibold text-white shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-secondary hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Study Groups
          </Link>

          {loading ? (
            <div className="py-20 text-center text-sm text-foreground-secondary" aria-live="polite">
              Loading study group details…
            </div>
          ) : !group ? (
            <Card className="p-8 text-center text-sm text-foreground-secondary">
              Study group not found.
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="p-6 sm:p-8 space-y-6 border border-border bg-surface shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1">
                    <Badge variant="teal">{group.examTrack}</Badge>
                    <h1 className="font-brand text-2xl sm:text-3xl font-bold text-foreground">
                      {group.title}
                    </h1>
                    <p className="text-xs text-foreground-muted">
                      Organized by {group.creatorName} · Created {new Date(group.createdAtUtc).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {group.isMember ? (
                      <Button
                        variant="outline"
                        onClick={handleLeave}
                        className="text-xs text-rose-500 hover:text-rose-600"
                      >
                        Leave Group
                      </Button>
                    ) : (
                      <Button
                        disabled={group.currentMembers >= group.maxMembers}
                        onClick={handleJoin}
                        className="text-xs bg-brand-teal text-white hover:bg-brand-teal-dark"
                      >
                        {group.currentMembers >= group.maxMembers ? "Group Full" : "Join Study Group"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 text-xs">
                  <div className="p-4 rounded-xl border border-border bg-background space-y-1">
                    <span className="text-foreground-muted flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-brand-teal" /> Members
                    </span>
                    <p className="text-base font-bold text-foreground">
                      {group.currentMembers} / {group.maxMembers}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-background space-y-1">
                    <span className="text-foreground-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-brand-teal" /> Meeting Schedule
                    </span>
                    <p className="font-semibold text-foreground">{group.meetingCadence}</p>
                    <p className="text-[10px] text-foreground-muted">{group.timezone}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-background space-y-1">
                    <span className="text-foreground-muted flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-brand-teal" /> Target Exam
                    </span>
                    <p className="font-semibold text-foreground">{group.targetExamDate || "Flexible"}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h2 className="font-brand text-base font-bold text-foreground">
                    About This Study Group
                  </h2>
                  <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed whitespace-pre-line">
                    {group.description}
                  </p>
                </div>

                {group.objectives && group.objectives.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <h2 className="font-brand text-base font-bold text-foreground flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-brand-teal" /> Group Objectives
                    </h2>
                    <ul className="space-y-2 text-xs sm:text-sm text-foreground-secondary">
                      {group.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
