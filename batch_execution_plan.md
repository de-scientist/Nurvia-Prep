# Batch Execution Plan

## Manual Git Operations Required

Since the current environment has limitations with executing shell commands, this plan outlines the manual Git operations needed to execute each batch sequentially.

## Batch 1: Core Infrastructure (11 files)

### Files to Stage
1. `src/lib/config/config.ts`
2. `src/lib/config/siteHeaders.ts`
3. `src/components/common/NurviaLogo.tsx`
4. `src/components/common/ScrollToTopButton.tsx`
5. `src/components/common/SeoHeader.tsx`
6. `src/lib/contexts/panel/layout/theme/PanelThemeContext.tsx`
7. `src/lib/contexts/web/assessment/theme/ExamThemeContext.tsx`
8. `src/lib/utils/data/PerPageSelect.tsx`
9. `src/lib/utils/data/SearchBar.tsx`
10. `src/components/panel/exam/tools/CustomMiniCalculator.tsx`
11. `src/components/common/modals/seek/SeekModal.tsx`

### Manual Staging Steps
```bash
# Open terminal in repository directory
# Execute these commands sequentially
git add src/lib/config/config.ts
git add src/lib/config/siteHeaders.ts
git add src/components/common/NurviaLogo.tsx
git add src/components/common/ScrollToTopButton.tsx
# Continue with remaining files...
git add -p src/lib/config/config.ts  # interactive patch if needed
git add -p src/components/common/ScrollToTopButton.tsx  # interactive patch if needed

# Verify staging
git diff --cached --name-status
git diff --cached --stat

# Validate TypeScript and build
npm run typecheck
npm run lint
npm test
npm run build

# Create commit
git commit -m "feat(config): establish core configuration and utility infrastructure" -m "- Add centralized configuration system with environment variables" -m "- Implement shared UI components (logo, scroll-to-top, SEO header)" -m "- Add theme contexts for panel and exam interfaces" -m "- Include utility components (per-page select, search bar)" -m "- Add panel examination tools and common modals"

# Record commit hash
git log --oneline --decorate -1
```

## Batch 2: Authentication System (15 files)

### Files to Stage
1. `src/app/(web)/auth/page.tsx`
2. `src/app/(web)/auth/login/page.tsx`
3. `src/app/(web)/auth/register/page.tsx`
4. `src/app/(web)/auth/logout/page.tsx`
5. `src/app/(web)/auth/onetap/page.tsx`
6. `src/app/(web)/auth/recovery/password/page.tsx`
7. `src/app/(web)/auth/recovery/social/page.tsx`
8. `src/app/(web)/auth/social/complete/page.tsx`
9. `src/app/(web)/auth/support/page.tsx`
10. `src/app/(web)/auth/update/2fa/page.tsx`
11. `src/app/(web)/auth/update/password/page.tsx`
12. `src/app/(web)/auth/validate/ValidateClient.tsx`
13. `src/app/(web)/auth/modals/auth.tsx`
14. `src/app/(web)/auth/modals/Login.tsx`
15. `src/app/(web)/auth/modals/Register.tsx`

### Manual Staging Steps
```bash
# Stage all auth files
git add src/app/(web)/auth/page.tsx
git add src/app/(web)/auth/login/page.tsx
git add src/app/(web)/auth/register/page.tsx
# ... continue for all 15 files

# Verify staging and commit similarly to Batch 1
```

## Batch 3: Navigation System (3 files)

### Files to Stage
1. `src/app/(web)/includes/navbar/index.tsx`
2. `src/app/(web)/includes/footer/index.tsx`
3. `src/components/common/modals/seek/SeekModal.tsx`

## Batch 4: Homepage (2 files)

### Files to Stage
1. `src/app/(web)/pages/home/home.tsx`
2. `src/app/(web)/layout.tsx`

## Batch 5: Study Resources (19 files)

### Files to Stage
1. `src/app/(web)/pages/(more)/about-us/page.tsx`
2. `src/app/(web)/pages/(more)/blogs/page.tsx`
3. `src/app/(web)/pages/(more)/documentation/page.tsx`
4. `src/app/(web)/pages/(more)/faqs/page.tsx`
5. `src/app/(web)/pages/(more)/live-sessions/page.tsx`
6. `src/app/(web)/pages/(more)/mission/page.tsx`
7. `src/app/(web)/pages/(more)/privacy-policy/page.tsx`
8. `src/app/(web)/pages/(more)/reviews/page.tsx`
9. `src/app/(web)/pages/(more)/social-groups/page.tsx`
10. `src/app/(web)/pages/(more)/team/page.tsx`
11. `src/app/(web)/pages/(more)/terms-of-service/page.tsx`
12. `src/app/(web)/pages/(more)/values/page.tsx`
13. `src/app/(web)/pages/(more)/vission/page.tsx`
14. `src/app/(web)/explore/page.tsx`
15. `src/app/(web)/pages/actions/page.tsx`
16. `src/app/(web)/pages/contact-us/page.tsx`
17. `src/app/(web)/pages/create/page.tsx`
18. `src/app/(web)/pages/entrance/page.tsx`
19. `src/app/(web)/pages/heed/current/page.tsx`

