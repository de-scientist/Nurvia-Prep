"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
  Quote,
} from "lucide-react";
import { nurviaApi } from "@/lib/api-client";
import type {
  ApprovedTestimonialPathway,
  NormalizedTestimonial,
  TestimonialsCollectionResult,
} from "@/lib/api-types";
import type { StudentTestimonial } from "@/lib/study-sets-data";
import {
  normalizeAndFilterBackendTestimonials,
  resolveTestimonialsCollection,
} from "@/lib/testimonials/testimonial-service";
import { cn } from "@/lib/utils";

interface StudentTestimonialCarouselProps {
  testimonials?: StudentTestimonial[];
  initialData?: TestimonialsCollectionResult;
  autoPlayIntervalMs?: number;
  className?: string;
}

type PathwayFilter = "All" | ApprovedTestimonialPathway;

function createEmptyTestimonialsCollection(): TestimonialsCollectionResult {
  return {
    items: [],
    source: "none",
    backendStatus: "empty",
    totalReceivedFromBackend: 0,
    eligibleBackendCount: 0,
    rejectedBackendCount: 0,
    endpointChecked: false,
    localFallbackUsed: false,
  };
}

function normalizeProvidedTestimonials(
  provided: StudentTestimonial[]
): TestimonialsCollectionResult {
  const mappedCandidates = provided.map((item) => ({
    id: item.id,
    content: item.testimonial,
    attribution: item.displayName,
    pathway: item.pathway,
    programId: item.programId,
    examTrack: item.examTrack,
    roleOrQualification: item.roleOrQualification,
    examFocus: item.scoreOrLevel,
    source: item.source,
    isSample: item.isSample,
    status: "published",
    visibility: "public",
  }));

  // Validate using the service normalizer — this correctly handles both
  // verified_backend (isVerified from backend) and approved_local (isVerified = false)
  const validated = normalizeAndFilterBackendTestimonials(mappedCandidates);
  if (validated.eligible.length === 0) {
    // No eligible records from the provided collection — fall back to the
    // approved local learner testimonials stored in the library.
    return resolveTestimonialsCollection({
      backendAttempted: true,
      backendOk: true,
      backendPayload: mappedCandidates,
      localFallback: provided,
    });
  }

  // Distinguish source: verified_backend records keep their authoritative
  // verification badge; approved_local records never receive a verified badge.
  const hasVerifiedBackend = validated.eligible.some(
    (item) => item.source === 'verified_backend' && item.isVerified === true
  );

  return {
    items: validated.eligible,
    source: validated.eligible[0]?.source ?? 'verified_backend',
    backendStatus: 'available_with_records',
    totalReceivedFromBackend: provided.length,
    eligibleBackendCount: validated.eligible.length,
    rejectedBackendCount: validated.rejectedCount,
    endpointChecked: false,
    localFallbackUsed: false,
  };
}

