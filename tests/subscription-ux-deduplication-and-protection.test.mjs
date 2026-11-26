import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const repoRoot = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        url: 'data:text/javascript,export default {};',
        shortCircuit: true,
      };
    }
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context);
    }
    if (specifier === 'next/link') {
      return nextResolve('next/link.js', context);
    }
    if (specifier === 'next/navigation') {
      return nextResolve('next/navigation.js', context);
    }
    if (specifier === 'next/headers') {
      return {
        url:
          'data:text/javascript,' +
          encodeURIComponent(`
            export async function cookies() {
              const map = globalThis.__TEST_COOKIES__ || new Map();
              return {
                get(name) {
                  return map.has(name) ? { name, value: map.get(name) } : undefined;
                },
              };
            }
            export async function headers() {
              const h = globalThis.__TEST_HEADERS__ || new Headers();
              return h;
            }
          `),
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('@/')) {
      const base = path.resolve(repoRoot, 'src', specifier.slice(2));
      for (const ext of ['', '.ts', '.tsx', '.mjs', '.js']) {
        const candidate = ext ? `${base}${ext}` : base;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file://')
    ) {
      const parentDir = path.dirname(
        new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, '$1')
      );
      const base = path.resolve(parentDir, specifier);
      for (const ext of ['', '.ts', '.tsx', '.mjs', '.js']) {
        const candidate = ext && !base.endsWith(ext) ? `${base}${ext}` : base;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            url: new URL(`file:///${candidate.replace(/\\/g, '/')}`).href,
            shortCircuit: true,
          };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const filePath = new URL(url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
      const source = fs.readFileSync(filePath, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: filePath,
      });
      return { format: 'module', source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

function installMockBrowserStorage() {
  const store = new Map();
  const events = [];
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.window = {
    localStorage,
    location: { origin: 'https://quiznurse.com', pathname: '/', search: '', hash: '' },
    dispatchEvent: (ev) => {
      events.push(ev);
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { store, events };
}

installMockBrowserStorage();

const { NextRequest } = await import('next/server');
const {
  classifyPermittedCatalogueCategory,
  deduplicateCataloguePackages,
  matchActiveSubscriptionForPackage,
  mergeCatalogueCollections,
  normalizeBackendCatalogueRecord,
  isPermittedLearnerCataloguePackage,
  evaluatePackageSelectionEligibility,
} = await import('../src/lib/subscriptions/catalogue-normalizer.ts');
const {
  subscriptionCart,
  getSubscriptionCart,
  clearSubscriptionCart,
  buildActiveSubscriptionMessage,
  formatActiveSubscriptionExpiryUtc,
} = await import('../src/lib/subscriptions/cart-store.ts');
const {
  evaluatePackagesForLearner,
} = await import('../src/lib/subscriptions/entitlement-service.ts');
const { POST: postDominionPackage } = await import(
  '../src/app/api/nexus/dominion/subscription/package/route.ts'
);

const testCounts = { passed: 0, failed: 0 };

async function test(title, fn) {
  try {
    await fn();
    testCounts.passed++;
    console.log(`[PASS] ${title}`);
  } catch (err) {
    testCounts.failed++;
    process.exitCode = 1;
    console.error(`[FAIL] ${title}:`, err);
  }
}

console.log('=== QUIZNURSE SUBSCRIPTION UX, DEDUPLICATION & PURCHASE PROTECTION TEST SUITE ===\n');

// ============================================================================
// SUITE 1: CATALOGUE DEDUPLICATION
// ============================================================================

await test('1.1 Deduplicates same package returned by both discovery resources (items & packages)', () => {
  const distinctItems = [
    {
      id: 101,
      guidId: 'guid-rn-deluxe',
      name: 'RN DELUXE',
      amount: 79,
      currency: 'USD',
      parentName: 'RN_NURSING',
      duration: '30 Days Full Access',
      features: '<ul><li>Timed Exam Mode</li><li>Tutor Mode</li></ul>',
    },
  ];

  const discretePackages = [
    {
      id: 201,
      guidId: 'guid-rn-deluxe',
      name: 'RN DELUXE',
      terminalClusterSegmentName: 'RN_NURSING',
      userSubscriptions: [
        { subscriptionStatus: 'Active', validUntil: '2027-05-31T00:00:00.000Z' },
      ],
    },
  ];

  const merged = mergeCatalogueCollections(distinctItems, discretePackages);
  assert.equal(merged.length, 1, 'Same package from both resources must be merged into 1 card');
  assert.equal(merged[0].name, 'RN DELUXE');
  assert.equal(merged[0].guidId, 'guid-rn-deluxe');
  assert.equal(merged[0].amount, 79, 'Must preserve purchasable price from item');
  assert.equal(merged[0].isActiveOnAccount, true, 'Must merge active subscription status from package');
  assert.equal(merged[0].activeValidUntilUtc, '2027-05-31T00:00:00.000Z');
});

await test('1.2 Deduplicates same package with different representations but matching canonical category', () => {
  const rawItems = [
    {
      id: 1,
      name: 'RN Standard Prep',
      plan: 'STANDARD',
      parentName: 'RN_NURSING',
      amount: 49,
      currency: 'USD',
    },
    {
      id: 2,
      name: 'RN Comprehensive Standard',
      type: 'STANDARD',
      parentName: 'RN_NURSING',
      amount: 49,
      currency: 'USD',
    },
  ];

  const normalized = rawItems
    .map((r, i) => normalizeBackendCatalogueRecord(r, 'item', i))
    .filter(Boolean);

  const deduped = deduplicateCataloguePackages(normalized);
  assert.equal(deduped.length, 1, 'Two records classifying as RN STANDARD must be deduplicated to 1');
  assert.equal(deduped[0].permittedCategory, 'RN STANDARD');
});

await test('1.3 Preserves different legitimate packages sharing similar tier names across tracks', () => {
  const distinctItems = [
    {
      id: 11,
      guidId: 'rn-std',
      name: 'RN STANDARD',
      amount: 49,
      currency: 'USD',
      parentName: 'RN_NURSING',
    },
    {
      id: 12,
      guidId: 'lpn-std',
      name: 'LPN STANDARD',
      amount: 39,
      currency: 'USD',
      parentName: 'LPN_NURSING',
    },
    {
      id: 13,
      guidId: 'rn-dlx',
      name: 'RN DELUXE',
      amount: 89,
      currency: 'USD',
      parentName: 'RN_NURSING',
    },
  ];

  const merged = mergeCatalogueCollections(distinctItems, []);
  assert.equal(merged.length, 3, 'Distinct legitimate packages must NOT be accidentally removed');
  const categories = merged.map((p) => p.permittedCategory || p.name);
  assert.ok(categories.includes('RN STANDARD'));
  assert.ok(categories.includes('LPN STANDARD'));
  assert.ok(categories.includes('RN DELUXE'));
});

await test('1.4 Handles missing or malformed package identifiers gracefully', () => {
  const malformed = [
    { name: 'Missing ID' },
    null,
    { id: '', guidId: '', name: 'Empty IDs' },
    { id: 105, name: '', parentName: 'RN_NURSING' },
  ];

  const normalized = malformed
    .map((r, i) => normalizeBackendCatalogueRecord(r, 'item', i))
    .filter(Boolean);

  assert.equal(normalized.length, 0, 'Malformed packages without ID or name must be excluded');
});

await test('1.5 Repeated fetches and catalogue refreshes produce stable idempotent results', () => {
  const items = [
    { id: 1, guidId: 'g-rn-1', name: 'RN STANDARD', parentName: 'RN_NURSING', amount: 49 },
    { id: 2, guidId: 'g-rn-2', name: 'RN PREMIUM', parentName: 'RN_NURSING', amount: 69 },
    { id: 3, guidId: 'g-rn-3', name: 'RN DELUXE', parentName: 'RN_NURSING', amount: 89 },
  ];

  const firstMerge = mergeCatalogueCollections(items, []);
  const secondMerge = mergeCatalogueCollections([...items, ...items], []);
  assert.equal(firstMerge.length, 3);
  assert.equal(secondMerge.length, 3, 'Double fetch must still yield exactly 3 packages');
  assert.deepEqual(firstMerge.map((p) => p.name), secondMerge.map((p) => p.name));
});

await test('1.6 Generates unique, stable canonical React keys', () => {
  const items = [
    { id: 1, guidId: 'g-rn-std', name: 'RN STANDARD', parentName: 'RN_NURSING', amount: 49 },
    { id: 2, guidId: 'g-rn-prem', name: 'RN PREMIUM', parentName: 'RN_NURSING', amount: 69 },
    { id: 3, guidId: 'g-rn-dlx', name: 'RN DELUXE', parentName: 'RN_NURSING', amount: 89 },
  ];

  const merged = mergeCatalogueCollections(items, []);
  const keys = merged.map((pkg) => pkg.permittedCategory || (pkg.guidId ? `guid-${pkg.guidId}` : `pkg-${pkg.id}`));
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, 'Every package must have a unique stable key');
});

// ============================================================================
// SUITE 2: ACTIVE SUBSCRIPTION DETECTION & BEHAVIOUR
// ============================================================================

await test('2.1 Identifies active subscription by package GUID, ID, and canonical category', () => {
  const activeSummaries = [
    {
      packageId: 50,
      packageGuidId: 'guid-rn-deluxe',
      packageName: 'RN DELUXE',
      programCode: 'RN',
      programName: 'RN Nursing Exams',
      expiresAt: '2027-05-31T00:00:00.000Z',
      grantsExam: true,
      grantsTutor: true,
      pathways: ['RN'],
    },
  ];

  // Match by GUID
  const matchGuid = matchActiveSubscriptionForPackage(
    { id: 999, guidId: 'guid-rn-deluxe', name: 'RN DELUXE', programCode: 'RN' },
    activeSummaries
  );
  assert.ok(matchGuid, 'Should match by GUID');

  // Match by ID
  const matchId = matchActiveSubscriptionForPackage(
    { id: 50, name: 'RN DELUXE', programCode: 'RN' },
    activeSummaries
  );
  assert.ok(matchId, 'Should match by backend ID');

  // Match by canonical category
  const matchCat = matchActiveSubscriptionForPackage(
    { id: 888, name: 'RN DELUXE', programCode: 'RN', permittedCategory: 'RN DELUXE' },
    activeSummaries
  );
  assert.ok(matchCat, 'Should match by canonical category');
});

await test('2.2 Does NOT treat another package in the same program as active', () => {
  const activeSummaries = [
    {
      packageId: 50,
      packageGuidId: 'guid-rn-std',
      packageName: 'RN STANDARD',
      programCode: 'RN',
      programName: 'RN Nursing Exams',
      expiresAt: '2027-05-31T00:00:00.000Z',
      grantsExam: true,
      grantsTutor: true,
      pathways: ['RN'],
    },
  ];

  // Active RN STANDARD must NOT mark RN DELUXE as active
  const deluxeMatch = matchActiveSubscriptionForPackage(
    { id: 51, guidId: 'guid-rn-dlx', name: 'RN DELUXE', programCode: 'RN', permittedCategory: 'RN DELUXE' },
    activeSummaries
  );
  assert.equal(deluxeMatch, null, 'RN STANDARD active must NOT mark RN DELUXE active');
});

await test('2.3 Cross-program isolation: Active RN subscription never matches LPN package', () => {
  const activeSummaries = [
    {
      packageId: 50,
      packageGuidId: 'guid-rn-dlx',
      packageName: 'RN DELUXE',
      programCode: 'RN',
      programName: 'RN Nursing Exams',
      expiresAt: '2027-05-31T00:00:00.000Z',
      grantsExam: true,
      grantsTutor: true,
      pathways: ['RN'],
    },
  ];

  const lpnMatch = matchActiveSubscriptionForPackage(
    { id: 70, guidId: 'guid-lpn-dlx', name: 'LPN DELUXE', programCode: 'PN_LPN', permittedCategory: 'LPN DELUXE' },
    activeSummaries
  );
  assert.equal(lpnMatch, null, 'Active RN subscription must NEVER match LPN package');
});

await test('2.4 Expired, cancelled, and pending subscriptions are not treated as active', () => {
  const nowMs = new Date('2026-11-26T12:00:00.000Z').getTime();

  // Expired
  const expiredCheck = evaluatePackagesForLearner(
    [
      {
        id: 1,
        name: 'RN DELUXE',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [
          { subscriptionStatus: 'Active', validUntil: '2025-01-01T00:00:00.000Z' },
        ],
      },
    ],
    { mode: 'Exam', pathway: 'RN', nowMs }
  );
  assert.equal(expiredCheck.allowed, false);
  assert.equal(expiredCheck.status, 'Expired');

  // Cancelled
  const cancelledCheck = evaluatePackagesForLearner(
    [
      {
        id: 2,
        name: 'RN DELUXE',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [
          { subscriptionStatus: 'Cancelled', validUntil: '2027-01-01T00:00:00.000Z' },
        ],
      },
    ],
    { mode: 'Exam', pathway: 'RN', nowMs }
  );
  assert.equal(cancelledCheck.allowed, false);
  assert.equal(cancelledCheck.status, 'Cancelled');

  // Pending
  const pendingCheck = evaluatePackagesForLearner(
    [
      {
        id: 3,
        name: 'RN DELUXE',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [
          { subscriptionStatus: 'Pending', validUntil: '2027-01-01T00:00:00.000Z' },
        ],
      },
    ],
    { mode: 'Exam', pathway: 'RN', nowMs }
  );
  assert.equal(pendingCheck.allowed, false);
  assert.equal(pendingCheck.status, 'Pending');
});

await test('2.5 Empty or unavailable status does not produce false active state', () => {
  const emptyMatch = matchActiveSubscriptionForPackage(
    { id: 1, name: 'RN DELUXE', programCode: 'RN' },
    []
  );
  assert.equal(emptyMatch, null, 'Empty active list must return null');
});

await test('2.6 Account switching refreshes cart and prevents leaking active state', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  subscriptionCart.add(
    {
      id: 101,
      name: 'RN STANDARD',
      amount: 49,
      currency: 'USD',
      program: 'RN Nursing Exams',
      pathway: 'RN',
      ownerUserId: 'user-alice',
      ownerEmail: 'alice@nursing.edu',
    },
    { id: 'user-alice', email: 'alice@nursing.edu' }
  );

  // User Alice has cart
  assert.equal(getSubscriptionCart({ id: 'user-alice', email: 'alice@nursing.edu' })?.id, 101);

  // User Bob logs in: Alice's cart is isolated and cleared
  assert.equal(getSubscriptionCart({ id: 'user-bob', email: 'bob@nursing.edu' }), null);
});

// ============================================================================
// SUITE 3: CART AND CHECKOUT PROTECTION
// ============================================================================

await test('3.1 Reject duplicate package insertion in cart', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  const pkg = {
    id: 101,
    guidId: 'g-101',
    name: 'RN STANDARD',
    amount: 49,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  };

  const firstAdd = subscriptionCart.add(pkg);
  assert.equal(firstAdd.status, 'added');

  const secondAdd = subscriptionCart.add(pkg);
  assert.equal(secondAdd.status, 'duplicate');
});

await test('3.2 Repeated clicks do not create multiple cart rows', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  const pkg = {
    id: 102,
    guidId: 'g-102',
    name: 'RN PREMIUM',
    amount: 69,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  };

  for (let i = 0; i < 5; i++) {
    subscriptionCart.add(pkg);
  }

  // Cart only holds 1 item
  const cart = getSubscriptionCart();
  assert.ok(cart);
  assert.equal(cart.id, 102);
});

await test('3.3 Cart replacement behaviour for different legitimate package', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  subscriptionCart.add({
    id: 101,
    guidId: 'g-101',
    name: 'RN STANDARD',
    amount: 49,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  });

  const replaceResult = subscriptionCart.add({
    id: 103,
    guidId: 'g-103',
    name: 'RN DELUXE',
    amount: 89,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  });

  assert.equal(replaceResult.status, 'replaced');
  assert.equal(replaceResult.item.id, 103);
  assert.equal(replaceResult.previousItem?.id, 101);
});

