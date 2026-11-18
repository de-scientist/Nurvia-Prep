# NURVIA-PREP — POST-EXPANSION FORENSIC & FUNCTIONAL AUDIT

**Date:** November 18, 2026  
**Auditor:** Lead Platform Engineering & Forensic Audit Agent (Antigravity)  
**Repository:** `C:\Users\gitau\Documents\Nurvia-Prep`  
**Active Branch:** `feat/nurvia-master-transformation`  
**Baseline HEAD Commit:** `faf7fdd361cb70849dbae005c663a26d0b4d7d60`  
**Governing Principle:** ADD, INTEGRATE, ENHANCE. NEVER DEDUCT.  

---

## 1. EXECUTIVE AUDIT SUMMARY

Following the additive product expansion and local development startup of Nurvia-Prep, an engineering forensic audit was authorized to resolve structural route warnings, comprehensively audit newly introduced modules against their actual source code and data stores, verify legacy system preservation, and evaluate production data persistence requirements.

### Key Audit Findings
1. **Structural Route Conflict Resolved:** A duplicate page warning on `/api/auth/validate` was traced to the coexistence of a legacy raw-proxy file (`src/app/api/auth/validate/route.tsx`) and the canonical BFF route handler (`src/app/api/auth/validate/route.ts`). All legitimate parameters (`userGuidId`, `email`) from the legacy file were integrated into `route.ts`, `route.tsx` was eliminated, and an automated regression test suite was instituted.
2. **Additive Expansion Modules Reality Check:**
   - **Community Groups & Categories:** 9 Category Groups are implemented. Actual distinct categories define 51 subcategories (compared to 67 claimed in historical reports).
   - **Question of the Day (QOTD):** 3 Clinical Judgment questions seeded. Streaks and answers are stored in an in-memory `Map`, resetting on server restart. Answer submission lacked user deduplication.
   - **Study Groups:** 5 seeded study cohorts. Memberships are stored in a process-local `Map` keyed by ephemeral session token (`castoLine`).
   - **Nurse Mentors:** 5 seeded mentor profiles. Mentor verification is a static boolean flag (`isVerified: true`); session bookings are unpersisted in-memory objects without calendar or external notification integration.
   - **Community Forum:** Thread and reply creation functional via in-memory store; vote scoring mutated shared post objects in place across all users; report flags were stored in an unpersisted `Set` with zero moderation dashboard review mechanism.
   - **Community Insights:** 12 seeded self-reported exam results. Aggregation logic works, but submissions are unauthenticated and in-memory.
   - **Global Search:** Fast multi-domain federated search across 7 domains. Searches only public/published resources (zero privacy leakage of private learner records).
   - **Study Guides:** 9 subjects advertised with a declared catalogue metadata sum of 95 topics; exactly 13 comprehensive concrete study guide topics are fully authored in the repository array. The remaining 82 topics represent planned educational content.
3. **Legacy Preservation Verified:** All 4 canonical examination tracks (RN, PN/LPN, RN Exit, PN Exit), 48 exam themes (6 programs × 8 UI layouts), 21 question renderers, BFF session bridge (`getServerCastoSession`), Common Learner Dashboard (`/learner`), and Study Library (`/learner/library`) remain 100% operational and intact.
4. **Data Persistence Requirement:** The entire additive expansion presently relies on in-memory Node.js process data structures (`Map`, `Array`, `Set`). A multi-tier persistent architecture is essential for multi-instance scalability and durable learner progress.

---

## 2. REPOSITORY BASELINE & SOURCE INVENTORY

```text
Repository Root: C:\Users\gitau\Documents\Nurvia-Prep
Active Branch:   feat/nurvia-master-transformation
Commit Hash:     faf7fdd361cb70849dbae005c663a26d0b4d7d60
Framework:       Next.js 15.5.19 (App Router, Turbopack)
Runtime/UI:      React 18.3.1, TypeScript 5.x, Tailwind CSS 4.x
Upstream:        https://github.com/rhenisstate-stack/Nurvia-Prep.git
Remote Backend:  https://explicitbackend.com (Protected LexmaCasto BFF)
```

