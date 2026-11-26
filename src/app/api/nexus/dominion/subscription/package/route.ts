import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api/api/api";
import { resolveBackendBaseUrl } from "@/lib/api-config.mjs";
import { getSiteHeaders } from "@/lib/config/siteHeaders";
import { getNurviaCastoSessionHeaders } from "@/lib/lexmacasto/qlexSessionBridge";
import { validateSameOriginRequest } from "@/lib/lexmacasto/session";

export interface DynamicDominionResponse<T = unknown> {
  success?: boolean;
  message?: string;
  error?: string;
  redirectUrl?: string | null;
  returnUrl?: string | null;
  data?: T;
}

const STRATA_GROUP = "subscription";
const STRATA_NAME = "packages";
const BASE_ROUTE = `/api/castoline/nexus/${STRATA_GROUP}/${STRATA_NAME}`;

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

function sanitizeCheckoutPayload(
  rawBody: unknown,
  req: NextRequest
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false, error: "Invalid subscription checkout request payload." };
  }
  const src = rawBody as Record<string, unknown>;

  const itemId = src.subscriptionItemId ?? src.packageId ?? src.id;
  const itemGuidId =
    typeof src.subscriptionItemGuidId === "string" && src.subscriptionItemGuidId.trim()
      ? src.subscriptionItemGuidId.trim()
      : undefined;

  if ((itemId === undefined || itemId === null || itemId === "") && !itemGuidId) {
    return { ok: false, error: "A valid subscription package identifier is required." };
  }

  // Enforce Section 4.3: Backend-authoritative RN/LPN restriction
  const pathwayCandidate = String(src.pathway || src.program || src.parentName || "").trim().toUpperCase();
  if (
    pathwayCandidate &&
    pathwayCandidate !== "RN" &&
    pathwayCandidate !== "PN_LPN" &&
    pathwayCandidate !== "LPN" &&
    pathwayCandidate !== "PN" &&
    pathwayCandidate !== "RN_NURSING" &&
    pathwayCandidate !== "LPN_NURSING"
  ) {
    return {
      ok: false,
      error: "Only RN and LPN subscription packages are eligible for checkout.",
    };
  }

  // Validate returnUrl to prevent open redirects; only allow same-origin or configured APP_DOMAIN callbacks
  let safeReturnUrl: string | undefined;
  if (typeof src.returnUrl === "string" && src.returnUrl.trim()) {
    try {
      const parsed = new URL(src.returnUrl.trim(), req.nextUrl.origin);
      const configuredDomain = (process.env.SKEW_LINE_APP_DOMAIN || "https://quiznurse.com").replace(/\/+$/, "");
      const configuredHost = new URL(configuredDomain).host.toLowerCase();
      const reqHost = (req.headers.get("host") || req.nextUrl.host || "").toLowerCase();
      const targetHost = parsed.host.toLowerCase();

      if (targetHost !== reqHost && targetHost !== configuredHost) {
        return { ok: false, error: "Return URL origin is not permitted." };
      }
      if (!parsed.pathname.startsWith("/pages/subscription/package") && !parsed.pathname.startsWith("/learner/subscription")) {
        return { ok: false, error: "Return URL path is not an authorized callback route." };
      }
      safeReturnUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Malformed checkout return URL." };
    }
  }

  // Strip any client-supplied price/amount/currency/discount fields — backend is sole pricing authority
  const payload: Record<string, unknown> = {};
  if (itemId !== undefined && itemId !== null && itemId !== "") {
    payload.subscriptionItemId = typeof itemId === "number" ? itemId : /^\d+$/.test(String(itemId)) ? Number(itemId) : itemId;
  }
  if (itemGuidId) {
    payload.subscriptionItemGuidId = itemGuidId;
  }
  if (safeReturnUrl) {
    payload.returnUrl = safeReturnUrl;
  }
  if (typeof src.provider === "string" && src.provider.trim()) {
    payload.provider = src.provider.trim().slice(0, 64);
  }

  return { ok: true, payload };
}

