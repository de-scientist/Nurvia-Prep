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
  data?: T;
}

const STRATA_GROUP = "subscription";
const STRATA_NAME = "items";
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

    let body: unknown = {};
    if (method !== "GET") {
      body = await req.json().catch(() => ({}));
    }

    const backendBaseUrl = resolveSafeBackendOrigin();
    const queryParams = method === "GET" ? new URL(req.url).searchParams.toString() : "";
    const url = `${backendBaseUrl}${backendPath}${queryParams ? `?${queryParams}` : ""}`;

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

  if (fetchtype === "relative") {
    return forwardToBackend(req, "GET", `${BASE_ROUTE}/list/relative`);
  }

  return NextResponse.json({ error: "Invalid Fetchtype" }, { status: 400, headers: NO_STORE_HEADERS });
}
