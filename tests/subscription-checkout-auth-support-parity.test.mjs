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

// In-memory browser storage harness for cart & return-context tests
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
const { buildSubscriptionEndpointPath } = await import('../src/lib/lexmacasto/contracts.ts');
const {
  evaluatePackageRecordEntitlements,
  evaluatePackagesForLearner,
} = await import('../src/lib/subscriptions/entitlement-service.ts');
const {
  formatCataloguePrice,
  formatMinutesDurationLabel,
  parsePackageFeatures,
  normalizeBackendCatalogueRecord,
  mergeCatalogueCollections,
  evaluatePackageSelectionEligibility,
  isPermittedLearnerCataloguePackage,
} = await import('../src/lib/subscriptions/catalogue-normalizer.ts');
const {
  subscriptionCart,
  getSubscriptionCart,
  clearSubscriptionCart,
  sanitizeInternalDestination,
  buildValidatedLearningContext,
  isContextValidForUser,
  saveAuthReturnContext,
  getAuthReturnContext,
  clearAuthReturnContext,
  formatActiveSubscriptionExpiryUtc,
  buildActiveSubscriptionMessage,
} = await import('../src/lib/subscriptions/cart-store.ts');
const { GET: getSubscriptionsResource } = await import(
  '../src/app/api/subscriptions/[resource]/route.ts'
);
const { POST: postDominionPackage } = await import(
  '../src/app/api/nexus/dominion/subscription/package/route.ts'
);
const { POST: postAuthSession } = await import('../src/app/api/auth/session/route.ts');
const { filterAndSearchSupportConversations } = await import(
  '../src/components/support/NavbarSupportMessaging.tsx'
);

const suiteStats = {
  discovery: { passed: 0, failed: 0 },
  cart: { passed: 0, failed: 0 },
  checkout: { passed: 0, failed: 0 },
  continuityAndToast: { passed: 0, failed: 0 },
  auth: { passed: 0, failed: 0 },
  support: { passed: 0, failed: 0 },
};

async function runCase(suiteKey, name, fn) {
  try {
    await fn();
    suiteStats[suiteKey].passed++;
    console.log(`[PASS] [${suiteKey}] ${name}`);
  } catch (err) {
    suiteStats[suiteKey].failed++;
    process.exitCode = 1;
    console.error(`[FAIL] [${suiteKey}] ${name}:`, err);
  }
}

console.log('=== QUIZNURSE COMPLETE SUBSCRIPTION, CART, CHECKOUT, AUTH & SUPPORT SUITE ===\n');

// ============================================================================
// SUITE 1: SUBSCRIPTION PACKAGE DISCOVERY (Section 14.1)
// ============================================================================
await runCase('discovery', '1.1 Forwards query filters and pagination in buildSubscriptionEndpointPath', () => {
  const distinctPath = buildSubscriptionEndpointPath('items', 'distinct', {
    parentTableName: 'program',
    parentName: 'RN_NURSING',
    page: 1,
    perPage: 50,
    search: 'deluxe',
  });
  assert.ok(distinctPath.startsWith('/api/castoline/nexus/subscription/items/list/distinct?'));
  assert.ok(distinctPath.includes('parentTableName=program'));
  assert.ok(distinctPath.includes('parentName=RN_NURSING'));
  assert.ok(distinctPath.includes('dynamicPage=1'));
  assert.ok(distinctPath.includes('dynamicPerPage=50'));
  assert.ok(distinctPath.includes('dynamicSearch=deluxe'));
  assert.ok(distinctPath.includes('fetchtype=distinct'));
});

await runCase('discovery', '1.2 Normalizes multiple packages with real pricing, currency, duration, features, and missing optional fields without inventing $49', () => {
  const rnItem = normalizeBackendCatalogueRecord(
    {
      id: 101,
      guidId: 'guid-rn-deluxe',
      name: 'RN DELUXE',
      amount: 79,
      currency: 'USD',
      priceDuration: '43200', // 30 days = 1 month
      duration: '30 Days Full Access',
      parentName: 'RN_NURSING',
      features: '<ul><li>Timed Exam Mode</li><li>AI-Guided Tutor Mode</li></ul>',
      description: 'Complete RN simulation suite',
      isFeatured: true,
    },
    'item'
  );
  assert.ok(rnItem);
  assert.equal(rnItem.formattedPrice, '$79');
  assert.equal(rnItem.currency, 'USD');
  assert.equal(rnItem.programCode, 'RN');
  assert.equal(rnItem.programDisplayName, 'RN Nursing Exams');
  assert.equal(rnItem.durationLabel, '1 month');
  assert.deepEqual(rnItem.featuresList, ['Timed Exam Mode', 'AI-Guided Tutor Mode']);
  assert.ok(!rnItem.applicablePathways.includes('PN_LPN'), 'RN package must not grant LPN access');

  // Missing optional price & metadata must NEVER invent $49
  const noPricePkg = normalizeBackendCatalogueRecord(
    {
      id: 102,
      guidId: 'guid-lpn-custom',
      name: 'LPN Institutional Access',
      terminalClusterSegmentName: 'LPN_NURSING',
    },
    'package'
  );
  assert.ok(noPricePkg);
  assert.equal(noPricePkg.amount, null);
  assert.equal(noPricePkg.formattedPrice, 'See Details');
  assert.equal(noPricePkg.programCode, 'PN_LPN');
  assert.equal(noPricePkg.programDisplayName, 'LPN Nursing Exams');
  assert.ok(!noPricePkg.applicablePathways.includes('RN'), 'LPN package must not grant RN access');
});

