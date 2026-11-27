"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nurviaApi } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { LearnerVerificationModal } from "@/components/auth/LearnerVerificationModal";
import type {
  StudyLibraryFiltersDto,
  StudyLibrarySummaryDto,
  StudySetCardDto,
  SubjectCardDto,
} from "@/lib/api-types";
import type { AdvancedFilterState } from "./StudyLibraryAdvancedFilters";
import {
  StudyLibraryCategoryTabs,
  PATHWAY_LABELS,
  simplifySubjectName,
  RN_EXAM_BODY_CATEGORIES,
  LPN_EXAM_BODY_CATEGORIES,
} from "./StudyLibraryCategoryTabs";
import { compareExitExams, isExitExam, isAtiBody, isHesiBody } from "@/lib/utils/exams/compareExams";
import { StudyLibraryHeader } from "./StudyLibraryHeader";
import { StudyLibrarySearch } from "./StudyLibrarySearch";
import {
  StudyLibraryEmptyState,
  StudyLibraryLoadingState,
  StudyLibraryPagination,
  StudyLibraryResultsHeader,
} from "./StudyLibraryStates";
import { StudySetCard } from "./StudySetCard";
import { SubjectCard } from "./SubjectCard";
import { useFeedback } from "@/lib/feedback/feedback-context";
import {
  isPathwayMatch,
  programIdForPathway,
} from "@/lib/study-library/curriculum-consolidation";

interface StudyLibraryViewProps {
  isPublic?: boolean;
  initialTrack?: string;
  initialCategory?: string;
}

const DEFAULT_ADVANCED: AdvancedFilterState = {
  school: "",
  academicYear: "",
  subject: "",
  season: "",
  examId: "",
  topic: "",
  difficulty: "",
  questionType: "",
  savedOnly: false,
  program: "",
  course: "",
};

const PAGE_SIZE = 100;

function getSubjectSortRank(title: string): number {
  const lower = title.toLowerCase();
  if (lower.includes("med-surg") || lower.includes("medical-surgical") || lower.includes("med surg") || lower.includes("medical surgical")) return 1;
  if (lower.includes("pediatric") || lower.includes("peds") || lower.includes("child")) return 2;
  if (lower.includes("mental health") || lower.includes("psych")) return 3;
  if (lower.includes("fundamental")) return 4;
  if (lower.includes("pharmacol") || lower.includes("dosage") || lower.includes("drug")) return 5;
  if (lower.includes("leadership") || lower.includes("management") || lower.includes("professional")) return 6;
  if (lower.includes("adult health")) return 7;
  if (lower.includes("health assessment") || lower.includes("assessment") || lower.includes("physical assessment")) return 8;
  if (lower.includes("maternal") || lower.includes("newborn") || lower.includes("obstetric") || lower.includes("maternity") || lower.includes("women")) return 9;
  return 10;
}

