import { NextRequest, NextResponse } from 'next/server';
import { extractSiteMetadataFromRequestHeaders } from '@/lib/lexmacasto/client';
import { getServerTestimonials } from '@/lib/testimonials/server-testimonials';
import {
  parseApprovedTestimonialPathway,
  type ApprovedTestimonialPathway,
} from '@/lib/testimonials/testimonial-service';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const rawPathway = request.nextUrl.searchParams.get('pathway');
  let pathwayFilter: ApprovedTestimonialPathway | undefined;

  if (rawPathway !== null && rawPathway.trim() !== '') {
    const parsed = parseApprovedTestimonialPathway(rawPathway);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unsupported pathway filter. Only RN and PN_LPN testimonials are permitted.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    pathwayFilter = parsed;
  }

  const siteMeta = extractSiteMetadataFromRequestHeaders(
    request.headers,
    '/api/testimonials'
  );

  const result = await getServerTestimonials({
    pathway: pathwayFilter,
    siteMeta,
  });

  return NextResponse.json(
    {
      success: true,
      message: 'OK',
      data: result,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