await runCase('discovery', '1.3 Handles unavailable packages, empty catalogues, and deduplicated item+package merging', () => {
  assert.deepEqual(mergeCatalogueCollections([], []), []);

  const merged = mergeCatalogueCollections(
    [
      {
        id: 11,
        guidId: 'shared-guid-11',
        name: 'RN Monthly Pro',
        amount: 45,
        currency: 'USD',
        parentName: 'RN_NURSING',
      },
      {
        id: 12,
        guidId: 'archived-guid-12',
        name: 'Retired Plan',
        amount: 30,
        status: 'Archived',
        parentName: 'RN_NURSING',
      },
    ],
    [
      {
        id: 900,
        guidId: 'shared-guid-11',
        name: 'RN Monthly Pro',
        amount: 45,
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [
          { subscriptionStatus: 'Active', validUntil: '2027-08-01T00:00:00.000Z' },
        ],
      },
    ]
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].isActiveOnAccount, true);
  assert.equal(merged[0].activeValidUntilUtc, '2027-08-01T00:00:00.000Z');
  assert.equal(merged[1].isAvailable, false);
});

await runCase('discovery', '1.4 /api/subscriptions/[resource] rejects unknown resources and fails closed on upstream error', async () => {
  globalThis.__TEST_COOKIES__ = new Map();
  const badReq = new NextRequest('https://quiznurse.com/api/subscriptions/unknown');
  const badRes = await getSubscriptionsResource(badReq, {
    params: Promise.resolve({ resource: 'unknown' }),
  });
  assert.equal(badRes.status, 404);

  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };
  process.env.SKEW_LINE_DOTNET_BASE_URL = 'https://backend.example.com';
  process.env.SKEW_LINE_APP_KEY = 'test-key-123';
  process.env.SKEW_LINE_APP_DOMAIN = 'https://quiznurse.com';
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Upstream down' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const failReq = new NextRequest(
      'https://quiznurse.com/api/subscriptions/items?parentTableName=program&parentName=RN_NURSING'
    );
    const failRes = await getSubscriptionsResource(failReq, {
      params: Promise.resolve({ resource: 'items' }),
    });
    assert.equal(failRes.status, 503);
    const failJson = await failRes.json();
    assert.equal(failJson.success, false);
  } finally {
    globalThis.fetch = origFetch;
    process.env = origEnv;
  }
});

await runCase('discovery', '1.5 Strict RN/LPN catalog filtering: permits authentic RN and LPN packages, excludes RN Exit-only, LPN Exit-only, ATI TEAS, HESI A2, Administrative, and Unclassified packages', () => {
  // 1. Valid RN package
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'RN Complete NCLEX Mastery',
      parentName: 'RN_NURSING',
      target: 'RN',
    }),
    true
  );

  // 2. Valid LPN package
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'PN / LPN Practical Nurse Essentials',
      parentName: 'LPN_NURSING',
      terminalClusterSegmentName: 'LPN_NURSING',
    }),
    true
  );

  // 3. Excluded: RN Exit-only package
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'RN Exit Exam Only Prep',
      parentName: 'RN_EXIT',
      target: 'RN_Exit',
    }),
    false
  );

  // 4. Excluded: LPN Exit-only package
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'LPN Exit Examination Only',
      parentName: 'PN_EXIT',
      target: 'PN_Exit',
    }),
    false
  );

  // 5. Excluded: Other pathway (ATI TEAS)
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'ATI TEAS Comprehensive Prep',
      parentName: 'ATI_TEAS',
      target: 'ATI_TEAS',
    }),
    false
  );

  // 6. Excluded: Administrative or internal test package
  assert.equal(
    isPermittedLearnerCataloguePackage({
      name: 'Internal Admin Dev Plan',
      parentName: 'RN_NURSING',
      target: 'admin',
    }),
    false
  );

  // 7. Excluded: Ambiguous / unclassified package with no program mapping
  assert.equal(
    isPermittedLearnerCataloguePackage({
      id: 999,
      name: 'Special Institutional Package',
    }),
    false
  );

  // 8. mergeCatalogueCollections strictly filters out non-RN/LPN items
  const mixedRaw = [
    { id: 1, name: 'RN NCLEX Pro', parentName: 'RN_NURSING' },
    { id: 2, name: 'LPN NCLEX Pro', parentName: 'LPN_NURSING' },
    { id: 3, name: 'RN Exit Exam Only', parentName: 'RN_EXIT' },
    { id: 4, name: 'HESI A2 Admission Prep', parentName: 'HESI_A2' },
    { id: 5, name: 'Dev Sandbox Test Package', parentName: 'RN_NURSING' },
    { id: 6, name: 'Unknown Program Package' },
  ];
  const mergedFiltered = mergeCatalogueCollections(mixedRaw, []);
  assert.equal(mergedFiltered.length, 2);
  assert.deepEqual(
    mergedFiltered.map((p) => p.name),
    ['RN NCLEX Pro', 'LPN NCLEX Pro']
  );
});

