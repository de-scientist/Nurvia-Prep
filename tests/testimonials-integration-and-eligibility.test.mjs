import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
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
      for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
        const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
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
          jsx: ts.JsxEmit.Preserve,
          esModuleInterop: true,
        },
        fileName: filePath,
      });
      return { format: 'module', source: compiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const testimonialSvc = await import('../src/lib/testimonials/testimonial-service.ts');
const serverMod = await import('../src/lib/testimonials/server-testimonials.ts');
const apiClientMod = await import('../src/lib/api-client.ts');
const studySetsMod = await import('../src/lib/study-sets-data.ts');

const {
  normalizeSingleTestimonial,
  normalizeAndFilterBackendTestimonials,
  parseApprovedTestimonialPathway,
  isProhibitedTestimonialText,
  isSyntheticTestimonialRecord,
} = testimonialSvc;
const { getServerTestimonials } = serverMod;
const { nurviaApi } = apiClientMod;
const { sampleStudentTestimonials } = studySetsMod;

function mockJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

console.log('=== TESTIMONIAL ELIGIBILITY, AUTHORITATIVE BACKEND & INTEGRITY VERIFICATION SUITE ===');

// 1. Strict pathway & programId eligibility enforcement + verification integrity (fail-closed)
{
  assert.equal(parseApprovedTestimonialPathway('RN'), 'RN');
  assert.equal(parseApprovedTestimonialPathway('PN_LPN'), 'PN_LPN');
  for (const invalid of ['RN_Exit', 'PN_Exit', 'NCLEX-RN', 'NCLEX-PN', 'All', 'Common', 'TEAS', 'LPN', '']) {
    assert.equal(parseApprovedTestimonialPathway(invalid), null, `Must reject pathway "${invalid}"`);
  }

  assert.equal(isProhibitedTestimonialText('Passed NCLEX-RN easily'), true);
  assert.equal(isProhibitedTestimonialText('NCLEX_PN study tips'), true);
  assert.equal(isProhibitedTestimonialText('ATI TEAS 7 science'), true);
  assert.equal(isProhibitedTestimonialText('HESI A2 prep'), true);
  assert.equal(isProhibitedTestimonialText('Pharmacology RN rationales helped me'), false);

  const validRn = normalizeSingleTestimonial({
    id: 't-rn-1',
    pathway: 'RN',
    programId: 9,
    attribution: 'Taylor M.',
    content: 'Pharmacology rationales in Review mode clarified high-alert medication monitoring.',
    status: 'Published',
    visibility: 'public',
    isVerified: true,
  });
  assert.ok(validRn);
  assert.equal(validRn.pathway, 'RN');
  assert.equal(validRn.programId, 9);
  assert.equal(validRn.isSample, false);
  assert.equal(validRn.isVerified, true);
  assert.equal(validRn.source, 'verified_backend');

  // Unverified record must not invent verification status
  const validLpnUnverified = normalizeSingleTestimonial({
    id: 't-lpn-1',
    programId: 6,
    attribution: 'Jordan K.',
    content: 'Practical nursing dosage drills helped me practice safe medication math daily.',
    isPublished: true,
    isApproved: true,
  });
  assert.ok(validLpnUnverified);
  assert.equal(validLpnUnverified.pathway, 'PN_LPN');
  assert.equal(validLpnUnverified.programId, 6);
  assert.equal(validLpnUnverified.isVerified, false, 'Must never invent verification status when backend record lacks explicit verification');

  // Rejection cases: unauthorized programs, missing/conflicting ownership, unpublished/restricted/private, NCLEX/prohibited, synthetic fallback
  const rejectedCases = [
    // Missing pathway & programId
    { id: 'r1', attribution: 'Learner A.', content: 'As an RN learner this helped me prepare for unit exams.', status: 'Published' },
    // Explicit NCLEX pathway / track / body / tags
    { id: 'r2', pathway: 'RN', programId: 9, examTrack: 'NCLEX-RN', attribution: 'Learner B.', content: 'Great pharmacology practice questions for nursing school.', status: 'Published' },
    { id: 'r3', pathway: 'RN', programId: 9, attribution: 'Learner C.', content: 'Used this library while preparing for my NCLEX licensure day.', status: 'Published' },
    { id: 'r3b', pathway: 'RN', programId: 9, tags: ['pharmacology', 'NCLEX-RN'], attribution: 'Learner D.', content: 'Helpful pharmacology review rationales for med-surg exams.', status: 'Published' },
    // Unauthorized program IDs
    { id: 'r4', programId: 7, attribution: 'Learner', content: 'Valid length testimonial body about fundamentals.', status: 'Published' },
    { id: 'r5', programId: 8, attribution: 'Learner', content: 'Valid length testimonial body about pharmacology.', status: 'Published' },
    { id: 'r6', programId: 3, attribution: 'Learner', content: 'Valid length testimonial body about math skills.', status: 'Published' },
    { id: 'r7', programId: 5, attribution: 'Learner', content: 'Valid length testimonial body about reading comprehension.', status: 'Published' },
    { id: 'r8', programId: 13, attribution: 'Learner', content: 'Valid length testimonial body about specialty exams.', status: 'Published' },
    // Invalid pathway
    { id: 'r9', pathway: 'RN_Exit', programId: 9, attribution: 'Learner', content: 'Valid length testimonial body about exit predictor review.', status: 'Published' },
    // Conflicting pathway and programId
    { id: 'r10', pathway: 'RN', programId: 6, attribution: 'Learner', content: 'Valid length testimonial body with conflicting metadata.', status: 'Published' },
    { id: 'r11', pathway: 'PN_LPN', programId: 9, attribution: 'Learner', content: 'Valid length testimonial body with conflicting metadata.', status: 'Published' },
    // Conflicting programName
    { id: 'r12', pathway: 'RN', programId: 9, programName: 'LPN Nursing Exams', attribution: 'Learner', content: 'Valid length testimonial body with conflicting program name.', status: 'Published' },
    // Unpublished, draft, pending, rejected, archived, restricted, private, or no positive publication indicator
    { id: 'r13', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Draft testimonial that must never be published.', status: 'Draft' },
    { id: 'r14', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Pending moderation testimonial that must stay hidden.', approvalStatus: 'PendingReview' },
    { id: 'r15', pathway: 'PN_LPN', programId: 6, attribution: 'Learner', content: 'Rejected testimonial that must stay excluded.', moderationStatus: 'Rejected' },
    { id: 'r16', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Unpublished boolean flag testimonial must be rejected.', isPublished: false },
    { id: 'r17', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Admin-restricted testimonial must never be exposed.', visibility: 'restricted', status: 'Published' },
    { id: 'r18', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Restricted flag testimonial must be rejected.', isRestricted: true, status: 'Published' },
    { id: 'r19', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Private testimonial must never be exposed publicly.', isPrivate: true, status: 'Published' },
    { id: 'r20', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'No consent to publish attribution publicly.', allowPublicAttribution: false, status: 'Published' },
    { id: 'r21', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Record with no publication or approval flags at all.' },
    // Synthetic / sample fallback records
    { id: 'sample-rn-pharm-01', pathway: 'RN', programId: 9, attribution: 'RN Pathway Study Perspective', content: 'Synthetic study perspective narrative.', status: 'Published' },
    { id: 'r22', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Synthetic sample record flagged as sample.', status: 'Published', isSample: true },
    { id: 'r23', pathway: 'PN_LPN', programId: 6, attribution: 'LPN / PN Pathway Study Perspective', content: 'Synthetic LPN study perspective narrative.', status: 'Published' },
    { id: 'r24', pathway: 'RN', programId: 9, attribution: 'Learner', content: 'Synthetic fallback source record.', status: 'Published', source: 'sample_fallback' },
  ];

  for (const bad of rejectedCases) {
    assert.equal(normalizeSingleTestimonial(bad), null, `Expected rejection for case ${bad.id}`);
  }

  console.log('[PASS] 1. Strict eligibility accepts genuine RN (9) / PN_LPN (6) records and rejects unauthorized programs, conflicting ownership, unpublished/restricted/private records, NCLEX content, and synthetic fallback records');
}

// 2. Complete removal of synthetic fallback store and zero fabricated social proof
{
  const fallbackFilePath = path.join(repoRoot, 'src/lib/testimonials/fallback-testimonials.ts');
  assert.equal(fs.existsSync(fallbackFilePath), false, 'Synthetic fallback-testimonials.ts store must be removed');
  assert.ok(Array.isArray(sampleStudentTestimonials));
  assert.equal(sampleStudentTestimonials.length, 0, 'sampleStudentTestimonials must be an empty array with zero synthetic records');
  assert.equal(
    isSyntheticTestimonialRecord({
      id: 'sample-rn-01',
      attribution: 'RN Pathway Study Perspective',
    }),
    true
  );

  console.log('[PASS] 2. Synthetic fallback store is completely removed and zero fabricated records exist');
}

// 3. Server testimonial integration: empty collection on unprovisioned/empty/error/excluded, automatic display when genuine records exist
{
  // Unprovisioned default state (no endpoint configured) -> valid empty collection
  const unprov = await getServerTestimonials({ backendPathOverride: '' });
  assert.equal(unprov.source, 'none');
  assert.equal(unprov.backendStatus, 'endpoint_not_provisioned');
  assert.deepEqual(unprov.items, []);

  // Backend returns valid + excluded + synthetic records -> ONLY genuine valid published records returned
  const mixedRes = await getServerTestimonials({
    backendPathOverride: '/api/castoline/testimonials',
    requester: async () => ({
      ok: true,
      status: 200,
      message: 'OK',
      data: {
        items: [
          {
            id: 'be-1',
            pathway: 'RN',
            programId: 9,
            attribution: 'RN Learner A.',
            content: 'Clinical rationales helped me connect lab values to priority interventions.',
            status: 'Published',
            isVerified: true,
            displayOrder: 2,
          },
          {
            id: 'be-nclex',
            pathway: 'RN',
            programId: 9,
            attribution: 'NCLEX Learner',
            content: 'Great NCLEX-RN review prep.',
            status: 'Published',
          },
          {
            id: 'sample-rn-pharm-01',
            pathway: 'RN',
            programId: 9,
            attribution: 'RN Pathway Study Perspective',
            content: 'Synthetic fallback record attempting to enter through backend.',
            status: 'Published',
          },
          {
            id: 'be-2',
            pathway: 'PN_LPN',
            programId: 6,
            attribution: 'LPN Learner B.',
            content: 'Dosage math drills improved my calculation speed during practical nursing blocks.',
            status: 'Published',
            displayOrder: 1,
          },
        ],
      },
    }),
  });
  assert.equal(mixedRes.source, 'verified_backend');
  assert.equal(mixedRes.backendStatus, 'available_with_records');
  assert.deepEqual(mixedRes.items.map((i) => i.id), ['be-2', 'be-1']);
  assert.equal(mixedRes.items[0].isVerified, false);
  assert.equal(mixedRes.items[1].isVerified, true);
  assert.equal(mixedRes.rejectedBackendCount, 2);

  // Empty response -> valid empty collection
  const emptyRes = await getServerTestimonials({
    backendPathOverride: '/api/castoline/testimonials',
    requester: async () => ({ ok: true, status: 200, message: 'OK', data: { items: [] } }),
  });
  assert.equal(emptyRes.source, 'none');
  assert.equal(emptyRes.backendStatus, 'empty');
  assert.deepEqual(emptyRes.items, []);

  // Excluded-only response -> valid empty collection
  const excludedOnlyRes = await getServerTestimonials({
    backendPathOverride: '/api/castoline/testimonials',
    requester: async () => ({
      ok: true,
      status: 200,
      message: 'OK',
      data: {
        items: [{ id: 'bad-1', programId: 7, attribution: 'User', content: 'NCLEX PN content', status: 'Published' }],
      },
    }),
  });
  assert.equal(excludedOnlyRes.source, 'none');
  assert.equal(excludedOnlyRes.backendStatus, 'excluded_only');
  assert.deepEqual(excludedOnlyRes.items, []);

  // Upstream HTTP / timeout / network error -> valid empty collection (no fabricated social proof)
  const errRes = await getServerTestimonials({
    backendPathOverride: '/api/castoline/testimonials',
    requester: async () => ({ ok: false, status: 504, message: 'Timed out', errorCode: 'TIMEOUT' }),
  });
  assert.equal(errRes.source, 'none');
  assert.equal(errRes.backendStatus, 'upstream_error');
  assert.deepEqual(errRes.items, []);

  // Malformed response -> valid empty collection
  const badRes = await getServerTestimonials({
    backendPathOverride: '/api/castoline/testimonials',
    requester: async () => ({ ok: true, status: 200, message: 'OK', data: { unexpected: 'shape' } }),
  });
  assert.equal(badRes.source, 'none');
  assert.equal(badRes.backendStatus, 'malformed_response');
  assert.deepEqual(badRes.items, []);

  console.log('[PASS] 3. Server testimonials layer returns valid empty collection on empty/error/excluded states and automatically surfaces genuine eligible records');
}

// 4. Client nurviaApi.getTestimonials() defense-in-depth & empty collection on error
{
  const origFetch = globalThis.fetch;
  try {
    // Network failure -> valid empty collection without throwing or inventing testimonials
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const netFail = await nurviaApi.getTestimonials();
    assert.equal(netFail.success, true);
    assert.equal(netFail.data.source, 'none');
    assert.deepEqual(netFail.data.items, []);

    // HTTP 500 -> valid empty collection
    globalThis.fetch = async () => mockJsonResponse({ success: false, message: 'Internal Server Error at stack.cs:42' }, 500);
    const httpFail = await nurviaApi.getTestimonials();
    assert.equal(httpFail.success, true);
    assert.equal(httpFail.data.source, 'none');
    assert.deepEqual(httpFail.data.items, []);

    // Malformed non-JSON -> valid empty collection
    globalThis.fetch = async () => new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } });
    const htmlFail = await nurviaApi.getTestimonials();
    assert.equal(htmlFail.success, true);
    assert.equal(htmlFail.data.source, 'none');
    assert.deepEqual(htmlFail.data.items, []);

    // Valid backend payload mixed with NCLEX and synthetic records -> client layer filters out ineligible records
    globalThis.fetch = async () =>
      mockJsonResponse({
        success: true,
        data: {
          source: 'verified_backend',
          items: [
            {
              id: 'cli-1',
              pathway: 'RN',
              programId: 9,
              attribution: 'Elena R.',
              content: 'Consistent practice with RN Pharmacology rationales built confidence.',
              status: 'Published',
              isVerified: true,
            },
            {
              id: 'cli-nclex',
              pathway: 'RN',
              programId: 9,
              attribution: 'Blocked',
              content: 'NCLEX prep review.',
              status: 'Published',
            },
            {
              id: 'sample-rn-01',
              pathway: 'RN',
              programId: 9,
              attribution: 'RN Pathway Study Perspective',
              content: 'Synthetic narrative.',
              status: 'Published',
            },
          ],
        },
      });
    const verifiedClient = await nurviaApi.getTestimonials();
    assert.equal(verifiedClient.success, true);
    assert.equal(verifiedClient.data.source, 'verified_backend');
    assert.deepEqual(verifiedClient.data.items.map((i) => i.id), ['cli-1']);

    // Invalid pathway argument fails closed
    const badPathway = await nurviaApi.getTestimonials({ pathway: 'NCLEX' });
    assert.equal(badPathway.success, false);
    assert.equal(badPathway.statusCode, 400);

    console.log('[PASS] 4. Client nurviaApi.getTestimonials enforces defense-in-depth filtering and returns empty collection on backend error');
  } finally {
    globalThis.fetch = origFetch;
  }
}

// 5. Route handler, carousel neutral empty state & data contract checks
{
  const routeSrc = fs.readFileSync(path.join(repoRoot, 'src/app/api/testimonials/route.ts'), 'utf8');
  assert.match(routeSrc, /parseApprovedTestimonialPathway/);
  assert.match(routeSrc, /status:\s*400/);
  assert.match(routeSrc, /no-store/);

  const carouselSrc = fs.readFileSync(
    path.join(repoRoot, 'src/components/home/student-testimonial-carousel.tsx'),
    'utf8'
  );
  assert.equal(/nclex/i.test(carouselSrc), false, 'Carousel component must contain zero NCLEX references');
  assert.equal(carouselSrc.includes('fallback-testimonials'), false, 'Carousel must not import fallback-testimonials');
  assert.equal(carouselSrc.includes('getFallbackSampleTestimonials'), false, 'Carousel must not call getFallbackSampleTestimonials');
  assert.match(carouselSrc, /nurviaApi\s*\.\s*getTestimonials/, 'Carousel must fetch from /api/testimonials via nurviaApi');
  assert.ok(carouselSrc.includes('data-testid="testimonial-empty-state"'), 'Carousel must render a neutral empty state when no eligible records exist');
  assert.ok(carouselSrc.includes('item.isVerified &&'), 'Carousel must only render Verified badge on cards when item.isVerified is authoritatively true');

  for (const forbiddenUiPhrase of [
    'No backend testimonials available',
    'Sample data loaded',
    'Test testimonials',
    'Mock data',
    'Testimonial API unavailable',
    'Verified Backend',
    'RN Pathway Study Perspective',
    'LPN / PN Pathway Study Perspective',
  ]) {
    assert.equal(
      carouselSrc.includes(forbiddenUiPhrase),
      false,
      `Carousel must not expose technical error strings or synthetic attributions: "${forbiddenUiPhrase}"`
    );
  }

  const rawNorm = normalizeAndFilterBackendTestimonials('invalid-string');
  assert.equal(rawNorm.validPayload, false);

  console.log('[PASS] 5. API route, neutral UI empty state, and verification badge guardrails verified');
}

console.log('\nALL TESTIMONIAL ELIGIBILITY, AUTHORITATIVE BACKEND & INTEGRITY TESTS PASSED!');
