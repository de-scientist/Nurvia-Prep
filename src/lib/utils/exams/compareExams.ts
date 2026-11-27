export interface ExamSortable {
  id?: number | string | null;
  order?: string | number | null;
  createdAt?: string | Date | null;
  season?: string | null;
}

const SEASON_RANK: Record<string, number> = { fall: 0, spring: 1, summer: 2, winter: 3 };

export const parseExamOrder = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 1) Backend "order" (ascending) when provided
// 2) No order → createdAt newest first
// 3) Tie → season (Fall, Spring, Summer, Winter) → id desc
export function compareExams<T extends ExamSortable>(
  a: T,
  b: T,
  getSeason?: (e: T) => string | null | undefined
): number {
  const oa = parseExamOrder(a.order);
  const ob = parseExamOrder(b.order);

  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;

  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const timeA = Number.isNaN(ta) ? 0 : ta;
  const timeB = Number.isNaN(tb) ? 0 : tb;
  if (timeA !== timeB) return timeB - timeA;

  const sa = SEASON_RANK[String((getSeason ? getSeason(a) : a.season) ?? "").toLowerCase()] ?? 99;
  const sb = SEASON_RANK[String((getSeason ? getSeason(b) : b.season) ?? "").toLowerCase()] ?? 99;
  if (sa !== sb) return sa - sb;

  return (Number(b.id) || 0) - (Number(a.id) || 0);
}

/**
 * Extracts the authoritative academic year for an examination.
 * Rules:
 * 5. Uses the authoritative academic-year field from the existing exam data model.
 * 6. Does not infer academic year from creation date or arbitrary title parsing when a dedicated field exists.
 * 7. Missing academic-year values return 0 so they sort to the end without preceding dated records.
 */
export function extractExamYear(item: {
  academicYear?: number | string | null;
  year?: number | string | null;
  title?: string | null;
}): number {
  const hasAcademicYear = "academicYear" in item;
  const hasYear = "year" in item;

  if (hasAcademicYear || hasYear) {
    const raw =
      item.academicYear !== undefined && item.academicYear !== null
        ? item.academicYear
        : item.year;

    if (typeof raw === "number" && Number.isFinite(raw) && raw > 1900 && raw < 2100) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim() !== "") {
      const num = Number(raw.trim());
      if (Number.isFinite(num) && num > 1900 && num < 2100) {
        return num;
      }
      // Support ranges like "2025/2026" or "2025-2026" in the dedicated year field
      const matches = Array.from(raw.matchAll(/\b(20\d\d)\b/g)).map((m) => Number(m[1]));
      if (matches.length > 0) {
        return Math.max(...matches);
      }
    }
    // Dedicated field exists on item but has missing/null/empty value:
    // Do not infer from title or creation date.
    return 0;
  }

  // Only fallback to title regex if no dedicated academic-year field exists on the object
  if (item.title) {
    const m = String(item.title).match(/\b(20\d\d)\b/);
    if (m) {
      const y = Number(m[1]);
      if (Number.isFinite(y) && y > 1900 && y < 2100) return y;
    }
  }
  return 0;
}

export interface ExamBodyItem {
  title?: string | null;
  name?: string | null;
  courseName?: string | null;
  category?: string | null;
  school?: string | null;
  provider?: string | null;
  examBody?: string | null;
  courseSeries?: string | null;
  sourceSubjects?: {
    rn?: Array<{ courseSeries?: string | null; courseName?: string | null; rawName?: string | null }>;
    lpn?: Array<{ courseSeries?: string | null; courseName?: string | null; rawName?: string | null }>;
  };
}

export function isAtiBody(item: ExamBodyItem): boolean {
  if (item.category === "ATI") return true;
  if (item.category === "HESI") return false;

  const directProvider = String(item.provider ?? item.examBody ?? "").trim();
  if (/\bati\b/i.test(directProvider)) return true;
  if (/\bhesi\b/i.test(directProvider)) return false;

  if (item.courseSeries === "ATI" || item.courseSeries === "ATI_EXIT") return true;
  if (item.courseSeries === "HESI" || item.courseSeries === "HESI_EXIT") return false;

  const sources = [
    ...(item.sourceSubjects?.rn ?? []),
    ...(item.sourceSubjects?.lpn ?? []),
  ];
  for (const s of sources) {
    if (s.courseSeries === "ATI" || s.courseSeries === "ATI_EXIT") return true;
    if (s.courseSeries === "HESI" || s.courseSeries === "HESI_EXIT") return false;
    if (/\bati\b/i.test(`${s.courseName ?? ""} ${s.rawName ?? ""}`)) return true;
    if (/\bhesi\b/i.test(`${s.courseName ?? ""} ${s.rawName ?? ""}`)) return false;
  }

  const text = `${item.category ?? ""} ${item.courseName ?? ""} ${item.school ?? ""} ${item.title ?? ""} ${item.name ?? ""}`;
  return /\bati\b/i.test(text);
}

