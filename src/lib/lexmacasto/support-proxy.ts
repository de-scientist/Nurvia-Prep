import { NextRequest, NextResponse } from 'next/server';
import {
  buildSupportEndpointPath,
  type SupportResourceKey,
  type StrataFetchType,
} from '@/lib/lexmacasto/contracts';
import { extractSiteMetadataFromRequestHeaders, lexmaCastoRequest } from '@/lib/lexmacasto/client';
import type { CastoSessionCredentials } from '@/lib/lexmacasto/headers';
import { getServerCastoSession, validateSameOriginRequest } from '@/lib/lexmacasto/session';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

const VALID_FETCHTYPES = new Set([
  'absolute',
  'distinct',
  'relative',
  'current',
  'discrete',
  'nominal',
  'live',
]);

const MAX_SUPPORT_BODY_BYTES = 131_072;

async function resolveSupportSession(req: NextRequest): Promise<CastoSessionCredentials | null> {
  const cookieSession = await getServerCastoSession();
  if (cookieSession) return cookieSession;
  const castoLine = req.headers.get('x-casto-line')?.trim();
  const castoBadge = req.headers.get('x-casto-badge')?.trim();
  if (castoLine && castoBadge) {
    return { castoLine, castoBadge };
  }
  return null;
}

export async function forwardSupportResource(
  req: NextRequest,
  resource: SupportResourceKey,
  action: 'list' | 'store' | 'update' | 'delete',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
): Promise<NextResponse> {
  if (method !== 'GET') {
    const csrf = validateSameOriginRequest(req);
    if (!csrf.ok) {
      return NextResponse.json(
        { success: false, message: csrf.reason, errorCode: 'FORBIDDEN' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
  }

  let fetchtype: StrataFetchType | 'discrete' | 'nominal' = 'relative';
  const queryParams: Record<string, string> = {};

  if (method === 'GET') {
    const rawFetch = req.nextUrl.searchParams.get('fetchtype')?.trim() || '';
    if (!VALID_FETCHTYPES.has(rawFetch)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Fetchtype', message: 'Invalid Fetchtype' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    fetchtype = rawFetch as StrataFetchType | 'discrete' | 'nominal';
    req.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'fetchtype') queryParams[key] = value;
    });
  }

  let body: unknown = undefined;
  if (method !== 'GET') {
    const text = await req.text().catch(() => '');
    if (text) {
      if (Buffer.byteLength(text, 'utf8') > MAX_SUPPORT_BODY_BYTES) {
        return NextResponse.json(
          { success: false, message: 'Request body exceeds maximum allowed size.' },
          { status: 413, headers: NO_STORE_HEADERS }
        );
      }
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { success: false, message: 'Invalid JSON request body.' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    } else {
      body = {};
    }
  }

  const session = await resolveSupportSession(req);
  const backendPath = buildSupportEndpointPath(resource, action, fetchtype, queryParams);
  const siteMeta = extractSiteMetadataFromRequestHeaders(req.headers, `/api/auth/support/${resource}`);

  const result = await lexmaCastoRequest<Record<string, unknown>>(backendPath, {
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
        error: result.message,
        errorCode: result.errorCode,
        errors: result.errors,
      },
      { status: result.status, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    result.data ?? { success: true, message: result.message || 'OK' },
    { status: result.status, headers: NO_STORE_HEADERS }
  );
}