// ============================================================================
// SUITE 2: SUBSCRIPTION CART (Section 14.2)
// ============================================================================
await runCase('cart', '2.1 Adds, prevents duplicates, replaces, and removes packages with accurate identity and backend price authority', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  const ctx = buildValidatedLearningContext({
    returnTo: '/exam-session?examId=rn_pharm_01&mode=Tutor&layout=Sequential',
    requiredMode: 'Tutor',
    examId: 'rn_pharm_01',
    pathway: 'RN',
    subject: 'Pharmacology',
    layout: 'Sequential',
  });

  // Add string/numeric package ID without coercing to 1
  const firstAdd = subscriptionCart.add({
    id: '42',
    guidId: 'guid-pkg-42',
    name: 'RN DELUXE',
    amount: 89,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
    learningContext: ctx,
  });
  assert.equal(firstAdd.status, 'added');
  assert.equal(firstAdd.item.id, 42);
  assert.equal(firstAdd.item.amount, 89);
  assert.equal(firstAdd.item.priceAuthority, 'backend');

  // Duplicate prevention
  const dupAdd = subscriptionCart.add({
    id: 42,
    guidId: 'guid-pkg-42',
    name: 'RN DELUXE',
    amount: 89,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  });
  assert.equal(dupAdd.status, 'duplicate');
  assert.equal(getSubscriptionCart()?.learningContext?.examId, 'rn_pharm_01');

  // Replace with another package while preserving learning context
  const repAdd = subscriptionCart.add({
    id: 77,
    guidId: 'guid-pkg-77',
    name: 'LPN PRO',
    amount: 59,
    currency: 'USD',
    program: 'LPN Nursing Exams',
    pathway: 'PN_LPN',
  });
  assert.equal(repAdd.status, 'replaced');
  assert.equal(repAdd.previousItem?.id, 42);
  assert.equal(getSubscriptionCart()?.id, 77);
  assert.equal(getSubscriptionCart()?.learningContext?.examId, 'rn_pharm_01');

  // Remove
  subscriptionCart.remove();
  assert.equal(getSubscriptionCart(), null);
});

await runCase('cart', '2.2 Restores guest cart across authentication and isolates cart from a different authenticated user', () => {
  installMockBrowserStorage();
  subscriptionCart.add({
    id: 55,
    guidId: 'guid-55',
    name: 'RN Quarterly',
    amount: 119,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
    learningContext: buildValidatedLearningContext({
      examId: 'exam_medsurg_2',
      requiredMode: 'Exam',
      pathway: 'RN',
    }),
  });

  // Learner A signs in -> cart binds to Learner A
  const bound = subscriptionCart.bindToAuthenticatedUser({
    id: 'user-alice',
    email: 'alice@nursing.edu',
  });
  assert.equal(bound?.ownerUserId, 'user-alice');
  assert.equal(getSubscriptionCart({ id: 'user-alice', email: 'alice@nursing.edu' })?.id, 55);

  // Learner B signs in on shared browser -> Learner A's cart/context is rejected and cleared
  assert.equal(getSubscriptionCart({ id: 'user-bob', email: 'bob@nursing.edu' }), null);
});

await runCase('cart', '2.3 Cart strictly rejects non-RN/LPN packages (exit-only, TEAS, administrative, unclassified) from entering purchasing journey', () => {
  installMockBrowserStorage();
  clearSubscriptionCart();

  // Attempting to add an RN Exit-only package to cart is rejected
  const exitAdd = subscriptionCart.add({
    id: 901,
    name: 'RN Exit Exam Only',
    amount: 49,
    currency: 'USD',
    program: 'RN Exit Exam Only',
    pathway: 'RN_Exit',
  });
  assert.equal(exitAdd.status, 'rejected');
  assert.ok(exitAdd.error);
  assert.equal(getSubscriptionCart(), null);

  // Attempting to add an ATI TEAS package to cart is rejected
  const teasAdd = subscriptionCart.add({
    id: 902,
    name: 'ATI TEAS Prep Plan',
    amount: 39,
    currency: 'USD',
    program: 'ATI TEAS Program',
    pathway: 'ATI_TEAS',
  });
  assert.equal(teasAdd.status, 'rejected');
  assert.equal(getSubscriptionCart(), null);

  // Attempting to add an unclassified package to cart is rejected
  const unclassifiedAdd = subscriptionCart.add({
    id: 903,
    name: 'Unmapped Package',
    amount: 29,
    currency: 'USD',
    program: 'Special',
    pathway: 'Unknown',
  });
  assert.equal(unclassifiedAdd.status, 'rejected');
  assert.equal(getSubscriptionCart(), null);

  // Genuine RN package is accepted into cart
  const rnAdd = subscriptionCart.add({
    id: 101,
    name: 'RN Comprehensive',
    amount: 79,
    currency: 'USD',
    program: 'RN Nursing Exams',
    pathway: 'RN',
  });
  assert.equal(rnAdd.status, 'added');
  assert.equal(getSubscriptionCart()?.id, 101);
});

