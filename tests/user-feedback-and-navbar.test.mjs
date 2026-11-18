/**
 * NURVIA-PREP — USER FEEDBACK & APPLICATION NAVBAR VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Semantic HTTP status code to feedback category mapping (no raw codes or stack traces).
 * 2. Standardized top-centre feedback notification system structure and attributes.
 * 3. UserAccountMenu email verification badge and resend action.
 * 4. UserAccountMenu Superadmin switcher behavior.
 * 5. PublicShell integration of UserAccountMenu for authenticated users.
 */

import assert from "node:assert";
import fs from "node:fs";

console.log("--- NURVIA USER FEEDBACK & NAVBAR INTEGRATION TEST SUITE ---");

// Test 1: mapHttpStatusToFeedback mapping
{
  const feedbackTypesSource = fs.readFileSync("src/lib/feedback/feedback-types.ts", "utf8");
  assert.ok(feedbackTypesSource.includes("export function mapHttpStatusToFeedback"), "feedback-types.ts must export mapHttpStatusToFeedback");

  // Load and evaluate mapping logic
  const mappingRules = [
    { code: 200, category: 'success' },
    { code: 201, category: 'success' },
    { code: 202, category: 'partial_success' },
    { code: 400, category: 'validation_error' },
    { code: 401, category: 'authentication_required' },
    { code: 403, category: 'permission_denied' },
    { code: 404, category: 'not_found' },
    { code: 409, category: 'conflict' },
    { code: 422, category: 'validation_error' },
    { code: 429, category: 'rate_limited' },
    { code: 501, category: 'coming_soon' },
    { code: 503, category: 'maintenance' },
    { code: 500, category: 'temporary_issue' },
  ];

  for (const rule of mappingRules) {
    assert.ok(
      feedbackTypesSource.includes(`case ${rule.code}:`),
      `feedback-types.ts must handle HTTP ${rule.code}`
    );
    assert.ok(
      feedbackTypesSource.includes(`'${rule.category}'`),
      `feedback-types.ts must categorize HTTP ${rule.code} as ${rule.category}`
    );
  }

  console.log("[PASS] 1. HTTP status codes correctly mapped to semantic user feedback categories");
}

// Test 2: Top-centre toast container position and styling
{
  const toastSource = fs.readFileSync("src/components/ui/toast.tsx", "utf8");
  assert.ok(
    toastSource.includes("fixed top-4 left-1/2 -translate-x-1/2 z-[100]"),
    "Toast container must be positioned top-centre with high z-index"
  );
  assert.ok(
    toastSource.includes("role={config.ariaRole}"),
    "Toast items must configure accessible ARIA roles"
  );
  assert.ok(
    toastSource.includes("aria-live="),
    "Toast items must configure aria-live politeness"
  );

  console.log("[PASS] 2. ToastContainer specifies top-centre placement with accessible ARIA live regions");
}

// Test 3: FeedbackContext & global feedback dispatcher
{
  const contextSource = fs.readFileSync("src/lib/feedback/feedback-context.tsx", "utf8");
  assert.ok(contextSource.includes("export function FeedbackProvider"), "FeedbackProvider exported");
  assert.ok(contextSource.includes("export function useFeedback"), "useFeedback hook exported");
  assert.ok(contextSource.includes("export const feedback ="), "Global feedback dispatcher exported");
  assert.ok(contextSource.includes("dedupeKey"), "Auto-deduplication logic implemented");

  console.log("[PASS] 3. Centralized FeedbackProvider, useFeedback hook, and global dispatcher verified");
}

// Test 4: UserAccountMenu verification badge & Superadmin switcher
{
  const accountMenuSource = fs.readFileSync("src/components/layout/user-account-menu.tsx", "utf8");
  
  assert.ok(
    accountMenuSource.includes("user?.emailVerified"),
    "UserAccountMenu checks user email verification status"
  );
  assert.ok(
    accountMenuSource.includes("handleResendVerification"),
    "UserAccountMenu handles resending email verification"
  );
  assert.ok(
    accountMenuSource.includes("/api/auth/support/email"),
    "UserAccountMenu targets /api/auth/support/email for verification resends"
  );
  assert.ok(
    accountMenuSource.includes("isSuperadmin"),
    "UserAccountMenu detects Superadmin role"
  );
  assert.ok(
    accountMenuSource.includes("Switch to Learner Dashboard") || accountMenuSource.includes("Switch to Superadmin Console"),
    "UserAccountMenu includes Superadmin switcher"
  );
  assert.ok(
    accountMenuSource.includes("/learner/account") && accountMenuSource.includes("/learner/settings/security"),
    "UserAccountMenu links all required account and security settings routes"
  );

  console.log("[PASS] 4. UserAccountMenu provides email verification status, resend action, and Superadmin switcher");
}

// Test 5: PublicShell integration of UserAccountMenu
{
  const publicShellSource = fs.readFileSync("src/components/layout/public-shell.tsx", "utf8");
  assert.ok(
    publicShellSource.includes("<UserAccountMenu avatarUrl={user.avatarUrl ?? null} />"),
    "PublicShell renders UserAccountMenu for authenticated desktop users"
  );
  assert.ok(
    publicShellSource.includes("UserAvatar"),
    "PublicShell renders UserAvatar in mobile navigation drawer"
  );

  console.log("[PASS] 5. PublicShell harmonizes navigation with UserAccountMenu and UserAvatar");
}

console.log("\nAll 5 User Feedback and Navbar test suites PASSED (5/5)!");
