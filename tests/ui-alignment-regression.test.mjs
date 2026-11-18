import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.resolve(import.meta.dirname, '..');
const webRoot = fs.existsSync(path.join(baseDir, 'src', 'app'))
  ? path.join(baseDir, 'src')
  : baseDir;
const repoRoot = baseDir;

function read(relPath) {
  if (fs.existsSync(path.join(webRoot, relPath))) {
    return fs.readFileSync(path.join(webRoot, relPath), 'utf8');
  }
  return fs.readFileSync(path.join(baseDir, relPath), 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('--- NURVIA APPLICATION-WIDE UI TRANSFORMATION & IDENTITY ALIGNMENT SUITE ---');

// 1. Canonical NURVIA Design System tokens in globals.css & tailwind.config.ts
const globalsCss = read('app/globals.css');
const tailwindCfg = read('tailwind.config.ts');
assert.match(globalsCss, /--brand-navy:\s*#142B4A/i, 'globals.css must define --brand-navy: #142B4A');
assert.match(globalsCss, /--brand-teal:\s*#0D9488/i, 'globals.css must define --brand-teal: #0D9488');
assert.match(globalsCss, /--background:\s*#FFFFFF/i, 'globals.css must define --background: #FFFFFF');
assert.match(globalsCss, /--surface:\s*#F8FAFC/i, 'globals.css must define --surface: #F8FAFC');
assert.match(globalsCss, /--foreground:\s*#0F172A/i, 'globals.css must define --foreground: #0F172A');
assert.match(globalsCss, /--text-muted:\s*#64748B/i, 'globals.css must define --text-muted: #64748B');
assert.match(globalsCss, /--border:\s*#E2E8F0/i, 'globals.css must define --border: #E2E8F0');
assert.match(tailwindCfg, /navy:\s*["']#142B4A["']/i, 'tailwind.config.ts must define brand.navy #142B4A');
assert.match(tailwindCfg, /teal:\s*["']#0D9488["']/i, 'tailwind.config.ts must define brand.teal #0D9488');
console.log('[PASS] 1. Canonical NURVIA design tokens (#142B4A, #0D9488, #FFFFFF, #F8FAFC, #0F172A, #64748B, #E2E8F0) verified');

// 2. PanelThemeContext uses NURVIA defaults and eliminates Qlex pastel defaults
const panelThemeSrc = read('lib/contexts/panel/layout/theme/PanelThemeContext.tsx');
assert.doesNotMatch(panelThemeSrc, /#c7fff2|#cee4ff|#e2dbff|#fffce6|#ffecad/i, 'PanelThemeContext must not use Qlex pastel default colors');
assert.match(panelThemeSrc, /navbar:\s*["']#FFFFFF["']/i);
assert.match(panelThemeSrc, /leftSidebar:\s*["']#F8FAFC["']/i);
assert.match(panelThemeSrc, /text:\s*["']#0F172A["']/i);
console.log('[PASS] 2. PanelThemeContext aligned to NURVIA surfaces with zero Qlex pastel defaults');

// 3. Brand assets & logo references
for (const asset of [
  'public/brand/favicon.svg',
  'public/brand/nurvia-symbol.svg',
  'public/brand/nurvia-logo-light.svg',
  'public/brand/nurvia-logo-dark.svg',
  'public/logo/logo.png',
  'public/logo/logo-dark.png',
  'public/favicons/favicon.png',
]) {
  const full = fs.existsSync(path.join(webRoot, asset))
    ? path.join(webRoot, asset)
    : path.join(baseDir, asset);
  assert.ok(fs.existsSync(full) && fs.statSync(full).size > 100, `Missing or empty brand asset: ${asset}`);
}
const seoHeaderSrc = read('components/common/SeoHeader.tsx');
assert.match(seoHeaderSrc, /\/brand\/favicon\.svg/);
console.log('[PASS] 3. NURVIA SVG and PNG brand assets verified and wired in SeoHeader');

// 4. All 6 program dashboards & 48 livexam routes use NURVIA branding and zero "Qlex Nursing" copyright
const programs = ['ati-teas', 'hesi-a2', 'lpn-nursing', 'nclex-pn', 'nclex-rn', 'rn-nursing'];
const themes = ['atlas', 'cascade', 'classic', 'generic', 'glacial', 'orbit', 'pulse', 'zen'];
for (const prog of programs) {
  const footerSrc = read(`app/dashboards/${prog}/includes/footer/Footer.tsx`);
  assert.doesNotMatch(footerSrc, /Qlex Nursing/i, `Footer for ${prog} must not contain Qlex Nursing`);
  assert.match(footerSrc, /NURVIA\. All rights reserved\./, `Footer for ${prog} must display NURVIA copyright`);

  const navSrc = read(`app/dashboards/${prog}/includes/navbar/Navbar.tsx`);
  assert.match(navSrc, /\/brand\/nurvia-symbol\.svg/, `Dashboard Navbar for ${prog} must use /brand/nurvia-symbol.svg`);

  for (const theme of themes) {
    const upperNav = read(`app/web/(livexams)/${prog}/vista/exam/(layout)/${theme}/partials/UpperStickyNavBar.tsx`);
    assert.match(upperNav, /\/brand\/nurvia-symbol\.svg/, `UpperStickyNavBar for ${prog}/${theme} must use /brand/nurvia-symbol.svg`);
  }
}
console.log('[PASS] 4. All 6 program dashboards and all 48 examination theme headers/footers use NURVIA branding');

// 5. Full scan: zero customer-facing Qlex strings, zero native alert()/confirm(), zero UTF-8 mojibake or golfer emojis
const sourceFiles = [
  ...walk(path.join(webRoot, 'app')),
  ...walk(path.join(webRoot, 'components')),
];
for (const f of sourceFiles) {
  if (!/\.(tsx|ts)$/i.test(f)) continue;
  const rel = path.relative(webRoot, f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
    if (/\bqlex\b/i.test(t) && !t.includes('qlexSessionBridge')) {
      assert.fail(`Customer-facing Qlex reference in ${rel}:${idx + 1}: ${t}`);
    }
    if (/(?:^|[^\w.])(?:window\.)?(?:alert|confirm)\s*\(/.test(t)) {
      assert.fail(`Prohibited native alert()/confirm() in ${rel}:${idx + 1}: ${t}`);
    }
    if (/â€|Ã—|Ã·|🏌/.test(t)) {
      assert.fail(`Mojibake or golfer emoji in ${rel}:${idx + 1}: ${t}`);
    }
  });
}
console.log('[PASS] 5. Zero customer-facing Qlex strings, zero native alert()/confirm() dialogs, and zero mojibake across all app/ and components/ files');

// 6. All required UI alignment documentation & registers exist in docs/ui-alignment/
const requiredDocs = [
  'NURVIA_DESIGN_SYSTEM.md',
  'UI_ALIGNMENT_INVENTORY.md',
  'UI_TRANSFORMATION_REGISTER.csv',
  'FEATURE_PRESERVATION_REGISTER.csv',
  'TERMINOLOGY_REPLACEMENT_REGISTER.csv',
  'UI_REGRESSION_REPORT.md',
  'UI_ALIGNMENT_PROGRESS_REPORT.md',
  'FINAL_NURVIA_UI_ALIGNMENT_REPORT.md',
];
for (const doc of requiredDocs) {
  const full = path.join(repoRoot, 'docs/ui-alignment', doc);
  assert.ok(fs.existsSync(full) && fs.statSync(full).size > 200, `Missing or empty required UI alignment doc: docs/ui-alignment/${doc}`);
}
console.log('[PASS] 6. All 8 required UI alignment specifications, registers, and reports exist in docs/ui-alignment/');

console.log('\nAll 6 NURVIA UI Transformation & Identity Alignment verification suites PASSED (6/6)!');
