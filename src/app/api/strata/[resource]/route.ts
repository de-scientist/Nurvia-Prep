import { NextRequest, NextResponse } from 'next/server';
import {
  buildCurrentUserEndpointPath,
  buildStrataEndpointPath,
  buildStrataMutationPath,
  isStrataResourceKey,
  LEXMACASTO_STRATA_ENDPOINTS,
  type LexmaCastoAuthUserRaw,
  type StrataFetchType,
  type StrataMutationAction,
} from '@/lib/lexmacasto/contracts';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
  normalizeStrataEnvelope,
  sanitizeAuthUser,
} from '@/lib/lexmacasto/client';
import { STAFF_ROLES } from '@/lib/lexmacasto/proxy-allowlist';
import { getServerCastoSession, validateSameOriginRequest } from '@/lib/lexmacasto/session';
import {
  getAuthorizedStudyLibraryIndex,
  verifyAuthorizedNominalTarget,
} from '@/lib/lexmacasto/study-library-index';
import { parseStrictProgramId } from '@/lib/study-library/curriculum-consolidation';

const ALLOWED_STRATA_QUERY_PARAMS = new Set([
  'page',
  'skewPage',
  'dynamicPage',
  'perPage',
  'skewPerPage',
  'dynamicPerPage',
  'limit',
  'search',
  'dynamicSearch',
  'dynamicSortColumn',
  'dynamicSortDirection',
  'dynamicLearningStrataName',
  'identifier',
  'scope',
  'dynamicExamLayout',
  'dynamicExamMode',
  'dynamicAttemptNumber',
  'q',
  'domainId',
  'categoryId',
  'subCategoryId',
  'programId',
  'courseId',
  'subjectId',
  'unitId',
  'lessonId',
  'topicId',
  'conceptId',
  'assessmentId',
  'examId',
  'sectionId',
  'institutionId',
  'schoolId',
  'departmentId',
  'divisionId',
  'cohortId',
  'classId',
]);

const ALLOWED_FETCH_TYPES = new Set<StrataFetchType>([
  'absolute',
  'distinct',
  'relative',
  'current',
  'live',
  'nominal',
]);

const ALLOWED_NOMINAL_LEVELS = new Set(['program', 'course', 'subject']);

