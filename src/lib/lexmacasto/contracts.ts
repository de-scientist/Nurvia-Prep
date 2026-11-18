/**
 * Verified LexmaCasto backend API contracts for NURVIA.
 * Based on Qlex-Nursing Phase 9 backend contract discovery.
 * Never invent unsupported endpoints (e.g. /csrf, /refresh, AcademicYear, Season, strataclasses).
 */

export const LEXMACASTO_AUTH_ENDPOINTS = {
  LOGIN: '/api/castoline/auth/login',
  REGISTER: '/api/castoline/auth/register',
  CURRENT_USER: '/api/castoline/system/user/list/current',
  LOGOUT_DISTINCT: '/api/castoline/auth/logout/sessions/distinct',
  LOGOUT_RELATIVE: '/api/castoline/auth/logout/sessions/relative',
  ACCOUNT_DESTROY: '/api/castoline/auth/account/destroy',
  SUPPORT_VALIDATE: '/api/castoline/strata/support/validate',
} as const;

export const LEXMACASTO_EXTRA_ENDPOINTS = {
  SEEK_BASE: '/api/castoline/strata/seek',
  DIY_EXAM_STORE: '/api/castoline/strata/assessment/exams/diy/learning/store',
  RECOVERY_PASSWORD: '/api/castoline/auth/recovery/password',
  RECOVERY_SOCIAL: '/api/castoline/auth/recovery/social',
  SUPPORT_BASE: '/api/castoline/strata/support',
  SUBSCRIPTION_PACKAGES_BASE: '/api/castoline/nexus/subscription/packages',
  SUBSCRIPTION_ITEMS_BASE: '/api/castoline/nexus/subscription/items',
  SYSTEM_DEBUG_ROUTES_VIEW: '/system/debug/routes/view',
  SYSTEM_DEBUG_ROUTES: '/system/debug/routes',
} as const;

export interface SystemDebugRouteRecord {
  method?: string;
  methods?: string[];
  path?: string;
  controller?: string;
  handler?: string;
  action?: string;
  group?: string;
  area?: string;
  name?: string;
  auth?: string | boolean;
  roles?: string[];
  parameters?: string[];
  raw?: Record<string, unknown>;
}

export interface SystemDebugRoutesPayload {
  endpoint: string;
  routes: SystemDebugRouteRecord[];
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
  upstreamStatus: number;
  upstreamAvailable: boolean;
}

export function buildSystemDebugRoutesEndpointPath(params?: {
  target?: 'view' | 'routes';
  search?: string;
  method?: string;
  group?: string;
  page?: number;
  perPage?: number;
}): string {
  const base =
    params?.target === 'routes'
      ? LEXMACASTO_EXTRA_ENDPOINTS.SYSTEM_DEBUG_ROUTES
      : LEXMACASTO_EXTRA_ENDPOINTS.SYSTEM_DEBUG_ROUTES_VIEW;
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.method) qs.set('method', params.method);
  if (params?.group) qs.set('group', params.group);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.perPage) qs.set('perPage', String(params.perPage));
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

