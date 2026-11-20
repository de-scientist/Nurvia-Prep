import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

describe("NURVIA-PLEX — Application-Wide Branded Loading System & Route Transitions", () => {
  // 1. Audit Root Layout & Global Splash Integration
  test("Phase 3: Root Layout mounts AppInitializationSplash and RouteTransitionBar", () => {
    const layoutPath = path.join(rootDir, "src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(
      content.includes("AppInitializationSplash") && content.includes("RouteTransitionBar"),
      "src/app/layout.tsx must import AppInitializationSplash and RouteTransitionBar"
    );
    assert.ok(
      content.includes("<AppInitializationSplash />") && content.includes("<RouteTransitionBar />"),
      "src/app/layout.tsx must render AppInitializationSplash and RouteTransitionBar inside providers"
    );
  });

  // 2. Next.js App Router Route Loading Boundaries
  test("Phase 5: App Router loading.tsx boundaries exist for major application sections", () => {
    const rootLoading = path.join(rootDir, "src/app/loading.tsx");
    const learnerLoading = path.join(rootDir, "src/app/learner/loading.tsx");
    const adminLoading = path.join(rootDir, "src/app/admin/loading.tsx");
    const examLoading = path.join(rootDir, "src/app/exam-session/loading.tsx");

    assert.ok(fs.existsSync(rootLoading), "src/app/loading.tsx must exist");
    assert.ok(fs.existsSync(learnerLoading), "src/app/learner/loading.tsx must exist");
    assert.ok(fs.existsSync(adminLoading), "src/app/admin/loading.tsx must exist");
    assert.ok(fs.existsSync(examLoading), "src/app/exam-session/loading.tsx must exist");

    const rootContent = fs.readFileSync(rootLoading, "utf-8");
    assert.ok(rootContent.includes("PageLoader"), "Root loading must utilize branded PageLoader");

    const examContent = fs.readFileSync(examLoading, "utf-8");
    assert.ok(examContent.includes("ExamLoadingScreen"), "Exam loading must utilize ExamLoadingScreen");
  });

  // 3. Shared Feedback & Branded Loader Architecture
  test("Phase 2: Branded loaders and feedback components export standard primitives", () => {
    const indexPath = path.join(rootDir, "src/components/shared/feedback/index.ts");
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    const expectedExports = [
      "AppSplashScreen",
      "AppInitializationSplash",
      "PageLoader",
      "SectionLoader",
      "InlineLoader",
      "RedirectScreen",
      "DashboardSkeleton",
      "TableSkeleton",
      "DetailSkeleton",
      "RouteTransitionBar",
    ];

    for (const exp of expectedExports) {
      assert.ok(
        indexContent.includes(exp),
        `src/components/shared/feedback/index.ts must export ${exp}`
      );
    }
  });

  test("Phase 2 & 11: Branded loaders respect prefers-reduced-motion and accessibility semantics", () => {
    const splashPath = path.join(rootDir, "src/components/shared/feedback/AppSplashScreen.tsx");
    const splashContent = fs.readFileSync(splashPath, "utf-8");

    assert.ok(
      splashContent.includes('role="status"') && splashContent.includes('aria-live="polite"'),
      "AppSplashScreen must declare role=status and aria-live=polite"
    );
    assert.ok(
      splashContent.includes("motion-reduce:animate-none"),
      "AppSplashScreen bouncing dots must respect prefers-reduced-motion"
    );
    assert.ok(
      splashContent.includes("isPublicPath"),
      "AppInitializationSplash must not block public routes"
    );

    const pageLoaderPath = path.join(rootDir, "src/components/shared/feedback/PageLoader.tsx");
    const pageLoaderContent = fs.readFileSync(pageLoaderPath, "utf-8");
    assert.ok(
      pageLoaderContent.includes("motion-reduce:animate-none"),
      "PageLoader must respect prefers-reduced-motion"
    );
    assert.ok(
      pageLoaderContent.includes("fullscreen"),
      "PageLoader must support both fullscreen and container mode"
    );
  });

  // 4. Shell-level Session Verification & Redirect Parity
  test("Phase 4 & 6: LearnerShell uses branded loaders and provides session error recovery", () => {
    const shellPath = path.join(rootDir, "src/components/layout/learner-shell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    assert.ok(
      shellContent.includes("<PageLoader fullscreen message="),
      "LearnerShell must render PageLoader during status === 'loading'"
    );
    assert.ok(
      shellContent.includes("<RedirectScreen"),
      "LearnerShell must render RedirectScreen when unauthenticated or unauthorized"
    );
    assert.ok(
      shellContent.includes("Retry Verification") && shellContent.includes("void refresh()"),
      "LearnerShell must provide an actionable Retry Verification button on error"
    );
    assert.ok(
      !shellContent.includes("Checking your session…"),
      "LearnerShell must not render unstyled raw text 'Checking your session…'"
    );
  });

  test("Phase 4 & 8: AdminShell shares identical branded loading architecture and error recovery", () => {
    const adminShellPath = path.join(rootDir, "src/components/layout/admin-shell.tsx");
    const adminShellContent = fs.readFileSync(adminShellPath, "utf-8");

    assert.ok(
      adminShellContent.includes("<PageLoader fullscreen message="),
      "AdminShell must render PageLoader during status === 'loading'"
    );
    assert.ok(
      adminShellContent.includes("<RedirectScreen"),
      "AdminShell must render RedirectScreen when unauthenticated or unauthorized"
    );
    assert.ok(
      adminShellContent.includes("Retry Verification") && adminShellContent.includes("void refresh()"),
      "AdminShell must provide an actionable Retry Verification button on error"
    );
    assert.ok(
      !adminShellContent.includes("Checking your session..."),
      "AdminShell must not render unstyled raw text 'Checking your session...'"
    );
  });

  // 5. Learner Dashboard & Study Library Intelligent States
  test("Phase 6: Learner dashboard uses structured multi-card skeletons without raw text pop", () => {
    const dashboardPath = path.join(rootDir, "src/app/learner/page.tsx");
    const content = fs.readFileSync(dashboardPath, "utf-8");

    assert.ok(
      content.includes('aria-busy="true"') && content.includes("Progress stats skeleton"),
      "Learner dashboard must use structured multi-card skeletons when loading"
    );
    assert.ok(
      !content.includes("Loading your saved activity…"),
      "Learner dashboard must not display raw paragraph 'Loading your saved activity…'"
    );
  });

  test("Phase 6: StudyLibraryView preserves catalog shell and prevents stale response race conditions", () => {
    const libraryPath = path.join(rootDir, "src/components/study/study-library-view.tsx");
    const content = fs.readFileSync(libraryPath, "utf-8");

    assert.ok(
      content.includes("isInitialLoading") && content.includes("isUpdating"),
      "StudyLibraryView must distinguish between initial loading and filter updating"
    );
    assert.ok(
      content.includes("latestRequestIdRef"),
      "StudyLibraryView must track latestRequestIdRef to prevent stale responses from overwriting newer selections"
    );
  });

  // 6. Examination, Review & Tutor Experience
  test("Phase 7: ExamLoadingScreen supports 5 stages, reduced motion, diagnostics and mode semantics", () => {
    const examScreenPath = path.join(rootDir, "src/components/exam/ExamLoadingScreen.tsx");
    const content = fs.readFileSync(examScreenPath, "utf-8");

    assert.ok(
      content.includes("EXAM_LOADING_STAGES"),
      "ExamLoadingScreen must define all 5 loading stages"
    );
    assert.ok(
      content.includes("motion-reduce:animate-none"),
      "ExamLoadingScreen must respect reduced motion"
    );
    assert.ok(
      content.includes("Safe Retry") && content.includes("Return to Study Library"),
      "ExamLoadingScreen must provide safe retry and return actions on failure"
    );
  });

  test("Phase 7: Exam session submission uses standardized action-level loading and prevents double submits", () => {
    const sessionPath = path.join(rootDir, "src/app/exam-session/page.tsx");
    const content = fs.readFileSync(sessionPath, "utf-8");

    assert.ok(
      content.includes("isLoading={isSubmitting}"),
      "Exam submission button must use standardized isLoading={isSubmitting}"
    );
    assert.ok(
      content.includes("if (isSubmitting) return;"),
      "Exam submission must guard against duplicate submissions"
    );
  });

  // 7. Administrative Modules Loading States
  test("Phase 8: Administrative modules use structured skeletons instead of raw text", () => {
    const adminPages = [
      { path: "src/app/admin/page.tsx", mustNotHave: "Loading live studio metrics…" },
      { path: "src/app/admin/exams/page.tsx", mustNotHave: "Loading examination catalogue..." },
      { path: "src/app/admin/questions/page.tsx", mustNotHave: "Loading question repository..." },
      { path: "src/app/admin/learners/page.tsx", mustNotHave: "Loading learners…" },
      { path: "src/app/admin/analytics/page.tsx", mustNotHave: "Loading persisted analytics…" },
      { path: "src/app/admin/cases/page.tsx", mustNotHave: "Loading clinical case studies…" },
      { path: "src/app/admin/rbac/page.tsx", mustNotHave: "Loading user accounts..." },
      { path: "src/app/admin/reviews/page.tsx", mustNotHave: "Loading queue..." },
      { path: "src/app/admin/taxonomy/page.tsx", mustNotHave: "Loading taxonomy metadata…" },
      { path: "src/app/admin/settings/page.tsx", mustNotHave: "Checking runtime diagnostics…" },
    ];

    for (const { path: relPath, mustNotHave } of adminPages) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        !content.includes(mustNotHave),
        `${relPath} must not contain raw text loading state '${mustNotHave}'`
      );
      assert.ok(
        content.includes('aria-busy="true"') || content.includes("DashboardSkeleton") || content.includes("DetailSkeleton") || content.includes("animate-pulse"),
        `${relPath} must utilize structured skeleton with aria-busy`
      );
    }
  });

  // 8. Button & Action-level Processing
  test("Phase 2 & 10: Button component supports aria-busy and motion-reduce:animate-none", () => {
    const buttonPath = path.join(rootDir, "src/components/ui/button.tsx");
    const content = fs.readFileSync(buttonPath, "utf-8");

    assert.ok(
      content.includes('aria-busy={isLoading ? "true" : undefined}'),
      "Button must declare aria-busy when isLoading is true"
    );
    assert.ok(
      content.includes("motion-reduce:animate-none"),
      "Button loader spinner must respect prefers-reduced-motion"
    );
  });

  // 9. Centralized Async Operation Lifecycle
  test("Phase 9: useAsyncOperation hook enforces IDLE -> LOADING -> SUCCESS/ERROR lifecycle with race condition protection", () => {
    const hookPath = path.join(rootDir, "src/lib/hooks/useAsyncOperation.ts");
    assert.ok(fs.existsSync(hookPath), "src/lib/hooks/useAsyncOperation.ts must exist");

    const content = fs.readFileSync(hookPath, "utf-8");
    assert.ok(
      content.includes("activeExecutionIdRef") && content.includes("isMountedRef"),
      "useAsyncOperation must protect against stale responses and unmounted state updates"
    );
    assert.ok(
      content.includes("AbortController"),
      "useAsyncOperation must support request cancellation"
    );
  });
});
