import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildApiUrl, DEDICATED_APP_ROUTES } from '../src/lib/api-url.mjs';
import {
  buildSystemDebugRoutesEndpointPath,
  extractRoutesFromUpstreamData,
  LEXMACASTO_EXTRA_ENDPOINTS,
} from '../src/lib/lexmacasto/contracts.ts';
import { matchProxyRoute } from '../src/lib/lexmacasto/proxy-allowlist.ts';

const baseDir = path.resolve(import.meta.dirname, '..');
const webRoot = fs.existsSync(path.join(baseDir, 'src', 'app'))
  ? path.join(baseDir, 'src')
  : baseDir;

console.log('--- NURVIA SYSTEM DEBUG ROUTES VIEWER VERIFICATION SUITE ---');

// 1. Same-origin routing & contract builders
assert.ok(
  DEDICATED_APP_ROUTES.has('/api/system/debug/routes'),
  'DEDICATED_APP_ROUTES must include /api/system/debug/routes'
);
globalThis.window = {};
assert.equal(
  buildApiUrl('/api/system/debug/routes?target=view'),
  '/api/system/debug/routes?target=view'
);
delete globalThis.window;

assert.equal(
  LEXMACASTO_EXTRA_ENDPOINTS.SYSTEM_DEBUG_ROUTES_VIEW,
  '/system/debug/routes/view'
);
assert.equal(
  buildSystemDebugRoutesEndpointPath({ target: 'view', method: 'GET', page: 2 }),
  '/system/debug/routes/view?method=GET&page=2'
);
assert.equal(
  buildSystemDebugRoutesEndpointPath({ target: 'routes', search: 'strata' }),
  '/system/debug/routes?search=strata'
);
console.log('[PASS] 1. Same-origin URL routing and contract path builders verified');

// 2. SSRF & proxy allowlist enforcement
const clientSource = fs.readFileSync(
  path.join(webRoot, 'lib/lexmacasto/client.ts'),
  'utf8'
);
assert.match(clientSource, /\\\/system\\\/debug\\\/routes\(\?:\\\/view\)\?/);

const allowGetView = matchProxyRoute('GET', ['system', 'debug', 'routes', 'view']);
assert.equal(allowGetView.allowed, true);
if (allowGetView.allowed) {
  assert.equal(allowGetView.rule.auth, 'staff');
}
const allowGetRoutes = matchProxyRoute('GET', ['system', 'debug', 'routes']);
assert.equal(allowGetRoutes.allowed, true);
if (allowGetRoutes.allowed) {
  assert.equal(allowGetRoutes.rule.auth, 'staff');
}
const denyPostView = matchProxyRoute('POST', ['system', 'debug', 'routes', 'view']);
assert.equal(denyPostView.allowed, false);
if (!denyPostView.allowed) {
  assert.equal(denyPostView.status, 405);
}
const denyTraversal = matchProxyRoute('GET', ['system', 'debug', '..', 'secret']);
assert.equal(denyTraversal.allowed, false);
console.log('[PASS] 2. SSRF path guard and staff-only GET proxy allowlist verified');

// 3. Upstream data extraction (empty, valid, nested, malformed/unexpected) without fabricating fields
const emptyExtracted = extractRoutesFromUpstreamData({ routes: [], totalCount: 0 });
assert.equal(emptyExtracted.valid, true);
assert.equal(emptyExtracted.routes.length, 0);

const validExtracted = extractRoutesFromUpstreamData({
  routes: [
    {
      method: 'get',
      path: '/api/castoline/strata/learning/courses/list/absolute',
      controller: 'CoursesController',
      action: 'ListAbsolute',
      group: 'Strata.Learning',
    },
  ],
  totalCount: 1,
});
assert.equal(validExtracted.valid, true);
assert.equal(validExtracted.routes.length, 1);
assert.equal(validExtracted.routes[0].method, 'GET');
assert.equal(validExtracted.routes[0].path, '/api/castoline/strata/learning/courses/list/absolute');
assert.equal(validExtracted.routes[0].controller, 'CoursesController');
assert.equal(validExtracted.routes[0].auth, undefined, 'Must not fabricate auth status when not supplied');

const unexpectedExtracted = extractRoutesFromUpstreamData({ unexpectedKey: 'not-a-route-list' });
assert.equal(unexpectedExtracted.valid, false);
assert.equal(extractRoutesFromUpstreamData('<html>Redirect</html>').valid, false);
console.log('[PASS] 3. Upstream route normalization preserves supplied fields and rejects unexpected shapes');

// 4. Route handler security & error states (400, 401, 403, 502, no-store)
const routeSource = fs.readFileSync(
  path.join(webRoot, 'app/api/system/debug/routes/route.ts'),
  'utf8'
);
assert.match(routeSource, /ALLOWED_QUERY_KEYS/);
assert.match(routeSource, /getServerCastoSession/);
assert.match(routeSource, /STAFF_ROLES\.has\(verifiedUser\.role\.toLowerCase\(\)\)/);
assert.match(routeSource, /status:\s*401/);
assert.match(routeSource, /status:\s*403/);
assert.match(routeSource, /status:\s*400/);
assert.match(routeSource, /status:\s*502/);
assert.match(routeSource, /no-store/);
console.log('[PASS] 4. Route handler enforces query validation (400), session auth (401), staff RBAC (403), and no-store');

// 5. UI integration & security check
const viewerUi = fs.readFileSync(
  path.join(webRoot, 'components/admin/system-debug-routes-viewer.tsx'),
  'utf8'
);
const adminSettingsUi = fs.readFileSync(
  path.join(webRoot, 'app/admin/settings/page.tsx'),
  'utf8'
);
const directViewPage = fs.readFileSync(
  path.join(webRoot, 'app/system/debug/routes/view/page.tsx'),
  'utf8'
);
assert.match(adminSettingsUi, /SystemDebugRoutesViewer/);
assert.match(directViewPage, /AdminShell/);
assert.match(directViewPage, /SystemDebugRoutesViewer/);
assert.doesNotMatch(viewerUi, /SKEW_LINE_APP_KEY|WEBSITE_1\b|skew_blanc_session|skew8lancasto/i);
console.log('[PASS] 5. UI integration in /admin/settings and /system/debug/routes/view verified with zero secret leakage');

console.log('\nAll 5 System Debug Routes Viewer verification tests PASSED (5/5)!');