// ============================================================================
// SUITE 3: CHECKOUT & PROVISIONING STATES (Section 14.3)
// ============================================================================
await runCase('checkout', '3.1 Authoritative checkout route enforces CSRF, auth cookies, strips client prices, validates returnUrl, and surfaces redirectUrl', async () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };
  process.env.SKEW_LINE_DOTNET_BASE_URL = 'https://backend.example.com';
  process.env.SKEW_LINE_APP_KEY = 'test-key-123';
  process.env.SKEW_LINE_APP_DOMAIN = 'https://quiznurse.com';

  let capturedUpstreamBody = null;
  let capturedUpstreamHeaders = null;

  globalThis.fetch = async (_url, init) => {
    capturedUpstreamHeaders = init?.headers;
    capturedUpstreamBody = init?.body ? JSON.parse(init.body) : null;
    return new Response(
      JSON.stringify({
        success: true,
        data: { redirectUrl: 'https://checkout.stripe.com/c/pay/cs_test_999' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  try {
    // 1. Unauthenticated checkout must fail with 401
    globalThis.__TEST_COOKIES__ = new Map();
    const unauthReq = new NextRequest('https://quiznurse.com/api/nexus/dominion/subscription/package', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://quiznurse.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionItemId: 42,
        returnUrl: 'https://quiznurse.com/pages/subscription/package?examId=ex1&requiredMode=Tutor',
      }),
    });
    const unauthRes = await postDominionPackage(unauthReq);
    assert.equal(unauthRes.status, 401);

    // 2. External open-redirect returnUrl must be rejected with 400
    globalThis.__TEST_COOKIES__ = new Map([
      ['nurvia_casto_line', 'server_line_tok'],
      ['nurvia_casto_badge', 'server_badge_tok'],
    ]);
    const evilUrlReq = new NextRequest('https://quiznurse.com/api/nexus/dominion/subscription/package', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://quiznurse.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionItemId: 42,
        returnUrl: 'https://evil.attacker.example/steal',
      }),
    });
    const evilUrlRes = await postDominionPackage(evilUrlReq);
    assert.equal(evilUrlRes.status, 400);

    // 3. Valid authenticated checkout strips tampered client amount/price and surfaces redirectUrl
    const validReq = new NextRequest('https://quiznurse.com/api/nexus/dominion/subscription/package', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://quiznurse.com',
        'x-casto-line': 'spoofed_client_line',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionItemId: 42,
        subscriptionItemGuidId: 'guid-42',
        amount: 0.01, // Tampered price attempt
        price: 0.01,
        currency: 'XYZ',
        returnUrl: 'https://quiznurse.com/pages/subscription/package?examId=ex1&requiredMode=Tutor',
      }),
    });
    const validRes = await postDominionPackage(validReq);
    assert.equal(validRes.status, 200);
    const validJson = await validRes.json();
    assert.equal(validJson.redirectUrl, 'https://checkout.stripe.com/c/pay/cs_test_999');
    assert.equal(capturedUpstreamBody.subscriptionItemId, 42);
    assert.equal(capturedUpstreamBody.amount, undefined, 'Client price must be stripped');
    assert.equal(capturedUpstreamBody.price, undefined, 'Client price must be stripped');
    assert.equal(capturedUpstreamBody.currency, undefined, 'Client currency must be stripped');
    assert.equal(capturedUpstreamHeaders['x-casto-line'], 'server_line_tok', 'HttpOnly cookie must override client header');
  } finally {
    globalThis.fetch = origFetch;
    process.env = origEnv;
  }
});