export function normalizeSystemDebugRouteRecord(raw: unknown): SystemDebugRouteRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const record: SystemDebugRouteRecord = {};

  if (typeof obj.method === 'string' && obj.method.trim()) {
    record.method = obj.method.trim().toUpperCase();
  } else if (typeof obj.httpMethod === 'string' && obj.httpMethod.trim()) {
    record.method = obj.httpMethod.trim().toUpperCase();
  }

  if (Array.isArray(obj.methods)) {
    const methods = obj.methods
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .map((m) => m.trim().toUpperCase());
    if (methods.length > 0) {
      record.methods = methods;
      if (!record.method) record.method = methods.join(', ');
    }
  } else if (Array.isArray(obj.httpMethods)) {
    const methods = obj.httpMethods
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .map((m) => m.trim().toUpperCase());
    if (methods.length > 0) {
      record.methods = methods;
      if (!record.method) record.method = methods.join(', ');
    }
  }

  const pathCandidate = obj.path ?? obj.pattern ?? obj.route ?? obj.template ?? obj.url;
  if (typeof pathCandidate === 'string' && pathCandidate.trim()) {
    record.path = pathCandidate.trim();
  }

  if (typeof obj.controller === 'string' && obj.controller.trim()) {
    record.controller = obj.controller.trim();
  }
  const handlerCandidate = obj.handler ?? obj.displayName ?? obj.endpoint;
  if (typeof handlerCandidate === 'string' && handlerCandidate.trim()) {
    record.handler = handlerCandidate.trim();
  }
  if (typeof obj.action === 'string' && obj.action.trim()) {
    record.action = obj.action.trim();
  }
  if (typeof obj.group === 'string' && obj.group.trim()) {
    record.group = obj.group.trim();
  }
  if (typeof obj.area === 'string' && obj.area.trim()) {
    record.area = obj.area.trim();
  }
  if (typeof obj.name === 'string' && obj.name.trim()) {
    record.name = obj.name.trim();
  }

  const authCandidate = obj.auth ?? obj.requiresAuth ?? obj.isAuthenticated;
  if (typeof authCandidate === 'boolean' || (typeof authCandidate === 'string' && authCandidate.trim())) {
    record.auth = authCandidate;
  }

  if (Array.isArray(obj.roles)) {
    const roles = obj.roles.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
    if (roles.length > 0) record.roles = roles;
  } else if (Array.isArray(obj.policies)) {
    const policies = obj.policies.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (policies.length > 0) record.roles = policies;
  }

  if (Array.isArray(obj.parameters)) {
    const params = obj.parameters.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (params.length > 0) record.parameters = params;
  }

  if (Object.keys(record).length === 0) {
    return null;
  }

  return record;
}

export function extractRoutesFromUpstreamData(data: unknown): {
  valid: boolean;
  routes: SystemDebugRouteRecord[];
  upstreamTotal?: number;
} {
  if (Array.isArray(data)) {
    const routes = data
      .map(normalizeSystemDebugRouteRecord)
      .filter((r): r is SystemDebugRouteRecord => r !== null);
    return { valid: data.length === 0 || routes.length > 0, routes };
  }
  if (!data || typeof data !== 'object') {
    return { valid: false, routes: [] };
  }
  const obj = data as Record<string, unknown>;
  const candidates = [obj.routes, obj.items, obj.data, obj.endpoints];
  for (const cand of candidates) {
    if (Array.isArray(cand)) {
      const routes = cand
        .map(normalizeSystemDebugRouteRecord)
        .filter((r): r is SystemDebugRouteRecord => r !== null);
      const total =
        typeof obj.totalCount === 'number'
          ? obj.totalCount
          : typeof obj.skewTotal === 'number'
            ? obj.skewTotal
            : typeof obj.total === 'number'
              ? obj.total
              : undefined;
      return { valid: cand.length === 0 || routes.length > 0, routes, upstreamTotal: total };
    }
    if (cand && typeof cand === 'object' && !Array.isArray(cand)) {
      const nested = extractRoutesFromUpstreamData(cand);
      if (nested.valid) return nested;
    }
  }
  return { valid: false, routes: [] };
}

export const LEXMACASTO_SUPPORT_RESOURCES = [
  '2fa',
  'account',
  'email',
  'message',
  'password',
  'phone',
  'social',
] as const;

export type SupportResourceKey = (typeof LEXMACASTO_SUPPORT_RESOURCES)[number];

export function isSupportResourceKey(value: string): value is SupportResourceKey {
  return (LEXMACASTO_SUPPORT_RESOURCES as readonly string[]).includes(value);
}