### Complete Route Inventory (Additive & Core)
| Route Path | Type | File Path | Auth Requirement | State Store |
|---|---|---|---|---|
| `/` | Page (Public) | `src/app/page.tsx` | Public | Static / Layout |
| `/community/categories` | Page (Public) | `src/app/community/categories/page.tsx` | Public | In-memory `communityStore` |
| `/forum` | Page (Public) | `src/app/forum/page.tsx` | Public | In-memory `communityStore` |
| `/new` | Page (Protected) | `src/app/new/page.tsx` | Authenticated | In-memory `communityStore` |
| `/qotd` | Page (Public/Learner) | `src/app/qotd/page.tsx` | Public / Optional Auth | In-memory `qotdStore` |
| `/groups` | Page (Public) | `src/app/groups/page.tsx` | Public | In-memory `groupsStore` |
| `/groups/[id]` | Page (Public) | `src/app/groups/[id]/page.tsx` | Public / Join Auth | In-memory `groupsStore` |
| `/mentors` | Page (Public) | `src/app/mentors/page.tsx` | Public / Request Auth | In-memory `mentorsStore` |
| `/insights` | Page (Public) | `src/app/insights/page.tsx` | Public | In-memory `insightsStore` |
| `/search` | Page (Public) | `src/app/search/page.tsx` | Public | In-memory Federated Search |
| `/nursing-exams` | Page (Public) | `src/app/nursing-exams/page.tsx` | Public | Static Content |
| `/nursing-exams/rn` | Page (Public) | `src/app/nursing-exams/rn/page.tsx` | Public | Static Content |
| `/nursing-exams/lpn` | Page (Public) | `src/app/nursing-exams/lpn/page.tsx` | Public | Static Content |
| `/study-guides` | Page (Public) | `src/app/study-guides/page.tsx` | Public | Static Content Repository |
| `/study-guide` | Page (Public) | `src/app/study-guide/page.tsx` | Public | Static Content Repository |
| `/care-plans` | Page (Public) | `src/app/care-plans/page.tsx` | Public | Static Content Catalogue |
| `/care-plans/[slug]`| Page (Public) | `src/app/care-plans/[slug]/page.tsx`| Public | Static Content Catalogue |
| `/mark-k` | Page (Public) | `src/app/mark-k/page.tsx` | Public | Static Content Catalogue |
| `/mark-k/[slug]` | Page (Public) | `src/app/mark-k/[slug]/page.tsx` | Public | Static Content Catalogue |
| `/nclex/study` | Page (Learner) | `src/app/nclex/study/page.tsx` | Authenticated | LexmaCasto BFF + QOTD |
| `/learner` | Page (Learner) | `src/app/learner/page.tsx` | Authenticated | LexmaCasto BFF |
| `/learner/library` | Page (Learner) | `src/app/learner/library/page.tsx` | Authenticated | LexmaCasto BFF / Strata |
| `/learner/exams` | Page (Learner) | `src/app/learner/exams/page.tsx` | Authenticated | LexmaCasto BFF |
| `/learner/history` | Page (Learner) | `src/app/learner/history/page.tsx` | Authenticated | LexmaCasto BFF |
| `/dashboards/[prog]`| Page (Workspace)| `src/app/dashboards/[prog]/page.tsx`| Authenticated | LexmaCasto BFF |
| `/web/(livexams)/*`| Live Exam Engine| `src/app/web/(livexams)/...` (48 routes) | Authenticated | LexmaCasto BFF Engine |

---

## 3. DUPLICATE AUTHENTICATION ROUTE FORENSIC INVESTIGATION

### 3.1 Initial Conflict Analysis
Next.js local development output flagged:
```text
Duplicate page detected.
src/app/api/auth/validate/route.ts
and
src/app/api/auth/validate/route.tsx
resolve to /api/auth/validate
```

### 3.2 Side-by-Side Comparison Matrix