export function StudentTestimonialCarousel({
  testimonials,
  initialData,
  autoPlayIntervalMs = 8000,
  className,
}: StudentTestimonialCarouselProps) {
  const hasExplicitOverride = Boolean(testimonials);
  const [collection, setCollection] = React.useState<TestimonialsCollectionResult>(() => {
    if (testimonials) {
      return normalizeProvidedTestimonials(testimonials);
    }
    if (initialData) {
      return resolveTestimonialsCollection({
        backendAttempted: Boolean(initialData.endpointChecked),
        backendOk: initialData.backendStatus !== "upstream_error",
        backendStatusOverride: initialData.backendStatus,
        backendPayload: initialData.items,
      });
    }
    return createEmptyTestimonialsCollection();
  });
  const [isLoading, setIsLoading] = React.useState(!hasExplicitOverride && !initialData);
  const [pathwayFilter, setPathwayFilter] = React.useState<PathwayFilter>("All");
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isPausedByUser, setIsPausedByUser] = React.useState(false);
  const [isPausedTemporarily, setIsPausedTemporarily] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(3);

  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);
  const resumeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch authoritative backend testimonials on mount
  React.useEffect(() => {
    if (testimonials) {
      setCollection(normalizeProvidedTestimonials(testimonials));
      setIsLoading(false);
      return;
    }
    if (initialData) {
      setCollection(
        resolveTestimonialsCollection({
          backendAttempted: Boolean(initialData.endpointChecked),
          backendOk: initialData.backendStatus !== "upstream_error",
          backendStatusOverride: initialData.backendStatus,
          backendPayload: initialData.items,
        })
      );
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    void nurviaApi
      .getTestimonials()
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setCollection(res.data);
        } else {
          setCollection(createEmptyTestimonialsCollection());
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setCollection(createEmptyTestimonialsCollection());
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [testimonials, initialData]);

  // Responsive cards-per-view: 1 mobile, 2 tablet, 3 desktop
  React.useEffect(() => {
    function updateLayout() {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCount(1);
      } else if (width < 1024) {
        setVisibleCount(2);
      } else {
        setVisibleCount(3);
      }
    }

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Respect user reduced-motion preference
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const allItems = collection.items;
  const rnCount = React.useMemo(
    () => allItems.filter((i) => i.pathway === "RN").length,
    [allItems]
  );
  const lpnCount = React.useMemo(
    () => allItems.filter((i) => i.pathway === "PN_LPN").length,
    [allItems]
  );

  const visibleItems: NormalizedTestimonial[] = React.useMemo(() => {
    if (pathwayFilter === "All") return allItems;
    return allItems.filter((item) => item.pathway === pathwayFilter);
  }, [allItems, pathwayFilter]);

  const totalItems = visibleItems.length;
  const maxIndex = Math.max(0, totalItems - visibleCount);

  React.useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  const isAutoRotationPaused =
    prefersReducedMotion ||
    isHovered ||
    isFocused ||
    isPausedByUser ||
    isPausedTemporarily ||
    totalItems <= visibleCount;

  // Calm automatic advancement (pauses on hover, focus, reduced motion, or user control)
  React.useEffect(() => {
    if (isAutoRotationPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, autoPlayIntervalMs);

    return () => clearInterval(interval);
  }, [isAutoRotationPaused, maxIndex, autoPlayIntervalMs]);

  const registerManualNavigation = React.useCallback(() => {
    setIsPausedTemporarily(true);
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = setTimeout(() => {
      setIsPausedTemporarily(false);
    }, 10000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const handlePrev = () => {
    registerManualNavigation();
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const handleNext = () => {
    registerManualNavigation();
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const hasPublishedTestimonials = allItems.length > 0;
  // Only backend-verified records earn the "Verified Learner" badge.
  // Local fallback records (source: "approved_local") must never be marked verified.
  const hasAuthoritativelyVerifiedItems = allItems.some(
    (item) => item.source === 'verified_backend' && item.isVerified === true
  );

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="RN and LPN learner testimonials"
      data-testid="testimonial-carousel"
      data-testimonial-source={collection.source}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "relative w-full overflow-hidden border-y border-border/80 bg-surface/60 py-8 sm:py-10 transition-colors",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Header & Pathway Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                hasAuthoritativelyVerifiedItems
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-brand-teal/10 text-brand-teal"
              )}
            >
              {hasAuthoritativelyVerifiedItems ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Quote className="h-4 w-4" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-brand text-xs font-bold uppercase tracking-widest text-foreground">
                  LEARNER TESTIMONIALS
                </h2>

                {hasAuthoritativelyVerifiedItems ? (
                  <span
                    data-testid="testimonial-source-badge"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Verified Learner
                  </span>
                ) : (
                  <span
                    data-testid="testimonial-source-badge"
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary"
                  >
                    <Info className="h-3 w-3 text-brand-teal" aria-hidden="true" />
                    RN &amp; LPN Pathways
                  </span>
                )}
              </div>

              <p className="text-xs text-foreground-muted">
                Published learner feedback across RN and LPN / PN nursing study tracks.
              </p>
            </div>
          </div>

          {/* Pathway Filter + Accessible Carousel Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div
              role="group"
              aria-label="Filter testimonials by pathway"
              className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-xs"
            >
              {(
                [
                  { id: "All" as const, label: `All (${allItems.length})` },
                  { id: "RN" as const, label: `RN (${rnCount})` },
                  { id: "PN_LPN" as const, label: `LPN / PN (${lpnCount})` },
                ] as const
              ).map((tab) => {
                const active = pathwayFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setPathwayFilter(tab.id);
                      setCurrentIndex(0);
                    }}
                    className={cn(
                      "min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                      active
                        ? "bg-brand-teal text-white shadow-2xs"
                        : "text-foreground-secondary hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {totalItems > visibleCount && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Show previous testimonials"
                  onClick={handlePrev}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground-secondary transition-colors hover:border-brand-teal/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  aria-label={
                    isPausedByUser
                      ? "Resume testimonial rotation"
                      : "Pause testimonial rotation"
                  }
                  aria-pressed={isPausedByUser}
                  onClick={() => setIsPausedByUser((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground-secondary transition-colors hover:border-brand-teal/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  {isPausedByUser || prefersReducedMotion ? (
                    <Play className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {isPausedByUser ? "Paused" : "Pause"}
                  </span>
                </button>

                <button
                  type="button"
                  aria-label="Show next testimonials"
                  onClick={handleNext}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground-secondary transition-colors hover:border-brand-teal/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading RN and LPN testimonials"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-44 rounded-2xl border border-border bg-background p-5 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 rounded-full bg-surface-muted" />
                  <div className="h-5 w-20 rounded-full bg-surface-muted" />
                </div>
                <div className="h-4 w-full rounded bg-surface-muted" />
                <div className="h-4 w-5/6 rounded bg-surface-muted" />
                <div className="h-4 w-2/3 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        ) : totalItems === 0 ? (
          <div
            data-testid="testimonial-empty-state"
            className="rounded-2xl border border-border/90 bg-background p-6 sm:p-8"
          >
            <div className="mx-auto max-w-2xl text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {hasPublishedTestimonials
                  ? `No published ${pathwayFilter === "RN" ? "RN" : "LPN / PN"} learner testimonials are currently listed.`
                  : "Published learner testimonials will appear here as approved submissions become available."}
              </p>
              <p className="text-xs leading-relaxed text-foreground-muted">
                NURVIA displays only authorized, published learner feedback for the RN (Program 9) and LPN / PN (Program 6) nursing study pathways.
              </p>
            </div>
          </div>
        ) : (
          /* Carousel Viewport with Exact Gutter Alignment */
          <div
            className="-mx-1.5 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={cn(
                "flex",
                prefersReducedMotion
                  ? "transition-none"
                  : "transition-transform duration-500 ease-out"
              )}
              style={{
                transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`,
              }}
            >
              {visibleItems.map((item) => {
                const isLpn = item.pathway === "PN_LPN";
                const monogram = item.attribution
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={item.id}
                    className="shrink-0 px-1.5"
                    style={{ width: `${100 / visibleCount}%` }}
                  >
                    <article
                      data-testid="testimonial-card"
                      data-pathway={item.pathway}
                      data-verified={item.isVerified ? "true" : "false"}
                      className="flex h-full flex-col justify-between rounded-2xl border border-border/90 bg-background p-5 shadow-xs transition-colors hover:border-brand-teal/50"
                    >
                      <div className="space-y-3">
                        {/* Top Row: Authoritative Pathway + Focus + Authoritative Verification Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                                isLpn
                                  ? "border-purple-500/30 bg-purple-500/10 text-purple-800 dark:border-purple-400/35 dark:bg-purple-500/15 dark:text-purple-200"
                                  : "border-brand-teal/30 bg-brand-teal/10 text-brand-tealDark dark:border-teal-400/35 dark:bg-brand-teal/15 dark:text-teal-200"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  isLpn ? "bg-purple-500" : "bg-brand-teal"
                                )}
                                aria-hidden="true"
                              />
                              {item.pathwayLabel}
                            </span>

                            {item.examFocus && (
                              <span className="text-[11px] font-semibold text-foreground-secondary">
                                {item.examFocus}
                              </span>
                            )}
                          </div>

                          {item.isVerified && (
                            <span
                              data-testid="testimonial-verified-badge"
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
                            >
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              Verified
                            </span>
                          )}
                        </div>

                        {/* Quote */}
                        <blockquote className="text-xs sm:text-[13px] leading-relaxed text-foreground">
                          &ldquo;{item.content}&rdquo;
                        </blockquote>
                      </div>

                      {/* Attribution Footer */}
                      <div className="mt-4 flex items-center gap-2.5 border-t border-border/70 pt-3.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            isLpn
                              ? "bg-purple-500/15 text-purple-800 dark:text-purple-200"
                              : "bg-brand-teal/15 text-brand-tealDark dark:text-teal-200"
                          )}
                          aria-hidden="true"
                        >
                          {monogram}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {item.attribution}
                          </p>
                          {item.roleOrQualification && (
                            <p className="truncate text-[11px] text-foreground-muted">
                              {item.roleOrQualification}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Range Counter */}
        {!isLoading && totalItems > 0 && (
          <div className="flex items-center justify-between text-[11px] text-foreground-muted">
            <span>
              Showing {Math.min(visibleCount, totalItems)} of {totalItems}{" "}
              {pathwayFilter === "All"
                ? "RN & LPN"
                : pathwayFilter === "RN"
                  ? "RN"
                  : "LPN / PN"}{" "}
              learner testimonials
            </span>
            {totalItems > visibleCount && (
              <span>
                Slide {currentIndex + 1} of {maxIndex + 1}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