await runCase('checkout', '3.2 Evaluates Pending, Provisioned, Expired, Cancelled, and Entitlement-Lacking states accurately', () => {
  const nowMs = Date.parse('2026-11-26T12:00:00.000Z');

  // Pending
  const pendingRes = evaluatePackagesForLearner(
    [
      {
        id: 1,
        name: 'RN DELUXE',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [{ subscriptionStatus: 'Pending', subscriptionHasPaid: 'Pending' }],
      },
    ],
    { mode: 'Exam', pathway: 'RN', nowMs }
  );
  assert.equal(pendingRes.allowed, false);
  assert.equal(pendingRes.status, 'Pending');
  assert.equal(pendingRes.errorCode, 'SUBSCRIPTION_PENDING');

  // Expired by date even if status string still says Active
  const expiredRes = evaluatePackagesForLearner(
    [
      {
        id: 1,
        name: 'RN DELUXE',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [{ subscriptionStatus: 'Active', validUntil: '2025-01-01T00:00:00.000Z' }],
      },
    ],
    { mode: 'Exam', pathway: 'RN', nowMs }
  );
  assert.equal(expiredRes.allowed, false);
  assert.equal(expiredRes.status, 'Expired');

  // Active RN subscription MUST NOT grant LPN access
  const mismatchRes = evaluatePackagesForLearner(
    [
      {
        id: 1,
        name: 'RN DELUXE',
        target: 'WEBSITE_1',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [{ subscriptionStatus: 'Active', validUntil: '2027-05-31T00:00:00.000Z' }],
      },
    ],
    { mode: 'Tutor', pathway: 'PN_LPN', nowMs }
  );
  assert.equal(mismatchRes.allowed, false);
  assert.equal(mismatchRes.status, 'Active');
  assert.equal(mismatchRes.errorCode, 'ENTITLEMENT_LACKING');

  // Active RN subscription grants RN Tutor Mode
  const activeRes = evaluatePackagesForLearner(
    [
      {
        id: 1,
        name: 'RN DELUXE',
        target: 'WEBSITE_1',
        terminalClusterSegmentName: 'RN_NURSING',
        userSubscriptions: [{ subscriptionStatus: 'Active', validUntil: '2027-05-31T00:00:00.000Z' }],
      },
    ],
    { mode: 'Tutor', pathway: 'RN', nowMs }
  );
  assert.equal(activeRes.allowed, true);
  assert.equal(activeRes.status, 'Active');
  assert.equal(activeRes.planName, 'RN DELUXE');
  assert.equal(activeRes.programName, 'RN Nursing Exams');
});

await runCase('checkout', '3.3 Idempotent callback reference tracking & callback source guards prevent premature launch', () => {
  installMockBrowserStorage();
  assert.equal(subscriptionCart.recordProvisionedReference('cs_live_abc123'), false);
  assert.equal(subscriptionCart.recordProvisionedReference('cs_live_abc123'), true, 'Duplicate callback must be flagged');

  const cbSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/pages/subscription/package/page.tsx'),
    'utf8'
  );
  assert.ok(cbSrc.includes('resolutionState === "provisioned" && safeReturnTo'), 'Protected launch link must only render when backend confirms provisioned');
  assert.ok(cbSrc.includes('Refresh Provisioning Status'), 'Pending callback state must offer bounded refresh');
  assert.ok(cbSrc.includes('Checkout Cancelled'), 'Cancelled callback state must be supported');
  assert.ok(cbSrc.includes('Payment Could Not Be Completed'), 'Failed callback state must be supported');
});

await runCase('checkout', '3.4 Checkout endpoint independently rejects non-RN/LPN program/pathway purchases with 400 validation error', async () => {
  globalThis.__TEST_COOKIES__ = new Map([
    ['nurvia_casto_line', 'valid-line-session'],
    ['nurvia_casto_badge', 'valid-badge-session'],
  ]);

  // Request attempting checkout for non-RN/LPN pathway
  const badPathwayReq = new NextRequest('https://quiznurse.com/api/nexus/dominion/subscription/package', {
    method: 'POST',
    headers: {
      host: 'quiznurse.com',
      origin: 'https://quiznurse.com',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionItemId: 501,
      pathway: 'ATI_TEAS',
      returnUrl: 'https://quiznurse.com/pages/subscription/package',
    }),
  });

  const badRes = await postDominionPackage(badPathwayReq);
  assert.equal(badRes.status, 400);
  const badJson = await badRes.json();
  assert.equal(badJson.success, false);
  assert.ok(badJson.error.includes('Only RN and LPN subscription packages are eligible'));
});

// ============================================================================
// SUITE 4: RETURN-CONTEXT CONTINUITY & ACTIVE SUBSCRIPTION TOAST (14.4 & 14.5)
// ============================================================================
await runCase('continuityAndToast', '4.1 Preserves exact examination, mode (Exam & Tutor), pathway, subject, layout, and attemptId', () => {
  const tutorCtx = buildValidatedLearningContext({
    returnTo: '/exam-session?examId=hesi_mat_04&mode=Tutor&layout=AllInOne&attemptId=att_99',
    requiredMode: 'Tutor',
    examId: 'hesi_mat_04',
    pathway: 'PN_LPN',
    subject: 'Maternal-Newborn',
    layout: 'AllInOne',
    attemptId: 'att_99',
  });
  assert.equal(tutorCtx.returnTo, '/exam-session?examId=hesi_mat_04&mode=Tutor&layout=AllInOne&attemptId=att_99');
  assert.equal(tutorCtx.requiredMode, 'Tutor');
  assert.equal(tutorCtx.pathway, 'PN_LPN');
  assert.equal(tutorCtx.subject, 'Maternal-Newborn');
  assert.equal(tutorCtx.layout, 'AllInOne');
  assert.equal(tutorCtx.attemptId, 'att_99');

  const examCtx = buildValidatedLearningContext({
    examId: 'ati_medsurg_01',
    requiredMode: 'Exam',
    pathway: 'RN',
    layout: 'Sequential',
  });
  assert.equal(examCtx.returnTo, '/exam-session?examId=ati_medsurg_01&mode=Exam&layout=Sequential');
});

