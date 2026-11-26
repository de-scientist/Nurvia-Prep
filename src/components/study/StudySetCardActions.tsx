"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Copy, ExternalLink, MoreVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamDeliveryMode, ExamLayoutPolicy, StudySetCardDto } from "@/lib/api-types";
import { isModeEnabled as sharedIsModeEnabled } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { useFeedback } from "@/lib/feedback/feedback-context";
import {
  buildValidatedLearningContext,
  saveAuthReturnContext,
} from "@/lib/subscriptions/cart-store";

export function isModeEnabled(
  modeAllowed: ExamDeliveryMode | string | undefined | null,
  target: "Exam" | "Review" | "Tutor"
): boolean {
  if (!modeAllowed) return false;
  const normalized = String(modeAllowed).trim().toLowerCase();
  if (normalized === "all") return true;
  if (normalized === "both") return target === "Exam" || target === "Review";
  return normalized === target.toLowerCase();
}

export function buildStudySessionHref(
  examId: string,
  mode: "Exam" | "Review" | "Tutor",
  layoutPolicy?: ExamLayoutPolicy
): string {
  const params = new URLSearchParams({ examId, mode });
  if (layoutPolicy === "AllInOneOnly") {
    params.set("layout", "AllInOne");
  } else if (layoutPolicy === "SequentialOnly") {
    params.set("layout", "Sequential");
  } else {
    params.set("layout", mode === "Review" ? "AllInOne" : "Sequential");
  }
  return `/exam-session?${params.toString()}`;
}

interface StudySetCardActionsProps {
  studySet: StudySetCardDto;
}

interface StudySetOverflowMenuProps {
  studySet: StudySetCardDto;
  detailHref: string;
  isPublic?: boolean;
  onToggleSave?: (studySet: StudySetCardDto) => void;
  onNotify?: (message: string) => void;
}

export function StudySetCardActions({
  studySet,
}: StudySetCardActionsProps) {
  const router = useRouter();
  const { status, user } = useAuth();
  const feedback = useFeedback();
  const [checkingMode, setCheckingMode] = React.useState<"Exam" | "Tutor" | null>(null);

  const canExam = isModeEnabled(studySet.modeAllowed, "Exam");
  const canTutor = isModeEnabled(studySet.modeAllowed, "Tutor");

  const handleLaunchMode = async (mode: "Exam" | "Tutor", e: React.MouseEvent) => {
    e.preventDefault();
    const destination = buildStudySessionHref(studySet.id, mode, studySet.allowedLayouts);
    const resolvedLayout =
      studySet.allowedLayouts === "AllInOneOnly" ? "AllInOne" : "Sequential";
    const activePathway =
      studySet.pathway ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("track") || "RN"
        : "RN");
    const pathwayParam = encodeURIComponent(activePathway);
    const activeSubject =
      studySet.subject ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("subject") || ""
        : "");
    const subjectParam = activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : "";
    const subDestination = `/learner/subscription?requiredMode=${mode}&examId=${encodeURIComponent(studySet.id)}&pathway=${pathwayParam}${subjectParam}&layout=${resolvedLayout}&returnTo=${encodeURIComponent(destination)}`;

    const persistReturnCtx = () => {
      saveAuthReturnContext(
        buildValidatedLearningContext({
          returnTo: subDestination,
          requiredMode: mode,
          examId: studySet.id,
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
        "Please verify your email address before launching " + mode + " Mode.",
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

  return (
    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-border/60">
      {canTutor ? (
        <Link
          href={buildStudySessionHref(studySet.id, "Tutor", studySet.allowedLayouts)}
          onClick={(e) => handleLaunchMode("Tutor", e)}
          className="block"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={checkingMode !== null}
            className="w-full h-7.5 px-2.5 py-1 text-xs font-semibold rounded-md hover:border-brand-teal/60"
          >
            {checkingMode === "Tutor" ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Verifying…
              </>
            ) : (
              "Tutor Mode"
            )}
          </Button>
        </Link>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Tutor mode is not enabled for this examination."
          className="w-full h-7.5 px-2.5 py-1 text-xs font-semibold rounded-md opacity-50 cursor-not-allowed"
        >
          Tutor Mode
        </Button>
      )}

      {canExam ? (
        <Link
          href={buildStudySessionHref(studySet.id, "Exam", studySet.allowedLayouts)}
          onClick={(e) => handleLaunchMode("Exam", e)}
          className="block"
        >
          <Button
            size="sm"
            disabled={checkingMode !== null}
            className="w-full h-7.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-brand-teal hover:bg-brand-tealDark text-white shadow-2xs"
          >
            {checkingMode === "Exam" ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Verifying…
              </>
            ) : (
              "Exam Mode"
            )}
          </Button>
        </Link>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled
          title="Exam mode is not enabled for this examination."
          className="w-full h-7.5 px-2.5 py-1 text-xs font-semibold rounded-md opacity-50 cursor-not-allowed"
        >
          Exam Mode
        </Button>
      )}
    </div>
  );
}

export function StudySetOverflowMenu({
  studySet,
  detailHref,
  isPublic = false,
  onToggleSave,
  onNotify,
}: StudySetOverflowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleCopyLink = async () => {
    setOpen(false);
    try {
      const url = `${window.location.origin}${detailHref}`;
      await navigator.clipboard.writeText(url);
      onNotify?.("Exam link copied to clipboard.");
    } catch {
      onNotify?.("Unable to copy link.");
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${studySet.title}`}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          <Link
            href={detailHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            <ExternalLink className="h-3.5 w-3.5 text-brand-teal" />
            View details
          </Link>

          {!isPublic && onToggleSave && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onToggleSave(studySet);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-surface-muted"
            >
              {studySet.isSaved ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5 text-brand-teal" />
                  Remove from My Library
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 text-brand-teal" />
                  Save to My Library
                </>
              )}
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopyLink()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            <Copy className="h-3.5 w-3.5 text-foreground-muted" />
            Copy study-set link
          </button>
        </div>
      )}
    </div>
  );
}
