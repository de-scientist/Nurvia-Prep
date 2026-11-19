"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { CommunityCategoryGroupDto, CommunityPostType } from "@/lib/api-types";
import {
  MessageSquare,
  HelpCircle,
  Trophy,
  Users,
  BarChart2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowLeft,
} from "lucide-react";

const POST_TYPES: { type: CommunityPostType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    type: "Discussion",
    label: "Discussion",
    icon: <MessageSquare className="h-4 w-4" />,
    desc: "Start an open dialogue on nursing school, clinicals, or careers",
  },
  {
    type: "Question",
    label: "Clinical Question",
    icon: <HelpCircle className="h-4 w-4" />,
    desc: "Ask for peer explanations, mnemonic help, or clinical rationales",
  },
  {
    type: "ExamResult",
    label: "Exam Result",
    icon: <Trophy className="h-4 w-4" />,
    desc: "Share your NCLEX, HESI, or ATI outcome, question count, and tips",
  },
  {
    type: "StudyGroup",
    label: "Study Group",
    icon: <Users className="h-4 w-4" />,
    desc: "Propose or recruit peers for structured exam prep sessions",
  },
  {
    type: "Poll",
    label: "Poll",
    icon: <BarChart2 className="h-4 w-4" />,
    desc: "Ask the community to vote on clinical priorities or prep tactics",
  },
];