await runCase('continuityAndToast', '4.2 Rejects open redirects, auth loops, tampered examIds, invalid modes, and expired contexts', () => {
  assert.equal(sanitizeInternalDestination('https://evil.com/exam-session?examId=1'), null);
  assert.equal(sanitizeInternalDestination('//evil.com/phish'), null);
  assert.equal(sanitizeInternalDestination('/\\evil.com'), null);
  assert.equal(sanitizeInternalDestination('/sign-in?returnTo=/learner'), null);
  assert.equal(sanitizeInternalDestination('/exam-session?examId=<script>alert(1)</script>&mode=Exam'), null);
  assert.equal(sanitizeInternalDestination('/exam-session?examId=valid_1&mode=HackedMode'), null);

  // Expired TTL check
  assert.equal(
    isContextValidForUser({ expiresAtUtc: '2020-01-01T00:00:00.000Z' }, null, Date.now()),
    false
  );
});

await runCase('continuityAndToast', '4.3 Formats exact required Active Subscription Toast in UTC without fabricating expiry dates', () => {
  const exactToast = buildActiveSubscriptionMessage(
    'RN DELUXE',
    'RN Nursing Exams',
    '2027-05-31T00:00:00.000Z'
  );
  assert.equal(
    exactToast,
    "You Already Have An Active Subscription To 'RN DELUXE' For The program 'RN Nursing Exams' — It Is Valid Until 31 May 2027, 00:00 UTC ⚓"
  );

  const lpnToast = buildActiveSubscriptionMessage(
    'LPN PRO ADVANCED',
    'LPN Nursing Exams',
    '2028-11-15T14:30:00.000Z'
  );
  assert.equal(
    lpnToast,
    "You Already Have An Active Subscription To 'LPN PRO ADVANCED' For The program 'LPN Nursing Exams' — It Is Valid Until 15 Nov 2028, 14:30 UTC ⚓"
  );

  // Indefinite / null expiry must never fabricate 2099
  const indefinite = formatActiveSubscriptionExpiryUtc(null);
  assert.ok(!indefinite.includes('2099'), 'Must never fabricate 2099 expiry date');
  assert.ok(indefinite.includes('UTC'));
});

await runCase('continuityAndToast', '4.4 Distinguishes duplicate covered purchase from different-program purchase and legitimate upgrades', () => {
  const activeRnBasic = [
    {
      packageId: 10,
      packageGuidId: 'rn-basic-guid',
      packageName: 'RN DELUXE',
      programCode: 'RN',
      programName: 'RN Nursing Exams',
      amount: 79,
      currency: 'USD',
      expiresAt: '2027-05-31T00:00:00.000Z',
      grantsExam: true,
      grantsTutor: true,
      pathways: ['RN', 'RN_Exit'],
    },
  ];

  // Same covered RN package -> triggers toast (alreadyCovered: true)
  const dupCheck = evaluatePackageSelectionEligibility({
    selectedPackage: {
      id: 10,
      guidId: 'rn-basic-guid',
      name: 'RN DELUXE',
      amount: 79,
      programCode: 'RN',
      programDisplayName: 'RN Nursing Exams',
      applicablePathways: ['RN'],
      entitlements: { examMode: true, tutorMode: true, pathways: ['RN'] },
    },
    requiredMode: 'Tutor',
    activeSubscriptions: activeRnBasic,
  });
  assert.equal(dupCheck.alreadyCovered, true);

  // Separate LPN program purchase -> allowed!
  const lpnCheck = evaluatePackageSelectionEligibility({
    selectedPackage: {
      id: 20,
      guidId: 'lpn-guid',
      name: 'LPN COMPLETE',
      amount: 69,
      programCode: 'PN_LPN',
      programDisplayName: 'LPN Nursing Exams',
      applicablePathways: ['PN_LPN'],
      entitlements: { examMode: true, tutorMode: true, pathways: ['PN_LPN'] },
    },
    requiredMode: 'Exam',
    activeSubscriptions: activeRnBasic,
  });
  assert.equal(lpnCheck.alreadyCovered, false);

  // Legitimate higher-tier upgrade -> allowed!
  const upgradeCheck = evaluatePackageSelectionEligibility({
    selectedPackage: {
      id: 30,
      guidId: 'rn-annual-guid',
      name: 'RN ANNUAL PREMIER',
      amount: 199,
      programCode: 'RN',
      programDisplayName: 'RN Nursing Exams',
      applicablePathways: ['RN'],
      entitlements: { examMode: true, tutorMode: true, pathways: ['RN'] },
    },
    requiredMode: 'Tutor',
    activeSubscriptions: activeRnBasic,
  });
  assert.equal(upgradeCheck.alreadyCovered, false);
  assert.equal(upgradeCheck.isUpgrade, true);
});

