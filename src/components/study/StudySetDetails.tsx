"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  HelpCircle,
  Star,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { nurviaApi } from "@/lib/api-client";
import type { StudySetDetailDto } from "@/lib/api-types";
import { buildStudySessionHref, isModeEnabled } from "./StudySetCardActions";
import { useAuth } from "@/components/auth/auth-provider";
import { useFeedback } from "@/lib/feedback/feedback-context";
import {
  buildValidatedLearningContext,
  saveAuthReturnContext,
} from "@/lib/subscriptions/cart-store";

interface StudySetDetailsProps {
  examId: string;
  isPublic?: boolean;
}

export function StudySetDetails({ examId, isPublic = false }: StudySetDetailsProps) {
  const router = useRouter();
  const { status, user } = useAuth();
  const feedback = useFeedback();
  const [checkingMode, setCheckingMode] = React.useState<"Exam" | "Tutor" | null>(null);

  const [detail, setDetail] = React.useState<StudySetDetailDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingLibrary, setSavingLibrary] = React.useState(false);

  // Review form state
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [submittingReview, setSubmittingReview] = React.useState(false);
  const [reviewMessage, setReviewMessage] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await nurviaApi.getStudySetDetail(examId);
    if (!res.success || !res.data) {
      setError(res.message || "Unable to load exam details.");
    } else {
      setDetail(res.data);
      if (res.data.learnerReview) {
        setRating(res.data.learnerReview.rating);
        setComment(res.data.learnerReview.comment ?? "");
      }
    }
    setLoading(false);
  }, [examId]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleToggleSave = async () => {
    if (!detail) return;
    setSavingLibrary(true);
    const res = detail.isSaved
      ? await nurviaApi.removeSavedStudySet(detail.id)
      : await nurviaApi.saveStudySet(detail.id);
    if (res.success) {
      setDetail({ ...detail, isSaved: !detail.isSaved });
    }
    setSavingLibrary(false);
  };

  const handleLaunchMode = async (mode: "Exam" | "Tutor", e: React.MouseEvent) => {
    e.preventDefault();
    if (!detail) return;
    const destination = buildStudySessionHref(detail.id, mode, detail.allowedLayouts);
    const resolvedLayout =
      detail.allowedLayouts === "AllInOneOnly" ? "AllInOne" : "Sequential";
    const activePathway =
      detail.pathway ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("track") || "RN"
        : "RN");
    const pathwayParam = encodeURIComponent(activePathway);
    const activeSubject =
      detail.subject ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("subject") || ""
        : "");
    const subjectParam = activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : "";
    const subDestination = `/learner/subscription?requiredMode=${mode}&examId=${encodeURIComponent(detail.id)}&pathway=${pathwayParam}${subjectParam}&layout=${resolvedLayout}&returnTo=${encodeURIComponent(destination)}`;

    const persistReturnCtx = () => {
      saveAuthReturnContext(
        buildValidatedLearningContext({
          returnTo: subDestination,
          requiredMode: mode,
          examId: detail.id,
          pathway: activePathway,
          subject: activeSubject || undefined,
          layout: resolvedLayout,
          ownerUserId: user?.id,
          ownerEmail: user?.email,
        })
      );
    };

    if (status === "unauthenticated" || !user) {
      persistReturnCtx();
      router.push(`/sign-in?returnTo=${encodeURIComponent(subDestination)}`);
      return;
    }

    if (status === "authenticated" && user?.emailVerified === false) {
      persistReturnCtx();
      feedback.showWarning(
        `Please verify your email address before launching ${mode} Mode.`,
        "Email Verification Required"
      );
      router.push(
        `/auth/validate?reason=verification&email=${encodeURIComponent(user.email || "")}&returnTo=${encodeURIComponent(subDestination)}`
      );
      return;
    }

    setCheckingMode(mode);
    try {
      const res = await fetch(`/api/subscriptions/status?mode=${mode}&pathway=${pathwayParam}`, {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.allowed) {
        router.push(destination);
        return;
      }

      persistReturnCtx();

      if (data.status === "None" || data.errorCode === "NO_SUBSCRIPTION") {
        feedback.showInfo(
          `An active subscription is required to access ${mode} Mode. Redirecting to subscription plans…`,
          "Subscription Required"
        );
        router.push(subDestination);
      } else if (data.status === "Expired" || data.errorCode === "SUBSCRIPTION_EXPIRED") {
        feedback.showWarning(
          "Your subscription has expired. Please renew your plan to continue.",
          "Subscription Expired"
        );
        router.push(subDestination);
      } else if (data.status === "Cancelled" || data.errorCode === "SUBSCRIPTION_CANCELLED") {
        feedback.showWarning(
          "Your subscription has been cancelled. Please resubscribe to continue.",
          "Subscription Cancelled"
        );
        router.push(subDestination);
      } else if (data.errorCode === "ENTITLEMENT_LACKING") {
        feedback.showWarning(
          data.message || `Your current plan does not include access to ${mode} Mode. Please upgrade your subscription.`,
          "Plan Upgrade Required"
        );
        router.push(subDestination);
      } else {
        feedback.showError(
          data.message || "Unable to verify subscription status at this time. Please try again.",
          "Service Unavailable"
        );
      }
    } catch {
      feedback.showError("Unable to verify subscription status. Please check your connection.", "Network Error");
    } finally {
      setCheckingMode(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmittingReview(true);
    setReviewMessage(null);
    const res = await nurviaApi.submitStudySetReview(detail.id, { rating, comment });
    if (res.success) {
      setReviewMessage("Thank you! Your review has been saved.");
      await loadDetail();
    } else {
      setReviewMessage(res.message || "Unable to submit review.");
    }
    setSubmittingReview(false);
  };

  const backHref = isPublic ? "/exams" : "/learner/library";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-muted" />
        <Card className="h-64 animate-pulse p-6" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <Card className="space-y-4 p-6">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error || "Exam not found."}
        </p>
        <Link href={backHref}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Study Library
          </Button>
        </Link>
      </Card>
    );
  }

  const canExam = isModeEnabled(detail.modeAllowed, "Exam");
  const canReview = isModeEnabled(detail.modeAllowed, "Review");
  const canTutor = isModeEnabled(detail.modeAllowed, "Tutor");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-secondary hover:text-brand-teal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Study Library
        </Link>

        {!isPublic && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={savingLibrary}
            onClick={() => void handleToggleSave()}
          >
            {detail.isSaved ? (
              <>
                <BookmarkCheck className="mr-2 h-4 w-4 text-brand-teal" />
                Saved in My Library
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" />
                Save to My Library
              </>
            )}
          </Button>
        )}
      </div>

      <Card className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">
              {detail.pathway.replace("_", " ")} · {detail.category.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </Badge>
            <span className="text-xs font-mono text-foreground-muted">{detail.code}</span>
            {detail.difficulty && <Badge variant="outline">{detail.difficulty}</Badge>}
          </div>

          <h1 className="font-brand text-2xl font-extrabold text-foreground sm:text-3xl">
            {detail.title}
          </h1>
          <p className="text-sm leading-relaxed text-foreground-secondary">{detail.description}</p>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-background/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            icon={<HelpCircle className="h-4 w-4 text-brand-teal" />}
            label="Questions"
            value={`${detail.totalQuestions} ${detail.totalQuestions === 1 ? "question" : "questions"}`}
          />
          <MetaItem
            icon={<Clock className="h-4 w-4 text-brand-teal" />}
            label="Time Limit"
            value={`${detail.timeLimitMinutes} minutes`}
          />
          <MetaItem
            icon={<CheckCircle2 className="h-4 w-4 text-brand-teal" />}
            label="Passing Score"
            value={`${detail.passingScorePercentage}%`}
          />
          <MetaItem
            icon={<GraduationCap className="h-4 w-4 text-brand-teal" />}
            label="Academic Metadata"
            value={
              [detail.school, detail.season, detail.academicYear].filter(Boolean).join(" · ") ||
              "Standard Curriculum"
            }
          />
        </div>

        {/* Three Mode Launcher */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Launch Learning Mode</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {canExam ? (
              <Link
                href={buildStudySessionHref(detail.id, "Exam", detail.allowedLayouts)}
                onClick={(e) => handleLaunchMode("Exam", e)}
              >
                <Button className="w-full" disabled={checkingMode !== null}>
                  {checkingMode === "Exam" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Launch Exam Mode"
                  )}
                </Button>
              </Link>
            ) : (
              <Button disabled className="w-full" title="Exam mode isn't currently enabled for this exam.">
                Exam Mode Unavailable
              </Button>
            )}

            {canReview ? (
              <Link href={buildStudySessionHref(detail.id, "Review", detail.allowedLayouts)}>
                <Button variant="outline" className="w-full">
                  Launch Review Mode
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                disabled
                className="w-full"
                title="Review mode isn't currently enabled for this exam."
              >
                Review Mode Unavailable
              </Button>
            )}

            {canTutor ? (
              <Link
                href={buildStudySessionHref(detail.id, "Tutor", detail.allowedLayouts)}
                onClick={(e) => handleLaunchMode("Tutor", e)}
              >
                <Button variant="outline" className="w-full" disabled={checkingMode !== null}>
                  {checkingMode === "Tutor" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Launch Tutor Mode"
                  )}
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                disabled
                className="w-full"
                title="Tutor mode isn't currently enabled for this exam."
              >
                Tutor Mode Unavailable
              </Button>
            )}
          </div>
          {(!canExam || !canReview || !canTutor) && (
            <p className="text-[11px] text-foreground-muted">
              Available modes are governed by the published exam configuration
              {!canReview && " — Review mode is disabled when allowReview is false on the exam record"}
              {!canTutor && "; Tutor mode requires an enabled Practice/Tutor rule"}.
            </p>
          )}
        </div>

        {detail.instructions && (
          <div className="space-y-1.5 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">Instructions</h2>
            <p className="whitespace-pre-line text-sm text-foreground-secondary">{detail.instructions}</p>
          </div>
        )}

        {detail.learningObjectives.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">Learning Objectives</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-secondary">
              {detail.learningObjectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {(detail.subjectsCovered.length > 0 || detail.topicsCovered.length > 0) && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {detail.subjectsCovered.map((s) => (
              <Badge key={`subj-${s}`} variant="secondary">
                {s}
              </Badge>
            ))}
            {detail.topicsCovered.map((t) => (
              <Badge key={`topic-${t}`} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Authentic Reviews & Ratings */}
      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-brand text-lg font-bold text-foreground">Learner Reviews</h2>
            <p className="text-xs text-foreground-muted">
              {detail.reviewCount > 0 && detail.averageRating != null
                ? `${detail.averageRating.toFixed(1)} out of 5 (${detail.reviewCount} verified ${
                    detail.reviewCount === 1 ? "review" : "reviews"
                  })`
                : "Not yet rated"}
            </p>
          </div>
        </div>

        {!isPublic && detail.canReview && (
          <form onSubmit={(e) => void handleSubmitReview(e)} className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs font-semibold text-foreground">
              {detail.learnerReview ? "Update your review" : "Rate this exam"}
            </p>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  onClick={() => setRating(star)}
                  className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= rating ? "fill-amber-400 text-amber-400" : "text-border"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share how this exam helped your clinical preparation (optional)..."
              rows={3}
              maxLength={1000}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" isLoading={submittingReview}>
                {detail.learnerReview ? "Update Review" : "Submit Review"}
              </Button>
              {reviewMessage && <span className="text-xs text-foreground-secondary">{reviewMessage}</span>}
            </div>
          </form>
        )}

        {detail.reviews.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No learner reviews yet. Complete an attempt to be the first to leave verified feedback.
          </p>
        ) : (
          <div className="space-y-3">
            {detail.reviews.map((rev) => (
              <div key={rev.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{rev.learnerName}</span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${idx < rev.rating ? "fill-amber-400" : "text-border"}`}
                      />
                    ))}
                  </div>
                </div>
                {rev.comment && (
                  <p className="mt-2 text-sm text-foreground-secondary">{rev.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
