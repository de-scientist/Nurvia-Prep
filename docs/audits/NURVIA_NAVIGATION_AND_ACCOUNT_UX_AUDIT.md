# NURVIA-PREP — NAVIGATION AND ACCOUNT UX AUDIT

**Document ID:** `NURVIA_NAVIGATION_AND_ACCOUNT_UX_AUDIT`  
**Date:** November 18, 2026  
**Status:** Unified & Accessible  
**Governing Directive:** ADD. INTEGRATE. ENHANCE. NEVER DEDUCT.  

---

## 1. EXECUTIVE OVERVIEW

Prior to this remediation, discrepancies existed between the authenticated user experience on the public homepage (`PublicShell`) and the learner portal (`LearnerLayout`). On public pages, authenticated users were shown static buttons ("My Account" / "Sign Out") without the custom avatar menu, while the learner portal contained a dedicated `<UserAccountMenu />`. Furthermore, the user account menu lacked real-time visibility into the user's email verification status, actions to resend verification emails, and a clean switcher for administrative roles.

This audit details the harmonization of the navigation system across all layouts, the enrichment of the user account menu, and full WCAG 2.1 AA keyboard accessibility.

---

## 2. NAVIGATION AND AVATAR HARMONIZATION

### 2.1 Unified Header Treatment
- **Desktop Public Shell:** Replaced static text buttons with `<UserAccountMenu avatarUrl={user.avatarUrl ?? null} />`. The user now experiences identical profile access regardless of whether they are on `/`, `/exams`, or `/learner`.
- **Mobile Navigation Drawer:** Enhanced the mobile slide-out panel to display the learner's avatar, full name, email, role badge, and verification status, alongside seamless navigation to the dashboard and sign out.
- **Strict 9 Approved Public Links:** Maintained the authoritative 9 direct navigation items in exact order:
  `Home`, `Exams`, `Study`, `Care Plans`, `Mark K.`, `Community`, `FAQ`, `NCLEX`, `TEAS`.

---

## 3. ACCOUNT MENU CAPABILITIES & ENRICHMENTS

| Feature | Implementation | UX Behavior |
|---|---|---|
| **User Identity Header** | `<UserAvatar />` + Name + Email | Clean typography with truncation protection on narrow screens |
| **Email Verification Status** | Green check badge (`Verified`) vs. Amber alert badge (`Unverified`) | Evaluates `user?.emailVerified` extracted from server session |
| **Resend Verification Flow** | Interactive button inside dropdown | Calls `POST /api/auth/support/email` with top-centre feedback confirmation |
| **Superadmin Switcher** | Dynamic context-aware banner | If on `/admin`, displays `Switch to Learner Dashboard`; otherwise displays `Switch to Superadmin Console` |
| **Account Routes** | 4 Learner Settings Links | `/learner/account`, `/learner/profile`, `/learner/settings`, `/learner/settings/security` |
| **Admin Routes** | 2 Administrative Links | `/admin/settings`, `/admin` (visible only to authorized roles) |
| **Sign Out** | Destructive action button | Executes server session termination via `signOut()` and routes to `/` |

---

## 4. ACCESSIBILITY & INTERACTION DESIGN

1. **Keyboard Trapping & Navigation:**
   - `ArrowDown` / `ArrowUp` cycle through active menu items.
   - `Home` / `End` jump immediately to first and last menu items.
   - `Escape` dismisses the dropdown and returns focus to the trigger button.
   - `Space` or `Enter` activates the focused item or link.
2. **Layering & Stacking Context:**
   - Configured with `z-[100]` and `shadow-2xl` to ensure the menu floats above all banners, cards, and canvas components.
3. **Responsive Viewport Containment:**
   - Width is set to `w-[min(20rem,calc(100vw-2rem))]` with `right-0` positioning, preventing horizontal overflow on mobile viewports.
