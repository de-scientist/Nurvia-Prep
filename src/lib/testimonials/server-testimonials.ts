import {
  lexmaCastoRequest,
  type LexmaCastoRequestOptions,
  type LexmaCastoResult,
} from '../lexmacasto/client';
import type { OptionalSiteMetadata } from '../lexmacasto/headers';
import {
  resolveTestimonialsCollection,
  type ApprovedTestimonialPathway,
  type TestimonialsCollectionResult,
} from './testimonial-service';

export type BackendRequester = <T = unknown>(
  path: string,
  options?: LexmaCastoRequestOptions
) => Promise<LexmaCastoResult<T>>;

export interface GetServerTestimonialsOptions {
  pathway?: ApprovedTestimonialPathway;
  siteMeta?: OptionalSiteMetadata;
  /**
   * Optional backend endpoint override (or `process.env.NURVIA_TESTIMONIALS_BACKEND_PATH`).
   * The hosted LexmaCasto backend currently does not expose a testimonials endpoint by default;
   * when unset, the service returns a valid empty collection without fabricating synthetic testimonials.
   */
  backendPathOverride?: string | null;
  requester?: BackendRequester;
  timeoutMs?: number;
}

export async function getServerTestimonials(
  options: GetServerTestimonialsOptions = {}
): Promise<TestimonialsCollectionResult> {
  const configuredPath =
    options.backendPathOverride !== undefined
      ? options.backendPathOverride
      : process.env.NURVIA_TESTIMONIALS_BACKEND_PATH;

  const trimmedPath = typeof configuredPath === 'string' ? configuredPath.trim() : '';
  if (!trimmedPath) {
    return resolveTestimonialsCollection({
      backendAttempted: false,
      backendOk: false,
      backendStatusOverride: 'endpoint_not_provisioned',
      pathwayFilter: options.pathway,
    });
  }

  const requester = options.requester ?? lexmaCastoRequest;
  const result = await requester<unknown>(trimmedPath, {
    method: 'GET',
    siteMeta: options.siteMeta,
    timeoutMs: options.timeoutMs ?? 8_000,
  });

  if (!result.ok) {
    return resolveTestimonialsCollection({
      backendAttempted: true,
      backendOk: false,
      backendStatusOverride:
        result.errorCode === 'NOT_FOUND' ? 'endpoint_not_provisioned' : 'upstream_error',
      pathwayFilter: options.pathway,
    });
  }

  return resolveTestimonialsCollection({
    backendAttempted: true,
    backendOk: true,
    backendPayload: result.data,
    pathwayFilter: options.pathway,
  });
}
