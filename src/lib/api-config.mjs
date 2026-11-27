/**
 * Fail-closed environment, backend URL, and application identity resolution for NURVIA.
 * Shared by next.config.mjs, server-side API client, and Node unit tests.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const CANONICAL_PRODUCTION_ORIGIN = 'https://quiznurse.com';
export const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:3000';

export class BackendConfigurationError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code = 'CONFIGURATION_ERROR') {
    super(message);
    this.name = 'BackendConfigurationError';
    this.code = code;
  }
}

/**
 * Checks whether an origin or hostname points to a local loopback interface.
 *
 * @param {string} originOrHost
 * @returns {boolean}
 */
export function isLocalhostOrigin(originOrHost) {
  if (!originOrHost || typeof originOrHost !== 'string') return false;
  const trimmed = originOrHost.trim().toLowerCase();
  return (
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('https://localhost') ||
    trimmed.startsWith('http://127.0.0.1') ||
    trimmed.startsWith('https://127.0.0.1') ||
    trimmed === 'localhost' ||
    trimmed.startsWith('localhost:') ||
    trimmed === '127.0.0.1' ||
    trimmed.startsWith('127.0.0.1:')
  );
}

/**
 * Checks whether an origin is a trusted Vercel Preview origin or allowed preview host.
 *
 * @param {string} origin
 * @returns {boolean}
 */
export function isTrustedPreviewOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const candidate = origin.includes('://') ? origin : `https://${origin}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host.endsWith('.vercel.app') || host === 'preview.quiznurse.com' || host.endsWith('.quiznurse.com');
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical, environment-aware application origin for QuizNurse.
 *
 * Rules:
 * 1. Production resolves to https://quiznurse.com (and never localhost).
 * 2. Development resolves to configured SKEW_LINE_APP_DOMAIN or http://localhost:3000.
 * 3. Preview follows a validated trusted-preview policy (*.vercel.app or *.quiznurse.com).
 * 4. Missing or invalid production configuration fails closed rather than using localhost.
 * 5. Server-side code does not depend on untrusted Host headers.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {{ requireConfigured?: boolean }} [options]
 * @returns {string}
 */
export function resolveCanonicalOrigin(env = process.env, options = {}) {
  const isProduction = env.NODE_ENV === 'production';
  const vercelEnv = (env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV || '').trim().toLowerCase();
  const rawDomain = (env.SKEW_LINE_APP_DOMAIN || env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL || '').trim();

  // Preview environment handling
  if (vercelEnv === 'preview') {
    const rawPreview = rawDomain || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '');
    if (!rawPreview || rawPreview.startsWith('<')) {
      throw new BackendConfigurationError(
        'Vercel Preview application origin is not configured.',
        'MISSING_PREVIEW_ORIGIN'
      );
    }
    const candidate = rawPreview.includes('://') ? rawPreview : `https://${rawPreview}`;
    if (!isTrustedPreviewOrigin(candidate)) {
      throw new BackendConfigurationError(
        `Untrusted or invalid preview origin: "${candidate}". Must use HTTPS and a trusted preview domain.`,
        'INVALID_PREVIEW_ORIGIN'
      );
    }
    return candidate.replace(/\/+$/, '');
  }

  // Production environment handling
  if (isProduction) {
    if (!rawDomain || rawDomain.startsWith('<')) {
      if (options.requireConfigured) {
        throw new BackendConfigurationError(
          'Production application domain (SKEW_LINE_APP_DOMAIN) is not configured.',
          'MISSING_APP_DOMAIN'
        );
      }
      return CANONICAL_PRODUCTION_ORIGIN;
    }

    if (isLocalhostOrigin(rawDomain)) {
      throw new BackendConfigurationError(
        'Production application origin cannot be localhost. Configure canonical production domain "https://quiznurse.com".',
        'INVALID_PRODUCTION_ORIGIN'
      );
    }

    let parsed;
    try {
      parsed = new URL(rawDomain);
    } catch {
      throw new BackendConfigurationError(
        `Invalid production application origin format: "${rawDomain}".`,
        'INVALID_APP_DOMAIN'
      );
    }

    if (parsed.protocol !== 'https:') {
      throw new BackendConfigurationError(
        'HTTPS is required for production application origin.',
        'INSECURE_PRODUCTION_ORIGIN'
      );
    }

    return parsed.toString().replace(/\/+$/, '');
  }

  // Development / Test environment handling
  if (rawDomain && !rawDomain.startsWith('<')) {
    try {
      const parsed = new URL(rawDomain.includes('://') ? rawDomain : `http://${rawDomain}`);
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      throw new BackendConfigurationError(
        `Invalid development application origin format: "${rawDomain}".`,
        'INVALID_APP_DOMAIN'
      );
    }
  }

  return DEFAULT_DEVELOPMENT_ORIGIN;
}

/**
 * Resolves the canonical social authentication completion route URL.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {{ requireConfigured?: boolean }} [options]
 * @returns {string}
 */
export function resolveSocialCompleteUrl(env = process.env, options = {}) {
  const origin = resolveCanonicalOrigin(env, options);
  return `${origin}/auth/social/complete`;
}

/**
 * Resolves and validates the remote .NET / LexmaCasto backend base URL from SKEW_LINE or legacy env vars.
 * Throws explicitly if missing, malformed, or using an unsupported protocol/backend.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {{ requireHttps?: boolean }} [options]
 * @returns {string}
 */