| Property | `src/app/api/auth/validate/route.ts` | `src/app/api/auth/validate/route.tsx` |
|---|---|---|
| **Origin Commit** | `c086695` (BFF Architecture) | `77db94de` (Initial Scaffolding) |
| **HTTP Methods** | `GET` | `GET` |
| **File Extension** | `.ts` (Canonical Route Handler) | `.tsx` (Unconventional for non-JSX API route) |
| **Input Validation** | Strict: requires `token` and `context`, bounded lengths | Permissive: Blind query string passthrough |
| **Supported Parameters** | `token`, `context` (mandatory) | Any parameter forwarded (including `userGuidId`, `email`) |
| **Authentication Transport**| Reads server HttpOnly cookies via `getServerCastoSession()` | Blindly reads client `x-casto-line` headers |
| **Backend Integration** | `lexmaCastoRequest` with SSRF and metadata guard | Raw Node `fetch()` |
| **Security & Caching** | Enforces `Cache-Control: no-store` | Sets `cache: 'no-store'` in fetch, but no HTTP response header |
| **Error Sanitization** | Structured error codes, sanitized messages | Raw exception message leaks; emoji literals ("⚓") |

### 3.3 Authoritative Determination & Remediation
1. `route.ts` is the authoritative, secure BFF implementation aligned with the LexmaCasto session bridge.
2. `route.tsx` contained one legitimate capability: client services (`src/lib/services/auth/validateService.ts`) occasionally pass `userGuidId` and `email` alongside `token` and `context`.
3. **Additive Enhancement:** `route.ts` was enhanced to safely accept and forward bounded `userGuidId` (max 128 chars) and `email` (max 256 chars) when provided, without weakening required validation of `token` and `context`.
4. `route.tsx` was safely removed using `git rm`.
5. Automated regression tests (`tests/auth-validate-route-resolution.test.mjs`) were added, verifying that exactly one handler exists and no `.tsx` routes exist in `src/app/api`.

---

## 4. ADDITIVE PRODUCT EXPANSION AUDIT (MODULES A–L)

### Module A — Community Categories
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/community/categories`, `GET /api/community/categories`
- **Findings:** 9 Category Groups are present. Actual categories defined total **51**, whereas prior reports claimed 67. The 51 categories cover admissions, clinical specialties, NCLEX tracks, licensure, and nurse wellness.
- **Limitation:** In-memory store; category post counts are hardcoded seeded counters.

### Module B — Question of the Day (QOTD)
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/qotd`, `GET /api/qotd/today`, `POST /api/qotd/submit`, `GET /api/qotd/history`
- **Findings:** Rich clinical judgment questions with rationales, cognitive skill tagging (CJMM), and client need mapping.
- **Limitation:**
  - In-memory process storage (`qotdStore`). All answers and streaks reset on server restart.
  - Submissions lack deduplication: repeated calls increment question answer counts multiple times.
  - Anonymous submissions are keyed to a single shared `'anonymous-learner'` record.
  - Streak calculation counts unique answer dates rather than strictly consecutive calendar days.

### Module C — Study Groups
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/groups`, `/groups/[id]`, `POST /api/groups`, `POST /api/groups/[id]/join`, `POST /api/groups/[id]/leave`
- **Findings:** 5 realistic clinical cohorts with exam-track filters, meeting cadences, timezones, and membership counts.
- **Limitation:**
  - Memberships and new groups are stored in process memory.
  - User identity is tied to the caller's raw `session.castoLine` session token rather than their persistent user ID. If a learner logs in from another device or renews their session, their group memberships are disconnected.

### Module D — Nurse Mentorship
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/mentors`, `POST /api/mentors/request`
- **Findings:** 5 comprehensive nurse mentor profiles with specialties, credentials, bio, and languages.
- **Limitation:**
  - Verification is a hardcoded mock boolean (`isVerified: true`). There is no auditable primary-source verification mechanism.
  - Ratings (e.g., 4.95, 5.0) are static numbers.
  - Session request endpoint pushes to an in-memory array with status `'Pending'`. No scheduling, calendar integration, or mentor notification workflow exists.