// ============================================================================
// SUITE 5: EMAIL VERIFICATION & GOOGLE OAUTH CONTINUITY (14.6 & 14.7)
// ============================================================================
await runCase('auth', '5.1 Email verification recovers persisted destination across email links, sign-in continuation, and resends', () => {
  installMockBrowserStorage();
  const checkoutDest =
    '/learner/subscription?requiredMode=Tutor&examId=rn_09&pathway=RN&layout=Sequential&returnTo=%2Fexam-session%3FexamId%3Drn_09%26mode%3DTutor%26layout%3DSequential';

  saveAuthReturnContext(
    buildValidatedLearningContext({
      returnTo: checkoutDest,
      ownerEmail: 'candidate@nursing.edu',
    })
  );

  const recovered = getAuthReturnContext({ email: 'candidate@nursing.edu' });
  assert.equal(recovered?.returnTo, checkoutDest);

  // Different email must not inherit candidate's verification return context
  assert.equal(getAuthReturnContext({ email: 'stranger@nursing.edu' }), null);

  const validateSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/auth/validate/ValidateClient.tsx'),
    'utf8'
  );
  assert.ok(validateSrc.includes('getAuthReturnContext'), 'ValidateClient must recover stored return context for email links');
  assert.ok(validateSrc.includes('handleResendVerification'), 'ValidateClient must provide throttled resend without losing destination');
  assert.ok(validateSrc.includes('signInContinuationHref'), 'ValidateClient must preserve destination when sign-in is required');
});

await runCase('auth', '5.2 POST /api/auth/session enforces CSRF, validates credentials with backend, and sets HttpOnly cookies', async () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };
  process.env.SKEW_LINE_DOTNET_BASE_URL = 'https://backend.example.com';
  process.env.SKEW_LINE_APP_KEY = 'test-key-123';
  process.env.SKEW_LINE_APP_DOMAIN = 'https://quiznurse.com';

  try {
    // 1. Cross-site CSRF attempt rejected with 403
    const csrfReq = new NextRequest('https://quiznurse.com/api/auth/session', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://evil.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ badge: 'b1', line: 'l1' }),
    });
    const csrfRes = await postAuthSession(csrfReq);
    assert.equal(csrfRes.status, 403);

    // 2. Rejected upstream OAuth token returns 401 and sets NO session cookies
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false, message: 'Invalid session' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });

    const invalidReq = new NextRequest('https://quiznurse.com/api/auth/session', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://quiznurse.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ badge: 'bad_badge', line: 'bad_line' }),
    });
    const invalidRes = await postAuthSession(invalidReq);
    assert.equal(invalidRes.status, 401);
    assert.equal(invalidRes.headers.get('set-cookie'), null);

    // 3. Valid OAuth credentials verified by backend establish HttpOnly nurvia_casto_* cookies
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                guidId: 'usr-google-1',
                userName: 'Nurse Maria',
                email: 'maria@nursing.edu',
                emailVerified: true,
                role: 'Learner',
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );

    const validReq = new NextRequest('https://quiznurse.com/api/auth/session', {
      method: 'POST',
      headers: {
        host: 'quiznurse.com',
        origin: 'https://quiznurse.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ badge: 'valid_badge_123', line: 'valid_line_456' }),
    });
    const validRes = await postAuthSession(validReq);
    assert.equal(validRes.status, 200);
    const setCookieHeader = validRes.headers.get('set-cookie') || '';
    assert.ok(setCookieHeader.includes('nurvia_casto_line=valid_line_456'));
    assert.ok(setCookieHeader.includes('nurvia_casto_badge=valid_badge_123'));
    assert.ok(/httponly/i.test(setCookieHeader), 'Session cookies must be HttpOnly');
  } finally {
    globalThis.fetch = origFetch;
    process.env = origEnv;
  }
});

await runCase('auth', '5.3 Social complete scrubs URL tokens, avoids non-HttpOnly credential cookies, and preserves destination', () => {
  const socialCompleteSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/auth/social/complete/page.tsx'),
    'utf8'
  );
  assert.ok(socialCompleteSrc.includes('/api/auth/session'), 'Must establish server session via /api/auth/session');
  assert.ok(socialCompleteSrc.includes('clearAuthSessionCookies'), 'Must scrub any non-HttpOnly client session cookies');
  assert.ok(!socialCompleteSrc.includes('writeAuthSessionCookies('), 'Must not write raw credentials into document.cookie');
  assert.ok(socialCompleteSrc.includes('history.replaceState'), 'Must scrub hash/query tokens from URL');
  assert.ok(socialCompleteSrc.includes('emailVerified === false'), 'Must handle verification-required Google accounts');
  assert.ok(!socialCompleteSrc.includes('/pages/entrance'), 'Must not default to /pages/entrance');
});