export default function NewPostPage() {
  const router = useRouter();

  const [categories, setCategories] = React.useState<CommunityCategoryGroupDto[]>([]);
  const [selectedType, setSelectedType] = React.useState<CommunityPostType>("Discussion");
  const [selectedChannel, setSelectedChannel] = React.useState<string>("nclex-study-plans");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Exam Result specific fields
  const [examType, setExamType] = React.useState("NCLEX-RN");
  const [outcome, setOutcome] = React.useState<"Pass" | "Fail" | "Waiting">("Pass");
  const [questionCount, setQuestionCount] = React.useState(85);
  const [weeksStudied, setWeeksStudied] = React.useState(8);
  const [prepResources] = React.useState<string[]>(["NURVIA Study Library"]);

  // Poll specific fields
  const [pollQuestion] = React.useState("");
  const [pollOptions, setPollOptions] = React.useState<string[]>(["Option 1", "Option 2"]);

  // Fetch categories on mount
  React.useEffect(() => {
    async function loadCats() {
      const res = await nurviaApi.getCommunityCategoryGroups();
      if (res.success && res.data) {
        setCategories(res.data);
        if (res.data[0]?.categories[0]?.slug) {
          setSelectedChannel(res.data[0].categories[0].slug);
        }
      }
    }
    void loadCats();
  }, []);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (!tags.includes(clean) && tags.length < 5) {
        setTags([...tags, clean]);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`]);
    }
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg("Please provide both a title and details for your post.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload = {
      channelId: selectedChannel,
      title: title.trim(),
      content: content.trim(),
      postType: selectedType,
      tags: tags.length > 0 ? tags : undefined,
      examResultMeta:
        selectedType === "ExamResult"
          ? {
              examType,
              outcome,
              questionCount,
              weeksStudied,
              prepResourcesUsed: prepResources,
            }
          : undefined,
      pollMeta:
        selectedType === "Poll"
          ? {
              question: pollQuestion.trim() || title.trim(),
              options: pollOptions.filter((o) => o.trim().length > 0),
            }
          : undefined,
    };

    const res = await nurviaApi.createCommunityPost(payload);
    setLoading(false);

    if (res.success) {
      router.push("/forum");
    } else {
      setErrorMsg(res.message || "Failed to submit post. Please try again.");
    }
  };

  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          {/* Back link */}
          <div className="mb-4">
            <Link
              href="/forum"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Community Forum
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Create a New Community Post
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Engage with over 25,000 nursing students, educators, and practicing nurses across the Nurvia ecosystem.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Form Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Post Type Selector Tabs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {POST_TYPES.map((pt) => {
                    const active = selectedType === pt.type;
                    return (
                      <button
                        key={pt.type}
                        type="button"
                        onClick={() => setSelectedType(pt.type)}
                        className={`flex flex-col items-center justify-center rounded-xl py-3 px-2 text-center transition-all ${
                          active
                            ? "bg-teal-700 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <div className="mb-1">{pt.icon}</div>
                        <span className="text-xs font-bold">{pt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Form Card */}
              <Card className="rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Category Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Select Forum Channel
                    </label>
                    <select
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    >
                      {categories.map((group) => (
                        <optgroup key={group.id} label={group.name}>
                          {group.categories.map((sub) => (
                            <option key={sub.slug} value={sub.slug}>
                              {sub.name} ({sub.examTrack || "General"})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Post Title */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Post Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        selectedType === "Question"
                          ? "e.g., Why do we hold Digoxin if apical pulse is under 60 bpm?"
                          : selectedType === "ExamResult"
                          ? "e.g., Passed NCLEX-RN at 85 questions! Here is what worked for me"
                          : "Be descriptive and clear..."
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {/* Contextual Sub-Forms */}
                  {selectedType === "ExamResult" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          Exam Experience Details
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">Exam</label>
                          <select
                            value={examType}
                            onChange={(e) => setExamType(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                          >
                            <option value="NCLEX-RN">NCLEX-RN</option>
                            <option value="NCLEX-PN">NCLEX-PN</option>
                            <option value="HESI Exit">HESI Exit</option>
                            <option value="ATI Predictor">ATI Predictor</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">Outcome</label>
                          <select
                            value={outcome}
                            onChange={(e) => setOutcome(e.target.value as any)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800 font-bold"
                          >
                            <option value="Pass">Passed 🎉</option>
                            <option value="Fail">Did Not Pass</option>
                            <option value="Waiting">Waiting</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">Questions</label>
                          <input
                            type="number"
                            min={75}
                            max={265}
                            value={questionCount}
                            onChange={(e) => setQuestionCount(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600">Weeks Prep</label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={weeksStudied}
                            onChange={(e) => setWeeksStudied(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedType === "Poll" && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-sky-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">
                          Poll Configuration
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 w-6">#{idx + 1}</span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const copy = [...pollOptions];
                                copy[idx] = e.target.value;
                                setPollOptions(copy);
                              }}
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                              placeholder={`Option ${idx + 1}`}
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePollOption(idx)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {pollOptions.length < 6 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddPollOption}
                          className="mt-2 text-xs text-teal-800 border-teal-200 bg-white"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Body Content */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Post Body
                    </label>
                    <textarea
                      rows={8}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Share your question details, clinical scenarios, study plan, or insights. Be clear, supportive, and respectful."
                      className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Tags (Up to 5)
                    </label>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 border border-teal-200"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-teal-600 hover:text-teal-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {tags.length < 5 && (
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          placeholder={tags.length === 0 ? "Type a tag and press Enter (e.g. Pharmacology)..." : "Add more..."}
                          className="flex-1 min-w-[140px] border-none bg-transparent text-xs text-slate-800 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <Link href="/forum">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-slate-300 text-slate-700"
                      >
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl bg-[#0A5C66] px-6 py-2.5 text-white hover:bg-[#084c55] font-semibold"
                    >
                      {loading ? "Publishing..." : "Publish Post"}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            {/* Sidebar Column: Guidelines & Tips */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-teal-800">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="font-bold text-sm">Community Standards</h3>
                </div>

                <ul className="mt-4 space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Strict HIPAA Compliance:</strong> Never share patient identifiers, hospital room numbers, or clinical locations.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>No Secure Exam Leaks:</strong> Discuss general topics, test strategies, and rationales rather than copyrighted live test items.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Constructive Feedback:</strong> Support fellow nurses with peer empathy, evidence-based guidelines, and encouragement.
                    </span>
                  </li>
                </ul>
              </Card>

              <Card className="rounded-2xl border-teal-100 bg-teal-50/50 p-5">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                  <Sparkles className="h-4 w-4 text-teal-700" />
                  <span>Tip for Faster Replies</span>
                </div>
                <p className="mt-2 text-xs text-teal-800 leading-relaxed">
                  Posts with clear titles and specific clinical contexts (e.g. <em>&ldquo;Pediatric dehydration vs fluid overload&rdquo;</em>) receive answers 3x faster than vague inquiries.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