await test('3.4 Reject adding already active subscription to cart', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  const activePkg = {
    id: 101,
    guidId: 'g-101',
    name: 'RN STANDARD',
    amount: 49,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
    isActiveOnAccount: true,
  };

  const result = subscriptionCart.add(activePkg);
  assert.equal(result.status, 'rejected');
  assert.ok(result.error?.includes('already have an active subscription'));
  assert.equal(getSubscriptionCart(), null);
});

await test('3.5 Backend checkout independently rejects duplicate purchase attempts with 409', async () => {
  globalThis.__TEST_COOKIES__ = new Map([
    ['nurvia_casto_line', 'valid-line-session'],
    ['nurvia_casto_badge', 'valid-badge-session'],
  ]);

  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };
  process.env.SKEW_LINE_DOTNET_BASE_URL = 'https://backend.example.com';
  process.env.SKEW_LINE_APP_KEY = 'test-key-123';
  process.env.SKEW_LINE_APP_DOMAIN = 'https://quiznurse.com';

  // Mock upstream backend to return an active subscription for item 505
  globalThis.fetch = async (url, init) => {
    if (url.includes('/list/discrete')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 505,
                guidId: 'guid-active-505',
                name: 'RN DELUXE',
                terminalClusterSegmentName: 'RN_NURSING',
                userSubscriptions: [
                  { subscriptionStatus: 'Active', validUntil: '2027-05-31T00:00:00.000Z' },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, data: { redirectUrl: 'https://stripe.com' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const checkoutReq = new NextRequest('https://quiznurse.com/api/nexus/dominion/subscription/package', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://quiznurse.com',
      },
      body: JSON.stringify({
        subscriptionItemId: 505,
        subscriptionItemGuidId: 'guid-active-505',
        pathway: 'RN',
        returnUrl: 'https://quiznurse.com/learner/subscription',
      }),
    });

    const res = await postDominionPackage(checkoutReq);
    assert.equal(res.status, 409, 'Duplicate checkout must be rejected with HTTP 409 Conflict');
    const json = await res.json();
    assert.equal(json.errorCode, 'ACTIVE_SUBSCRIPTION_EXISTS');
    assert.ok(json.error.includes('already have an active subscription'));
  } finally {
    globalThis.fetch = origFetch;
    Object.assign(process.env, origEnv);
  }
});

