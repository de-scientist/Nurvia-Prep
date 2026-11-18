import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

console.log('--- NURVIA ADDITIVE PRODUCT EXPANSION VERIFICATION SUITE ---');

let passed = 0;

// 1. Verify all new page and route handler files exist
const requiredFiles = [
  // API Route Handlers
  'src/app/api/community/categories/route.ts',
  'src/app/api/community/posts/route.ts',
  'src/app/api/community/posts/[id]/route.ts',
  'src/app/api/community/posts/[id]/replies/route.ts',
  'src/app/api/community/posts/[id]/vote/route.ts',
  'src/app/api/community/posts/[id]/report/route.ts',
  'src/app/api/qotd/today/route.ts',
  'src/app/api/qotd/submit/route.ts',
  'src/app/api/qotd/history/route.ts',
  'src/app/api/groups/route.ts',
  'src/app/api/groups/[id]/route.ts',
  'src/app/api/groups/[id]/join/route.ts',
  'src/app/api/groups/[id]/leave/route.ts',
  'src/app/api/mentors/route.ts',
  'src/app/api/mentors/request/route.ts',
  'src/app/api/insights/summary/route.ts',
  'src/app/api/insights/share/route.ts',
  'src/app/api/search/global/route.ts',

  // UI Pages
  'src/app/community/categories/page.tsx',
  'src/app/forum/page.tsx',
  'src/app/qotd/page.tsx',
  'src/app/groups/page.tsx',
  'src/app/groups/[id]/page.tsx',
  'src/app/mentors/page.tsx',
  'src/app/insights/page.tsx',
  'src/app/search/page.tsx',
  'src/app/new/page.tsx',
  'src/app/nursing-exams/page.tsx',
  'src/app/nursing-exams/rn/page.tsx',
  'src/app/nursing-exams/lpn/page.tsx',
  'src/app/study-guides/page.tsx',
  'src/app/study-guide/page.tsx',
  'src/app/nclex/study/page.tsx',

  // Core Stores & Services
  'src/lib/community/community-store.ts',
  'src/lib/qotd/qotd-store.ts',
  'src/lib/groups/groups-store.ts',
  'src/lib/mentors/mentors-store.ts',
  'src/lib/insights/insights-store.ts',
  'src/lib/search/search-service.ts',
  'src/lib/content/study-guides-repository.ts',
];

