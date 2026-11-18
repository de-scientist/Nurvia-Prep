import type { GlobalSearchResultItemDto, GlobalSearchResponseDto } from '@/lib/api-types';
import { initialStudySets } from '@/lib/study-sets-data';
import { loadCarePlansCatalogue } from '@/lib/content/care-plans-service';
import { getPublishedLectureCatalogue } from '@/lib/lectures/nurvia-lectures-data';
import { loadStudyGuidesCatalogue } from '@/lib/content/study-guides-service';
import { communityStore } from '@/lib/community/community-store';
import { groupsStore } from '@/lib/groups/groups-store';
import { mentorsStore } from '@/lib/mentors/mentors-store';

export async function searchGlobalContent(
  query: string,
  typeFilter?: string
): Promise<GlobalSearchResponseDto> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      query: '',
      totalCount: 0,
      items: [],
      facets: [],
    };
  }

  const results: GlobalSearchResultItemDto[] = [];

  // 1. Search Study Sets & Exam Banks
  for (const set of initialStudySets) {
    if (
      set.title.toLowerCase().includes(q) ||
      set.description.toLowerCase().includes(q) ||
      set.category.toLowerCase().includes(q) ||
      set.pathway.toLowerCase().includes(q)
    ) {
      results.push({
        id: `set-${set.id}`,
        type: 'study_set',
        title: set.title,
        excerpt: set.description,
        category: `${set.pathway} · ${set.category}`,
        url: `/exam-session?examId=${encodeURIComponent(set.id)}`,
        badge: set.badge,
        tags: [set.pathway, set.category, 'Practice Set'],
      });
    }
  }

  // 2. Search Care Plans
  const { plans } = await loadCarePlansCatalogue();
  for (const plan of plans) {
    if (
      plan.title.toLowerCase().includes(q) ||
      plan.shortSummary.toLowerCase().includes(q) ||
      plan.bodySystem.toLowerCase().includes(q) ||
      plan.searchKeywords.some((k) => k.toLowerCase().includes(q))
    ) {
      results.push({
        id: `cp-${plan.id}`,
        type: 'care_plan',
        title: plan.title,
        excerpt: plan.shortSummary,
        category: `Care Plan · ${plan.bodySystem}`,
        url: `/care-plans/${plan.slug}`,
        badge: 'Clinical Care Plan',
        tags: [plan.bodySystem, ...plan.relatedConditions.slice(0, 2)],
      });
    }
  }

  // 3. Search Mark K. Lectures
  const lectures = getPublishedLectureCatalogue(true);
  for (const lec of lectures) {
    if (
      lec.title.toLowerCase().includes(q) ||
      lec.summary.toLowerCase().includes(q) ||
      lec.highYieldConcepts.some((c) => c.toLowerCase().includes(q))
    ) {
      results.push({
        id: `lec-${lec.id}`,
        type: 'lecture',
        title: `Lecture ${lec.number}: ${lec.title}`,
        excerpt: lec.summary,
        category: 'Mark K. Notes',
        url: `/mark-k/${lec.slug}`,
        badge: 'Lecture Notes',
        tags: lec.highYieldConcepts.slice(0, 3),
      });
    }
  }

  // 4. Search Study Guides
  const { guides } = await loadStudyGuidesCatalogue();
  for (const guide of guides) {
    if (
      guide.title.toLowerCase().includes(q) ||
      guide.summary.toLowerCase().includes(q) ||
      guide.subject.toLowerCase().includes(q) ||
      guide.keyConcepts.some((k) => k.toLowerCase().includes(q))
    ) {
      results.push({
        id: `guide-${guide.id}`,
        type: 'study_guide',
        title: guide.title,
        excerpt: guide.summary,
        category: `Study Guide · ${guide.subject}`,
        url: `/learner/guides`,
        badge: `${guide.readingMinutes} min read`,
        tags: guide.keyConcepts.slice(0, 2),
      });
    }
  }

  // 5. Search Community Threads
  const communityPosts = communityStore.getPosts({ search: q, pageSize: 50 });
  for (const post of communityPosts.items) {
    results.push({
      id: `comm-${post.id}`,
      type: 'community_post',
      title: post.title,
      excerpt: post.content.slice(0, 160) + '...',
      category: post.channelName,
      url: `/forum?postId=${post.id}`,
      badge: post.postType,
      tags: post.tags,
    });
  }

  // 6. Search Study Groups
  const groups = groupsStore.getGroups({ search: q });
  for (const group of groups) {
    results.push({
      id: `grp-${group.id}`,
      type: 'group',
      title: group.title,
      excerpt: group.description,
      category: `Study Group · ${group.examTrack}`,
      url: `/groups/${group.id}`,
      badge: `${group.currentMembers}/${group.maxMembers} members`,
      tags: [group.examTrack, group.meetingCadence],
    });
  }

  // 7. Search Mentors
  const mentors = mentorsStore.getMentors({ search: q });
  for (const mentor of mentors) {
    results.push({
      id: `mentor-${mentor.id}`,
      type: 'mentor',
      title: `${mentor.name} (${mentor.qualification})`,
      excerpt: mentor.bio,
      category: 'Nurse Mentor',
      url: `/mentors`,
      badge: `${mentor.rating} ★ (${mentor.reviewCount})`,
      tags: mentor.specialties.slice(0, 3),
    });
  }

  // Filter by requested type if specified
  const filtered = typeFilter && typeFilter !== 'all'
    ? results.filter((r) => r.type === typeFilter)
    : results;

  // Compute facet counts
  const facetMap = new Map<string, number>();
  for (const item of results) {
    facetMap.set(item.type, (facetMap.get(item.type) || 0) + 1);
  }

  const TYPE_LABELS: Record<string, string> = {
    study_set: 'Study Sets',
    care_plan: 'Care Plans',
    lecture: 'Mark K. Lectures',
    study_guide: 'Study Guides',
    community_post: 'Discussions',
    group: 'Study Groups',
    mentor: 'Mentors',
  };

  const facets = [
    { type: 'all', label: 'All Results', count: results.length },
    ...Array.from(facetMap.entries()).map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      count,
    })),
  ];

  return {
    query,
    totalCount: filtered.length,
    items: filtered,
    facets,
  };
}