export function resolveBackendBaseUrl(env = process.env, options = {}) {
  const activeBackend = (env.SKEW_LINE_ACTIVE_BACKEND || '').trim();
  const legacyUrl = (env.NEXT_PUBLIC_API_URL || '').trim();
  const skewLineUrl = (env.SKEW_LINE_DOTNET_BASE_URL || '').trim();

  if (activeBackend && activeBackend !== 'dotnet' && !legacyUrl) {
    throw new BackendConfigurationError(
      `Unsupported SKEW_LINE_ACTIVE_BACKEND="${activeBackend}". Expected "dotnet" for remote .NET backend integration.`,
      'UNSUPPORTED_BACKEND'
    );
  }

  const rawUrl = skewLineUrl || legacyUrl;
  if (!rawUrl || rawUrl.startsWith('<')) {
    throw new BackendConfigurationError(
      'QuizNurse backend URL is not configured. Set SKEW_LINE_DOTNET_BASE_URL in apps/web/.env.local (or deployment environment variables).',
      'MISSING_BACKEND_URL'
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BackendConfigurationError(
      `Invalid NURVIA backend URL format: "${rawUrl}". Expected a valid http:// or https:// URL.`,
      'INVALID_BACKEND_URL'
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new BackendConfigurationError(
      `Unsupported NURVIA backend protocol "${parsed.protocol}". Only http: and https: are permitted.`,
      'INVALID_BACKEND_PROTOCOL'
    );
  }

  const isProduction = env.NODE_ENV === 'production';
  const requireHttps = options.requireHttps ?? isProduction;

  if (requireHttps && parsed.protocol !== 'https:') {
    throw new BackendConfigurationError(
      'HTTPS is required for production authentication-bearing traffic. Configure an https:// reverse proxy for SKEW_LINE_DOTNET_BASE_URL.',
      'INSECURE_PRODUCTION_ORIGIN'
    );
  }

  return parsed.toString().replace(/\/+$/, '');
}

/**
 * Checks whether the configured backend URL uses HTTPS (required for production auth cookies).
 *
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function isHttpsBackendUrl(baseUrl) {
  try {
    return new URL(baseUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolves and validates NURVIA's dedicated server-side application identity.
 * Never falls back to another application's key or domain (e.g., Qlex-Nursing / WEBSITE_1).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ appKey: string; appDomain: string; appName: string; appTitle: string }}
 */
export function resolveApplicationIdentity(env = process.env) {
  const appKey = (env.SKEW_LINE_APP_KEY || '').trim();
  const appDomain = (env.SKEW_LINE_APP_DOMAIN || '').trim();
  const appName = (env.SKEW_LINE_APP_NAME || 'QuizNurse').trim();
  const appTitle = (env.SKEW_LINE_APP_TITLE || 'QuizNurse').trim();

  if (!appKey || appKey.startsWith('<')) {
    throw new BackendConfigurationError(
      'NURVIA application key (SKEW_LINE_APP_KEY) is not provisioned. Configure a dedicated NURVIA application key from the backend owner.',
      'MISSING_APP_KEY'
    );
  }

  if (!appDomain || appDomain.startsWith('<')) {
    throw new BackendConfigurationError(
      'NURVIA application domain (SKEW_LINE_APP_DOMAIN) is not configured. Configure the officially provisioned NURVIA domain.',
      'MISSING_APP_DOMAIN'
    );
  }

  // Reject control chars / CRLF (header injection) in appKey while preserving internal spaces;
  // reject any whitespace or control chars in appDomain.
  if (/[\r\n\0\x01-\x1F\x7F]/.test(appKey) || /[\r\n\s\0\x01-\x1F\x7F]/.test(appDomain)) {
    throw new BackendConfigurationError(
      'Invalid characters in NURVIA application identity configuration.',
      'INVALID_APP_IDENTITY'
    );
  }

  try {
    if (appDomain.includes('://')) {
      const parsed = new URL(appDomain);
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    }
  } catch {
    throw new BackendConfigurationError(
      `Invalid SKEW_LINE_APP_DOMAIN format: "${appDomain}".`,
      'INVALID_APP_DOMAIN'
    );
  }

  if (env.NODE_ENV === 'production' && (env.VERCEL_ENV || '').trim().toLowerCase() !== 'preview') {
    if (isLocalhostOrigin(appDomain)) {
      throw new BackendConfigurationError(
        'Production application domain cannot be localhost. Configure canonical production domain "https://quiznurse.com".',
        'INVALID_PRODUCTION_ORIGIN'
      );
    }
  }

  return {
    appKey,
    appDomain: appDomain.replace(/\/+$/, ''),
    appName,
    appTitle,
  };
}

/**
 * Validates complete server-side backend configuration (origin + application identity).
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {{ requireHttps?: boolean }} [options]
 */
export function validateServerConfiguration(env = process.env, options = {}) {
  const backendBaseUrl = resolveBackendBaseUrl(env, options);
  const identity = resolveApplicationIdentity(env);
  return {
    backendBaseUrl,
    ...identity,
  };
}

/**
 * Returns non-secret SKEW_LINE application metadata for server-side diagnostics.
 * Never exposes private keys or credentials to client bundles.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function getSkewLineServerConfig(env = process.env) {
  const backendBaseUrl = resolveBackendBaseUrl(env);
  const appDomain = (env.SKEW_LINE_APP_DOMAIN || '').trim();
  const appKey = (env.SKEW_LINE_APP_KEY || '').trim();
  return {
    appName: (env.SKEW_LINE_APP_NAME || 'QuizNurse').trim(),
    appTitle: (env.SKEW_LINE_APP_TITLE || 'QuizNurse').trim(),
    appDomain,
    appDomainConfigured: Boolean(appDomain && !appDomain.startsWith('<')),
    appKeyConfigured: Boolean(appKey && !appKey.startsWith('<')),
    activeBackend: (env.SKEW_LINE_ACTIVE_BACKEND || 'dotnet').trim(),
    backendBaseUrl,
    isHttps: isHttpsBackendUrl(backendBaseUrl),
  };
}
