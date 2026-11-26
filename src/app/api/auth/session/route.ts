import { getNurviaCastoSessionHeaders } from "@/lib/lexmacasto/qlexSessionBridge";
import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api/api/api";
import { resolveBackendBaseUrl } from "@/lib/api-config.mjs";
import { getSiteHeaders } from "@/lib/config/siteHeaders";
import {
  setServerCastoSession,
  clearServerCastoSession,
  validateSameOriginRequest,
} from "@/lib/lexmacasto/session";
import { sanitizeHeaderValue } from "@/lib/lexmacasto/headers";
import {
  extractSiteMetadataFromRequestHeaders,
  lexmaCastoRequest,
  sanitizeAuthUser,
} from "@/lib/lexmacasto/client";
import {
  buildCurrentUserEndpointPath,
  type LexmaCastoAuthUserRaw,
} from "@/lib/lexmacasto/contracts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

function resolveSafeBackendOrigin(): string {
  try {
    return resolveBackendBaseUrl(process.env);
  } catch {
    return getBackendBaseUrl();
  }
}

export async function GET(request: Request) {
  try {
    const backendBaseUrl = resolveSafeBackendOrigin();
    const backendUrl = `${backendBaseUrl}/api/castoline/auth/system/user`;

    const castoLine = request.headers.get("x-casto-line")?.trim();
    const castoBadge = request.headers.get("x-casto-badge")?.trim();
    const cookieHeaders = await getNurviaCastoSessionHeaders();

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        ...(await getSiteHeaders()),
        ...(castoLine ? { "x-casto-line": castoLine } : {}),
        ...(castoBadge ? { "x-casto-badge": castoBadge } : {}),
        ...cookieHeaders,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { logged_in: false },
        { status: response.status, headers: NO_STORE_HEADERS }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Session Route Error:", error);
    return NextResponse.json({ logged_in: false }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, message: csrf.reason, errorCode: "CSRF_REJECTED" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawLine = typeof body.line === "string" ? body.line.trim() : "";
    const rawBadge = typeof body.badge === "string" ? body.badge.trim() : "";
    const dashboardName =
      typeof body.dashboardName === "string" && body.dashboardName.trim()
        ? body.dashboardName.trim().slice(0, 64)
        : "web";
    const rememberMe = body.rememberMe !== false;

    if (!rawLine || !rawBadge) {
      return NextResponse.json(
        {
          success: false,
          message: "Both line and badge session credentials are required.",
          errorCode: "VALIDATION_ERROR",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (/[\r\n\0\x01-\x1F\x7F]/.test(rawLine) || /[\r\n\0\x01-\x1F\x7F]/.test(rawBadge)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid characters in session credentials.",
          errorCode: "VALIDATION_ERROR",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const castoLine = sanitizeHeaderValue(rawLine, 2048);
    const castoBadge = sanitizeHeaderValue(rawBadge, 2048);
    if (!castoLine || !castoBadge) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session credentials.",
          errorCode: "VALIDATION_ERROR",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // Validate credentials against authoritative backend current-user endpoint when configured
    const siteMeta = extractSiteMetadataFromRequestHeaders(request.headers, "/api/auth/session");
    const verifyResult = await lexmaCastoRequest<Record<string, unknown>>(
      buildCurrentUserEndpointPath(),
      {
        method: "GET",
        session: { castoLine, castoBadge },
        siteMeta,
      }
    );

    if (!verifyResult.ok) {
      if (verifyResult.status === 401 || verifyResult.status === 403) {
        return NextResponse.json(
          {
            success: false,
            message: verifyResult.message || "OAuth session credentials were rejected by the backend.",
            errorCode: verifyResult.errorCode || "UNAUTHORIZED",
          },
          { status: verifyResult.status, headers: NO_STORE_HEADERS }
        );
      }
      // Fail closed on unexpected backend errors unless configuration is explicitly absent in isolated test harnesses
      if (
        verifyResult.errorCode !== "CONFIGURATION_ERROR" &&
        verifyResult.errorCode !== "MISSING_APP_IDENTITY"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: verifyResult.message || "Unable to verify session with authentication service.",
            errorCode: verifyResult.errorCode || "BACKEND_ERROR",
          },
          { status: verifyResult.status || 502, headers: NO_STORE_HEADERS }
        );
      }
    }

    const rawPayload = verifyResult.data as Record<string, unknown> | undefined;
    const dataNode =
      rawPayload?.data && typeof rawPayload.data === "object"
        ? (rawPayload.data as Record<string, unknown>)
        : rawPayload;
    const rawUserCandidate =
      (Array.isArray(dataNode?.items) ? dataNode.items[0] : undefined) ??
      dataNode?.user ??
      rawPayload?.user ??
      dataNode;
    const sanitizedUser = sanitizeAuthUser(rawUserCandidate as LexmaCastoAuthUserRaw | undefined);

    const response = NextResponse.json(
      {
        success: true,
        message: "Session established successfully.",
        data: sanitizedUser ?? undefined,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );

    setServerCastoSession(
      response,
      { castoLine, castoBadge },
      sanitizedUser?.dashboardName || dashboardName,
      process.env.NODE_ENV === "production",
      rememberMe
    );

    return response;
  } catch (error) {
    console.error("Session Establishment Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to establish session." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, message: csrf.reason, errorCode: "CSRF_REJECTED" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }
  const response = NextResponse.json(
    { success: true, message: "Session cleared." },
    { headers: NO_STORE_HEADERS }
  );
  clearServerCastoSession(response, process.env.NODE_ENV === "production");
  return response;
}
