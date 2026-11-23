import {
  isUnauthorizedExamFamilyName,
  LPN_PROGRAM_ID,
  parseStrictProgramId,
  RN_PROGRAM_ID,
} from '../study-library/curriculum-consolidation';

export type ApprovedTestimonialPathway = 'RN' | 'PN_LPN';
export type AuthorizedTestimonialProgramId = typeof LPN_PROGRAM_ID | typeof RN_PROGRAM_ID;
export type TestimonialSource = 'verified_backend' | 'none';
export type TestimonialBackendStatus =
  | 'available_with_records'
  | 'empty'
  | 'excluded_only'
  | 'endpoint_not_provisioned'
  | 'upstream_error'
  | 'malformed_response';

export interface NormalizedTestimonial {
  id: string;
  content: string;
  attribution: string;
  pathway: ApprovedTestimonialPathway;
  pathwayLabel: 'RN' | 'LPN / PN';
  programId: AuthorizedTestimonialProgramId;
  roleOrQualification?: string;
  examFocus?: string;
  publishedStatus: 'published';
  displayOrder?: number;
  createdAtUtc?: string;
  source: 'verified_backend';
  isVerified: boolean;
  isSample: false;
}

export interface TestimonialsCollectionResult {
  items: NormalizedTestimonial[];
  source: TestimonialSource;
  backendStatus: TestimonialBackendStatus;
  totalReceivedFromBackend: number;
  eligibleBackendCount: number;
  rejectedBackendCount: number;
  endpointChecked: boolean;
}

const PROHIBITED_TESTIMONIAL_TEXT_PATTERN =
  /\bnclex(?:[_-]?(?:rn|pn))?\b|\bged\b|\bati[\s_-]*teas\b|\bteas\b|\bhesi[\s_-]*a2\b|\baccuplacer\b|explicit[\s_-]+dynamic/i;

const SYNTHETIC_ATTRIBUTION_PATTERN =
  /\bpathway\s+study\s+perspective\b|\bsample\s+testimonial\b|\bsynthetic\b|\bplaceholder\b|\bmock\s+learner\b|\bfallback\b/i;

const EXCLUDED_ASSESSMENT_IDS = new Set([1, 2, 3, 4, 6, 7, 11]);
const ALLOWED_PUBLICATION_STATUSES = new Set(['published', 'approved', 'active']);

function hasNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

export function isProhibitedTestimonialText(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isUnauthorizedExamFamilyName(trimmed) || PROHIBITED_TESTIMONIAL_TEXT_PATTERN.test(trimmed);
}

