import { NextRequest, NextResponse } from 'next/server';
import { getServerCastoSession } from '@/lib/lexmacasto/session';
import { communityStore } from '@/lib/community/community-store';
import type { CommunityPostType, CreateCommunityPostRequest } from '@/lib/api-types';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sort = (searchParams.get('sort') || 'newest') as 'newest' | 'hot' | 'top' | 'comments' | 'unanswered';
  const categorySlug = searchParams.get('categorySlug') || undefined;
  const channelId = searchParams.get('channelId') || undefined;
  const postType = (searchParams.get('postType') || undefined) as CommunityPostType | undefined;
  const search = searchParams.get('search') || undefined;
  const solvedOnly = searchParams.get('solvedOnly') === 'true';
  const region = searchParams.get('region') || undefined;
  const tag = searchParams.get('tag') || undefined;
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || '20') || 20));

  const result = communityStore.getPosts({
    sort,
    categorySlug,
    channelId,
    postType,
    search,
    solvedOnly,
    region,
    tag,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Community posts retrieved successfully.',
      data: result,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCommunityPostRequest;

    if (!body || !body.title?.trim() || !body.content?.trim() || !body.channelId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Title, content, and category are required to publish a post.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const session = await getServerCastoSession();
    const authorName = session ? `Nurse_${session.castoLine.slice(0, 6)}` : 'Nurse_Learner';

    const newPost = communityStore.createPost(authorName, body);

    return NextResponse.json(
      {
        success: true,
        message: 'Discussion published successfully.',
        data: newPost,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to process community post request.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
