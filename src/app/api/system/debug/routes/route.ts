import { NextRequest, NextResponse } from 'next/server';
import {
  buildCurrentUserEndpointPath,
  buildSystemDebugRoutesEndpointPath,
  extractRoutesFromUpstreamData,
  type LexmaCastoAuthUserRaw,
  type SystemDebugRoutesPayload,
} from '@/lib/lexmacasto/contracts';
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
  sanitizeAuthUser,
} from '@/lib/lexmacasto/client';
import { STAFF_ROLES } from '@/lib/lexmacasto/proxy-allowlist';
import { getServerCastoSession } from '@/lib/lexmacasto/session';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

const ALLOWED_QUERY_KEYS = new Set([
  'target',
  'search',
  'q',
  'method',
  'group',
  'controller',
  'page',
  'perPage',
]);

const ALLOWED_HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // 1. Strict query parameter allowlist & validation
  for (const key of sp.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'VALIDATION_ERROR',
          message: `Unsupported query parameter: ${key}`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
  }

  const rawTarget = (sp.get('target') ?? 'view').trim();
  if (rawTarget !== 'view' && rawTarget !== 'routes') {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid target parameter. Allowed values: "view", "routes".',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawSearch = (sp.get('search') ?? sp.get('q') ?? '').trim();
  if (rawSearch.length > 120 || /[\r\n\0]/.test(rawSearch)) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid search query parameter.',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawMethod = (sp.get('method') ?? '').trim().toUpperCase();
  if (rawMethod && !ALLOWED_HTTP_METHODS.has(rawMethod)) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: `Unsupported HTTP method filter: ${rawMethod}`,
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawGroup = (sp.get('group') ?? sp.get('controller') ?? '').trim();
  if (rawGroup.length > 120 || /[\r\n\0]/.test(rawGroup) || !/^[a-zA-Z0-9_.\-/]*$/.test(rawGroup)) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid group/controller filter parameter.',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawPage = sp.get('page');
  const page = rawPage ? Number(rawPage) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 1000) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Page must be an integer between 1 and 1000.',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rawPerPage = sp.get('perPage');
  const perPage = rawPerPage ? Number(rawPerPage) : 50;
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 200) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'perPage must be an integer between 1 and 200.',
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 2. Enforce server-side session authentication
  const session = await getServerCastoSession();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication is required to access system route diagnostics.',
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    '/api/system/debug/routes'
  );

  // 3. Enforce server-side staff role authorization
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
      ? ('user' in userRes.data.data
          ? userRes.data.data.user
          : (userRes.data.data as LexmaCastoAuthUserRaw))
      : undefined) ??
    userRes.data;
  const verifiedUser = sanitizeAuthUser(rawUser as LexmaCastoAuthUserRaw);

  if (!userRes.ok || !verifiedUser) {
    return NextResponse.json(
      {
        success: false,
        errorCode: userRes.errorCode || 'UNAUTHORIZED',
        message: 'Unable to verify active staff session.',
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!STAFF_ROLES.has(verifiedUser.role.toLowerCase())) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Insufficient permissions. Staff authorization is required to inspect system routes.',
      },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // 4. Query verified upstream endpoint with manual redirect handling (no credential forwarding on 3xx)
  const endpointPath = buildSystemDebugRoutesEndpointPath({
    target: rawTarget,
    search: rawSearch || undefined,
    method: rawMethod || undefined,
    group: rawGroup || undefined,
    page,
    perPage,
  });

  const upstreamRes = await lexmaCastoRequest<unknown>(endpointPath, {
    method: 'GET',
    session,
    siteMeta,
  });

  if (!upstreamRes.ok) {
    const status =
      upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502;
    return NextResponse.json(
      {
        success: false,
        errorCode: upstreamRes.errorCode || 'BACKEND_ERROR',
        message:
          upstreamRes.message ||
          'The upstream system route diagnostics endpoint is currently unavailable or rejected the session.',
      },
      { status, headers: NO_STORE_HEADERS }
    );
  }

  const extracted = extractRoutesFromUpstreamData(upstreamRes.data);
  if (!extracted.valid) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'UNEXPECTED_RESPONSE',
        message: 'Upstream endpoint returned an unexpected route diagnostics format.',
      },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }

  let filtered = extracted.routes;
  if (rawMethod) {
    filtered = filtered.filter(
      (r) =>
        r.method === rawMethod ||
        (Array.isArray(r.methods) && r.methods.includes(rawMethod))
    );
  }
  if (rawGroup) {
    const gLower = rawGroup.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.group && r.group.toLowerCase().includes(gLower)) ||
        (r.controller && r.controller.toLowerCase().includes(gLower)) ||
        (r.area && r.area.toLowerCase().includes(gLower))
    );
  }
  if (rawSearch) {
    const sLower = rawSearch.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.path && r.path.toLowerCase().includes(sLower)) ||
        (r.controller && r.controller.toLowerCase().includes(sLower)) ||
        (r.handler && r.handler.toLowerCase().includes(sLower)) ||
        (r.action && r.action.toLowerCase().includes(sLower)) ||
        (r.group && r.group.toLowerCase().includes(sLower)) ||
        (r.name && r.name.toLowerCase().includes(sLower))
    );
  }

  const hasLocalFilter = Boolean(rawMethod || rawGroup || rawSearch);
  const totalCount = hasLocalFilter
    ? filtered.length
    : (extracted.upstreamTotal ?? filtered.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const pagedRoutes =
    filtered.length > perPage
      ? filtered.slice((page - 1) * perPage, page * perPage)
      : filtered;

  const payload: SystemDebugRoutesPayload = {
    endpoint:
      rawTarget === 'routes' ? '/system/debug/routes' : '/system/debug/routes/view',
    routes: pagedRoutes,
    totalCount,
    page,
    perPage,
    totalPages,
    upstreamStatus: upstreamRes.status,
    upstreamAvailable: true,
  };

  return NextResponse.json(
    {
      success: true,
      message: upstreamRes.message || 'OK',
      data: payload,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
