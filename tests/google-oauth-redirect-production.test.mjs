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
    if (specifier === 'next/headers') {
      return {
        url:
          'data:text/javascript,' +
          encodeURIComponent(`
            export async function cookies() {
              return { get: () => undefined };
            }
            export async function headers() {
              return new Headers();
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

const {
  resolveCanonicalOrigin,
  resolveSocialCompleteUrl,
  isLocalhostOrigin,
  isTrustedPreviewOrigin,
  BackendConfigurationError,
  CANONICAL_PRODUCTION_ORIGIN,
  DEFAULT_DEVELOPMENT_ORIGIN,
  resolveApplicationIdentity,
} = await import('../src/lib/api-config.mjs');

const { sanitizeInternalDestination } = await import('@/lib/subscriptions/cart-store');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('=== QUIZNURSE GOOGLE OAUTH REDIRECT & PRODUCTION CANONICAL ORIGIN SUITE ===\n');

// ============================================================================
// 1. Environment-Origin Matrix Tests (Section 9.1)
// ============================================================================
console.log('--- 1. Canonical Origin Resolution Matrix ---');

test('1.1 Local development resolves to http://localhost:3000', () => {
  const origin = resolveCanonicalOrigin({
    NODE_ENV: 'development',
    SKEW_LINE_APP_DOMAIN: 'http://localhost:3000',
  });
  assert.equal(origin, 'http://localhost:3000');

  const originDefault = resolveCanonicalOrigin({
    NODE_ENV: 'development',
  });
  assert.equal(originDefault, 'http://localhost:3000');
});

test('1.2 Production resolves to https://quiznurse.com', () => {
  const origin = resolveCanonicalOrigin({
    NODE_ENV: 'production',
    SKEW_LINE_APP_DOMAIN: 'https://quiznurse.com',
  });
  assert.equal(origin, 'https://quiznurse.com');

  // Strip trailing slashes
  const originSlash = resolveCanonicalOrigin({
    NODE_ENV: 'production',
    SKEW_LINE_APP_DOMAIN: 'https://quiznurse.com/',
  });
  assert.equal(originSlash, 'https://quiznurse.com');
});

test('1.3 Production rejects localhost and never silently falls back to localhost', () => {
  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        SKEW_LINE_APP_DOMAIN: 'http://localhost:3000',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_PRODUCTION_ORIGIN'
  );

  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        SKEW_LINE_APP_DOMAIN: 'http://127.0.0.1:3000',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_PRODUCTION_ORIGIN'
  );
});

test('1.4 Missing production configuration fails closed when required and defaults safely', () => {
  // When requireConfigured is true, missing domain throws MISSING_APP_DOMAIN
  assert.throws(
    () =>
      resolveCanonicalOrigin(
        {
          NODE_ENV: 'production',
          SKEW_LINE_APP_DOMAIN: '',
        },
        { requireConfigured: true }
      ),
    (err) => err instanceof BackendConfigurationError && err.code === 'MISSING_APP_DOMAIN'
  );

  // When requireConfigured is false, default production canonical origin is used, NEVER localhost
  const defaultProd = resolveCanonicalOrigin({
    NODE_ENV: 'production',
    SKEW_LINE_APP_DOMAIN: '',
  });
  assert.equal(defaultProd, 'https://quiznurse.com');
  assert.notEqual(defaultProd, 'http://localhost:3000');
});

test('1.5 Invalid production configuration fails closed', () => {
  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        SKEW_LINE_APP_DOMAIN: 'not-a-valid-url',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_APP_DOMAIN'
  );

  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        SKEW_LINE_APP_DOMAIN: 'http://insecure-domain.com',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INSECURE_PRODUCTION_ORIGIN'
  );
});

test('1.6 Supported Preview resolves to correct validated Preview origin', () => {
  const previewVercel = resolveCanonicalOrigin({
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'nurvia-black-preview-git-fix.vercel.app',
  });
  assert.equal(previewVercel, 'https://nurvia-black-preview-git-fix.vercel.app');

  const previewExplicit = resolveCanonicalOrigin({
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    SKEW_LINE_APP_DOMAIN: 'https://preview.quiznurse.com',
  });
  assert.equal(previewExplicit, 'https://preview.quiznurse.com');
});

test('1.7 Untrusted Preview origin fails closed', () => {
  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        SKEW_LINE_APP_DOMAIN: 'https://attacker.com',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_PREVIEW_ORIGIN'
  );

  assert.throws(
    () =>
      resolveCanonicalOrigin({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        SKEW_LINE_APP_DOMAIN: 'http://localhost:3000',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_PREVIEW_ORIGIN'
  );
});

test('1.8 Canonical social completion URL resolves accurately per environment', () => {
  assert.equal(
    resolveSocialCompleteUrl({ NODE_ENV: 'production', SKEW_LINE_APP_DOMAIN: 'https://quiznurse.com' }),
    'https://quiznurse.com/auth/social/complete'
  );
  assert.equal(
    resolveSocialCompleteUrl({ NODE_ENV: 'development', SKEW_LINE_APP_DOMAIN: 'http://localhost:3000' }),
    'http://localhost:3000/auth/social/complete'
  );
});

// ============================================================================
// 2. Application Identity & Server Config Integrity
// ============================================================================
console.log('\n--- 2. Identity & Server Configuration ---');

test('2.1 resolveApplicationIdentity rejects localhost in production mode', () => {
  assert.throws(
    () =>
      resolveApplicationIdentity({
        NODE_ENV: 'production',
        SKEW_LINE_APP_KEY: 'test-key',
        SKEW_LINE_APP_DOMAIN: 'http://localhost:3000',
      }),
    (err) => err instanceof BackendConfigurationError && err.code === 'INVALID_PRODUCTION_ORIGIN'
  );
});

test('2.2 resolveApplicationIdentity accepts canonical production domain', () => {
  const identity = resolveApplicationIdentity({
    NODE_ENV: 'production',
    SKEW_LINE_APP_KEY: 'test-key',
    SKEW_LINE_APP_DOMAIN: 'https://quiznurse.com/',
  });
  assert.equal(identity.appDomain, 'https://quiznurse.com');
  assert.equal(identity.appName, 'QuizNurse');
});

test('2.3 resolveApplicationIdentity accepts localhost in development mode', () => {
  const identity = resolveApplicationIdentity({
    NODE_ENV: 'development',
    SKEW_LINE_APP_KEY: 'test-key',
    SKEW_LINE_APP_DOMAIN: 'http://localhost:3000',
  });
  assert.equal(identity.appDomain, 'http://localhost:3000');
});

// ============================================================================
// 3. Open Redirect & Destination Protection Tests (Section 9.5)
// ============================================================================
console.log('\n--- 3. Redirect Security & Open Redirect Protection ---');

test('3.1 /learner is accepted as canonical internal destination', () => {
  assert.equal(sanitizeInternalDestination('/learner'), '/learner');
});

test('3.2 Valid internal learner paths are accepted with query parameters and fragments', () => {
  assert.equal(sanitizeInternalDestination('/learner/library'), '/learner/library');
  assert.equal(sanitizeInternalDestination('/learner/library?track=RN'), '/learner/library?track=RN');
  assert.equal(sanitizeInternalDestination('/exams/nclex-rn'), '/exams/nclex-rn');
  assert.equal(sanitizeInternalDestination('/pages/subscription/package'), '/pages/subscription/package');
});

test('3.3 External origins are strictly rejected', () => {
  assert.equal(sanitizeInternalDestination('https://evil.example'), null);
  assert.equal(sanitizeInternalDestination('https://evil.example/learner'), null);
  assert.equal(sanitizeInternalDestination('http://evil.example'), null);
});

test('3.4 Protocol-relative and backslash destinations are strictly rejected', () => {
  assert.equal(sanitizeInternalDestination('//evil.example'), null);
  assert.equal(sanitizeInternalDestination('/\\evil.example'), null);
  assert.equal(sanitizeInternalDestination('//localhost:3000'), null);
});

test('3.5 Dangerous schemes (javascript:, data:, vbscript:) are strictly rejected', () => {
  assert.equal(sanitizeInternalDestination('javascript:alert(1)'), null);
  assert.equal(sanitizeInternalDestination('data:text/html,<script>alert(1)</script>'), null);
});

test('3.6 Open localhost redirects are rejected when passed as absolute URL', () => {
  assert.equal(sanitizeInternalDestination('http://localhost:3000/learner'), null);
  assert.equal(sanitizeInternalDestination('http://localhost:3000/auth/social/complete'), null);
});

test('3.7 Malformed URLs fail safely', () => {
  assert.equal(sanitizeInternalDestination(''), null);
  assert.equal(sanitizeInternalDestination(null), null);
  assert.equal(sanitizeInternalDestination('   '), null);
  assert.equal(sanitizeInternalDestination('/with\r\nnewline'), null);
});

// ============================================================================
// 4. Source Code Contract Audit
// ============================================================================
console.log('\n--- 4. Codebase Contract Verification ---');

test('4.1 Social route (Google) attaches canonical origin in x-site-domain header', () => {
  const googleRouteSrc = fs.readFileSync('src/app/api/auth/social/google/route.ts', 'utf8');
  assert.ok(googleRouteSrc.includes('resolveCanonicalOrigin'), 'Google route must import resolveCanonicalOrigin');
  assert.ok(googleRouteSrc.includes('"x-site-domain": canonicalOrigin'), 'Google route must send canonical origin in x-site-domain');
  assert.ok(!googleRouteSrc.includes('http://localhost:3000'), 'Google route must not contain hardcoded localhost');
});

test('4.2 Site headers utility resolves canonical origin server-side', () => {
  const siteHeadersSrc = fs.readFileSync('src/lib/config/siteHeaders.ts', 'utf8');
  assert.ok(siteHeadersSrc.includes('resolveCanonicalOrigin'), 'siteHeaders must import resolveCanonicalOrigin');
  assert.ok(siteHeadersSrc.includes('"x-site-domain": canonicalDomain'), 'siteHeaders must set x-site-domain to canonicalDomain');
});

test('4.3 Middleware resolves canonical origin without hardcoded localhost', () => {
  const middlewareSrc = fs.readFileSync('src/middleware.ts', 'utf8');
  assert.ok(middlewareSrc.includes('resolveCanonicalOrigin'), 'Middleware must import resolveCanonicalOrigin');
});

test('4.4 next.config.ts prevents baking localhost into production bundle', () => {
  const nextConfigSrc = fs.readFileSync('next.config.ts', 'utf8');
  assert.ok(nextConfigSrc.includes('https://quiznurse.com'), 'next.config.ts must enforce production fallback to https://quiznurse.com');
  assert.ok(nextConfigSrc.includes('!process.env.SKEW_LINE_APP_DOMAIN.includes("localhost")'), 'next.config.ts must reject localhost in production');
});

test('4.5 /auth/social/complete page retains secure session completion contracts', () => {
  const completeSrc = fs.readFileSync('src/app/(web)/auth/social/complete/page.tsx', 'utf8');
  assert.ok(completeSrc.includes('hashParams.get("badge")'), 'Must read badge token');
  assert.ok(completeSrc.includes('hashParams.get("line")'), 'Must read line token');
  assert.ok(completeSrc.includes('clearAuthSessionCookies'), 'Must clear client cookies');
  assert.ok(completeSrc.includes('/api/auth/session'), 'Must post to session route to set HttpOnly cookies');
  assert.ok(completeSrc.includes('window.history.replaceState'), 'Must scrub URL tokens');
  assert.ok(completeSrc.includes('sanitizeInternalDestination'), 'Must validate return destination');
});

// ============================================================================
// Final Summary
// ============================================================================
console.log(`\n=========================================================================`);
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log(`=========================================================================`);

if (failed > 0) {
  process.exit(1);
}