export function isSyntheticTestimonialRecord(raw: Record<string, unknown>): boolean {
  if (
    raw.isSample === true ||
    raw.sample === true ||
    raw.isSynthetic === true ||
    raw.synthetic === true ||
    raw.isFallback === true ||
    raw.fallback === true
  ) {
    return true;
  }

  if (typeof raw.source === 'string') {
    const src = raw.source.trim().toLowerCase();
    if (src === 'sample_fallback' || src === 'fallback' || src === 'sample' || src === 'synthetic' || src === 'mock') {
      return true;
    }
  }

  const rawId = raw.id ?? raw.guidId ?? raw.testimonialId;
  if (typeof rawId === 'string' && /^(?:sample|fallback|synthetic|mock)[-_]/i.test(rawId.trim())) {
    return true;
  }

  const attributionCandidates = [
    raw.attribution,
    raw.displayName,
    raw.authorName,
    raw.learnerName,
    raw.name,
  ];
  for (const candidate of attributionCandidates) {
    if (typeof candidate === 'string' && SYNTHETIC_ATTRIBUTION_PATTERN.test(candidate.trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Strictly parses an approved application pathway (`RN` or `PN_LPN`).
 * Fails closed on Exit pathways, NCLEX strings, vague labels (`All`, `Common`), or unknown strings.
 */
export function parseApprovedTestimonialPathway(raw: unknown): ApprovedTestimonialPathway | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'RN') return 'RN';
  if (normalized === 'PN_LPN') return 'PN_LPN';
  return null;
}

export function programIdForTestimonialPathway(
  pathway: ApprovedTestimonialPathway
): AuthorizedTestimonialProgramId {
  return pathway === 'RN' ? RN_PROGRAM_ID : LPN_PROGRAM_ID;
}

export function pathwayForTestimonialProgramId(
  programId: AuthorizedTestimonialProgramId
): ApprovedTestimonialPathway {
  return programId === RN_PROGRAM_ID ? 'RN' : 'PN_LPN';
}

export function formatTestimonialPathwayBadge(pathway: ApprovedTestimonialPathway): 'RN' | 'LPN / PN' {
  return pathway === 'RN' ? 'RN' : 'LPN / PN';
}

function isPublishedAndVisible(raw: Record<string, unknown>): boolean {
  if (
    raw.isPublished === false ||
    raw.published === false ||
    raw.isApproved === false ||
    raw.approved === false ||
    raw.isDeleted === true ||
    raw.deleted === true ||
    raw.isArchived === true ||
    raw.archived === true ||
    raw.isRestricted === true ||
    raw.restricted === true ||
    raw.isHidden === true ||
    raw.hidden === true ||
    raw.isDraft === true ||
    raw.draft === true ||
    raw.isPrivate === true ||
    raw.private === true ||
    raw.adminOnly === true ||
    raw.allowPublicAttribution === false ||
    raw.publicAttribution === false ||
    raw.consentToPublish === false
  ) {
    return false;
  }

  if (hasNonEmptyValue(raw.visibility)) {
    if (typeof raw.visibility !== 'string') return false;
    if (raw.visibility.trim().toLowerCase() !== 'public') return false;
  }

  const statusFields = [
    raw.status,
    raw.publicationStatus,
    raw.approvalStatus,
    raw.moderationStatus,
  ];

  let hasPositiveStatus =
    raw.isPublished === true ||
    raw.published === true ||
    raw.isApproved === true ||
    raw.approved === true;

  for (const field of statusFields) {
    if (!hasNonEmptyValue(field)) continue;
    if (typeof field !== 'string') return false;
    const norm = field.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!ALLOWED_PUBLICATION_STATUSES.has(norm)) {
      return false;
    }
    hasPositiveStatus = true;
  }

  return hasPositiveStatus;
}

function resolveAuthoritativeVerification(raw: Record<string, unknown>): boolean {
  if (raw.isVerified === false || raw.verified === false) {
    return false;
  }
  if (typeof raw.verificationStatus === 'string') {
    return raw.verificationStatus.trim().toLowerCase() === 'verified';
  }
  return raw.isVerified === true || raw.verified === true;
}

function pickFirstNonEmptyString(
  raw: Record<string, unknown>,
  keys: readonly string[]
): string | null {
  for (const k of keys) {
    const val = raw[k];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

function hasTextMetadataConflict(
  resolvedPathway: ApprovedTestimonialPathway,
  label: string | null
): boolean {
  if (!label) return false;
  const mentionsRn = /\brn\b|registered\s*nurs/i.test(label);
  const mentionsLpn = /\b(?:lpn|pn)\b|practical\s*nurs/i.test(label);
  if (resolvedPathway === 'RN' && mentionsLpn && !mentionsRn) return true;
  if (resolvedPathway === 'PN_LPN' && mentionsRn && !mentionsLpn) return true;
  return false;
}

/**
 * Validates and normalizes a single raw testimonial record from an authoritative backend source.
 * Enforces fail-closed pathway eligibility (`RN` / `PN_LPN`, program IDs `9` / `6`),
 * publication & attribution rules, rejection of synthetic/sample records, and strict
 * exclusion of NCLEX and unauthorized exam families.
 */
export function normalizeSingleTestimonial(
  rawInput: unknown
): NormalizedTestimonial | null {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return null;
  }

  const raw = rawInput as Record<string, unknown>;

  if (isSyntheticTestimonialRecord(raw)) {
    return null;
  }

  if (!isPublishedAndVisible(raw)) {
    return null;
  }

  const rawId = raw.id ?? raw.guidId ?? raw.testimonialId;
  const id =
    typeof rawId === 'string'
      ? rawId.trim()
      : typeof rawId === 'number' && Number.isFinite(rawId)
        ? String(rawId)
        : '';
  if (!id) {
    return null;
  }

  const content = pickFirstNonEmptyString(raw, [
    'content',
    'testimonial',
    'quote',
    'comment',
    'message',
    'body',
  ]);
  if (!content || content.length < 10) {
    return null;
  }

  const attribution = pickFirstNonEmptyString(raw, [
    'attribution',
    'displayName',
    'authorName',
    'learnerName',
    'name',
  ]);
  if (!attribution) {
    return null;
  }

  // Enforce strict assessmentId exclusions when present
  const rawAssessmentId = raw.assessmentId ?? raw.assessmentNumericId;
  if (hasNonEmptyValue(rawAssessmentId)) {
    const parsedAssId = Number(rawAssessmentId);
    if (!Number.isFinite(parsedAssId) || EXCLUDED_ASSESSMENT_IDS.has(parsedAssId)) {
      return null;
    }
  }

  // Validate pathway and programId strictly — never infer eligibility from prose text
  const rawPathwayCandidate = raw.pathway ?? raw.learnerPathway ?? raw.nursingPathway;
  const hasRawPathway = hasNonEmptyValue(rawPathwayCandidate);
  const parsedPathway = hasRawPathway ? parseApprovedTestimonialPathway(rawPathwayCandidate) : null;
  if (hasRawPathway && parsedPathway === null) {
    return null;
  }

  const rawProgramCandidate = raw.programId ?? raw.program_id;
  const hasRawProgramId = hasNonEmptyValue(rawProgramCandidate);
  const parsedProgramId = hasRawProgramId ? parseStrictProgramId(rawProgramCandidate) : null;
  if (hasRawProgramId && parsedProgramId === null) {
    return null;
  }

  if (parsedPathway === null && parsedProgramId === null) {
    return null;
  }

  if (
    parsedPathway !== null &&
    parsedProgramId !== null &&
    programIdForTestimonialPathway(parsedPathway) !== parsedProgramId
  ) {
    return null;
  }

  const resolvedPathway: ApprovedTestimonialPathway =
    parsedPathway ?? pathwayForTestimonialProgramId(parsedProgramId!);
  const resolvedProgramId: AuthorizedTestimonialProgramId =
    parsedProgramId ?? programIdForTestimonialPathway(resolvedPathway);

  // Check metadata & prose fields for prohibited exam families (NCLEX, GED, TEAS, HESI A2, ACCUPLACER)
  const programName = pickFirstNonEmptyString(raw, ['programName', 'program']);
  const examTrack = pickFirstNonEmptyString(raw, ['examTrack', 'track']);
  const roleOrQualification = pickFirstNonEmptyString(raw, [
    'roleOrQualification',
    'role',
    'qualification',
    'designation',
  ]);
  const examFocus = pickFirstNonEmptyString(raw, ['examFocus', 'scoreOrLevel', 'subjectName']);

  const metadataValues: unknown[] = [
    content,
    attribution,
    programName,
    examTrack,
    roleOrQualification,
    examFocus,
    raw.category,
    raw.label,
    raw.badge,
    raw.tag,
    raw.courseName,
    raw.assessmentName,
    raw.title,
    raw.headline,
  ];
  if (Array.isArray(raw.tags)) {
    metadataValues.push(...raw.tags);
  }

  for (const val of metadataValues) {
    if (isProhibitedTestimonialText(val)) {
      return null;
    }
  }

  if (
    hasTextMetadataConflict(resolvedPathway, programName) ||
    hasTextMetadataConflict(resolvedPathway, examTrack)
  ) {
    return null;
  }

  const rawOrder = raw.displayOrder ?? raw.order ?? raw.priority;
  const displayOrder =
    typeof rawOrder === 'number' && Number.isFinite(rawOrder)
      ? rawOrder
      : typeof rawOrder === 'string' && /^-?\d+$/.test(rawOrder.trim())
        ? Number(rawOrder.trim())
        : undefined;

  const createdAtUtc = pickFirstNonEmptyString(raw, ['createdAtUtc', 'createdAt', 'publishedAt']);

  return {
    id,
    content,
    attribution,
    pathway: resolvedPathway,
    pathwayLabel: formatTestimonialPathwayBadge(resolvedPathway),
    programId: resolvedProgramId,
    roleOrQualification: roleOrQualification ?? undefined,
    examFocus: examFocus ?? undefined,
    publishedStatus: 'published',
    displayOrder,
    createdAtUtc: createdAtUtc ?? undefined,
    source: 'verified_backend',
    isVerified: resolveAuthoritativeVerification(raw),
    isSample: false,
  };
}

export function extractRawTestimonialsArray(payload: unknown): {
  valid: boolean;
  items: unknown[];
} {
  if (Array.isArray(payload)) {
    return { valid: true, items: payload };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false, items: [] };
  }

  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.items)) return { valid: true, items: obj.items };
  if (Array.isArray(obj.testimonials)) return { valid: true, items: obj.testimonials };

  if (Array.isArray(obj.data)) {
    return { valid: true, items: obj.data };
  }

  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner.items)) return { valid: true, items: inner.items };
    if (Array.isArray(inner.testimonials)) return { valid: true, items: inner.testimonials };
  }

  return { valid: false, items: [] };
}

