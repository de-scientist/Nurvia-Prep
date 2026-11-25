"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nurviaApi } from "@/lib/api-client";
import type {
  StudyLibraryFiltersDto,
  StudyLibrarySummaryDto,
  StudySetCardDto,
  SubjectCardDto,
} from "@/lib/api-types";
import {
  StudyLibraryAdvancedFilters,
  type AdvancedFilterState,
} from "./StudyLibraryAdvancedFilters";
import { StudyLibraryCategoryTabs } from "./StudyLibraryCategoryTabs";
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
            setStudySets(response.data.items);
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

  const hasActiveFilters =
    pathway !== "All" ||
    category !== "All" ||
    debouncedSearch.trim().length > 0 ||
    selectedSubjectIds.length > 0 ||
    Boolean(selectedProgramId) ||
    Object.values(advanced).some(Boolean);

  return (
    <div className="space-y-6">
      <StudyLibraryHeader isPublic={isPublic} summary={summary} selectedPathway={pathway} selectedSubject={advanced.subject} />

      <StudyLibrarySearch
        value={searchInput}
        onChange={setSearchInput}
        isSearching={loading && searchInput !== debouncedSearch}
      />

      <StudyLibraryCategoryTabs
        selectedPathway={pathway}
        selectedCategory={category}
        availablePathways={filtersData?.pathways ?? []}
        availableCategories={filtersData?.categories ?? []}
        onSelectPathway={(next) => {
          setPathway(next);
          if (category === "ExitPredictor" && next !== "All" && next !== "RN_Exit" && next !== "PN_Exit") {
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
        }}
        onSelectCategory={(next) => {
          setCategory(next);
          if (advanced.examId) {
            const selectedExam = filtersData?.exams.find((e) => e.id === advanced.examId);
            if (!selectedExam || (next !== "All" && String(selectedExam.category ?? "").toLowerCase() !== next.toLowerCase())) {
              setAdvanced((prev) => ({ ...prev, examId: "" }));
            }
          }
          setPageNumber(1);
        }}
      />

      <StudyLibraryAdvancedFilters
        filtersData={filtersData}
        filtersLoading={filtersLoading}
        selectedPathway={pathway}
        selectedCategory={category}
        value={advanced}
        isPublic={isPublic}
        onChange={(patch) => {
          if ("program" in patch || "course" in patch || "subject" in patch) {
            selectedCardRef.current = null;
            setSelectedSubjectIds([]);
            setSelectedProgramId("");
          }
          setAdvanced((prev) => {
            const next = { ...prev, ...patch };
            // Cascading: clear downstream filters when upstream changes
            // Hierarchy: GLOBAL -> PROGRAM -> COURSE -> SUBJECT -> YEAR -> SEASON -> SCHOOL -> EXAM
            if ("program" in patch && patch.program !== prev.program) {
              next.course = "";
              next.subject = "";
              next.academicYear = "";
              next.season = "";
              next.school = "";
              next.topic = "";
              next.examId = "";
            } else if ("course" in patch && patch.course !== prev.course) {
              next.subject = "";
              next.academicYear = "";
              next.season = "";
              next.school = "";
              next.topic = "";
              next.examId = "";
            } else if ("subject" in patch && patch.subject !== prev.subject) {
              next.academicYear = "";
              next.season = "";
              next.school = "";
              next.topic = "";
              next.examId = "";
            } else if ("academicYear" in patch && patch.academicYear !== prev.academicYear) {
              next.season = "";
              next.school = "";
              next.topic = "";
              next.examId = "";
            } else if ("season" in patch && patch.season !== prev.season) {
              next.school = "";
              next.topic = "";
              next.examId = "";
            } else if ("school" in patch && patch.school !== prev.school) {
              next.examId = "";
            }
            return next;
          });
          setPageNumber(1);
        }}
        onClearAll={handleClearAllFilters}
      />

      {/* Subject-to-Examination Breadcrumb Context Banner */}
      {isExamView && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-teal/30 bg-surface p-4 shadow-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs text-foreground-muted">
              <button
                type="button"
                onClick={() => {
                  selectedCardRef.current = null;
                  setSelectedSubjectIds([]);
                  setSelectedProgramId("");
                  setAdvanced((prev) => ({ ...prev, subject: "", examId: "" }));
                  setPageNumber(1);
                }}
                className="font-medium hover:text-brand-teal hover:underline flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Subject Catalogue
              </button>
              <span>/</span>
              <span className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                {advanced.subject || "Selected Examination"}
              </span>
            </div>
            <h2 className="font-brand text-lg font-bold text-foreground">
              {advanced.subject ? `Examinations in ${advanced.subject}` : "Examination Practice Sets"}
            </h2>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              selectedCardRef.current = null;
              setSelectedSubjectIds([]);
              setSelectedProgramId("");
              setAdvanced((prev) => ({ ...prev, subject: "", examId: "" }));
              setPageNumber(1);
            }}
            className="rounded-lg"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4 text-brand-teal" />
            Back to Subject Catalogue
          </Button>
        </div>
      )}

      {!isInitialLoading && !error && (
        <StudyLibraryResultsHeader
          shownCount={isExamView ? studySets.length : subjects.length}
          totalCount={totalCount}
          pageNumber={pageNumber}
          totalPages={totalPages}
          itemLabel={isExamView ? "examination" : "subject"}
          isUpdating={isUpdating}
        />
      )}

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

      {!loading && !error && isExamView && studySets.length === 0 && (
        <StudyLibraryEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAllFilters}
          itemLabel="examinations"
        />
      )}

      {!loading && !error && !isExamView && subjects.length === 0 && (
        <StudyLibraryEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAllFilters}
          itemLabel="subjects"
        />
      )}

      {!isInitialLoading && !error && isExamView && studySets.length > 0 && (
        <>
          <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition-opacity duration-200", isUpdating && "opacity-60 pointer-events-none")}>
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

      {!isInitialLoading && !error && !isExamView && subjects.length > 0 && (
        <>
          <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition-opacity duration-200", isUpdating && "opacity-60 pointer-events-none")}>
            {subjects.map((subject) => (
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

          <StudyLibraryPagination
            pageNumber={pageNumber}
            totalPages={totalPages}
            onPageChange={setPageNumber}
          />
        </>
      )}
    </div>
  );
}