### Module E — Community Forum
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/forum`, `GET/POST /api/community/posts`, `GET/POST /api/community/posts/[id]/replies`, `POST /api/community/posts/[id]/vote`, `POST /api/community/posts/[id]/report`
- **Findings:** Rich feed with sorting (newest, hot, top), post types (Discussion, Question, ExamResult, StudyGroup, Poll), replies, voting, and reporting.
- **Security Defect Identified:**
  - In `src/lib/community/community-store.ts`, `toggleVote` mutates `post.userVote` directly on the global post object. This causes cross-user state pollution: one user's vote status appears to other users, and an upvote by User B toggles off the vote recorded by User A.
  - `reportPost` adds to a private in-memory `Set<string>` without persisting the reason or reporter, and lacks an administrative review console.
  - `POST /api/community/posts` sets `authorName = Nurse_${session.castoLine.slice(0, 6)}`. Using a substring of an authentication secret for public display poses an information disclosure risk.

### Module F — Exam Insights
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/insights`, `GET /api/insights/summary`, `POST /api/insights/share`
- **Findings:** 12 initial reported outcomes with NCLEX question count brackets (85, 86–100, 101–130, 131–150), prep resource rankings, and pass percentages.
- **Privacy Boundary Verified:** Community Insights is fully isolated from private learner performance records. Submissions are voluntary and separate from official examination attempts.
- **Limitation:** Results are illustrative seeded data; anonymous submissions are stored in process memory.

### Module G — Global Search
- **Status:** PASS
- **Route:** `/search`, `GET /api/search/global`
- **Findings:** High-speed federated search querying 7 domains (Study Sets, Care Plans, Mark K. Lectures, Study Guides, Discussions, Groups, Mentors).
- **Privacy Verified:** Search explicitly indexes only published public content; private learner attempts, exam answers, and personal metrics are not exposed.

### Module H — Post Composer
- **Status:** PASS
- **Route:** `/new`
- **Findings:** Multi-type creation modal supporting Discussions, Clinical Questions, Exam Results, and Polls.
- **Compliance Verified:** Features prominent HIPAA compliance warnings instructing learners never to share patient identifiers, room numbers, or clinical facilities, along with secure exam disclosure prohibitions.

### Module I — Nursing Exam Directory
- **Status:** PASS
- **Route:** `/nursing-exams`, `/nursing-exams/rn`, `/nursing-exams/lpn`
- **Findings:** Complete clinical guidance on RN vs LPN scopes of practice, Next Gen NCLEX 6 CJMM cognitive skills, HESI/ATI exit benchmarks, and direct launch buttons into practice workspaces.

### Module J — Expanded Study Guides
- **Status:** PASS WITH LIMITATIONS
- **Route:** `/study-guides`, `/study-guide`
- **Discrepancy Investigation:**
  - Declared Catalogue Metadata: 9 Subjects advertising a total of **95** topics (12 pharmacology, 15 med-surg, 10 fundamentals, 10 pediatrics, 10 maternity, 10 mental health, 10 critical care, 10 leadership, 8 dosage calculations).
  - Implemented Concrete Content: Exactly **13** high-yield study guide topics are fully authored with comparison tables, NCLEX alerts, and clinical priorities in `STUDY_GUIDE_CATALOGUE`.
  - The remaining 82 topics are planned/curriculum targets. No code was modified to invent placeholder text.

### Module K — Clinical Connectors
- **Status:** PASS
- **Route:** `/care-plans`, `/care-plans/[slug]`, `/mark-k`, `/mark-k/[slug]`
- **Findings:** All catalog and dynamic slug detail pages compile and render clinical content cleanly.

### Module L — NCLEX Study Hub
- **Status:** PASS
- **Route:** `/nclex/study`
- **Findings:** Aggregates NCSBN client needs blueprint progress, daily question integration, CAT simulator launchers, and links to the Common Learner Dashboard.

---

## 5. LEGACY PRESERVATION AUDIT