async function forwardToBackend(
  req: NextRequest,
  method: "POST" | "PUT" | "DELETE" | "GET",
  backendPath: string
): Promise<NextResponse> {
  try {
    if (method !== "GET") {
      const csrf = validateSameOriginRequest(req);
      if (!csrf.ok) {
        return NextResponse.json(
          { success: false, error: csrf.reason, message: csrf.reason },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      const parsedBody = await req.json().catch(() => ({}));
      if (method === "POST" && backendPath.endsWith("/store")) {
        const check = sanitizeCheckoutPayload(parsedBody, req);
        if (!check.ok) {
          return NextResponse.json(
            { success: false, error: check.error, message: check.error },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
        body = check.payload;
      } else if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
        body = parsedBody as Record<string, unknown>;
      }
    }

    const backendBaseUrl = resolveSafeBackendOrigin();
    const queryParams = method === "GET" ? new URL(req.url).searchParams.toString() : "";
    const url = `${backendBaseUrl}${backendPath}${queryParams ? `?${queryParams}` : ""}`;

    // Legacy header fallback first, then server-managed HttpOnly cookies override unconditionally
    const castoLine = req.headers.get("x-casto-line")?.trim();
    const castoBadge = req.headers.get("x-casto-badge")?.trim();
    const cookieSessionHeaders = await getNurviaCastoSessionHeaders();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(await getSiteHeaders()),
      ...(castoLine ? { "x-casto-line": castoLine } : {}),
      ...(castoBadge ? { "x-casto-badge": castoBadge } : {}),
      ...cookieSessionHeaders,
    };

    if (method !== "GET" && (!headers["x-casto-line"] || !headers["x-casto-badge"])) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication is required to initiate checkout.",
          message: "Authentication is required to initiate checkout.",
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // Server-side active subscription check before forwarding checkout initiation
    if (method === "POST" && backendPath.endsWith("/store")) {
      try {
        const statusCheckUrl = `${backendBaseUrl}/api/castoline/nexus/subscription/packages/list/discrete?dynamicPage=1&dynamicPerPage=100`;
        const statusCheckRes = await fetch(statusCheckUrl, {
          method: "GET",
          headers,
          cache: "no-store",
        });
        if (statusCheckRes.ok) {
          const statusJson = await statusCheckRes.json().catch(() => ({}));
          const payload = statusJson?.data && typeof statusJson.data === "object" ? statusJson.data : statusJson;
          const itemsRaw = (payload?.items || (Array.isArray(payload) ? payload : [])) as Array<Record<string, unknown>>;
          if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
            const reqItemId = body.subscriptionItemId;
            const reqItemGuid = body.subscriptionItemGuidId;
            const nowMs = Date.now();

            for (const pkg of itemsRaw) {
              const isMatchingPkg =
                Boolean(reqItemGuid && pkg.guidId && String(pkg.guidId).trim().toLowerCase() === String(reqItemGuid).trim().toLowerCase()) ||
                Boolean(reqItemId !== undefined && pkg.id !== undefined && String(pkg.id).trim() === String(reqItemId).trim());

              if (isMatchingPkg) {
                const userSubs = Array.isArray(pkg.userSubscriptions) ? (pkg.userSubscriptions as Array<Record<string, unknown>>) : [];
                for (const sub of userSubs) {
                  const st = String(sub.subscriptionStatus || sub.status || "").trim().toLowerCase();
                  const validUntil = (sub.validUntil || sub.expiresAt || sub.expiresAtUtc) as string | undefined;
                  const parsedExp = validUntil ? new Date(validUntil).getTime() : NaN;
                  const isDateExpired = Number.isFinite(parsedExp) ? parsedExp < nowMs : false;
                  if ((st === "active" || st === "current" || st === "paid") && !isDateExpired) {
                    return NextResponse.json(
                      {
                        success: false,
                        error: `You already have an active subscription to '${pkg.name || "this package"}'.`,
                        message: `You already have an active subscription to '${pkg.name || "this package"}'.`,
                        errorCode: "ACTIVE_SUBSCRIPTION_EXISTS",
                        activeSubscription: {
                          packageId: pkg.id,
                          packageGuidId: pkg.guidId,
                          packageName: pkg.name,
                          expiresAt: validUntil || null,
                        },
                      },
                      { status: 409, headers: NO_STORE_HEADERS }
                    );
                  }
                }
              }
            }
          }
        }
      } catch {
        // If status verification endpoint encounters error, fall through to backend store
      }
    }

    const backendResponse = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const responseBody: DynamicDominionResponse = await backendResponse.json().catch(() => ({
      error: "Failed to Parse Backend Response ⚓",
    }));

    if ("success" in responseBody && responseBody.success === false) {
      responseBody.error = responseBody.message ?? "Unknown Backend Error 🔖";
    }

    // Surface redirectUrl consistently if nested inside responseBody.data
    if (
      !responseBody.redirectUrl &&
      responseBody.data &&
      typeof responseBody.data === "object" &&
      "redirectUrl" in (responseBody.data as Record<string, unknown>)
    ) {
      const nestedRedirect = (responseBody.data as Record<string, unknown>).redirectUrl;
      if (typeof nestedRedirect === "string") {
        responseBody.redirectUrl = nestedRedirect;
      }
    }

    return NextResponse.json(responseBody, {
      status: backendResponse.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : `Unknown ${method} error`;
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "POST", `${BASE_ROUTE}/store`);
}

export async function PUT(req: NextRequest) {
  return forwardToBackend(req, "PUT", `${BASE_ROUTE}/update`);
}

export async function DELETE(req: NextRequest) {
  return forwardToBackend(req, "DELETE", `${BASE_ROUTE}/delete`);
}

export async function GET(req: NextRequest) {
  const fetchtype = new URL(req.url).searchParams.get("fetchtype");

  if (fetchtype === "absolute") {
    return forwardToBackend(req, "GET", `${BASE_ROUTE}/list/absolute`);
  }

  if (fetchtype === "distinct") {
    return forwardToBackend(req, "GET", `${BASE_ROUTE}/list/distinct`);
  }

  if (fetchtype === "discrete") {
    return forwardToBackend(req, "GET", `${BASE_ROUTE}/list/discrete`);
  }

  if (fetchtype === "relative") {
    return forwardToBackend(req, "GET", `${BASE_ROUTE}/list/relative`);
  }

  return NextResponse.json({ error: "Invalid Fetchtype" }, { status: 400, headers: NO_STORE_HEADERS });
}
