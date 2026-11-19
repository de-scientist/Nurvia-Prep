"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { nurviaApi } from "@/lib/api-client";
import type { CommunityPostDetailDto } from "@/lib/api-types";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Flag,
  CheckCircle2,
  Award,
  Clock,
  Eye,
  Plus,
  Send,
  Sparkles,
  Flame,
} from "lucide-react";

function ForumContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get("category") || undefined;
  const initialPostId = searchParams?.get("postId") || undefined;

  const [posts, setPosts] = React.useState<CommunityPostDetailDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeSort, setActiveSort] = React.useState<"newest" | "hot" | "top" | "comments" | "unanswered">("newest");
  const [selectedCategory, setSelectedCategory] = React.useState<string | undefined>(initialCategory);
  const [expandedPostId, setExpandedPostId] = React.useState<string | null>(initialPostId || null);
  const [replyInput, setReplyInput] = React.useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const fetchPosts = React.useCallback(async () => {
    setLoading(true);
    const res = await nurviaApi.getCommunityPosts({
      sort: activeSort,
      categorySlug: selectedCategory,
    });
    if (res.success && res.data) {
      setPosts(res.data.items);
    }
    setLoading(false);
  }, [activeSort, selectedCategory]);

  React.useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handleVote = async (postId: string, direction: "up" | "down") => {
    const res = await nurviaApi.toggleCommunityVote(postId, direction);
    if (res.success && res.data) {
      const { voteScore, userVote } = res.data;
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, voteScore, userVote } : p))
      );
    }
  };

  const handleReplySubmit = async (postId: string) => {
    const content = replyInput[postId]?.trim();
    if (!content) return;

    setSubmittingReply(true);
    const res = await nurviaApi.addCommunityReply(postId, content);
    if (res.success && res.data) {
      setReplyInput((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const replies = p.replies ? [...p.replies, res.data!] : [res.data!];
            return { ...p, replies, replyCount: replies.length };
          }
          return p;
        })
      );
      setToastMessage("Your reply was published to the peer discussion.");
      setTimeout(() => setToastMessage(null), 3000);
    }
    setSubmittingReply(false);
  };

  const handleReport = async (postId: string) => {
    const res = await nurviaApi.reportCommunityPost(postId, "Flagged by peer for clinical safety review");
    if (res.success) {
      setToastMessage("Post flagged for moderation review. Thank you for protecting learner safety.");
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <PublicShell>
      <div className="bg-background text-foreground min-h-screen">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-brand-teal px-4 py-3 text-xs font-semibold text-white shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </div>
        )}

        {/* Community Guidelines Strip */}
        <div className="border-b border-border bg-surface-muted/50 py-2.5 px-4 text-center text-xs text-foreground-secondary flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
          <span>
            <strong>Peer Support Guidelines:</strong> Never share patient identifiers or protected health information. Real licensure exam questions are strictly prohibited.
          </span>
        </div>

        {/* Hero Banner */}
        <section className="border-b border-border bg-surface py-8 sm:py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="teal">r/NursingPlex</Badge>
                  <span className="text-xs text-foreground-muted">2.4k members · 67 forums</span>
                </div>
                <h1 className="font-brand text-2xl sm:text-3xl font-extrabold text-foreground">
                  Nursing Learner Community Forum
                </h1>
                <p className="text-xs sm:text-sm text-foreground-secondary max-w-2xl">
                  A moderated, supportive space for nursing students and nurses. Ask clinical questions, dissect NGN cases, share exam outcomes, and find study accountability partners.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/new">
                  <Button className="gap-1.5 text-xs bg-brand-teal text-white hover:bg-brand-teal-dark">
                    <Plus className="w-3.5 h-3.5" /> Ask a Question
                  </Button>
                </Link>
                <Link href="/community/categories">
                  <Button variant="outline" className="text-xs">
                    Browse Categories
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick Composer Bar */}
            <Link
              href="/new"
              className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-background hover:border-brand-teal/50 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs text-foreground-muted">
                <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center text-[10px] font-bold">
                  N
                </div>
                <span>Ask a question, share an exam experience, or start a study group…</span>
              </div>
              <Button size="sm" variant="secondary" className="text-xs h-7">
                Post
              </Button>
            </Link>
          </div>
        </section>

        {/* Sort Tabs & Feed */}
        <section className="py-8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Sort & Category Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-1 sm:gap-2">
                {(["newest", "hot", "top", "comments", "unanswered"] as const).map((sort) => (
                  <Button
                    key={sort}
                    size="sm"
                    variant={activeSort === sort ? "primary" : "ghost"}
                    onClick={() => setActiveSort(sort)}
                    className="capitalize text-xs h-8 px-3"
                  >
                    {sort === "hot" && <Flame className="w-3 h-3 mr-1 text-amber-500" />}
                    {sort === "newest" ? "Newest Posts" : sort}
                  </Button>
                ))}
              </div>

              {selectedCategory && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Filtered: {selectedCategory}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCategory(undefined)}
                    className="text-[11px] h-6 px-1.5 text-foreground-muted"
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </div>

            {/* Feed List */}
            {loading ? (
              <div className="py-16 text-center text-sm text-foreground-secondary" aria-live="polite">
                Loading discussions…
              </div>
            ) : posts.length === 0 ? (
              <Card className="p-12 text-center space-y-3">
                <p className="font-semibold text-foreground">No discussions found in this view.</p>
                <p className="text-xs text-foreground-secondary">
                  Be the first to ask a question or start a conversation!
                </p>
                <Link href="/new">
                  <Button size="sm" className="mt-2 text-xs">
                    Create Discussion
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => {
                  const isExpanded = expandedPostId === post.id;
                  return (
                    <Card
                      key={post.id}
                      className="p-5 sm:p-6 border border-border bg-surface hover:border-border/80 transition-all shadow-xs space-y-4"
                    >
                      {/* Post Header */}
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Vote Column */}
                        <div className="flex flex-col items-center justify-start rounded-lg bg-surface-muted/60 p-1 shrink-0 text-center">
                          <button
                            type="button"
                            onClick={() => handleVote(post.id, "up")}
                            className={`p-1.5 rounded hover:bg-surface text-xs ${
                              post.userVote === "up" ? "text-brand-teal font-bold" : "text-foreground-muted"
                            }`}
                            aria-label="Upvote"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-foreground my-0.5">
                            {post.voteScore}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleVote(post.id, "down")}
                            className={`p-1.5 rounded hover:bg-surface text-xs ${
                              post.userVote === "down" ? "text-rose-500 font-bold" : "text-foreground-muted"
                            }`}
                            aria-label="Downvote"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Post Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                            <Link
                              href={`/forum?category=${encodeURIComponent(post.channelId)}`}
                              className="font-bold text-brand-teal hover:underline"
                            >
                              r/{post.channelName}
                            </Link>
                            <span>·</span>
                            <span>{post.cohortLabel}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(post.createdAtUtc).toLocaleDateString()}
                            </span>
                            {post.status === "Solved" && (
                              <Badge variant="teal" className="text-[10px] py-0 px-1.5">
                                Solved
                              </Badge>
                            )}
                            {post.postType === "ExamResult" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                <Award className="w-3 h-3" /> Exam Result
                              </span>
                            )}
                          </div>

                          <h2
                            onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                            className="font-brand text-base sm:text-lg font-bold text-foreground cursor-pointer hover:text-brand-teal transition-colors"
                          >
                            {post.title}
                          </h2>

                          {post.examResultMeta && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-muted text-xs text-foreground font-medium">
                              <span>🎯 {post.examResultMeta.examType}</span>
                              <span>·</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {post.examResultMeta.outcome}
                              </span>
                              {post.examResultMeta.questionCount && (
                                <>
                                  <span>·</span>
                                  <span>{post.examResultMeta.questionCount} Questions</span>
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed whitespace-pre-line line-clamp-3">
                            {post.content}
                          </p>

                          {/* Hashtags */}
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {post.tags.map((tag) => (
                                <Link
                                  key={tag}
                                  href={`/search?q=${encodeURIComponent(tag)}`}
                                  className="text-[11px] text-brand-teal hover:underline bg-brand-teal/5 px-2 py-0.5 rounded-md"
                                >
                                  #{tag}
                                </Link>
                              ))}
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50 text-xs text-foreground-muted">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                                className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {post.replyCount} Comments
                              </button>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {post.views} Views
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleReport(post.id)}
                                className="hover:text-rose-500 transition-colors p-1"
                                title="Report post for moderation"
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Comments & Reply Composer */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-4 pl-8 sm:pl-12">
                          <h3 className="font-semibold text-xs uppercase tracking-wider text-foreground-muted">
                            Discussion Thread ({post.replies?.length || 0})
                          </h3>

                          {post.replies && post.replies.length > 0 ? (
                            <div className="space-y-3">
                              {post.replies.map((rep) => (
                                <div
                                  key={rep.id}
                                  className="rounded-xl border border-border/70 bg-background/60 p-3.5 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-foreground-muted text-[11px]">
                                    <span className="font-bold text-foreground">{rep.authorName}</span>
                                    <span>{new Date(rep.createdAtUtc).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-foreground-secondary whitespace-pre-line leading-relaxed">
                                    {rep.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-foreground-muted italic">
                              No replies yet. Share your insight below.
                            </p>
                          )}

                          {/* Reply Input Form */}
                          <div className="flex gap-2 pt-2">
                            <input
                              type="text"
                              placeholder="Write a supportive, constructive response…"
                              value={replyInput[post.id] || ""}
                              onChange={(e) =>
                                setReplyInput((prev) => ({ ...prev, [post.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void handleReplySubmit(post.id);
                                }
                              }}
                              className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand-teal"
                            />
                            <Button
                              size="sm"
                              disabled={submittingReply || !replyInput[post.id]?.trim()}
                              onClick={() => handleReplySubmit(post.id)}
                              className="text-xs px-4"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

export default function ForumPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent" />
        </div>
      }
    >
      <ForumContent />
    </React.Suspense>
  );
}