| Capability | Scope / Count | Verification Status | Evidence |
|---|---|---|---|
| **Four Examination Workspaces** | RN, PN/LPN, RN Exit, PN Exit | **VERIFIED PRESERVED** | `tests/learning-integration.test.mjs`, all 6 program trees intact |
| **Exam Engine Themes** | 48 themes (6 programs × 8 layouts) | **VERIFIED PRESERVED** | `tests/phase-e-exam-engine.test.mjs`, `tests/phase-qlex-full-replication.test.mjs` (7/7, 5/5 green) |
| **Question Renderers** | 21 canonical & live exam renderers | **VERIFIED PRESERVED** | `tests/question-renderers.test.mjs` (7/7 green), `QuestionRendererRegistry.tsx`, `QuestionTypes.tsx` |
| **Common Learner Dashboard** | `/learner` | **VERIFIED PRESERVED** | `tests/phase-3-9-dashboard-and-public-routes.test.mjs` (5/5 green) |
| **Study Library** | `/learner/library` | **VERIFIED PRESERVED** | `tests/phase-3-10-learner-filters-and-menu.test.mjs` (5/5 green) |
| **Authentication Bridge** | `getServerCastoSession`, HttpOnly cookies | **VERIFIED PRESERVED** | `tests/lexmacasto-integration.test.mjs` (9/9 green) |
| **BFF Architecture** | Same-origin Route Handlers | **VERIFIED PRESERVED** | `tests/phase-3-8-api-parity.test.mjs` (9/9 green) |

---

## 6. SECURITY & AUTHORIZATION FINDINGS

1. **Session Token Exposure in Username Synthesis (VULN-01 - Medium):**
   In `src/app/api/community/posts/route.ts` and `replies/route.ts`, anonymous or session-authenticated posts generate author names using `Nurse_${session.castoLine.slice(0, 6)}`. Session credentials must never be leaked into user-facing display names.
2. **Missing Rate Limiting & Input Deduplication on Public Endpoints (RISK-01 - Low):**
   `POST /api/insights/share` and `POST /api/qotd/submit` do not rate-limit submissions per IP or session, allowing in-memory store inflation.
3. **Cross-User Vote State Collision (BUG-01 - Medium):**
   `communityStore.toggleVote` writes the last voter's direction directly to `post.userVote` on the shared post reference in memory. In a multi-user environment, this corrupts user vote display and prevents accurate vote counts.
4. **Ephemeral Identity in Study Groups (ARCH-01 - High):**
   Group ownership and memberships are indexed by `session.castoLine`. When sessions expire or rotate, learners lose access to their groups.

---

## 7. DATA PERSISTENCE CLASSIFICATION

| Data Domain | Feature Capability | Current State | Required Target State |
|---|---|---|---|
| Static Educational Content | Study Guides (13 authored + 82 planned) | Static TypeScript File | Version-controlled TypeScript / CMS |
| Static Educational Content | Care Plans & Mark K. Lectures | Static TypeScript File | Version-controlled TypeScript / CMS |
| Community Forum | Discussions & Replies | In-memory `communityStore` | Persistent Relational Database |
| Community Forum | Post & Reply Votes | In-memory `post.voteScore` | Persistent Relational (Unique User Constraint) |
| Community Moderation | Content Reports | In-memory `Set<string>` | Persistent Audit / Moderation Table |
| Study Groups | Group Entities | In-memory `groupsStore` | Persistent Relational Database |
| Study Groups | Group Memberships | In-memory `Map<userId, Set>` | Persistent Relational (User ↔ Group Join Table) |
| Mentorship | Mentor Profiles & Reviews | In-memory `mentorsStore` | Persistent Database + Verification Workflow |
| Mentorship | Session Booking Requests | In-memory `sessionRequests` | Persistent Workflow / Booking Table |
| Question of the Day | Daily Questions | In-memory `SEED_QUESTIONS` | Managed Content Database |
| Question of the Day | Learner Answers & History | In-memory `userAttempts` | Persistent Learner Progress Table |
| Question of the Day | Streaks | In-memory Set Length | Derived Query from Persistent Answer Log |
| Community Insights | Aggregated Statistics | In-memory `insightsStore` | Materialized Aggregations / Read-Replica |
| Global Search | Search Index | In-memory Array Filter | Postgres Full-Text Search (tsvector) / Meilisearch |

---

## 8. REMAINING RISKS & ARCHITECTURAL SUMMARY

1. **Current In-Memory Runtime Boundary:** The new community, group, and QOTD features function properly in single-instance local development, but cannot support horizontal scaling or serverless environments (Vercel) without persistent storage.
2. **LexmaCasto Remote Backend Integrity:** The remote backend (`https://explicitbackend.com`) remains untouched and fully compatible with existing examination workflows.
3. **Preservation Commitment:** All 4 workspaces, 48 themes, and 21 question renderers have zero regressions.
