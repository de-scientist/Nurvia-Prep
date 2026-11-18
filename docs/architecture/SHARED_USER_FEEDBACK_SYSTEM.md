# NURVIA-PREP — SHARED USER FEEDBACK SYSTEM ARCHITECTURE

**Document ID:** `SHARED_USER_FEEDBACK_SYSTEM`  
**Date:** November 18, 2026  
**Status:** Authoritative Specification & Implementation  
**Governing Directive:** ADD. INTEGRATE. ENHANCE. NEVER DEDUCT.  

---

## 1. ARCHITECTURAL OVERVIEW

The Nurvia Application-Wide User Feedback System provides an accessible, non-intrusive, and consistent mechanism for notifying users about operational results, system status, validation messages, and developmental previews.

### Core Tenets:
1. **Top-Centre Placement:** Notifications appear centered at the top of the viewport (`fixed top-4 left-1/2 -translate-x-1/2 z-[100]`), ensuring immediate visual recognition without obscuring primary actions or mobile navigation.
2. **Elimination of Raw Developer Errors:** No raw HTTP status codes (e.g., `404`, `500`), database query exceptions, or backend error traces are ever displayed to learners. All errors are mapped to empathetic, actionable copy.
3. **Strongly Typed Categories:** Feedback is categorized across 15 semantic domains with tailored iconography, colors, and accessibility attributes.
4. **Auto-Deduplication & Dismissal:** Repetitive error triggers within a 1.5-second window are suppressed to prevent notification spam, while active toasts automatically dismiss after 4.5 seconds.
5. **Universal Dispatch:** Supports both declarative React hooks (`useFeedback()`) and imperative global calls (`feedback.show(...)`).

---

## 2. TYPE DEFINITIONS & CONTRACTS

Located at `src/lib/feedback/feedback-types.ts`:

```typescript
export type FeedbackCategory =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'coming_soon'
  | 'temporary_issue'
  | 'partial_success'
  | 'unsupported_format'
  | 'validation_error'
  | 'authentication_required'
  | 'permission_denied'
  | 'not_found'
  | 'rate_limited'
  | 'conflict'
  | 'maintenance';

export interface FeedbackAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  title?: string;
  message: string;
  durationMs?: number;
  action?: FeedbackAction;
  timestamp: number;
}
```

---

## 3. SEMANTIC HTTP TO FEEDBACK MAPPING

The `mapHttpStatusToFeedback(statusCode, backendMessage, featureName)` function translates upstream responses into user-friendly feedback:

| HTTP Status | Semantic Category | Standard User Title | Standard User Message |
|---|---|---|---|
| `200` / `201` | `success` | `Success` | "Operation completed successfully." |
| `202` | `partial_success` | `You're all set!` | "Your changes have been saved. Processing final updates..." |
| `400` / `422` | `validation_error` | `Check Your Inputs` | "Please review the highlighted fields and try submitting again." |
| `401` | `authentication_required` | `Sign In Required` | "Your session has expired. Please sign in to continue." |
| `403` | `permission_denied` | `Access Restricted` | "Your account does not currently have permission for this action." |
| `404` | `not_found` | `Resource Not Found` | "The requested item or examination could not be located." |
| `409` | `conflict` | `Update Conflict` | "This record was modified elsewhere. Please refresh and try again." |
| `429` | `rate_limited` | `Please Wait a Moment` | "Too many requests. Please wait a few moments before retrying." |
| `501` | `coming_soon` | `We're Still Building This!` | "Good news—this feature is currently in development." |
| `503` | `maintenance` | `Brief Maintenance` | "Taking a little longer than usual. Please try again shortly." |
| `500` / Other | `temporary_issue` | `Hang Tight, We Hit a Snag` | "We could not complete your request right now. Please try again." |

---

## 4. COMPONENT AND HOOK IMPLEMENTATION

### 4.1 Root Layout Integration
`FeedbackProvider` wraps the application tree in `src/app/layout.tsx`:
```tsx
<ThemeProvider>
  <FeedbackProvider>
    <AuthProvider>
      <LeftSidebarProvider>
        <RightSidebarProvider>
          {children}
        </RightSidebarProvider>
      </LeftSidebarProvider>
    </AuthProvider>
  </FeedbackProvider>
</ThemeProvider>
```

### 4.2 Hook Usage (`useFeedback`)
```tsx
import { useFeedback } from "@/lib/feedback/feedback-context";

export function SaveExamButton({ examId }: { examId: string }) {
  const { showSuccess, showError } = useFeedback();

  const handleSave = async () => {
    const res = await nurviaApi.saveStudySet(examId);
    if (res.success) {
      showSuccess("Exam saved to your personal library.");
    } else {
      showError(res.message || "Failed to save exam.");
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### 4.3 Global Imperative Dispatch (`feedback`)
For non-React lifecycle callers:
```typescript
import { feedback } from "@/lib/feedback/feedback-context";

feedback.success("Verification email dispatched!");
feedback.fromHttp(response.status, response.message);
```

---

## 5. ACCESSIBILITY & VISUAL DESIGN

- **Live Regions:** Dynamic `role="alert"` with `aria-live="assertive"` for errors and warnings; `role="status"` with `aria-live="polite"` for informational and success notices.
- **Glassmorphism:** Styled with backdrop blur, subtle borders, and category-themed icon highlights matching the Nurvia Design System.
- **Interactive Actions:** Optional action buttons (e.g. retry or learn more) allow quick remediation without navigating away from current progress.
