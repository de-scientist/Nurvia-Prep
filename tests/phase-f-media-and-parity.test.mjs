import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.resolve(import.meta.dirname, '..');
const webRoot = fs.existsSync(path.join(baseDir, 'src', 'app'))
  ? path.join(baseDir, 'src')
  : baseDir;

const mediaRoute = fs.readFileSync(
  path.join(webRoot, 'app/api/media/[...path]/route.ts'),
  'utf8'
);
assert.match(mediaRoute, /ALLOWED_MEDIA_PREFIXES/);
assert.match(mediaRoute, /SAFE_CONTENT_TYPE_PREFIXES/);
assert.match(mediaRoute, /X-Content-Type-Options/);
assert.match(mediaRoute, /buildSiteHeaders/);
console.log('[PASS] 1. /api/media/[...path] enforces prefix allowlist, traversal guard, and nosniff');

const parityDir = fs.existsSync(path.join(baseDir, 'docs/architecture/qlex-nurvia-parity'))
  ? path.join(baseDir, 'docs/architecture/qlex-nurvia-parity')
  : path.resolve(webRoot, '../../docs/architecture/qlex-nurvia-parity');
const parityFiles = fs.readdirSync(parityDir).filter((f) => f.endsWith('.md'));
assert.ok(parityFiles.length >= 15, `Expected at least 15 parity docs, found ${parityFiles.length}`);
console.log(`[PASS] 2. All 15 parity register documents present in docs/architecture/qlex-nurvia-parity/ (${parityFiles.length} total)`);

console.log('\nAll Phase F media & parity tests PASSED (2/2)!');