// ============================================================================
// SUITE 6: SUPPORT MESSAGING & FULL INBOX (Section 14.8)
// ============================================================================
await runCase('support', '6.1 Mounted on homepage PublicShell, (web) navbar, and LearnerShell while preserving announcements', () => {
  const publicShellSrc = fs.readFileSync(
    path.join(repoRoot, 'src/components/layout/public-shell.tsx'),
    'utf8'
  );
  const webNavbarSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/includes/navbar/index.tsx'),
    'utf8'
  );
  const learnerShellSrc = fs.readFileSync(
    path.join(repoRoot, 'src/components/layout/learner-shell.tsx'),
    'utf8'
  );
  assert.ok(publicShellSrc.includes('<NavbarSupportMessaging />'), 'Homepage PublicShell must mount NavbarSupportMessaging');
  assert.ok(publicShellSrc.includes('QuizNurse Education'), 'Homepage top announcement banner must be preserved');
  assert.ok(webNavbarSrc.includes('<NavbarSupportMessaging />'), '(web) navbar must mount NavbarSupportMessaging');
  assert.ok(learnerShellSrc.includes('<NavbarSupportMessaging />'), 'LearnerShell must mount NavbarSupportMessaging');
  assert.ok(learnerShellSrc.includes('/learner/notifications'), 'Existing learner notifications entry must be preserved');
});

await runCase('support', '6.2 Filters (All, Unread, Later, Starred) and search operate accurately across conversation metadata', () => {
  const sampleConversations = [
    {
      id: 1,
      guidId: 'msg-1',
      title: 'Billing receipt question',
      message: 'Need invoice for RN DELUXE plan',
      category: 'Payment / Billing Issue',
      status: 'Open',
      clientReadStatus: 'Unread',
      isRead: false,
      target: 'WEBSITE_1',
      createdAt: '2026-11-25T10:00:00Z',
    },
    {
      id: 2,
      guidId: 'msg-2',
      title: 'Pharmacology SATA exhibit',
      message: 'Lab tab question',
      response: 'Fixed in clinical exhibit viewer',
      category: 'Exam or Technical Issue',
      status: 'Responded',
      clientReadStatus: 'Starred',
      isRead: true,
      target: 'WEBSITE_1',
      createdAt: '2026-11-24T10:00:00Z',
    },
    {
      id: 3,
      guidId: 'msg-3',
      title: 'Follow up next week',
      message: 'Study schedule inquiry',
      category: 'Something Else',
      status: 'Open',
      clientReadStatus: 'Later',
      isRead: true,
      target: 'WEBSITE_1',
      createdAt: '2026-11-23T10:00:00Z',
    },
  ];

  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'All', '').length, 3);
  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'Unread', '').length, 1);
  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'Starred', '').length, 1);
  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'Later', '').length, 1);
  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'All', 'exhibit').length, 1);
  assert.equal(filterAndSearchSupportConversations(sampleConversations, 'Starred', 'invoice').length, 0);
});

await runCase('support', '6.3 Support panel & full inbox enforce guest isolation, compose, replies, status actions, and pagination', () => {
  const supportSrc = fs.readFileSync(
    path.join(repoRoot, 'src/components/support/NavbarSupportMessaging.tsx'),
    'utf8'
  );
  const fullInboxSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/pages/heed/relative/page.tsx'),
    'utf8'
  );
  const threadSrc = fs.readFileSync(
    path.join(repoRoot, 'src/app/(web)/pages/heed/current/page.tsx'),
    'utf8'
  );

  assert.ok(supportSrc.includes('Message Support'));
  assert.ok(supportSrc.includes('Conversations with our support team'));
  assert.ok(supportSrc.includes('Start A New Conversation'));
  assert.ok(supportSrc.includes('Open Full Inbox Page'));
  assert.ok(supportSrc.includes('enabled: isAuthenticated'), 'Guests must not trigger unauthenticated RelativeFetch 401s');
  assert.ok(supportSrc.includes('Sign In to View Past Conversations'), 'Guests must receive safe sign-in continuation');
  assert.ok(fullInboxSrc.includes('Sign In to Access Your Support Inbox'), 'Full inbox must protect conversations for guests');
  assert.ok(threadSrc.includes('HeedReplyBox'), 'Full thread page must support replies');
});

console.log('\n=== FOCUSED SUITE SUMMARY ===');
for (const [k, v] of Object.entries(suiteStats)) {
  console.log(`  ${k}: ${v.passed} passed, ${v.failed} failed`);
}