export function buildSupportEndpointPath(
  resource: SupportResourceKey,
  action: 'list' | 'store' | 'update' | 'delete',
  fetchtype: StrataFetchType | 'discrete' | 'nominal' = 'relative',
  queryParams?: Record<string, string | number | boolean | undefined | null>
): string {
  const base = `${LEXMACASTO_EXTRA_ENDPOINTS.SUPPORT_BASE}/${resource}`;
  if (action !== 'list') {
    return `${base}/${action}`;
  }
  const params = new URLSearchParams();
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (k === 'fetchtype') continue;
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    }
  }
  params.set('fetchtype', fetchtype);
  return `${base}/list/${fetchtype}?${params.toString()}`;
}

export function buildSubscriptionEndpointPath(
  resource: 'packages' | 'items',
  fetchtype: 'absolute' | 'distinct' | 'relative' | 'discrete' = 'discrete'
): string {
  const base =
    resource === 'packages'
      ? LEXMACASTO_EXTRA_ENDPOINTS.SUBSCRIPTION_PACKAGES_BASE
      : LEXMACASTO_EXTRA_ENDPOINTS.SUBSCRIPTION_ITEMS_BASE;
  return `${base}/list/${fetchtype}?fetchtype=${fetchtype}`;
}

export const LEXMACASTO_STRATA_ENDPOINTS = {
  // Main strata
  categories: {
    path: '/api/castoline/strata/main/categories/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  subcategories: {
    path: '/api/castoline/strata/main/subcategories/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  domains: {
    path: '/api/castoline/strata/main/domains/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },

  // Learning strata
  programs: {
    path: '/api/castoline/strata/learning/programs/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  courses: {
    path: '/api/castoline/strata/learning/courses/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  subjects: {
    path: '/api/castoline/strata/learning/subjects/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  units: {
    path: '/api/castoline/strata/learning/units/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  lessons: {
    path: '/api/castoline/strata/learning/lessons/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  topics: {
    path: '/api/castoline/strata/learning/topics/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  concepts: {
    path: '/api/castoline/strata/learning/concepts/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  facts: {
    path: '/api/castoline/strata/learning/facts/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },

  // Assessment strata
  assessments: {
    path: '/api/castoline/strata/assessment/assessments/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  exams: {
    path: '/api/castoline/strata/assessment/exams/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  examsLive: {
    path: '/api/castoline/strata/assessment/exams/list/live',
    fetchtype: 'live',
    requiresAuth: true,
  },
  examResults: {
    path: '/api/castoline/strata/assessment/exams/results/list/relative',
    fetchtype: 'relative',
    requiresAuth: true,
  },
  sections: {
    path: '/api/castoline/strata/assessment/sections/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  questions: {
    path: '/api/castoline/strata/assessment/questions/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },

  // Institution strata (verified route is `classes`, not `strataclasses`)
  institutions: {
    path: '/api/castoline/strata/institution/institutions/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  schools: {
    path: '/api/castoline/strata/institution/schools/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  departments: {
    path: '/api/castoline/strata/institution/departments/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  divisions: {
    path: '/api/castoline/strata/institution/divisions/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  cohorts: {
    path: '/api/castoline/strata/institution/cohorts/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
  classes: {
    path: '/api/castoline/strata/institution/classes/list/absolute',
    fetchtype: 'absolute',
    requiresAuth: false,
  },
} as const;

export type StrataResourceKey = keyof typeof LEXMACASTO_STRATA_ENDPOINTS;

export function isStrataResourceKey(value: string): value is StrataResourceKey {
  return Object.prototype.hasOwnProperty.call(LEXMACASTO_STRATA_ENDPOINTS, value);
}

export type StrataFetchType = 'absolute' | 'distinct' | 'relative' | 'current' | 'live';
export type StrataMutationAction = 'store' | 'update' | 'delete';

/**
 * Builds a LexmaCasto strata list path with the requested (or default) `fetchtype`.
 */
export function buildStrataEndpointPath(
  resource: StrataResourceKey,
  queryParams?: Record<string, string | number | boolean | undefined | null>,
  fetchtypeOverride?: StrataFetchType
): string {
  const def = LEXMACASTO_STRATA_ENDPOINTS[resource];
  const resolvedFetchType = fetchtypeOverride ?? def.fetchtype;
  const basePath = def.path.replace(/\/list\/[^/]+$/, `/list/${resolvedFetchType}`);
  const params = new URLSearchParams();
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === 'fetchtype') continue;
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
  }
  if (fetchtypeOverride) {
    params.set('fetchtype', fetchtypeOverride);
  } else {
    params.set('fetchtype', def.fetchtype);
  }
  return `${basePath}?${params.toString()}`;
}

/**
 * Builds a LexmaCasto strata mutation path (`/store`, `/update`, `/delete`).
 */
export function buildStrataMutationPath(
  resource: StrataResourceKey,
  action: StrataMutationAction
): string {
  const def = LEXMACASTO_STRATA_ENDPOINTS[resource];
  return def.path.replace(/\/list\/[^/]+$/, `/${action}`);
}

export function buildCurrentUserEndpointPath(): string {
  return `${LEXMACASTO_AUTH_ENDPOINTS.CURRENT_USER}?fetchtype=current`;
}

export type LoginMethod = 'password' | 'pin' | 'provider' | string;

export interface LexmaCastoLoginPayload {
  email: string;
  password?: string;
  pin?: string;
  loginMethod: LoginMethod;
  LoginProvider?: string;
  fingerprint?: string;
  ipAddress?: string;
  dashboardName?: string;
  role?: string;
  challenge?: string;
}

export interface LexmaCastoRegisterPayload {
  username: string;
  email: string;
  phone?: string;
  password?: string;
  passwordConfirmation?: string;
  pin?: string;
  pinConfirmation?: string;
  loginMethod: LoginMethod;
  agree: boolean;
  role?: string;
  dashboardName?: string;
  provider?: string;
  providerPayload?: string | Record<string, unknown>;
  challenge?: string;
}

export interface LexmaCastoLogoutPayload {
  target_dashboard: string;
}

export interface LexmaCastoAuthUserRaw {
  id?: string;
  userId?: string;
  username?: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  roles?: string[];
  castoBadge?: string;
  castoLine?: string;
  dashboardName?: string;
  avatarUrl?: string;
  profilePicture?: string;
  profile?: {
    profilePicture?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LexmaCastoLoginResponseRaw {
  success?: boolean;
  message?: string;
  user?: LexmaCastoAuthUserRaw;
  redirect_url?: string;
  data?: {
    user?: LexmaCastoAuthUserRaw;
    redirect_url?: string;
    castoBadge?: string;
    castoLine?: string;
  };
  castoBadge?: string;
  castoLine?: string;
}

export interface StrataPagedData<T = Record<string, unknown>> {
  items: T[];
  skewPage: number;
  skewPerPage: number;
  skewTotal: number;
  skewTotalPages: number;
}

export interface StrataEnvelope<T = Record<string, unknown>> {
  success: boolean;
  message?: string;
  data: StrataPagedData<T>;
}

export interface StrataRecord extends Record<string, unknown> {
  id?: string | number;
  _id?: string;
  uuid?: string;
  name?: string;
  title?: string;
  slug?: string;
  code?: string;
  description?: string;
  academicYear?: string | number;
  year?: string | number;
  season?: string;
  term?: string;
  categoryId?: string | number;
  subCategoryId?: string | number;
  domainId?: string | number;
  programId?: string | number;
  courseId?: string | number;
  subjectId?: string | number;
  unitId?: string | number;
  lessonId?: string | number;
  topicId?: string | number;
  conceptId?: string | number;
  assessmentId?: string | number;
  examId?: string | number;
  sectionId?: string | number;
  institutionId?: string | number;
  schoolId?: string | number;
  departmentId?: string | number;
  divisionId?: string | number;
  cohortId?: string | number;
  classId?: string | number;
}