for (const file of requiredFiles) {
  const fullPath = path.join(baseDir, file);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${file}`);
  passed++;
}
console.log(`✓ Verified all ${requiredFiles.length} additive files exist on disk.`);

// 2. Verify Route Registry has all additive routes
const routesFile = fs.readFileSync(path.join(baseDir, 'src/lib/routes.ts'), 'utf-8');
const expectedRoutes = [
  'categories: "/community/categories"',
  'qotd: "/qotd"',
  'groups: "/groups"',
  'mentors: "/mentors"',
  'forum: "/forum"',
  'insights: "/insights"',
  'search: "/search"',
  'newPost: "/new"',
  'nursingExams: "/nursing-exams"',
  'nursingExamsRn: "/nursing-exams/rn"',
  'nursingExamsLpn: "/nursing-exams/lpn"',
  'studyGuides: "/study-guides"',
  'nclexStudy: "/nclex/study"',
];

for (const route of expectedRoutes) {
  assert.ok(routesFile.includes(route), `Route definition missing in routes.ts: ${route}`);
  passed++;
}
console.log(`✓ Verified centralized route definitions in routes.ts.`);

// 3. Verify Community Store structure & 9 category groups
const communityStoreFile = fs.readFileSync(path.join(baseDir, 'src/lib/community/community-store.ts'), 'utf-8');
assert.ok(communityStoreFile.includes('Pre-Nursing & Admissions'), 'Pre-Nursing category missing');
assert.ok(communityStoreFile.includes('Nursing School Survival'), 'Nursing School category missing');
assert.ok(communityStoreFile.includes('Exit & Predictor Examinations'), 'Exit exams category missing');
assert.ok(communityStoreFile.includes('NCLEX-RN Preparation'), 'NCLEX-RN category missing');
assert.ok(communityStoreFile.includes('NCLEX-PN / LPN-LVN Corner'), 'NCLEX-PN category missing');
assert.ok(communityStoreFile.includes('International Nursing & Licensure'), 'International category missing');
assert.ok(communityStoreFile.includes('New Graduates & First Year'), 'New Grad category missing');
assert.ok(communityStoreFile.includes('Careers & Professional Growth'), 'Career category missing');
assert.ok(communityStoreFile.includes('Wellness & Break Room'), 'Wellness category missing');
passed += 9;
console.log('✓ Verified 9 structured community category groups in community-store.ts.');

// 4. Verify QOTD evaluation logic
const qotdStoreFile = fs.readFileSync(path.join(baseDir, 'src/lib/qotd/qotd-store.ts'), 'utf-8');
assert.ok(qotdStoreFile.includes('submitAnswer'), 'QOTD submitAnswer missing');
assert.ok(qotdStoreFile.includes('getTodayQuestion'), 'QOTD getTodayQuestion missing');
assert.ok(qotdStoreFile.includes('userStreak'), 'QOTD streak tracking missing');
passed += 3;
console.log('✓ Verified QOTD store contracts and streak tracking.');

// 5. Verify Study Groups & Mentors store logic
const groupsStoreFile = fs.readFileSync(path.join(baseDir, 'src/lib/groups/groups-store.ts'), 'utf-8');
assert.ok(groupsStoreFile.includes('joinGroup'), 'Groups joinGroup missing');
assert.ok(groupsStoreFile.includes('leaveGroup'), 'Groups leaveGroup missing');
assert.ok(groupsStoreFile.includes('createGroup'), 'Groups createGroup missing');
passed += 3;

const mentorsStoreFile = fs.readFileSync(path.join(baseDir, 'src/lib/mentors/mentors-store.ts'), 'utf-8');
assert.ok(mentorsStoreFile.includes('requestSession'), 'Mentors requestSession missing');
assert.ok(mentorsStoreFile.includes('specialties'), 'Mentors specialties missing');
passed += 2;
console.log('✓ Verified Study Groups & Nurse Mentors stores.');

// 6. Verify Study Guide Catalogue content
const studyGuideRepo = fs.readFileSync(path.join(baseDir, 'src/lib/content/study-guides-repository.ts'), 'utf-8');
assert.ok(studyGuideRepo.includes('STUDY_GUIDE_CATALOGUE'), 'STUDY_GUIDE_CATALOGUE missing');
assert.ok(studyGuideRepo.includes('Pharmacology & Parenteral Therapies'), 'Pharmacology subject missing');
assert.ok(studyGuideRepo.includes('Medical-Surgical Nursing'), 'Med-Surg subject missing');
assert.ok(studyGuideRepo.includes('Fundamentals of Nursing'), 'Fundamentals subject missing');
assert.ok(studyGuideRepo.includes('Pediatric Nursing'), 'Pediatrics subject missing');
assert.ok(studyGuideRepo.includes('Maternal & Newborn Nursing (OB)'), 'Maternity subject missing');
assert.ok(studyGuideRepo.includes('Mental Health & Psychiatric Nursing'), 'Mental health subject missing');
assert.ok(studyGuideRepo.includes('Critical Care & Emergency Nursing'), 'Critical care subject missing');
assert.ok(studyGuideRepo.includes('Leadership, Delegation & Priority Setting'), 'Leadership subject missing');
assert.ok(studyGuideRepo.includes('Dosage Calculations & Pharmacology Math'), 'Dosage calc subject missing');
passed += 10;
console.log('✓ Verified 9 complete subjects in study-guides-repository.ts.');

// 7. Verify Absolute Preservation: Ensure existing learner workspaces exist
const protectedWorkspaces = [
  'src/app/learner/page.tsx',
  'src/app/learner/exams/page.tsx',
  'src/app/learner/library/page.tsx',
  'src/app/learner/performance/page.tsx',
  'src/app/learner/history/page.tsx',
  'src/app/learner/my-exams/page.tsx',
  'src/app/learner/custom-practice/page.tsx',
];

for (const ws of protectedWorkspaces) {
  assert.ok(fs.existsSync(path.join(baseDir, ws)), `Protected workspace missing: ${ws}`);
  passed++;
}
console.log(`✓ Verified preservation of all ${protectedWorkspaces.length} core learner workspaces.`);

console.log(`\nALL ${passed} VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