// ============================================================================
// SUITE 4: TOAST NOTIFICATIONS & MESSAGING
// ============================================================================

await test('4.1 Exact approved active subscription toast wording in UTC', () => {
  const toast = buildActiveSubscriptionMessage(
    'RN DELUXE',
    'RN Nursing Exams',
    '2027-05-31T00:00:00.000Z'
  );

  const expected =
    "You Already Have An Active Subscription To 'RN DELUXE' For The program 'RN Nursing Exams' — It Is Valid Until 31 May 2027, 00:00 UTC ⚓";
  assert.equal(toast, expected);
});

await test('4.2 Toast does not fabricate a date when expiry is null or unavailable', () => {
  const toast = buildActiveSubscriptionMessage('RN STANDARD', 'RN Nursing Exams', null);
  assert.ok(!toast.includes('2099'));
  assert.ok(!toast.includes('undefined'));
  assert.ok(!toast.includes('null'));
  assert.ok(toast.includes("You Already Have An Active Subscription To 'RN STANDARD' For The program 'RN Nursing Exams'"));
  assert.ok(toast.includes('⚓'));
});

await test('4.3 Formats UTC timestamp correctly for various times and dates', () => {
  const formatted = formatActiveSubscriptionExpiryUtc('2028-12-25T15:45:00.000Z');
  assert.equal(formatted, '25 Dec 2028, 15:45 UTC');
});

console.log('\n=== COMPLETE RESULTS ===');
console.log(`Passed: ${testCounts.passed}`);
console.log(`Failed: ${testCounts.failed}`);

if (testCounts.failed > 0) {
  process.exit(1);
}