const PAGINATION_PAGE_KEYS = new Set(['page', 'skewPage', 'dynamicPage']);
const PAGINATION_SIZE_KEYS = new Set(['perPage', 'skewPerPage', 'dynamicPerPage', 'limit']);
const MAX_MUTATION_BODY_BYTES = 1_048_576;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> }
) {
  const { resource } = await context.params;
  if (!isStrataResourceKey(resource)) {
    return NextResponse.json(
      {
        success: false,
        message: `Unknown academic strata resource: "${resource}".`,
        errorCode: 'NOT_FOUND',
      },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const endpointDef = LEXMACASTO_STRATA_ENDPOINTS[resource];
  const requestedFetchType = request.nextUrl.searchParams.get('fetchtype')?.trim().toLowerCase();
  let resolvedFetchType: StrataFetchType = endpointDef.fetchtype;

  if (requestedFetchType) {
    if (!ALLOWED_FETCH_TYPES.has(requestedFetchType as StrataFetchType)) {
      return NextResponse.json(
        {
          success: false,
          message: `Unsupported strata fetchtype: "${requestedFetchType}".`,
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    resolvedFetchType = requestedFetchType as StrataFetchType;
  }

  const isNominalExamRead = resource === 'exams' && resolvedFetchType === 'nominal';
  const requiresAuth =
    endpointDef.requiresAuth || (resolvedFetchType !== 'absolute' && !isNominalExamRead);
  const session = await getServerCastoSession();

  if (requiresAuth && !session) {
    return NextResponse.json(
      {
        success: false,
        message: 'Authentication is required to access this academic strata resource.',
        errorCode: 'UNAUTHORIZED',
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const queryParams: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (key === 'fetchtype') continue;
    if (!ALLOWED_STRATA_QUERY_PARAMS.has(key)) {
      return NextResponse.json(
        { success: false, message: `Unsupported query parameter: "${key}".`, errorCode: 'VALIDATION_ERROR' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (PAGINATION_PAGE_KEYS.has(key)) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 10_000) {
        return NextResponse.json(
          { success: false, message: `Invalid pagination page value for "${key}".`, errorCode: 'VALIDATION_ERROR' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    }
    if (PAGINATION_SIZE_KEYS.has(key)) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 250) {
        return NextResponse.json(
          { success: false, message: `Invalid pagination size for "${key}" (expected 1..250).`, errorCode: 'VALIDATION_ERROR' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    }
    queryParams[key] = value.slice(0, 200);
  }

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    `/api/strata/${resource}`
  );
  const cacheHeader = requiresAuth ? 'no-store' : 'private, no-store';

  // Server-side {6, 9} allowlist enforcement for learner-scoped absolute strata reads
  if (
    queryParams.scope === 'learner' &&
    resolvedFetchType === 'absolute' &&
    (resource === 'programs' || resource === 'courses' || resource === 'subjects' || resource === 'exams')
  ) {
    if (queryParams.programId && parseStrictProgramId(queryParams.programId) === null) {
      return NextResponse.json(
        {
          success: false,
          message: 'Requested program is outside the authorized RN (9) and LPN (6) Study Library allowlist.',
          errorCode: 'FORBIDDEN',
        },
        { status: 403, headers: { 'Cache-Control': cacheHeader } }
      );
    }

    const index = await getAuthorizedStudyLibraryIndex(siteMeta, session);
    if (!index.complete && index.programs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unable to retrieve authorized RN/LPN curriculum records.',
          errorCode: 'BACKEND_ERROR',
        },
        { status: 502, headers: { 'Cache-Control': cacheHeader } }
      );
    }

    const pool =
      resource === 'programs'
        ? index.programs
        : resource === 'courses'
          ? index.courses
          : resource === 'subjects'
            ? index.subjects
            : index.allAuthorizedExams;

    const requestedPid = queryParams.programId ? parseStrictProgramId(queryParams.programId) : null;
    const filteredPool = requestedPid
      ? pool.filter((item) => {
          const itemPid =
            resource === 'programs'
              ? parseStrictProgramId(item.id)
              : parseStrictProgramId(item.programId);
          return itemPid === requestedPid;
        })
      : pool;

    const page = Math.max(
      1,
      Number(queryParams.page ?? queryParams.skewPage ?? queryParams.dynamicPage ?? 1) || 1
    );
    const perPage = Math.max(
      1,
      Math.min(
        250,
        Number(
          queryParams.perPage ??
            queryParams.skewPerPage ??
            queryParams.dynamicPerPage ??
            queryParams.limit ??
            250
        ) || 250
      )
    );
    const total = filteredPool.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pagedItems = filteredPool.slice((page - 1) * perPage, page * perPage);

    return NextResponse.json(
      {
        success: true,
        message: 'OK',
        data: {
          items: pagedItems,
          skewPage: page,
          skewPerPage: perPage,
          skewTotal: total,
          skewTotalPages: totalPages,
        },
      },
      { headers: { 'Cache-Control': cacheHeader } }
    );
  }

  // Server-side {6, 9} allowlist enforcement for nominal examination reads
  let nominalTarget: {
    programId: 6 | 9;
    level: 'program' | 'course' | 'subject';
    identifier: string;
    subjectId?: string;
    subjectGuidId?: string | null;
  } | null = null;
  if (isNominalExamRead) {
    const levelRaw = (queryParams.dynamicLearningStrataName || '').trim().toLowerCase();
    const identifier = (queryParams.identifier || '').trim();
    if (!identifier || !ALLOWED_NOMINAL_LEVELS.has(levelRaw)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nominal exam queries require a valid identifier and learning stratum (program, course, or subject).',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: { 'Cache-Control': cacheHeader } }
      );
    }

    const level = levelRaw as 'program' | 'course' | 'subject';
    const verification = await verifyAuthorizedNominalTarget(level, identifier, siteMeta, session);
    if (!verification.authorized) {
      return NextResponse.json(
        {
          success: false,
          message: verification.reason,
          errorCode: 'FORBIDDEN',
        },
        { status: 403, headers: { 'Cache-Control': cacheHeader } }
      );
    }

    nominalTarget = {
      programId: verification.programId,
      level,
      identifier: verification.canonicalIdentifier,
      subjectId: verification.subjectId,
      subjectGuidId: verification.subjectGuidId,
    };
  }

  const backendParams = { ...queryParams };
  delete backendParams.scope;

  const backendPath = buildStrataEndpointPath(resource, backendParams, resolvedFetchType);

  const result = await lexmaCastoRequest(backendPath, {
    method: 'GET',
    session,
    siteMeta,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        errorCode: result.errorCode,
        errors: result.errors,
      },
      { status: result.status, headers: { 'Cache-Control': cacheHeader } }
    );
  }

  const normalized = normalizeStrataEnvelope(result.data);
  if (!normalized) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unexpected academic strata response format.',
        errorCode: 'UNEXPECTED_RESPONSE',
      },
      { status: 502, headers: { 'Cache-Control': cacheHeader } }
    );
  }

  if (nominalTarget) {
    const allowedItems = normalized.data.items.filter((item) => {
      if (parseStrictProgramId(item.programId) !== nominalTarget.programId) {
        return false;
      }
      if (nominalTarget.level === 'subject') {
        const subGuid =
          typeof item.subjectGuidId === 'string' ? item.subjectGuidId.trim().toLowerCase() : '';
        const subId =
          item.subjectId !== undefined && item.subjectId !== null ? String(item.subjectId).trim() : '';
        const expectedGuid =
          typeof nominalTarget.subjectGuidId === 'string' && nominalTarget.subjectGuidId.trim()
            ? nominalTarget.subjectGuidId.trim().toLowerCase()
            : null;
        const expectedNumId = nominalTarget.subjectId?.trim() || null;
        if (expectedGuid && subGuid && subGuid !== expectedGuid) {
          return false;
        }
        if (expectedNumId && subId && subId !== expectedNumId) {
          return false;
        }
        if (!expectedGuid && !expectedNumId) {
          const targetLower = nominalTarget.identifier.toLowerCase();
          if ((subGuid && subGuid !== targetLower) || (subId && subId !== nominalTarget.identifier)) {
            return false;
          }
        }
      }
      return true;
    });

    if (allowedItems.length !== normalized.data.items.length) {
      normalized.data = {
        ...normalized.data,
        items: allowedItems,
        skewTotal: allowedItems.length,
        skewTotalPages: 1,
      };
    }
  }

  return NextResponse.json(normalized, {
    headers: { 'Cache-Control': cacheHeader },
  });
}

async function handleStrataMutation(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
  method: 'POST' | 'PUT' | 'DELETE',
  action: StrataMutationAction
) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, message: csrf.reason, errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { resource } = await context.params;
  if (!isStrataResourceKey(resource)) {
    return NextResponse.json(
      { success: false, message: `Unknown academic strata resource: "${resource}".`, errorCode: 'NOT_FOUND' },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const session = await getServerCastoSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Authentication is required.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const siteMeta = extractSiteMetadataFromRequestHeaders(request.headers, `/api/strata/${resource}`);

  // Enforce server-verified staff role for all strata authoring/administrative mutations.
  const userRes = await lexmaCastoRequest<{
    user?: LexmaCastoAuthUserRaw;
    data?: LexmaCastoAuthUserRaw | { user?: LexmaCastoAuthUserRaw };
  } & LexmaCastoAuthUserRaw>(buildCurrentUserEndpointPath(), {
    method: 'GET',
    session,
    siteMeta,
  });
  const rawUser =
    userRes.data?.user ??
    (userRes.data?.data && typeof userRes.data.data === 'object'
      ? ('user' in userRes.data.data ? userRes.data.data.user : (userRes.data.data as LexmaCastoAuthUserRaw))
      : undefined) ??
    userRes.data;
  const verifiedUser = sanitizeAuthUser(rawUser as LexmaCastoAuthUserRaw);
  if (!userRes.ok || !verifiedUser) {
    return NextResponse.json(
      { success: false, message: 'Unable to verify staff session.', errorCode: 'UNAUTHORIZED' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  if (!STAFF_ROLES.has(verifiedUser.role.toLowerCase())) {
    return NextResponse.json(
      { success: false, message: 'Insufficient permissions for strata modification.', errorCode: 'FORBIDDEN' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { success: false, message: 'Unsupported Content-Type. Expected application/json.', errorCode: 'VALIDATION_ERROR' },
      { status: 415, headers: NO_STORE_HEADERS }
    );
  }

  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_MUTATION_BODY_BYTES) {
    return NextResponse.json(
      { success: false, message: 'Request body exceeds maximum allowed size.', errorCode: 'VALIDATION_ERROR' },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = text ? (JSON.parse(text) as unknown) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request body.', errorCode: 'VALIDATION_ERROR' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON request body.', errorCode: 'VALIDATION_ERROR' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const backendPath = buildStrataMutationPath(resource, action);
  const result = await lexmaCastoRequest(backendPath, {
    method,
    body,
    session,
    siteMeta,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        errorCode: result.errorCode,
        errors: result.errors,
      },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(result.data ?? { success: true, message: result.message }, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  return handleStrataMutation(request, context, 'POST', 'store');
}

export async function PUT(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  return handleStrataMutation(request, context, 'PUT', 'update');
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  return handleStrataMutation(request, context, 'DELETE', 'delete');
}