export function sortNormalizedTestimonials(
  items: NormalizedTestimonial[]
): NormalizedTestimonial[] {
  return [...items].sort((a, b) => {
    const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.createdAtUtc && b.createdAtUtc) {
      return b.createdAtUtc.localeCompare(a.createdAtUtc);
    }
    return 0;
  });
}

export function normalizeAndFilterTestimonials(
  rawItems: unknown[],
  pathwayFilter?: ApprovedTestimonialPathway
): {
  eligible: NormalizedTestimonial[];
  rejectedCount: number;
} {
  const seenIds = new Set<string>();
  const eligible: NormalizedTestimonial[] = [];
  let rejectedCount = 0;

  for (const rawItem of rawItems) {
    const normalized = normalizeSingleTestimonial(rawItem);
    if (!normalized) {
      rejectedCount++;
      continue;
    }
    if (pathwayFilter && normalized.pathway !== pathwayFilter) {
      continue;
    }
    if (seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    eligible.push(normalized);
  }

  return {
    eligible: sortNormalizedTestimonials(eligible),
    rejectedCount,
  };
}

export function normalizeAndFilterBackendTestimonials(
  payload: unknown,
  pathwayFilter?: ApprovedTestimonialPathway
): {
  validPayload: boolean;
  totalReceived: number;
  eligible: NormalizedTestimonial[];
  rejectedCount: number;
} {
  const extracted = extractRawTestimonialsArray(payload);
  if (!extracted.valid) {
    return {
      validPayload: false,
      totalReceived: 0,
      eligible: [],
      rejectedCount: 0,
    };
  }

  const { eligible, rejectedCount } = normalizeAndFilterTestimonials(
    extracted.items,
    pathwayFilter
  );

  return {
    validPayload: true,
    totalReceived: extracted.items.length,
    eligible,
    rejectedCount,
  };
}

export function resolveTestimonialsCollection(params: {
  backendAttempted: boolean;
  backendOk: boolean;
  backendPayload?: unknown;
  backendStatusOverride?: TestimonialBackendStatus;
  pathwayFilter?: ApprovedTestimonialPathway;
}): TestimonialsCollectionResult {
  const {
    backendAttempted,
    backendOk,
    backendPayload,
    backendStatusOverride,
    pathwayFilter,
  } = params;

  if (!backendAttempted) {
    return {
      items: [],
      source: 'none',
      backendStatus: backendStatusOverride ?? 'endpoint_not_provisioned',
      totalReceivedFromBackend: 0,
      eligibleBackendCount: 0,
      rejectedBackendCount: 0,
      endpointChecked: false,
    };
  }

  if (!backendOk) {
    return {
      items: [],
      source: 'none',
      backendStatus: backendStatusOverride ?? 'upstream_error',
      totalReceivedFromBackend: 0,
      eligibleBackendCount: 0,
      rejectedBackendCount: 0,
      endpointChecked: true,
    };
  }

  const filtered = normalizeAndFilterBackendTestimonials(backendPayload, pathwayFilter);
  if (!filtered.validPayload) {
    return {
      items: [],
      source: 'none',
      backendStatus: 'malformed_response',
      totalReceivedFromBackend: 0,
      eligibleBackendCount: 0,
      rejectedBackendCount: 0,
      endpointChecked: true,
    };
  }

  if (filtered.eligible.length > 0) {
    return {
      items: filtered.eligible,
      source: 'verified_backend',
      backendStatus: 'available_with_records',
      totalReceivedFromBackend: filtered.totalReceived,
      eligibleBackendCount: filtered.eligible.length,
      rejectedBackendCount: filtered.rejectedCount,
      endpointChecked: true,
    };
  }

  return {
    items: [],
    source: 'none',
    backendStatus: filtered.totalReceived === 0 ? 'empty' : 'excluded_only',
    totalReceivedFromBackend: filtered.totalReceived,
    eligibleBackendCount: 0,
    rejectedBackendCount: filtered.rejectedCount,
    endpointChecked: true,
  };
}
