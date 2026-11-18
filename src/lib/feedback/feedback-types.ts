/**
 * Authoritative Typed Feedback System Contracts for NURVIA.
 * Standardizes application-wide notifications, empty states, and diagnostic mappings.
 */

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

export interface FeedbackResponseDto {
  status: FeedbackCategory;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Authoritative HTTP status to semantic feedback mapping.
 */
export function mapHttpStatusToFeedback(
  statusCode: number | undefined,
  backendMessage?: string,
  featureName?: string
): { category: FeedbackCategory; title: string; message: string } {
  switch (statusCode) {
    case 200:
    case 201:
      return {
        category: 'success',
        title: 'Success',
        message: backendMessage || 'Operation completed successfully.',
      };

    case 202:
      return {
        category: 'partial_success',
        title: "You're all set!",
        message:
          backendMessage ||
          'Your changes have been saved. One additional step is still processing, and we will update you when it is complete.',
      };

    case 400:
      return {
        category: 'validation_error',
        title: 'Check Your Inputs',
        message: backendMessage || 'Please review the highlighted fields and try submitting again.',
      };

    case 401:
      return {
        category: 'authentication_required',
        title: 'Sign In Required',
        message: backendMessage || 'Your session has expired or authentication is required. Please sign in to continue.',
      };

    case 403:
      return {
        category: 'permission_denied',
        title: 'Access Restricted',
        message: backendMessage || 'Your account does not currently have permission to perform this action.',
      };

    case 404:
      return {
        category: 'not_found',
        title: 'Resource Not Found',
        message: backendMessage || 'The requested item or examination could not be located.',
      };

    case 409:
      return {
        category: 'conflict',
        title: 'Update Conflict',
        message: backendMessage || 'This record was modified in another session. Please refresh and try again.',
      };

    case 422:
      return {
        category: 'validation_error',
        title: 'Verification Needed',
        message: backendMessage || 'Some information provided could not be processed. Please check the form.',
      };

    case 429:
      return {
        category: 'rate_limited',
        title: 'Please Wait a Moment',
        message: backendMessage || 'Too many requests were received. Please wait a few moments before retrying.',
      };

    case 501:
      return {
        category: 'coming_soon',
        title: "We're Still Building This!",
        message:
          backendMessage ||
          (featureName
            ? `Good news—${featureName} is currently in development. You can continue exploring the rest of Nurvia in the meantime.`
            : 'Good news—this feature is currently in development. You can continue exploring the rest of Nurvia in the meantime.'),
      };

    case 503:
      return {
        category: 'maintenance',
        title: 'Brief Maintenance',
        message: backendMessage || 'Taking a little longer than usual. Please try again shortly.',
      };

    case 500:
    default:
      return {
        category: 'temporary_issue',
        title: 'Hang Tight, We Hit a Quick Snag',
        message: 'We could not complete your request right now. Please try again in a few moments.',
      };
  }
}
