import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api/api/api";
import { resolveBackendBaseUrl, resolveCanonicalOrigin } from "@/lib/api-config.mjs";
import { getSiteHeaders } from "@/lib/config/siteHeaders";

function resolveSafeBackendOrigin(): string {
  try {
    return resolveBackendBaseUrl(process.env);
  } catch {
    return getBackendBaseUrl();
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const redirectPath = searchParams.get("redirectPath") || searchParams.get("returnTo") || "";

  let canonicalOrigin = "https://quiznurse.com";
  try {
    canonicalOrigin = resolveCanonicalOrigin(process.env);
  } catch {
    canonicalOrigin = req.nextUrl.origin;
  }

  let providerUrl: string | null = null;
  try {
    const backendBaseUrl = resolveSafeBackendOrigin();
    const backendUrl = `${backendBaseUrl}/api/castoline/auth/social/google?${searchParams.toString()}`;
    const siteHeaders = await getSiteHeaders();

    const backendResponse = await fetch(backendUrl, {
      redirect: "manual",
      headers: {
        ...siteHeaders,
        "x-site-domain": canonicalOrigin,
      },
      cache: "no-store",
    });

    providerUrl = backendResponse.headers.get("location");
  } catch (err) {
    console.error("Social route (Google) upstream connection failed:", err);
  }

  if (!providerUrl) {
    const referer = req.headers.get("referer");
    let target: URL;
    try {
      target = referer ? new URL(referer) : new URL("/sign-in", canonicalOrigin);
      if (target.origin !== canonicalOrigin && target.origin !== req.nextUrl.origin) {
        target = new URL("/sign-in", canonicalOrigin);
      }
    } catch {
      target = new URL("/sign-in", canonicalOrigin);
    }

    if (
      redirectPath &&
      redirectPath.startsWith("/") &&
      !redirectPath.startsWith("//") &&
      !target.searchParams.has("returnTo")
    ) {
      target.searchParams.set("returnTo", redirectPath);
    }

    const response = NextResponse.redirect(target, { status: 302 });
    response.cookies.set("socialError", "Failed Sign In with Google - Kindly Continue with Email.", {
      maxAge: 45,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.redirect(providerUrl, { status: 302 });
}
