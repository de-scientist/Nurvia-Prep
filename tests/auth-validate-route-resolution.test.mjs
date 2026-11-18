import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');
const apiDir = path.join(appDir, 'api');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    failed++;
    process.exitCode = 1;
  }
}

console.log('--- NURVIA AUTH VALIDATE ROUTE REMEDIATION & ROUTE CONFLICT REGRESSION TEST ---');

// 1. Exactly one file exists in src/app/api/auth/validate
await test('1. Exactly one canonical route handler exists in src/app/api/auth/validate', () => {
  const validateDir = path.join(apiDir, 'auth', 'validate');
  assert.equal(fs.existsSync(validateDir), true, 'validate dir must exist');
  const files = fs.readdirSync(validateDir);
  assert.deepEqual(files, ['route.ts'], 'Only route.ts must exist in src/app/api/auth/validate');
  assert.equal(fs.existsSync(path.join(validateDir, 'route.tsx')), false, 'route.tsx must not exist');
});

// 2. Zero .tsx files in src/app/api
await test('2. Zero .tsx route handler files exist anywhere in src/app/api', () => {
  function findTsxInApi(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const tsxFiles = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        tsxFiles.push(...findTsxInApi(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        tsxFiles.push(path.relative(rootDir, fullPath));
      }
    }
    return tsxFiles;
  }

  const tsxInApi = findTsxInApi(apiDir);
  assert.deepEqual(tsxInApi, [], `Found unexpected .tsx files in src/app/api: ${tsxInApi.join(', ')}`);
});

// 3. No duplicate route/page base names in any directory in src/app
await test('3. No duplicate route or page files with identical base names in src/app', () => {
  const duplicates = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const fileBaseMap = new Map();

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const match = entry.name.match(/^(route|page|layout)\.([^.]+)$/);
        if (match) {
          const base = match[1];
          const ext = match[2];
          if (!fileBaseMap.has(base)) {
            fileBaseMap.set(base, []);
          }
          fileBaseMap.get(base).push(entry.name);
        }
      }
    }

    for (const [base, fileList] of fileBaseMap.entries()) {
      if (fileList.length > 1) {
        duplicates.push({ dir: path.relative(rootDir, dir), base, files: fileList });
      }
    }
  }

  scanDir(appDir);
  assert.deepEqual(duplicates, [], `Found duplicate route/page files: ${JSON.stringify(duplicates)}`);
});

// 4. Canonical route exports GET and enforces parameters & no-store
await test('4. Canonical route.ts exports GET and enforces required token and context parameters', () => {
  const routeContent = fs.readFileSync(path.join(apiDir, 'auth', 'validate', 'route.ts'), 'utf8');
  assert.match(routeContent, /export\s+async\s+function\s+GET\s*\(/, 'Must export async function GET');
  assert.match(routeContent, /Both token and context query parameters are required/, 'Must validate required token and context');
  assert.match(routeContent, /'Cache-Control':\s*'no-store'/, 'Must enforce Cache-Control: no-store');
  assert.match(routeContent, /getServerCastoSession\(\)/, 'Must use getServerCastoSession for secure HttpOnly cookie session');
  assert.match(routeContent, /lexmaCastoRequest\(/, 'Must use lexmaCastoRequest for backend BFF communication');
});

// 5. Canonical route forwards optional userGuidId and email query parameters
await test('5. Canonical route.ts safely forwards optional userGuidId and email query parameters', () => {
  const routeContent = fs.readFileSync(path.join(apiDir, 'auth', 'validate', 'route.ts'), 'utf8');
  assert.match(routeContent, /userGuidId/, 'Must support userGuidId query parameter');
  assert.match(routeContent, /email/, 'Must support email query parameter');
  assert.match(routeContent, /userGuidId\.slice\(0,\s*128\)/, 'Must bound userGuidId parameter length');
  assert.match(routeContent, /email\.slice\(0,\s*256\)/, 'Must bound email parameter length');
});

console.log(`\nAuth Validate Route Remediation Tests: ${passed} passed, ${failed} failed.`);