export function isHesiBody(item: ExamBodyItem): boolean {
  if (item.category === "HESI") return true;
  if (item.category === "ATI") return false;

  const directProvider = String(item.provider ?? item.examBody ?? "").trim();
  if (/\bhesi\b/i.test(directProvider)) return true;
  if (/\bati\b/i.test(directProvider)) return false;

  if (item.courseSeries === "HESI" || item.courseSeries === "HESI_EXIT") return true;
  if (item.courseSeries === "ATI" || item.courseSeries === "ATI_EXIT") return false;

  const sources = [
    ...(item.sourceSubjects?.rn ?? []),
    ...(item.sourceSubjects?.lpn ?? []),
  ];
  for (const s of sources) {
    if (s.courseSeries === "HESI" || s.courseSeries === "HESI_EXIT") return true;
    if (s.courseSeries === "ATI" || s.courseSeries === "ATI_EXIT") return false;
    if (/\bhesi\b/i.test(`${s.courseName ?? ""} ${s.rawName ?? ""}`)) return true;
    if (/\bati\b/i.test(`${s.courseName ?? ""} ${s.rawName ?? ""}`)) return false;
  }

  const text = `${item.category ?? ""} ${item.courseName ?? ""} ${item.school ?? ""} ${item.title ?? ""} ${item.name ?? ""}`;
  return /\bhesi\b/i.test(text);
}

export function isExitExam(item: { title?: string | null; courseName?: string | null; category?: string | null; pathway?: string | null }): boolean {
  const pathway = String(item.pathway ?? "");
  if (pathway === "RN_Exit" || pathway === "PN_Exit") return true;
  if (item.category === "ExitPredictor") return true;
  const text = `${item.courseName ?? ""} ${item.title ?? ""}`;
  // Explicitly protect Capstone: Capstone is an ordinary subject, never an Exit exam
  if (/\bcapstone\b/i.test(text)) return false;
  return /\b(exit|predictor)\b/i.test(text);
}

/**
 * Compares two Exit examinations:
 * 1. Provider priority is fixed: ATI before HESI. All ATI records precede every HESI record, regardless of year.
 * 2. Within each provider, sort by academic year in descending order (2026, 2025, 2024, 2023).
 * 3. Missing academic-year values consistently sort after dated records.
 * 4. Preserve existing secondary ordering for exams within same provider and academic year:
 *    - order field (ascending)
 *    - title (alphabetical ascending)
 *    - season (fall, spring, summer, winter)
 *    - deterministic ID tie-breaker
 */
export function compareExitExams<
  T extends {
    id?: number | string | null;
    title?: string | null;
    academicYear?: number | string | null;
    year?: number | string | null;
    courseName?: string | null;
    category?: string | null;
    pathway?: string | null;
    order?: string | number | null;
    createdAt?: string | Date | null;
    season?: string | null;
    provider?: string | null;
    examBody?: string | null;
    courseSeries?: string | null;
  }
