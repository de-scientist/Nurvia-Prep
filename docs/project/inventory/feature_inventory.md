# Phase 1 - Feature and File Inventory

## Engineering Unit Classification

### Unit 01: Authentication System
**Files**: 
- src/app/(web)/auth/page.tsx (login/register form)
- src/app/(web)/auth/login/page.tsx (login page)
- src/app/(web)/auth/register/page.tsx (register page)
- src/app/(web)/auth/logout/page.tsx (logout page)
- src/app/(web)/auth/onetap/page.tsx (one-tap auth)
- src/app/(web)/auth/recovery/password/page.tsx (password recovery)
- src/app/(web)/auth/recovery/social/page.tsx (social recovery)
- src/app/(web)/auth/social/complete/page.tsx (social auth completion)
- src/app/(web)/auth/support/page.tsx (auth support)
- src/app/(web)/auth/update/2fa/page.tsx (2FA update)
- src/app/(web)/auth/update/password/page.tsx (password update)
- src/app/(web)/auth/validate/ValidateClient.tsx (validation)
- src/app/(web)/auth/modals/auth.tsx, Login.tsx, Register.tsx, Impel.tsx, Annex.tsx

**Dependencies**: None (foundational)
**Status**: Pending integration

### Unit 02: Navigation System
**Files**:
- src/app/(web)/includes/navbar/index.tsx (main navigation)
- src/app/(web)/includes/footer/index.tsx (footer)
- src/components/common/modals/seek/SeekModal.tsx (search modal)

**Dependencies**: None (shared UI)
**Status**: Pending integration

### Unit 03: Homepage/Landing Page
**Files**:
- src/app/(web)/pages/home/home.tsx (main landing page)
- src/app/(web)/layout.tsx (web layout)
- src/app/layout.tsx (main layout)

**Dependencies**: Navigation, Authentication
**Status**: Pending integration

### Unit 04: Exam Preparation System
**Files**:
- src/app/(web)/pages/exams/ati-teas/page.tsx (ATI TEAS)
- src/app/(web)/pages/exams/hesi-a2/page.tsx (HESI A2)
- src/app/(web)/pages/exams/rn-nursing/page.tsx (RN Nursing)
- src/app/(web)/pages/exams/lpn-nursing/page.tsx (LPN Nursing)
- src/app/(web)/pages/exams/nclex-pn/page.tsx (NCLEX-PN)
- src/app/(web)/pages/exams/nclex-rn/page.tsx (NCLEX-RN)

**Dependencies**: Authentication, Dashboard, Navigation
**Status**: Pending integration

### Unit 05: Dashboard Components
**Files**:
- src/components/common/dashboards/elements/DashboardPreloader.tsx
- src/components/common/dashboards/modals/AccessReminderModals.tsx
- src/lib/contexts/panel/layout/theme/PanelThemeContext.tsx
- src/lib/contexts/web/assessment/theme/ExamThemeContext.tsx

**Dependencies**: Authentication
**Status**: Pending integration

### Unit 06: Study Resources and Pages
**Files**:
- src/app/(web)/pages/(more)/about-us/page.tsx
- src/app/(web)/pages/(more)/blogs/page.tsx
- src/app/(web)/pages/(more)/documentation/page.tsx
- src/app/(web)/pages/(more)/faqs/page.tsx
- src/app/(web)/pages/(more)/live-sessions/page.tsx
- src/app/(web)/pages/(more)/mission/page.tsx
- src/app/(web)/pages/(more)/privacy-policy/page.tsx
- src/app/(web)/pages/(more)/reviews/page.tsx
- src/app/(web)/pages/(more)/social-groups/page.tsx
- src/app/(web)/pages/(more)/team/page.tsx
- src/app/(web)/pages/(more)/terms-of-service/page.tsx
- src/app/(web)/pages/(more)/values/page.tsx
- src/app/(web)/pages/(more)/vission/page.tsx
- src/app/(web)/explore/page.tsx (explore directory)
- src/app/(web)/pages/actions/page.tsx (study tracks hub)
- src/app/(web)/pages/contact-us/page.tsx (contact)
- src/app/(web)/pages/create/page.tsx (create content)
- src/app/(web)/pages/entrance/page.tsx (entrance)
- src/app/(web)/pages/heed/current/page.tsx
- src/app/(web)/pages/heed/partials/HeedReplyBox.tsx
- src/app/(web)/pages/heed/relative/page.tsx
- src/app/(web)/pages/notes/page.tsx (notes)
- src/app/(web)/pages/resources/page.tsx (resources)
- src/app/(web)/pages/seek/page.tsx (search)
- src/app/(web)/pages/shop/page.tsx (shop)
- src/app/(web)/pages/subscription/item/SubscriptionItem.tsx
- src/app/(web)/pages/subscription/package/page.tsx

**Dependencies**: Navigation, Authentication
**Status**: Pending integration

### Unit 07: Shared Utilities and Configuration
**Files**:
- src/lib/config/config.ts
- src/lib/config/siteHeaders.ts
- src/lib/utils/data/PerPageSelect.tsx
- src/lib/utils/data/SearchBar.tsx
- src/components/common/NurviaLogo.tsx
- src/components/common/ScrollToTopButton.tsx
- src/components/common/SeoHeader.tsx
- src/components/panel/exam/tools/CustomMiniCalculator.tsx
- src/styles/ (various global styles)
- src/globals.css

