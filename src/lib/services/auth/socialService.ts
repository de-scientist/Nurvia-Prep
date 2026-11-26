import { apiFetch } from "@/lib/api/api/api";
import {
  getOrCreateFingerprint,
  getStoredIPAddress,
  resolveAndStoreIPAddress,
  clearAuthSessionCookies,
} from "@/lib/utils/sessions/generateSystemUserSessionCookies";
import {
  sanitizeInternalDestination,
  saveAuthReturnContext,
  buildValidatedLearningContext,
} from "@/lib/subscriptions/cart-store";

export type SocialProvider =
  | "google"
  | "apple"
  | "facebook"
  | "github"
  | "linkedin"
  | "microsoft";

export type SocialContext = "login" | "register";

export interface SocialRedirectOptions {
  provider: SocialProvider;
  context: SocialContext;
  role?: string;
  dashboardName?: string;
  redirectPath?: string;
}

const SOCIAL_ROUTE_MAP: Record<SocialProvider, string> = {
  google: "/api/auth/social/google",
  apple: "/api/auth/social/apple",
  facebook: "/api/auth/social/facebook",
  github: "/api/auth/social/github",
  linkedin: "/api/auth/social/linkedin",
  microsoft: "/api/auth/social/microsoft",
};

export const buildSocialRedirectUrl = ({
  provider,
  context,
  role = "Learner",
  dashboardName = "web",
  redirectPath,
  fingerprint,
  ipAddress,
}: SocialRedirectOptions & { fingerprint?: string; ipAddress?: string }): string => {
  const base = SOCIAL_ROUTE_MAP[provider];
  const safeRedirect = sanitizeInternalDestination(redirectPath) || "/learner";
  const params = new URLSearchParams({
    context,
    role,
    dashboardName,
    challenge:
      context === "login"
        ? "learner.login.skew8lancasto"
        : "register-skew8@lancasto",
  });
  params.set("redirectPath", safeRedirect);
  if (fingerprint) params.set("fingerprint", fingerprint);
  if (ipAddress) params.set("ipAddress", ipAddress);
  return `${base}?${params.toString()}`;
};

export const redirectToSocialProvider = async (
  options: SocialRedirectOptions
): Promise<void> => {
  if (typeof window === "undefined") return;

  const safeRedirect = sanitizeInternalDestination(options.redirectPath) || "/learner";
  if (safeRedirect && safeRedirect !== "/learner") {
    saveAuthReturnContext(
      buildValidatedLearningContext({
        returnTo: safeRedirect,
      })
    );
  }

  const fingerprint = getOrCreateFingerprint();
  const ipAddress = getStoredIPAddress() ?? (await resolveAndStoreIPAddress());

  const url = buildSocialRedirectUrl({
    ...options,
    redirectPath: safeRedirect,
    fingerprint,
    ipAddress: ipAddress ?? undefined,
  });

  window.location.href = url;
};

export interface OneTapLoginParams {
  credential: string;
  select_by?: string;
  context?: SocialContext;
  role?: string;
  dashboardName?: string;
}

export interface OneTapLoginResponse {
  success?: boolean;
  error?: string;
  casto_line?: string;
  casto_badge?: string;
  redirect_url?: string;
}

export const oneTapLogin = async ({
  credential,
  select_by,
  context = "login",
  role = "Learner",
  dashboardName = "web",
}: OneTapLoginParams): Promise<OneTapLoginResponse> => {
  try {
    const fingerprint = getOrCreateFingerprint();
    const ipAddress = getStoredIPAddress() ?? (await resolveAndStoreIPAddress());

    const result = await apiFetch<OneTapLoginResponse>("/api/auth/social/onetap", {
      method: "POST",
      body: JSON.stringify({
        credential,
        select_by,
        context,
        role,
        dashboardName,
        challenge:
          context === "login"
            ? "learner.login.skew8lancasto"
            : "register-skew8@lancasto",
        fingerprint,
        ipAddress: ipAddress ?? undefined,
      }),
      credentials: "include",
    });

    // Server /api/auth/social/onetap sets HttpOnly nurvia_casto_* cookies; scrub any legacy JS cookies
    clearAuthSessionCookies();

    return result;
  } catch (err: unknown) {
    if (err instanceof Error) {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.errors) {
          const messages = Object.entries(parsed.errors)
            .flatMap(([field, msgs]) =>
              (msgs as string[]).map((m) => `${field}: ${m}`)
            )
            .join(" | ");
          return { error: messages };
        }
        if (parsed?.error) return { error: parsed.error };
        if (parsed?.title) return { error: parsed.title };
      } catch {
        // message wasn't JSON
      }
      return { error: err.message };
    }
    return { error: "Unknown One Tap login error" };
  }
};