>(a: T, b: T): number {
  const aIsAti = isAtiBody(a);
  const bIsAti = isAtiBody(b);

  // 1. Fixed provider priority: All ATI Exit examinations appear before HESI Exit examinations
  if (aIsAti && !bIsAti) return -1;
  if (!aIsAti && bIsAti) return 1;

  const aIsHesi = isHesiBody(a);
  const bIsHesi = isHesiBody(b);
  if (aIsHesi && !bIsHesi) return -1;
  if (!aIsHesi && bIsHesi) return 1;

  // 2. Descending chronological ordering by academic year (2026, 2025, 2024, 2023)
  // Missing academic years (0) consistently sort to the end without preceding dated records
  const yearA = extractExamYear(a);
  const yearB = extractExamYear(b);
  if (yearA !== yearB) {
    return yearB - yearA;
  }

  // 3. Preserve secondary ordering within the same provider and academic year
  // A) Explicit order ascending when provided
  const oa = parseExamOrder(a.order);
  const ob = parseExamOrder(b.order);
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;

  // B) Title alphabetical ascending
  const titleA = String(a.title ?? "");
  const titleB = String(b.title ?? "");
  const tDiff = titleA.localeCompare(titleB);
  if (tDiff !== 0) return tDiff;

  // C) Season ranking
  const sa = SEASON_RANK[String(a.season ?? "").toLowerCase()] ?? 99;
  const sb = SEASON_RANK[String(b.season ?? "").toLowerCase()] ?? 99;
  if (sa !== sb) return sa - sb;

  // D) Deterministic ID tie-breaker
  const numA = Number(a.id);
  const numB = Number(b.id);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
    return numB - numA;
  }
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/**
 * Sorts exit exams strictly by provider (ATI before HESI), then descending academic year,
 * with deterministic secondary ordering.
 */
export function sortExitExams<
  T extends ExamBodyItem & {
    academicYear?: number | string | null;
    year?: number | string | null;
    title?: string | null;
    id?: number | string | null;
  }
>(exams: T[]): T[] {
  return [...exams].sort(compareExitExams);
}

/**
 * Filters exit exams by provider:
 * - "ATI": displays ATI exams only
 * - "HESI": displays HESI exams only
 * - "All": displays all exit exams
 */
export function filterExitExams<T extends ExamBodyItem>(
  exams: T[],
  filter: "All" | "ATI" | "HESI"
): T[] {
  if (filter === "ATI") return exams.filter((e) => isAtiBody(e) && !isHesiBody(e));
  if (filter === "HESI") return exams.filter((e) => isHesiBody(e) && !isAtiBody(e));
  return [...exams];
}

export interface PagedExitExamsResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginates an already filtered and sorted array of exit exams.
 * Ensures totalCount reflects the filtered dataset and pagination bounds are respected.
 */
export function paginateExitExams<T>(
  items: T[],
  pageNumber = 1,
  pageSize = 12
): PagedExitExamsResult<T> {
  const validPage = Math.max(1, Math.floor(pageNumber) || 1);
  const validSize = Math.max(1, Math.floor(pageSize) || 12);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / validSize));
  const safePage = Math.min(validPage, totalPages);
  const startIndex = (safePage - 1) * validSize;
  const pagedItems = items.slice(startIndex, startIndex + validSize);

  return {
    items: pagedItems,
    totalCount,
    pageNumber: safePage,
    pageSize: validSize,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

/**
 * End-to-end exit examination pipeline:
 * 1. Filter by provider (All, ATI, HESI)
 * 2. Sort provider-first (ATI then HESI) & descending chronological order
 * 3. Paginate after sorting and filtering
 */
export function getOrderedExitExams<
  T extends ExamBodyItem & {
    academicYear?: number | string | null;
    year?: number | string | null;
    title?: string | null;
    id?: number | string | null;
  }
>(
  exams: T[],
  options?: {
    provider?: "All" | "ATI" | "HESI";
    pageNumber?: number;
    pageSize?: number;
  }
): PagedExitExamsResult<T> {
  const provider = options?.provider ?? "All";
  const filtered = filterExitExams(exams, provider);
  const sorted = sortExitExams(filtered);

  if (options?.pageSize !== undefined) {
    return paginateExitExams(sorted, options.pageNumber ?? 1, options.pageSize);
  }

  return {
    items: sorted,
    totalCount: sorted.length,
    pageNumber: 1,
    pageSize: sorted.length || 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

export const RN_EXAM_BODY_CATEGORIES = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "GENERAL EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
] as const;

export const LPN_EXAM_BODY_CATEGORIES = [
  "ATI EXAMS",
  "HESI EXAMS",
  "EXAMPLIFY EXAMS",
  "KAP-LAN EXAMS",
  "ATI EXIT EXAMS",
  "HESI EXIT EXAMS",
] as const;

export function getPathwayExamBodyCategories(pathway: string): string[] {
  const isLpn = pathway === "PN_LPN" || pathway === "PN_Exit" || pathway === "LPN";
  return isLpn ? [...LPN_EXAM_BODY_CATEGORIES] : [...RN_EXAM_BODY_CATEGORIES];
}