export function StudyLibraryView({
  isPublic = false,
  initialTrack,
  initialCategory,
}: StudyLibraryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryTrack = searchParams?.get("track") || initialTrack || "All";
  const queryCategory = searchParams?.get("category") || initialCategory || "All";

  const [pathway, setPathway] = React.useState<string>(queryTrack);
  const [category, setCategory] = React.useState<string>(queryCategory);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = React.useState<string>("All");
  const [exitFilter, setExitFilter] = React.useState<"All" | "ATI" | "HESI">("All");

  const [searchInput, setSearchInput] = React.useState(searchParams?.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchInput);
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>(() =>
    (searchParams?.get("subjectIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [selectedProgramId, setSelectedProgramId] = React.useState<string>(
    () => searchParams?.get("programId")?.trim() || ""
  );
  const [advanced, setAdvanced] = React.useState<AdvancedFilterState>({
    school: searchParams?.get("school") || "",
    academicYear: searchParams?.get("year") || "",
    subject: searchParams?.get("subject") || "",
    season: searchParams?.get("season") || "",
    examId: searchParams?.get("examId") || "",
    topic: searchParams?.get("topic") || "",
    difficulty: searchParams?.get("difficulty") || "",
    questionType: searchParams?.get("questionType") || "",
    savedOnly: searchParams?.get("saved") === "true",
    program: searchParams?.get("program") || "",
    course: searchParams?.get("course") || "",
  });
  const [pageNumber, setPageNumber] = React.useState<number>(
    Math.max(1, Number(searchParams?.get("page") || "1") || 1)
  );

  const [subjects, setSubjects] = React.useState<SubjectCardDto[]>([]);
  const [studySets, setStudySets] = React.useState<StudySetCardDto[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filtersData, setFiltersData] = React.useState<StudyLibraryFiltersDto | null>(null);
  const [filtersLoading, setFiltersLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<StudyLibrarySummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const hasLoadedOnceRef = React.useRef(false);
  const latestRequestIdRef = React.useRef(0);
  const selectedCardRef = React.useRef<SubjectCardDto | null>(null);
  const lastKnownUrlQsRef = React.useRef<string | null>(null);
  const { showSuccess, showError, showInfo } = useFeedback();

  const isExamView = Boolean(advanced.subject || advanced.examId || selectedSubjectIds.length > 0);
  const isInitialLoading = loading && !hasLoadedOnceRef.current;
  const isUpdating = loading && hasLoadedOnceRef.current;

  const { status, user } = useAuth();

  // STAGE 3 & 4: Authentication gate when accessing an individual subject's examinations
  React.useEffect(() => {
    if (isExamView && status === "unauthenticated") {
      const qs = searchParams?.toString();
      const currentUrl = qs ? `${pathname}?${qs}` : pathname;
      router.push(`/sign-in?returnTo=${encodeURIComponent(currentUrl)}`);
    }
  }, [isExamView, status, pathname, searchParams, router]);

  // Debounce search input
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== searchInput) {
          setPageNumber(1);
        }
        return searchInput;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Sync external URL navigation (e.g., browser Back/Forward, route changes) cleanly
  React.useEffect(() => {
    const currentQs = searchParams?.toString() ?? "";
    if (lastKnownUrlQsRef.current === null) {
      lastKnownUrlQsRef.current = currentQs;
      setPathway(queryTrack);
      setCategory(queryCategory);
      return;
    }
    if (currentQs === lastKnownUrlQsRef.current) {
      return;
    }
    lastKnownUrlQsRef.current = currentQs;
    setPathway(queryTrack);
    setCategory(queryCategory);
    const qSearch = searchParams?.get("q") || "";
    setSearchInput(qSearch);
    setDebouncedSearch(qSearch);
    setSelectedSubjectIds(
      (searchParams?.get("subjectIds") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setSelectedProgramId(searchParams?.get("programId")?.trim() || "");
    selectedCardRef.current = null;
    setAdvanced({
      school: searchParams?.get("school") || "",
      academicYear: searchParams?.get("year") || "",
      subject: searchParams?.get("subject") || "",
      season: searchParams?.get("season") || "",
      examId: searchParams?.get("examId") || "",
      topic: searchParams?.get("topic") || "",
      difficulty: searchParams?.get("difficulty") || "",
      questionType: searchParams?.get("questionType") || "",
      savedOnly: searchParams?.get("saved") === "true",
      program: searchParams?.get("program") || "",
      course: searchParams?.get("course") || "",
    });
    setPageNumber(Math.max(1, Number(searchParams?.get("page") || "1") || 1));
  }, [searchParams, queryTrack, queryCategory]);

  // Fetch data-driven filters & live catalog summary once
  React.useEffect(() => {
    let active = true;
    setFiltersLoading(true);
    void Promise.all([
      nurviaApi.getStudyLibraryFilters(),
      nurviaApi.getStudyLibrarySummary(),
    ]).then(([filtersRes, summaryRes]) => {
      if (!active) return;
      if (filtersRes.success && filtersRes.data) {
        setFiltersData(filtersRes.data);
      }
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      setFiltersLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync URL query params from committed filter/navigation state
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (pathway !== "All") {
      params.set("track", pathway);
    } else if (initialTrack && initialTrack !== "All") {
      params.set("track", "All");
    }
    if (category !== "All") params.set("category", category);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (advanced.school) params.set("school", advanced.school);
    if (advanced.academicYear) params.set("year", advanced.academicYear);
    if (advanced.subject) params.set("subject", advanced.subject);
    if (selectedProgramId) params.set("programId", selectedProgramId);
    if (selectedSubjectIds.length > 0) params.set("subjectIds", selectedSubjectIds.join(","));
    if (advanced.season) params.set("season", advanced.season);
    if (advanced.examId) params.set("examId", advanced.examId);
    if (advanced.topic) params.set("topic", advanced.topic);
    if (advanced.difficulty) params.set("difficulty", advanced.difficulty);
    if (advanced.questionType) params.set("questionType", advanced.questionType);
    if (advanced.savedOnly) params.set("saved", "true");
    if (advanced.program) params.set("program", advanced.program);
    if (advanced.course) params.set("course", advanced.course);
    if (pageNumber > 1) params.set("page", String(pageNumber));

    const qs = params.toString();
    if (lastKnownUrlQsRef.current === qs) {
      return;
    }
    lastKnownUrlQsRef.current = qs;
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [
    pathname,
    router,
    pathway,
    category,
    debouncedSearch,
    advanced,
    selectedProgramId,
    selectedSubjectIds,
    pageNumber,
    initialTrack,
  ]);

  // Fetch paginated subjects (subject-first catalogue) or examinations
  React.useEffect(() => {
    let active = true;
    const currentRequestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    const queryParams = {
      pathway: pathway === "All" ? undefined : pathway,
      category: category === "All" ? undefined : category,
      searchTerm: debouncedSearch.trim() || undefined,
      school: advanced.school || undefined,
      academicYear: advanced.academicYear ? Number(advanced.academicYear) : undefined,
      subject: advanced.subject || undefined,
      subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds.join(",") : undefined,
      programId: selectedProgramId || undefined,
      season: advanced.season || undefined,
      examId: advanced.examId || undefined,
      topic: advanced.topic || undefined,
      difficulty: advanced.difficulty || undefined,
      questionType: advanced.questionType || undefined,
      savedOnly: advanced.savedOnly || undefined,
      program: advanced.program || undefined,
      course: advanced.course || undefined,
      pageNumber,
      pageSize: PAGE_SIZE,
    };

    if (isExamView) {
      void nurviaApi
        .getStudyLibrary(queryParams)
        .then((response) => {
          if (!active || currentRequestId !== latestRequestIdRef.current) return;
          if (!response.success || !response.data) {
            setError(response.message || "Unable to load examinations for this subject.");
          } else {
            const items = response.data.items || [];
            const sorted = [...items].sort((a, b) => {
              const aExit = isExitExam(a);
              const bExit = isExitExam(b);
              if (aExit && bExit) {
                return compareExitExams(a, b);
              }
              if (aExit && !bExit) return 1;
              if (!aExit && bExit) return -1;
              return String(a.title ?? '').localeCompare(String(b.title ?? ''));
            });
            setStudySets(sorted);
            setTotalCount(response.data.totalCount);
            setTotalPages(Math.max(1, response.data.totalPages || Math.ceil(response.data.totalCount / PAGE_SIZE)));
            hasLoadedOnceRef.current = true;
          }
          setLoading(false);
        });
    } else {
      void nurviaApi
        .getStudyLibrarySubjects(queryParams)
        .then((response) => {
          if (!active || currentRequestId !== latestRequestIdRef.current) return;
          if (!response.success || !response.data) {
            setError(response.message || "Unable to load published subjects.");
          } else {
            const sorted = [...response.data.items].sort((a, b) => {
              const rankA = getSubjectSortRank(a.title);
              const rankB = getSubjectSortRank(b.title);
              if (rankA !== rankB) return rankA - rankB;
              return a.title.localeCompare(b.title);
            });
            setSubjects(sorted);
            setTotalCount(response.data.totalCount);
            setTotalPages(Math.max(1, response.data.totalPages || Math.ceil(response.data.totalCount / PAGE_SIZE)));
            hasLoadedOnceRef.current = true;
          }
          setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [pathway, category, debouncedSearch, advanced, selectedSubjectIds, selectedProgramId, pageNumber, retryCount, isExamView]);

  const handleToggleSave = async (studySet: StudySetCardDto) => {
    const nextSaved = !studySet.isSaved;
    setStudySets((prev) =>
      prev.map((item) => (item.id === studySet.id ? { ...item, isSaved: nextSaved } : item))
    );

    const res = nextSaved
      ? await nurviaApi.saveStudySet(studySet.id)
      : await nurviaApi.removeSavedStudySet(studySet.id);

    if (!res.success) {
      setStudySets((prev) =>
        prev.map((item) => (item.id === studySet.id ? { ...item, isSaved: !nextSaved } : item))
      );
      showError(res.message || "Could not update your personal library.");
      return;
    }

    showSuccess(nextSaved ? "Saved to My Library." : "Removed from My Library.");
  };

  const handleClearAllFilters = () => {
    selectedCardRef.current = null;
    setSelectedSubjectFilter("All");
    setExitFilter("All");
    setPathway("All");
    setCategory("All");
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedSubjectIds([]);
    setSelectedProgramId("");
    setAdvanced({
      ...DEFAULT_ADVANCED,
      program: "",
      course: "",
    });
    setPageNumber(1);
  };

  const handleBackToSubjectCatalogue = () => {
    // Subject Catalogue / Back to Subject Catalogue breadcrumb return flow
    selectedCardRef.current = null;
    setSelectedSubjectIds([]);
    setSelectedProgramId("");
    setSelectedSubjectFilter("All");
    setExitFilter("All");
    setAdvanced((prev) => ({ ...prev, subject: "", examId: "", course: "" }));
    setCategory("All");
    setPageNumber(1);
  };

  const handleSelectPathway = (next: string) => {
    setPathway(next);
    setSelectedSubjectFilter("All");
    setExitFilter("All");
    const isNextLpn = next === "PN_LPN" || next === "PN_Exit" || next === "LPN";
    const validCats = isNextLpn ? (LPN_EXAM_BODY_CATEGORIES as readonly string[]) : (RN_EXAM_BODY_CATEGORIES as readonly string[]);
    if (category !== "All" && !validCats.includes(category)) {
      setCategory("All");
    }
    if (isExamView) {
      const activeCard =
        selectedCardRef.current ??
        subjects.find((s) => s.title === advanced.subject) ??
        null;
      if (next === "All") {
        selectedCardRef.current = null;
        setSelectedSubjectIds([]);
        setSelectedProgramId("");
        setAdvanced((prev) => ({ ...prev, subject: "", examId: "" }));
      } else if (activeCard) {
        const candidateSources = [
          ...(activeCard.sourceSubjects?.rn ?? []),
          ...(activeCard.sourceSubjects?.lpn ?? []),
        ].filter((src) => isPathwayMatch(src.pathway, next));
        if (candidateSources.length > 0) {
          const nextProgId = candidateSources[0].programId;
          const nextIds = candidateSources
            .map((s) => s.subjectGuidId ?? s.subjectId)
            .filter(Boolean);
          setSelectedProgramId(String(nextProgId));
          setSelectedSubjectIds(nextIds);
          setAdvanced((prev) => ({ ...prev, examId: "" }));
        } else {
          selectedCardRef.current = null;
          setSelectedSubjectIds([]);
          setSelectedProgramId("");
          setAdvanced((prev) => ({ ...prev, subject: "", examId: "" }));
        }
      } else {
        const nextProgId = programIdForPathway(next);
        setSelectedSubjectIds([]);
        setSelectedProgramId(nextProgId ? String(nextProgId) : "");
        setAdvanced((prev) => ({ ...prev, examId: "" }));
      }
    } else if (advanced.examId) {
      const selectedExam = filtersData?.exams.find((e) => e.id === advanced.examId);
      if (!selectedExam || (next !== "All" && !isPathwayMatch(String(selectedExam.pathway ?? ""), next))) {
        setAdvanced((prev) => ({ ...prev, examId: "" }));
      }
    }
    setPageNumber(1);
  };

  const isExitSubject = (s: SubjectCardDto) => isExitExam(s);

  const regularSubjects = React.useMemo(() => {
    return subjects.filter((s) => !isExitSubject(s));
  }, [subjects]);

  const exitSubjects = React.useMemo(() => {
    return subjects.filter((s) => isExitSubject(s)).sort(compareExitExams);
  }, [subjects]);

  // Dynamic Subject Filters for the active pathway
  const availableSubjectFilters = React.useMemo(() => {
    const isRn = pathway === "RN" || pathway === "RN_Exit";
    const isLpn = pathway === "PN_LPN" || pathway === "PN_Exit";

    let list: string[] = [];
    if (isRn && filtersData?.rnSubjects && filtersData.rnSubjects.length > 0) {
      list = filtersData.rnSubjects;
    } else if (isLpn && filtersData?.lpnSubjects && filtersData.lpnSubjects.length > 0) {
      list = filtersData.lpnSubjects;
    } else if (filtersData?.subjects && filtersData.subjects.length > 0) {
      list = filtersData.subjects;
    } else {
      list = regularSubjects.map((s) => s.title);
    }

    const unique = Array.from(new Set(list.filter(Boolean)));
    return ["All Subjects", ...unique];
  }, [pathway, filtersData, regularSubjects]);

  const visibleRegularSubjects = React.useMemo(() => {
    if (selectedSubjectFilter === "All Subjects" || selectedSubjectFilter === "All") {
      return regularSubjects;
    }
    const target = selectedSubjectFilter.toLowerCase();
    return regularSubjects.filter((s) =>
      s.title.toLowerCase() === target || s.title.toLowerCase().includes(target)
    );
  }, [regularSubjects, selectedSubjectFilter]);

  const visibleExitSubjects = React.useMemo(() => {
    return exitSubjects.filter((s) => {
      if (exitFilter === "All") return true;
      if (exitFilter === "ATI") return isAtiBody(s) && !isHesiBody(s);
      if (exitFilter === "HESI") return isHesiBody(s) && !isAtiBody(s);
      return true;
    });
  }, [exitSubjects, exitFilter]);

  const hasActiveFilters =
    pathway !== "All" ||
    category !== "All" ||
    debouncedSearch.trim().length > 0 ||
    selectedSubjectFilter !== "All" ||
    exitFilter !== "All" ||
    selectedSubjectIds.length > 0 ||
    Boolean(selectedProgramId) ||
    Object.values(advanced).some(Boolean);

  const pathwayOptions = ["All", "RN", "PN_LPN", "RN_Exit", "PN_Exit"];

  return (
    <div className="space-y-4">
      {/* 1. Header with Compact Search on Desktop Right / Mobile Stacked */}
      <StudyLibraryHeader
        isPublic={isPublic}
        summary={summary}
        selectedPathway={pathway}
        selectedSubject={advanced.subject}
        onBackToCatalogue={handleBackToSubjectCatalogue}
        searchSlot={
          <StudyLibrarySearch
            value={searchInput}
            onChange={setSearchInput}
            isSearching={loading && searchInput !== debouncedSearch}
            placeholder={isExamView ? "Search examinations..." : "Search subjects, exams, or keywords..."}
          />
        }
      />

      {/* Unauthenticated redirect state */}
      {isExamView && status === "unauthenticated" && (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Sign-in required to view examinations for this subject.
          </p>
          <p className="text-xs text-foreground-secondary">
            Redirecting to sign-in portal...
          </p>
        </div>
      )}

      {/* Authenticated but unverified state */}
      {isExamView && status === "authenticated" && user?.emailVerified === false && (
        <div className="py-16 text-center space-y-4 rounded-2xl border border-clinical-teal/30 bg-surface p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-mist text-clinical-teal">
            <Mail className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="font-brand text-xl font-bold text-foreground">
              Email Verification Required
            </h2>
            <p className="text-sm text-foreground-secondary max-w-md mx-auto">
              Progress is built one step at a time. A small confirmation today brings you closer to the future you&apos;re working towards. Please complete email verification to access examinations in {advanced.subject || "this subject"}.
            </p>
          </div>
          <LearnerVerificationModal isOpen={true} returnTo={searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname} />
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SUBJECT LIBRARY VIEW (/learner/library)                      */}
      {/* ============================================================== */}
      {!isExamView && (
        <div className="space-y-3.5">
          {/* A. Pathway Filters — Directly below Subject Library Heading (Visible Chips, Not a Dropdown) */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Available pathway filters">
            {pathwayOptions.map((pathOption) => {
              const isActive = pathway === pathOption;
              const label = PATHWAY_LABELS[pathOption] ?? pathOption.replace("_", " ");
              return (
                <button
                  key={pathOption}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelectPathway(pathOption)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border shadow-2xs",
                    isActive
                      ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                      : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* B. Result Count — Directly below Pathway Filters */}
          {!isInitialLoading && !error && (
            <StudyLibraryResultsHeader
              shownCount={visibleRegularSubjects.length}
              totalCount={regularSubjects.length}
              pageNumber={pageNumber}
              totalPages={totalPages}
              itemLabel="published subject"
              isUpdating={isUpdating}
            />
          )}

          {/* C. Subject Filters — Directly below Result Count (Single-line Horizontal Scrolling Filter Strip) */}
          <div
            className="w-full min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-smooth subject-filter-scrollbar pb-2.5 pt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-teal/40"
            role="tablist"
            tabIndex={0}
            aria-label="Available subject filters"
          >
            {availableSubjectFilters.map((subName) => {
              const isActive =
                (subName === "All Subjects" && selectedSubjectFilter === "All") ||
                selectedSubjectFilter === subName;
              return (
                <button
                  key={subName}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setSelectedSubjectFilter(subName === "All Subjects" ? "All" : subName);
                    setPageNumber(1);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-all border shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                    isActive
                      ? "bg-brand-teal/15 text-brand-tealDark dark:text-teal-200 border-brand-teal/40 font-semibold shadow-2xs"
                      : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {simplifySubjectName(subName)}
                </button>
              );
            })}
          </div>

          {/* Loading, Error, Empty & Regular Subjects Grid */}
          {isInitialLoading && <StudyLibraryLoadingState />}

          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && visibleRegularSubjects.length === 0 && exitSubjects.length === 0 && (
            <StudyLibraryEmptyState
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearAllFilters}
              itemLabel="subjects"
            />
          )}

          {!isInitialLoading && !error && visibleRegularSubjects.length > 0 && (
            <div className={cn("grid gap-2.5 sm:gap-3.5 grid-cols-2 xl:grid-cols-3 transition-opacity duration-200", isUpdating && "opacity-60 pointer-events-none")}>
              {visibleRegularSubjects.map((subject) => (
                <SubjectCard
                  key={subject.presentationId ?? subject.id}
                  subject={subject}
                  isPublic={isPublic}
                  activePathway={pathway}
                  onSelectSubjectSource={(selection) => {
                    selectedCardRef.current = selection.card;
                    setPathway(selection.pathway);
                    setSelectedProgramId(String(selection.programId));
                    setSelectedSubjectIds(selection.subjectIds);
                    setAdvanced((prev) => ({
                      ...prev,
                      subject: selection.subjectName,
                      examId: selection.examId ?? "",
                    }));
                    setPageNumber(1);
                  }}
                  onSelectSubject={(subjectName, selectedPathway) => {
                    if (selectedPathway) {
                      setPathway(selectedPathway);
                      const pid = programIdForPathway(selectedPathway);
                      setSelectedProgramId(pid ? String(pid) : "");
                    }
                    setSelectedSubjectIds([]);
                    setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
                    setPageNumber(1);
                  }}
                />
              ))}
            </div>
          )}

          {/* D. All Exit Exams Section — Positioned below regular RN & LPN subjects */}
          {!isInitialLoading && !error && exitSubjects.length > 0 && (
            <div className="pt-6 border-t border-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h2 className="font-brand text-lg sm:text-xl font-bold text-foreground">
                    All Exit Exams
                  </h2>
                  <p className="text-xs text-foreground-secondary">
                    Comprehensive exit predictor and readiness examinations for RN and LPN nursing candidates.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Exit examination provider filters">
                  <button
                    type="button"
                    aria-pressed={exitFilter === "All"}
                    onClick={() => {
                      setExitFilter("All");
                      setPageNumber(1);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                      exitFilter === "All"
                        ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                        : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    aria-pressed={exitFilter === "ATI"}
                    onClick={() => {
                      setExitFilter((prev) => (prev === "ATI" ? "All" : "ATI"));
                      setPageNumber(1);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                      exitFilter === "ATI"
                        ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                        : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    ATI
                  </button>
                  <button
                    type="button"
                    aria-pressed={exitFilter === "HESI"}
                    onClick={() => {
                      setExitFilter((prev) => (prev === "HESI" ? "All" : "HESI"));
                      setPageNumber(1);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                      exitFilter === "HESI"
                        ? "bg-brand-teal text-white border-brand-teal shadow-xs font-bold"
                        : "bg-surface text-foreground-secondary border-border hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    HESI
                  </button>
                </div>
              </div>

              <p className="text-xs text-foreground-muted">
                Showing <span className="font-semibold text-foreground">{visibleExitSubjects.length}</span> of{" "}
                <span className="font-semibold text-foreground">{exitSubjects.length}</span> exit examinations
              </p>

              {visibleExitSubjects.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-6 text-center text-xs text-foreground-secondary">
                  No exit examinations match the current filter.
                </div>
              ) : (
                <div className="grid gap-2.5 sm:gap-3.5 grid-cols-2 xl:grid-cols-3">
                  {visibleExitSubjects.map((subject) => (
                    <SubjectCard
                      key={subject.presentationId ?? subject.id}
                      subject={subject}
                      isPublic={isPublic}
                      activePathway={pathway}
                      onSelectSubjectSource={(selection) => {
                        selectedCardRef.current = selection.card;
                        setPathway(selection.pathway);
                        setSelectedProgramId(String(selection.programId));
                        setSelectedSubjectIds(selection.subjectIds);
                        setAdvanced((prev) => ({
                          ...prev,
                          subject: selection.subjectName,
                          examId: selection.examId ?? "",
                        }));
                        setPageNumber(1);
                      }}
                      onSelectSubject={(subjectName, selectedPathway) => {
                        if (selectedPathway) {
                          setPathway(selectedPathway);
                          const pid = programIdForPathway(selectedPathway);
                          setSelectedProgramId(pid ? String(pid) : "");
                        }
                        setSelectedSubjectIds([]);
                        setAdvanced((prev) => ({ ...prev, subject: subjectName, examId: "" }));
                        setPageNumber(1);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. EXAMINATION LIBRARY VIEW (/learner/library?track=...&subject=...) */}
      {/* ============================================================== */}
      {isExamView && (!user || user?.emailVerified !== false) && (
        <div className="space-y-3.5">
          {/* A. Examination Result Count — Directly below Header Area */}
          {!isInitialLoading && !error && (
            <StudyLibraryResultsHeader
              shownCount={studySets.length}
              totalCount={totalCount}
              pageNumber={pageNumber}
              totalPages={totalPages}
              itemLabel="examination"
              isUpdating={isUpdating}
            />
          )}

          {/* B. Exam Bodies Filters — Directly below Result Count (Inline Chips, Not a Dropdown) */}
          <StudyLibraryCategoryTabs
            isExamView={true}
            selectedPathway={pathway}
            selectedCategory={category}
            selectedSubject={advanced.subject}
            selectedCourse={advanced.course}
            availablePathways={filtersData?.pathways ?? []}
            availableCategories={filtersData?.categories ?? []}
            availableSubjects={filtersData?.subjects ?? []}
            rnSubjects={filtersData?.rnSubjects ?? []}
            lpnSubjects={filtersData?.lpnSubjects ?? []}
            courses={filtersData?.courses}
            onSelectPathway={handleSelectPathway}
            onSelectCategory={(nextCat) => {
              setCategory(nextCat);
              setPageNumber(1);
            }}
            onSelectCourse={(nextCourse) => {
              setAdvanced((prev) => ({ ...prev, course: nextCourse }));
              setPageNumber(1);
            }}
            onSelectSubject={(nextSub) => {
              if (!nextSub || nextSub === "All") {
                handleBackToSubjectCatalogue();
                return;
              }
              setAdvanced((prev) => ({ ...prev, subject: nextSub, examId: "" }));
              setPageNumber(1);
            }}
          />

          {isInitialLoading && <StudyLibraryLoadingState />}

          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && studySets.length === 0 && (
            <StudyLibraryEmptyState
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearAllFilters}
              itemLabel="examinations"
            />
          )}

          {!isInitialLoading && !error && studySets.length > 0 && (
            <>
              <div className={cn("grid gap-2.5 sm:gap-3.5 grid-cols-2 xl:grid-cols-3 transition-opacity duration-200", isUpdating && "opacity-60 pointer-events-none")}>
                {studySets.map((studySet) => (
                  <StudySetCard
                    key={studySet.id}
                    studySet={studySet}
                    isPublic={isPublic}
                    onToggleSave={handleToggleSave}
                    onNotify={(msg) => showInfo(msg)}
                  />
                ))}
              </div>

              <StudyLibraryPagination
                pageNumber={pageNumber}
                totalPages={totalPages}
                onPageChange={setPageNumber}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
