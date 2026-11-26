"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { StudyGroupDto } from "@/lib/api-types";
import {
  Users,
  Plus,
  Calendar,
  Clock,
  Globe2,
  CheckCircle2,
  X,
} from "lucide-react";

const EXAM_PILLS = [
  "All",
  "RN Licensure",
  "LPN Licensure",
  "HESI Exit",
  "ATI Predictor",
  "TEAS",
  "HESI A2",
  "Kaplan Entrance",
  "NCK Licensure",
  "NMC CBT",
  "NMC OSCE",
];

export default function StudyGroupsPage() {
  const [groups, setGroups] = React.useState<StudyGroupDto[]>([]);
  const [selectedTrack, setSelectedTrack] = React.useState("All");
  const [search] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Form fields
  const [newTitle, setNewTitle] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newTrack, setNewTrack] = React.useState("RN Licensure");
  const [newCadence, setNewCadence] = React.useState("Tue & Thu 8:00 PM EST");
  const [newTimezone, setNewTimezone] = React.useState("America/New_York");
  const [newMaxMembers] = React.useState(8);
  const [creating, setCreating] = React.useState(false);

  const fetchGroups = React.useCallback(async () => {
    setLoading(true);
    const res = await nurviaApi.getStudyGroups({
      examTrack: selectedTrack === "All" ? undefined : selectedTrack,
      search: search.trim() || undefined,
    });
    if (res.success && res.data) {
      setGroups(res.data);
    }
    setLoading(false);
  }, [selectedTrack, search]);

  React.useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const handleJoin = async (id: string) => {
    const res = await nurviaApi.joinStudyGroup(id);
    if (res.success) {
      setToastMessage(res.message);
      void fetchGroups();
    } else {
      setToastMessage(res.message);
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLeave = async (id: string) => {
    const res = await nurviaApi.leaveStudyGroup(id);
    if (res.success) {
      setToastMessage(res.message);
      void fetchGroups();
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await nurviaApi.createStudyGroup({
      title: newTitle,
      description: newDesc,
      examTrack: newTrack,
      meetingCadence: newCadence,
      timezone: newTimezone,
      maxMembers: Number(newMaxMembers),
    });
    if (res.success) {
      setToastMessage("Study group created successfully!");
      setCreateModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      void fetchGroups();
    } else {
      setToastMessage(res.message);
    }
    setCreating(false);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-brand-teal px-4 py-3 text-xs font-semibold text-white shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* Header Hero */}
        <section className="border-b border-border bg-gradient-to-b from-surface/80 via-background to-background py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  <span>Peer Study Accountability</span>
                </div>
                <h1 className="font-brand text-2xl sm:text-3xl font-extrabold text-foreground">
                  Nursing Study Groups
                </h1>
                <p className="text-xs sm:text-sm text-foreground-secondary max-w-2xl">
                  Accountability makes tough semesters and predictor prep easier. Join an active study pod aligned with your exam window or launch your own.
                </p>
              </div>

              <Button
                onClick={() => setCreateModalOpen(true)}
                className="gap-1.5 text-xs bg-brand-teal text-white hover:bg-brand-teal-dark w-fit"
              >
                <Plus className="w-3.5 h-3.5" /> Start a Group
              </Button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-4">
              {EXAM_PILLS.map((pill) => (
                <Button
                  key={pill}
                  size="sm"
                  variant={selectedTrack === pill ? "primary" : "outline"}
                  onClick={() => setSelectedTrack(pill)}
                  className="text-xs h-7 px-3 rounded-full"
                >
                  {pill}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Groups Grid */}
        <section className="py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="py-16 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading study groups…
              </div>
            ) : groups.length === 0 ? (
              <Card className="p-12 text-center space-y-3">
                <p className="font-semibold text-foreground">No study groups found for {selectedTrack}.</p>
                <p className="text-xs text-foreground-secondary">
                  Be the first to start a group for this pathway!
                </p>
                <Button
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-2 text-xs"
                >
                  Start a Study Group
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    className="p-5 border border-border bg-surface flex flex-col justify-between gap-4 shadow-xs hover:border-brand-teal/40 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="teal">{group.examTrack}</Badge>
                        <span className="text-[11px] font-semibold text-foreground-muted">
                          {group.currentMembers} / {group.maxMembers} members
                        </span>
                      </div>

                      <Link href={`/groups/${group.id}`}>
                        <h3 className="font-brand font-bold text-base text-foreground hover:text-brand-teal transition-colors">
                          {group.title}
                        </h3>
                      </Link>

                      <p className="text-xs text-foreground-secondary line-clamp-2 leading-relaxed">
                        {group.description}
                      </p>

                      <div className="space-y-1.5 pt-2 text-[11px] text-foreground-muted">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-brand-teal" />
                          <span>Exam: {group.targetExamDate || "Flexible"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-brand-teal" />
                          <span>{group.meetingCadence}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe2 className="w-3 h-3 text-brand-teal" />
                          <span>{group.timezone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[11px] text-foreground-muted">
                        Led by {group.creatorName}
                      </span>
                      {group.isMember ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLeave(group.id)}
                          className="text-xs h-7 text-rose-500 hover:text-rose-600"
                        >
                          Leave Group
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={group.currentMembers >= group.maxMembers}
                          onClick={() => handleJoin(group.id)}
                          className="text-xs h-7 bg-brand-teal text-white hover:bg-brand-teal-dark"
                        >
                          {group.currentMembers >= group.maxMembers ? "Full" : "Join Group"}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Create Modal Dialog */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-brand font-bold text-lg text-foreground">
                  Start a New Study Group
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="text-foreground-muted hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Group Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RN Licensure January High-Yield Study Pod"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Exam Pathway</label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  >
                    {EXAM_PILLS.filter((p) => p !== "All").map((pill) => (
                      <option key={pill} value={pill}>
                        {pill}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Meeting Cadence</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tue & Thu 8:00 PM EST"
                    value={newCadence}
                    onChange={(e) => setNewCadence(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Timezone</label>
                  <input
                    type="text"
                    required
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Description &amp; Goals</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="What will this group focus on? (e.g. Daily questions, weekly Zoom reviews)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreateModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="text-xs bg-brand-teal text-white hover:bg-brand-teal-dark"
                  >
                    {creating ? "Creating…" : "Publish Group"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