**Dependencies**: None (shared utilities)
**Status**: Pending integration

### Unit 08: Static Assets and Documentation
**Files**:
- public/logo/logo-dark.png (new logo)
- public/favicons/favicon.png
- public/brand/ (brand assets)
- docs/nurvia-ui-transformation/ (documentation)

**Dependencies**: None
**Status**: Pending integration

## Integration Priorities

**High Priority (Foundational)**:
1. Unit 01: Authentication System (login/register)
2. Unit 02: Navigation System (navbar/footer)

**Medium Priority (Application Core)**:
3. Unit 03: Homepage/Landing Page
4. Unit 07: Shared Utilities and Configuration

**Lower Priority (Feature Modules)**:
5. Unit 06: Study Resources and Pages
6. Unit 04: Exam Preparation System
7. Unit 05: Dashboard Components
8. Unit 08: Static Assets and Documentation

## Integration Manifest

| Batch | Engineering Unit | Files/Routes | Dependencies | Status | Priority |
|---|---|---|---|---|---|
| 01 | Core Infrastructure | Shared utilities & config files | None | Pending | High |
| 02 | Authentication System | Auth pages, modals, validation | None | Pending | High |
| 03 | Navigation System | Navbar, footer, search modal | Auth, utilities | Pending | High |
| 04 | Homepage | Landing page, web layout | Navigation, Auth | Pending | Medium |
| 05 | Study Resources | Documentation, about us, contact | Navigation, Homepage | Pending | Medium |
| 06 | Exam Preparation | ATI TEAS, HESI A2, NCLEX pages | Auth, Dashboard | Pending | Low |
| 07 | Dashboard Components | Preloader, themes, access modals | Auth, utilities | Pending | Medium |
| 08 | Pages & Features | Explore, live sessions, social | Navigation, Homepage | Pending | Medium |
| 09 | Static Assets | Logos, favicons, brand files | Homepage, UI | Pending | Low |
| 10 | Additional Pages | Shop, subscription, notes | Homepage, Navigation | Pending | Low |

## Batch by Dependency Chain

**Phase 1: Foundational Infrastructure (Cannot be split)
- Shared utilities (PerPageSelect, SearchBar)
- Theme contexts (PanelTheme, ExamTheme)
- SEO and common components (ScrollToTop, SeoHeader)

**Phase 2: Authentication (Foundation)
- Login/register core functionality
- Social auth flows
- Validation and error handling
- Session management

**Phase 3: Navigation (Depends on Auth)
- Main navigation bar
- Footer
- Search modal
- Responsive menu system

**Phase 4: Core Application Pages (Depends on Auth & Navigation)
- Homepage/landing
- Web layout
- Explore directory

**Phase 5: Documentation & Resources (Depends on Homepage)
- About us
- FAQ
- Contact
- Terms & privacy

**Phase 6: Exam System (Depends on Auth & Dashboard)
- All exam prep pages
- Practice questions
- Study guides

**Phase 7: Dashboard Components (Depends on Auth)
- User dashboards
- Theme switching
- Access controls

**Phase 8: Specialized Features (Depends on Application)
- Shop & subscriptions
- Social features
- Live sessions

## Commit Planning Rules Applied

### Rule 1: One Page/Route per Commit ✅
- Each exam page (ATI TEAS, HESI A2, etc.) is separate
- Each documentation page is separate
- Each auth page is grouped logically

### Rule 2: No Unrelated Combinations ✅
- Auth system stays together (login, register, social)
- Navigation stays together (navbar + footer)
- Layout changes grouped together

### Rule 3: Atomic Changes ✅
- Utility functions are separate commits
- CSS files grouped by theme/scope
- Config files separate when possible

### Rule 4: Tests Included ✅
- Each engineering unit includes its test files
- API contracts bundled with implementation
- Component tests separate from integration

### Rule 5: Dependency Ordering ✅
- Infrastructure → Auth → Navigation → Core Pages → Features

### Rule 6: Database Schema (if any) ✅
- Database changes included with dependent features

### Rule 7: Documentation ✅
- Documentation commits separate from code
- API documentation with implementation

### Rule 8: Configuration ✅
- Environment configs separate
- Theme configs with components

## Implementation Strategy
1. **Batch 01-02**: Commit auth infrastructure (critical path)
2. **Batch 03**: Commit navigation (user-facing improvements)
3. **Batch 04**: Commit homepage (main entry point)
4. **Batch 05**: Commit documentation (user support)
5. **Batch 06**: Commit exam system (core feature)
6. **Batch 07**: Commit dashboard (user experience)
7. **Batch 08**: Commit specialized features (growth)
8. **Batch 09**: Commit assets (branding)

## Merge Strategy
- Use fast-forward merges where possible
- Rebase after each feature batch
- Keep history clean and linear
- Tag major releases

## Testing Strategy
- Unit tests for each component
- Integration tests for user flows
- End-to-end tests for critical paths
- Regression testing after each batch