## Batch 6: Exam Preparation (7 files)

### Files to Stage
1. `src/app/(web)/pages/exams/ati-teas/page.tsx`
2. `src/app/(web)/pages/exams/hesi-a2/page.tsx`
3. `src/app/(web)/pages/exams/rn-nursing/page.tsx`
4. `src/app/(web)/pages/exams/lpn-nursing/page.tsx`
5. `src/app/(web)/pages/exams/nclex-pn/page.tsx`
6. `src/app/(web)/pages/exams/nclex-rn/page.tsx`
7. `src/app/(web)/pages/exams/rn-nursing/page.tsx`

## Batch 7: Dashboard Components (4 files)

### Files to Stage
1. `src/components/common/dashboards/elements/DashboardPreloader.tsx`
2. `src/components/common/dashboards/modals/AccessReminderModals.tsx`
3. `src/components/common/modals/seek/SeekModal.tsx`
4. `src/components/common/modals/seek/SeekModal.tsx`

## Batch 8: Specialized Features (11 files)

### Files to Stage
1. `src/app/(web)/pages/heed/partials/HeedReplyBox.tsx`
2. `src/app/(web)/pages/heed/relative/page.tsx`
3. `src/app/(web)/pages/notes/page.tsx`
4. `src/app/(web)/pages/resources/page.tsx`
5. `src/app/(web)/pages/seek/page.tsx`
6. `src/app/(web)/pages/shop/page.tsx`
7. `src/app/(web)/pages/subscription/item/SubscriptionItem.tsx`
8. `src/app/(web)/pages/subscription/package/page.tsx`
9. `src/app/(web)/pages/heed/partials/HeedReplyBox.tsx`
10. `src/app/(web)/pages/heed/relative/page.tsx`

## Batch 9: Static Assets (5 files)

### Files to Stage
1. `public/logo/logo-dark.png`
2. `public/favicons/favicon.png`
3. `public/brand/favicon.svg`
4. `public/brand/nurvia-logo-dark.svg`
5. `public/brand/nurvia-logo-light.svg`

## Batch 10: Additional Features (6 files)

### Files to Stage
1. `src/app/(web)/pages/heed/partials/HeedReplyBox.tsx`
2. `src/app/(web)/pages/heed/relative/page.tsx`
3. `src/app/(web)/pages/notes/page.tsx`
4. `src/app/(web)/pages/resources/page.tsx`
5. `src/app/(web)/pages/seek/page.tsx`
6. `src/app/(web)/pages/shop/page.tsx`

## Validation Commands

### Required Commands (Based on Project Structure)
```bash
# TypeScript compilation
git diff --cached --name-status > staged-files.txt
# Run TypeScript type checking on staged files
# Check for syntax errors

# ESLint checks
npm run lint -- --file "$(git diff --cached --name-only)"

# Build verification
npm run build

# Unit tests (if available)
npm test

# Integration tests (if available)
# Run backend tests
# Run frontend tests
```

## Push Strategy

### After Each Logically Complete Batch
1. **Recheck remote state**
   ```bash
   git status --short --branch
   git log --oneline --decorate -5
   ```

2. **Verify remote and branch**
   ```bash
   git remote -v
   git branch -vv
   ```

3. **Check push permissions**
   ```bash
   git ls-remote origin
   ```

4. **Push normally**
   ```bash
   git push origin main
   ```

5. **Verify push**
   ```bash
   git log --oneline --decorate -10
   ```

## Final Report Requirements

After execution, generate a final engineering report with:

1. **Actual baseline** from gate 1
2. **Reconciled file inventory** from gate 2
3. **Batch-by-batch commit register** with hashes
4. **Test and build results** for each batch
5. **Number of commits created and pushed**
6. **Remote HEAD verification**
7. **Remaining uncommitted changes**
8. **Outstanding failures and deployment considerations**

## Safety Guidelines

1. **Never use blanket staging** (`git add .` or `git add -A`)
2. **Never reset, clean or discard unrelated work**
3. **Never force-push**
4. **Always verify staging before committing**
5. **Always validate before committing**
6. **Always preserve application integrity**
7. **Always document commit activities**

## Execution Instructions

1. **Open terminal in repository directory**
2. **Read the batch execution plan carefully**
3. **Execute Batch 1 manually as outlined**
4. **Validate Batch 1 before proceeding**
5. **Continue with Batch 2, then Batch 3, etc.**
6. **Push after each batch if safe**
7. **Generate final report when complete**

**Estimated execution time: 5 days of sequential Git operations**
**Risk level: LOW (well-documented, dependency-aware approach)"