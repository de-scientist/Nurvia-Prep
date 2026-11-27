// Placed at Root Level : src\middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { resolveCanonicalOrigin } from "@/lib/api-config.mjs";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "";

  const country =
    req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "";
  const city = safeDecode(req.headers.get("x-vercel-ip-city") || "");
  const location = [city, country].filter(Boolean).join(", ");

  const mobileRaw = req.headers.get("sec-ch-ua-mobile");
  const mobile = mobileRaw === "?1" ? "true" : mobileRaw === "?0" ? "false" : "";

  const isApiCall = req.nextUrl.pathname.startsWith("/api");
  const pageReferer = req.headers.get("referer") || "";
  let appOrigin: string;
  try {
    appOrigin = resolveCanonicalOrigin(process.env);
  } catch {
    appOrigin = (process.env.SKEW_LINE_APP_DOMAIN || req.nextUrl.origin).replace(/\/+$/, "");
  }
  const currentUrl =
    isApiCall && pageReferer
      ? pageReferer
      : `${appOrigin}${req.nextUrl.pathname}${req.nextUrl.search}`;
  h.set("x-current-path", currentUrl);
  h.set("x-current-ip", ip);
  h.set("x-current-location", encodeURIComponent(location));
  h.set("x-current-country", country);
  h.set("x-current-ua", req.headers.get("user-agent") || "");
  h.set("x-current-referrer", req.headers.get("referer") || "");
  h.set("x-current-mobile", mobile);
  h.set("x-current-request-id", crypto.randomUUID());

  let sid = req.cookies.get("x-site-session")?.value;
  const isNew = !sid;
  if (!sid) sid = crypto.randomUUID();
  h.set("x-current-session-id", sid);

  const pathname = req.nextUrl.pathname;

  // Server-side authentication gate for protected examination and account routes.
  // Guests can discover subjects on the public homepage, /exams, and /learner/library,
  // but cannot access protected examination libraries/details (/exams/[id], /learner/library/[id]),
  // or examination sessions (/exam-session).
  const isProtectedPath =
    pathname.startsWith("/exams/") ||
    pathname === "/exam-session" ||
    pathname.startsWith("/exam-session/") ||
    pathname === "/learner" ||
    (pathname.startsWith("/learner/") && pathname !== "/learner/library");

  if (isProtectedPath) {
    const castoLine = req.cookies.get("nurvia_casto_line")?.value?.trim();
    const castoBadge = req.cookies.get("nurvia_casto_badge")?.value?.trim();

    if (!castoLine || !castoBadge) {
      const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      const signinUrl = new URL(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`, req.url);
      return NextResponse.redirect(signinUrl);
    }
  }

  const res = NextResponse.next({ request: { headers: h } });
  if (isNew) {
    res.cookies.set("x-site-session", sid, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};