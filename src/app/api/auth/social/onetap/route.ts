import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api/api/api";
import { getSiteHeaders } from "@/lib/config/siteHeaders";
import { getNurviaCastoSessionHeaders } from "@/lib/lexmacasto/qlexSessionBridge";
import {
  extractCastoCredentialsFromLogin,
  sanitizeAuthUser,
} from "@/lib/lexmacasto/client";
import type { LexmaCastoLoginResponseRaw } from "@/lib/lexmacasto/contracts";
import {
  setServerCastoSession,
  validateSameOriginRequest,
} from "@/lib/lexmacasto/session";
import { getTemporaryChallenge } from "@/lib/auth/temporaryChallenge";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export interface OneTapCredentialBody {
  credential: string;
  select_by?: string;
  context?: "login" | "register";
  role?: string;
  dashboardName?: string;
  challenge?: string;
  fingerprint?: string;
  ipAddress?: string;
}

export async function POST(req: NextRequest) {
  const csrf = validateSameOriginRequest(req);
  if (!csrf.ok) {
    return NextResponse.json(
      { success: false, message: csrf.reason, errorCode: "CSRF_REJECTED" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as OneTapCredentialBody | null;

    if (!body?.credential) {
      return NextResponse.json(
        { success: false, message: "Missing One Tap credential.", errorCode: "VALIDATION_ERROR" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const backendBaseUrl = getBackendBaseUrl();
    const backendUrl = `${backendBaseUrl}/api/castoline/auth/social/onetap`;

    const backendResponse = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getSiteHeaders()),
        ...(await getNurviaCastoSessionHeaders()),
      },
      body: JSON.stringify({
        idToken: body.credential,
        context: body.context ?? "login",
        role: body.role ?? "Learner",
        dashboardName: body.dashboardName ?? "web",
        challenge:
          body.challenge ??
          getTemporaryChallenge(body.context === "register" ? "register" : "standard_login"),
        fingerprint: body.fingerprint,
        ipAddress: body.ipAddress,
      }),
    });

    const parsed = (await backendResponse.json().catch(() => ({}))) as LexmaCastoLoginResponseRaw;

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: parsed?.message || "One Tap authentication failed.",
          errorCode: "AUTH_FAILED",
        },
        { status: backendResponse.status, headers: NO_STORE_HEADERS }
      );
    }

    const creds = extractCastoCredentialsFromLogin(parsed);
    const rawUser = parsed.user ?? parsed.data?.user;
    const safeUser = sanitizeAuthUser(rawUser);

    const response = NextResponse.json(
      {
        success: true,
        message: parsed.message || "Signed in via One Tap.",
        user: safeUser,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );

    if (creds) {
      setServerCastoSession(response, creds, safeUser?.dashboardName);
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "One Tap login failed";
    return NextResponse.json(
      { success: false, message, errorCode: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
