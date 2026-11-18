import type {
  CommunityCategoryGroupDto,
  CommunityCategoryDto,
  CommunityPostDetailDto,
  CommunityReplyDto,
  CreateCommunityPostRequest,
  CommunityPostType,
  CommunityPostStatus,
} from '@/lib/api-types';

export const COMMUNITY_CATEGORY_GROUPS: CommunityCategoryGroupDto[] = [
  {
    id: 'grp-pre-nursing',
    slug: 'pre-nursing-admissions',
    name: 'Pre-Nursing & Admissions',
    description: 'Entrance examinations, science prerequisites, points calculations, and program selection.',
    sortOrder: 1,
    categories: [
      { id: 'cat-teas', groupId: 'grp-pre-nursing', slug: 'teas', name: 'TEAS', description: 'ATI TEAS 7 preparation, scoring benchmarks, science reviews, and retakes.', postCount: 24, examTrack: 'TEAS', visibility: 'Public' },
      { id: 'cat-hesi-a2', groupId: 'grp-pre-nursing', slug: 'hesi-a2', name: 'HESI A2', description: 'HESI Admission Assessment section breakdowns, vocabulary, A&P, and math study tips.', postCount: 18, examTrack: 'HESI', visibility: 'Public' },
      { id: 'cat-kaplan-entrance', groupId: 'grp-pre-nursing', slug: 'kaplan-entrance', name: 'Kaplan Entrance Test', description: 'Kaplan Nursing School Admission Test tips and experiences.', postCount: 9, visibility: 'Public' },
      { id: 'cat-prereqs', groupId: 'grp-pre-nursing', slug: 'prerequisites', name: 'Prerequisites (A&P, Micro, Chem)', description: 'Mastering anatomy, physiology, microbiology, and chemistry prereqs.', postCount: 31, visibility: 'Public' },
      { id: 'cat-choosing-program', groupId: 'grp-pre-nursing', slug: 'choosing-a-program', name: 'Choosing a Program', description: 'Comparing ADN vs. BSN vs. ABSN vs. Entry MSN pathways and accreditations.', postCount: 22, visibility: 'Public' },
      { id: 'cat-admissions-waitlist', groupId: 'grp-pre-nursing', slug: 'admissions-waitlists', name: 'Admission Points & Waitlists', description: 'GPA weighting, admission points formulas, and waitlist timelines.', postCount: 15, visibility: 'Public' },
      { id: 'cat-acceptance', groupId: 'grp-pre-nursing', slug: 'did-you-get-in', name: 'Did You Get In?', description: 'Acceptance celebrations and cohort announcement threads.', postCount: 29, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-nursing-school',
    slug: 'nursing-school-survival',
    name: 'Nursing School Survival',
    description: 'Semester-by-semester course revision, pharmacology mnemonics, clinical rotations, and skills.',
    sortOrder: 2,
    categories: [
      { id: 'cat-fundamentals', groupId: 'grp-nursing-school', slug: 'fundamentals', name: 'Fundamentals', description: 'Foundations of nursing practice, vital signs, mobility, and hygiene.', postCount: 42, visibility: 'Public' },
      { id: 'cat-med-surg', groupId: 'grp-nursing-school', slug: 'med-surg', name: 'Med-Surg Nursing', description: 'Adult acute health, fluid/electrolytes, pathophysiology, and system exams.', postCount: 68, visibility: 'Public' },
      { id: 'cat-pharm', groupId: 'grp-nursing-school', slug: 'pharmacology', name: 'Pharmacology', description: 'High-alert medications, drug suffixes, antidotes, and side effects.', postCount: 54, visibility: 'Public' },
      { id: 'cat-ob', groupId: 'grp-nursing-school', slug: 'maternity-ob', name: 'Maternity & Newborn (OB)', description: 'Antepartum, labor stages, postpartum hemorrhage, and fetal monitoring.', postCount: 27, visibility: 'Public' },
      { id: 'cat-peds', groupId: 'grp-nursing-school', slug: 'pediatrics', name: 'Pediatrics', description: 'Developmental milestones, pediatric dosages, congenital defects, and child safety.', postCount: 21, visibility: 'Public' },
      { id: 'cat-mental-health', groupId: 'grp-nursing-school', slug: 'mental-health', name: 'Mental Health Nursing', description: 'Psychiatric disorders, therapeutic communication, and crisis interventions.', postCount: 19, visibility: 'Public' },
      { id: 'cat-community-health', groupId: 'grp-nursing-school', slug: 'community-health', name: 'Community & Public Health', description: 'Epidemiology, disaster triage, vulnerable populations, and level of prevention.', postCount: 14, visibility: 'Public' },
      { id: 'cat-dosage-calc', groupId: 'grp-nursing-school', slug: 'dosage-calculations', name: 'Dosage Calculations', description: 'Dimensional analysis, IV drip rates, mcg/kg/min infusions, and reconstitution.', postCount: 36, visibility: 'Public' },
      { id: 'cat-care-plans', groupId: 'grp-nursing-school', slug: 'care-plans-concept-maps', name: 'Care Plans & Concept Maps', description: 'NANDA-I nursing diagnoses, SMART goals, rationale writing, and concept maps.', postCount: 28, visibility: 'Public' },
      { id: 'cat-clinicals', groupId: 'grp-nursing-school', slug: 'clinicals-preceptors', name: 'Clinicals & Preceptors', description: 'Hospital orientation, preceptor relationships, and morning report handoffs.', postCount: 33, visibility: 'Public' },
      { id: 'cat-skills-checkoffs', groupId: 'grp-nursing-school', slug: 'skills-checkoffs', name: 'Skills Check-offs', description: 'Foley catheters, sterile dressing changes, NG tubes, and medication pass.', postCount: 17, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-exit-predictor',
    slug: 'exit-predictor-exams',
    name: 'Exit & Predictor Examinations',
    description: 'HESI Exit, ATI Comprehensive Predictor, remediation blueprints, and graduation benchmarks.',
    sortOrder: 3,
    categories: [
      { id: 'cat-hesi-exit', groupId: 'grp-exit-predictor', slug: 'hesi-exit', name: 'HESI Exit (RN/PN)', description: 'Scoring conversions, 850/900 benchmarks, and specialty practice questions.', postCount: 45, examTrack: 'HESI', visibility: 'Public' },
      { id: 'cat-ati-comp-predictor', groupId: 'grp-exit-predictor', slug: 'ati-comprehensive-predictor', name: 'ATI Comprehensive Predictor', description: 'Predictor cut-scores, 90%+ passing probability strategies, and VATI green light.', postCount: 51, examTrack: 'ATI', visibility: 'Public' },
      { id: 'cat-specialty-exams', groupId: 'grp-exit-predictor', slug: 'specialty-exams', name: 'HESI/ATI Specialty Exams', description: 'Proctored pharmacology, med-surg, leadership, and maternal exams.', postCount: 38, visibility: 'Public' },
      { id: 'cat-remediation', groupId: 'grp-exit-predictor', slug: 'remediation-plans', name: 'Remediation Plans', description: 'Focused review plans after low benchmark scores and targeted study loops.', postCount: 22, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-nclex-rn',
    slug: 'nclex-rn',
    name: 'NCLEX-RN Preparation',
    description: 'NGN clinical judgment cases, CAT test-taking strategies, Pearson VUE experiences, and pass stories.',
    sortOrder: 4,
    categories: [
      { id: 'cat-rn-study-plans', groupId: 'grp-nclex-rn', slug: 'nclex-study-plans', name: 'NCLEX Study Plans', description: '4-week, 8-week, and 12-week schedules, question pacing, and review hours.', postCount: 63, examTrack: 'RN', visibility: 'Public' },
      { id: 'cat-rn-ngn', groupId: 'grp-nclex-rn', slug: 'next-gen-ngn', name: 'Next Gen (NGN) Strategies', description: 'Mastering the 6 cognitive skills, unfolding case studies, and matrix questions.', postCount: 74, examTrack: 'RN', visibility: 'Public' },
      { id: 'cat-rn-test-day', groupId: 'grp-nclex-rn', slug: 'test-day-experience', name: 'Test-Day Experience', description: 'Check-in procedures, palm vein scan, pacing, and managing test fatigue.', postCount: 41, examTrack: 'RN', visibility: 'Public' },
      { id: 'cat-rn-passed', groupId: 'grp-nclex-rn', slug: 'i-passed', name: 'Passed! (Success Stories)', description: 'Celebrating passed candidates, question counts, and key takeaways.', postCount: 88, examTrack: 'RN', visibility: 'Public' },
      { id: 'cat-rn-retake', groupId: 'grp-nclex-rn', slug: 'retake-support', name: 'Retake Support & Guidance', description: 'Analyzing Candidate Performance Reports (CPR) and rebuilding confidence.', postCount: 29, examTrack: 'RN', visibility: 'Public' },
    ],
  },
  {
    id: 'grp-nclex-pn',
    slug: 'nclex-pn-lpn-lvn',
    name: 'NCLEX-PN / LPN-LVN Corner',
    description: 'Practical nurse licensure study resources, scope of practice, and LPN-to-RN bridge pathways.',
    sortOrder: 5,
    categories: [
      { id: 'cat-pn-study', groupId: 'grp-nclex-pn', slug: 'pn-study-resources', name: 'PN Study Resources', description: 'Dedicated NCLEX-PN question banks, delegation boundaries, and practical review.', postCount: 35, examTrack: 'PN_LPN', visibility: 'Public' },
      { id: 'cat-pn-results', groupId: 'grp-nclex-pn', slug: 'pn-results', name: 'PN Exam Results', description: 'Self-reported PN outcomes, test center experiences, and license verifications.', postCount: 26, examTrack: 'PN_LPN', visibility: 'Public' },
      { id: 'cat-lpn-scope', groupId: 'grp-nclex-pn', slug: 'lpn-lvn-life', name: 'LPN/LVN Life & Practice Scope', description: 'Delegation regulations, long-term care, clinic nursing, and clinical autonomy.', postCount: 19, examTrack: 'PN_LPN', visibility: 'Public' },
      { id: 'cat-lpn-to-rn', groupId: 'grp-nclex-pn', slug: 'lpn-to-rn-bridge', name: 'LPN to RN Bridge Programs', description: 'Transition courses, bridge prerequisites, and accelerated pathways.', postCount: 24, examTrack: 'PN_LPN', visibility: 'Public' },
    ],
  },
  {
    id: 'grp-international',
    slug: 'international-nurses',
    name: 'International Nursing & Licensure',
    description: 'CGFNS verification, VisaScreen, state board endorsements, English exams, and global migration.',
    sortOrder: 6,
    categories: [
      { id: 'cat-cgfns', groupId: 'grp-international', slug: 'cgfns-trumerit', name: 'CGFNS / TruMerit', description: 'CES reports, credential verifications, and primary-source document tracking.', postCount: 46, visibility: 'Public' },
      { id: 'cat-visascreen', groupId: 'grp-international', slug: 'visascreen', name: 'VisaScreen & Immigration', description: 'EB-3 nursing visas, prevailing wage, consular processing, and retrogression.', postCount: 32, visibility: 'Public' },
      { id: 'cat-ielts-oet', groupId: 'grp-international', slug: 'ielts-oet-toefl', name: 'IELTS / OET / TOEFL', description: 'English language requirements, test tips, and passing band scores.', postCount: 28, visibility: 'Public' },
      { id: 'cat-uk-nmc', groupId: 'grp-international', slug: 'uk-nmc-cbt-osce', name: 'UK NMC CBT & OSCE', description: 'Test of Competence, computer-based testing, and OSCE clinical stations.', postCount: 34, visibility: 'Public' },
      { id: 'cat-australia-nz', groupId: 'grp-international', slug: 'australia-new-zealand', name: 'Australia & New Zealand', description: 'AHPRA OBA, NCLEX-RN recognition, and nursing in ANZ.', postCount: 18, visibility: 'Public' },
      { id: 'cat-middle-east', groupId: 'grp-international', slug: 'middle-east-licensing', name: 'Middle East Licensing', description: 'DHA, DOH/HAAD, MOHAP, and Prometric examinations.', postCount: 16, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-new-grads',
    slug: 'new-grads-first-year',
    name: 'New Graduates & First Year',
    description: 'Residency programs, preceptorship transitions, night shift survival, and overcoming imposter syndrome.',
    sortOrder: 7,
    categories: [
      { id: 'cat-residency', groupId: 'grp-new-grads', slug: 'residency-programs', name: 'Residency Programs', description: 'Cohort applications, evidence-based practice projects, and interviews.', postCount: 39, visibility: 'Public' },
      { id: 'cat-orientation', groupId: 'grp-new-grads', slug: 'orientation-onboarding', name: 'Orientation & Onboarding', description: 'Maximizing preceptor feedback, taking full patient loads, and time management.', postCount: 27, visibility: 'Public' },
      { id: 'cat-night-shift', groupId: 'grp-new-grads', slug: 'night-shift', name: 'Night Shift Survival', description: 'Circadian rhythm hacks, black-out curtains, and nocturnal self-care.', postCount: 31, visibility: 'Public' },
      { id: 'cat-imposter-syndrome', groupId: 'grp-new-grads', slug: 'imposter-syndrome', name: 'Imposter Syndrome', description: 'Navigating transition anxiety, peer reassurance, and recognizing your competence.', postCount: 44, visibility: 'Public' },
      { id: 'cat-mistakes-learning', groupId: 'grp-new-grads', slug: 'mistakes-learning', name: 'Learning From Mistakes', description: 'Near-miss debriefs, safe reporting culture, and psychological safety.', postCount: 23, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-careers',
    slug: 'careers-jobs',
    name: 'Careers & Professional Growth',
    description: 'Nursing resumes, hospital interview coaching, clinical certifications, and advanced practice degrees.',
    sortOrder: 8,
    categories: [
      { id: 'cat-resumes', groupId: 'grp-careers', slug: 'resumes', name: 'Resumes & Cover Letters', description: 'Formatting clinical rotations, ATS optimization, and portfolio builders.', postCount: 37, visibility: 'Public' },
      { id: 'cat-interviews', groupId: 'grp-careers', slug: 'interviews', name: 'Interviews & Peer Panels', description: 'STAR behavioral answers, difficult clinical scenarios, and questions for unit managers.', postCount: 32, visibility: 'Public' },
      { id: 'cat-specialties', groupId: 'grp-careers', slug: 'specialties', name: 'Specialty Selection', description: 'ICU vs. ED vs. OR vs. PACU vs. Labor & Delivery vs. Flight vs. Infusion.', postCount: 45, visibility: 'Public' },
      { id: 'cat-advancing', groupId: 'grp-careers', slug: 'advancing-rn-bsn-msn-np-crna', name: 'Advancing (RN-BSN, MSN, NP, CRNA)', description: 'Graduate school prerequisites, shadow hours, and direct MSN pathways.', postCount: 38, visibility: 'Public' },
      { id: 'cat-certifications', groupId: 'grp-careers', slug: 'certifications', name: 'Certifications (CCRN, CEN, PCCN)', description: 'Specialty exam review materials and continuing education hours.', postCount: 21, visibility: 'Public' },
    ],
  },
  {
    id: 'grp-wellness',
    slug: 'wellness-break-room',
    name: 'Wellness & Break Room',
    description: 'Burnout mitigation, test anxiety coping tools, peer support, nurse humor, and off-duty celebrations.',
    sortOrder: 9,
    categories: [
      { id: 'cat-burnout', groupId: 'grp-wellness', slug: 'burnout', name: 'Burnout & Exhaustion', description: 'Compassion fatigue, healthy clinical boundaries, and rejuvenating outside hospital.', postCount: 48, visibility: 'Public' },
      { id: 'cat-anxiety', groupId: 'grp-wellness', slug: 'test-anxiety', name: 'Test Anxiety', description: 'Breathing protocols, beta-blocker questions, and panic reduction in exam rooms.', postCount: 52, visibility: 'Public' },
      { id: 'cat-humor', groupId: 'grp-wellness', slug: 'humor', name: 'Nurse Humor & Memes', description: 'Relatable hospital moments, charting absurdities, and lighthearted laughs.', postCount: 65, visibility: 'Public' },
      { id: 'cat-wins', groupId: 'grp-wellness', slug: 'wins-celebrations', name: 'Wins & Celebrations', description: 'First IV stick, passed exams, good clinical feedback, and graduation milestones.', postCount: 71, visibility: 'Public' },
    ],
  },
];

// Initial seeded posts
const initialPosts: CommunityPostDetailDto[] = [
  {
    id: 'post-1',
    channelId: 'nclex-study-plans',
    channelName: 'NCLEX Study Plans',
    authorName: 'NurseElena_RN',
    cohortLabel: 'NCLEX-RN · Dec 2026 Cohort',
    title: '8-Week NCLEX-RN study plan for internationally educated nurses working full time',
    content: `Graduated in Manila, working 36 hrs/week as a clinic aide while preparing for NCLEX-RN. Sharing the 8-week schedule that got me through:

- **Weekdays (2 hrs/night):** 50 NGN practice questions on NURVIA Study Library + thorough rationale breakdown.
- **Saturdays (4 hrs):** Pharmacology deep-dive using Mark K Lecture 2 notes & high-alert medication cards.
- **Sundays (3 hrs):** One full-length CAT exam simulation.

Remember: quality of rationale review matters far more than question volume! Would love feedback from other IEN test takers.`,
    replyCount: 8,
    likeCount: 42,
    voteScore: 42,
    views: 1420,
    likedByCaller: false,
    isOwnedByCaller: false,
    createdAtUtc: new Date(Date.now() - 3 * 86400000).toISOString(),
    postType: 'Discussion',
    status: 'Open',
    tags: ['IEN', 'study-plan', 'nclex-rn', 'pharmacology'],
    region: 'United States',
    replies: [
      {
        id: 'rep-1',
        postId: 'post-1',
        authorName: 'SarahM_BSN',
        content: 'This schedule is golden! The Sunday CAT simulation really builds cognitive endurance for 150 questions.',
        isOwnedByCaller: false,
        createdAtUtc: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'rep-2',
        postId: 'post-1',
        authorName: 'Marcus_RN',
        content: 'Agreed. Tracking CPR weaknesses early in Week 3 made a massive difference for me.',
        isOwnedByCaller: false,
        createdAtUtc: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
  },
  {
    id: 'post-2',
    channelId: 'dosage-calculations',
    channelName: 'Dosage Calculations',
    authorName: 'ClinicalInstructor_Dave',
    cohortLabel: 'Faculty & Preceptor',
    title: 'Dimensional analysis for IV drip rates – my 3-step foolproof method',
    content: `A lot of nursing students struggle with mL/hr vs gtt/min conversions. Here is the single line setup:

1. **Start with what you want on top left:** e.g., \`[gtt / min]\`.
2. **Bring in the drop factor first:** e.g., \`[15 gtt / 1 mL]\`.
3. **Multiply by volume over time in minutes:** e.g., \`[1000 mL / 480 min]\`.

Cross off units: mL cancels with mL, leaving \`gtt / min\`. Zero memorized conversion formulas needed!`,
    replyCount: 14,
    likeCount: 78,
    voteScore: 78,
    views: 2950,
    likedByCaller: false,
    isOwnedByCaller: false,
    createdAtUtc: new Date(Date.now() - 6 * 86400000).toISOString(),
    postType: 'Discussion',
    status: 'Solved',
    tags: ['dosage-calc', 'IV', 'dimensional-analysis', 'med-surg'],
    region: 'United States',
  },
  {
    id: 'post-3',
    channelId: 'i-passed',
    channelName: 'Passed! (Success Stories)',
    authorName: 'Jasmine_NewRN',
    cohortLabel: 'NCLEX-RN Passed',
    title: 'NCLEX-RN Passed in 85 questions! Here is what actually showed up on my test',
    content: `Took the exam yesterday at 8:00 AM, shut off right at 85 questions! Got the unofficial quick results today and official license on the board registry!

- **NGN Case Studies:** 3 unfolding case studies (one sepsis, one pediatric dehydration, one preeclampsia).
- **Standalone NGN:** Multiple Bowtie questions and matrix multi-response.
- **Topics:** Prioritization was 40% of the entire exam. Knowing ABCs + acute vs. chronic saved me.
- **Study Resources Used:** NURVIA Study Library (completed 1,800 questions), Mark K Lecture Notes 1 & 12.`,
    replyCount: 22,
    likeCount: 115,
    voteScore: 115,
    views: 4800,
    likedByCaller: false,
    isOwnedByCaller: false,
    createdAtUtc: new Date(Date.now() - 4 * 86400000).toISOString(),
    postType: 'ExamResult',
    status: 'Open',
    tags: ['nclex-rn', 'passed', 'NGN', 'prioritization'],
    examResultMeta: {
      examType: 'NCLEX-RN',
      outcome: 'Pass',
      examDate: '2026-11-14',
      questionCount: 85,
      weeksStudied: 8,
      prepResourcesUsed: ['NURVIA Study Library', 'Mark Klimek Notes'],
    },
  },
  {
    id: 'post-4',
    channelId: 'next-gen-ngn',
    channelName: 'Next Gen (NGN) Strategies',
    authorName: 'Kwame_NursingStudent',
    cohortLabel: 'Senior BSN Cohort',
    title: 'How do you approach NGN Matrix grid questions when two answers sound equally plausible?',
    content: `On matrix multiple response questions with 3-4 columns (e.g. Indicated vs. Contraindicated vs. Non-Essential), what is your rule of thumb for ruling out medications that could be benign but aren't strictly ordered? Do you lose points if you leave it or mark non-essential?`,
    replyCount: 6,
    likeCount: 19,
    voteScore: 19,
    views: 890,
    likedByCaller: false,
    isOwnedByCaller: false,
    createdAtUtc: new Date(Date.now() - 1 * 86400000).toISOString(),
    postType: 'Question',
    status: 'Open',
    tags: ['NGN', 'clinical-judgment', 'matrix', 'SATA'],
  },
  {
    id: 'post-5',
    channelId: 'burnout',
    channelName: 'Burnout & Exhaustion',
    authorName: 'Maya_LPN',
    cohortLabel: 'LPN / Bridge Student',
    title: 'Managing clinical shift fatigue while working 12s on night shift',
    content: `Any tips from night shifters on balancing 3x12s at the hospital with morning coursework? How do you schedule sleep on transition days without feeling completely disoriented?`,
    replyCount: 11,
    likeCount: 34,
    voteScore: 34,
    views: 1100,
    likedByCaller: false,
    isOwnedByCaller: false,
    createdAtUtc: new Date(Date.now() - 5 * 86400000).toISOString(),
    postType: 'Discussion',
    status: 'Open',
    tags: ['night-shift', 'burnout', 'wellness'],
  },
];

class CommunityStore {
  private posts: CommunityPostDetailDto[] = [...initialPosts];
  private reportedPostIds = new Set<string>();

  getCategoryGroups(): CommunityCategoryGroupDto[] {
    return COMMUNITY_CATEGORY_GROUPS;
  }

  getAllCategories(): CommunityCategoryDto[] {
    return COMMUNITY_CATEGORY_GROUPS.flatMap((g) => g.categories);
  }

  getCategoryBySlug(slug: string): CommunityCategoryDto | undefined {
    return this.getAllCategories().find((c) => c.slug === slug);
  }

  getPosts(options?: {
    sort?: 'newest' | 'hot' | 'top' | 'comments' | 'unanswered';
    categorySlug?: string;
    channelId?: string;
    postType?: CommunityPostType;
    search?: string;
    solvedOnly?: boolean;
    region?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }): { items: CommunityPostDetailDto[]; totalCount: number; page: number; totalPages: number } {
    const {
      sort = 'newest',
      categorySlug,
      channelId,
      postType,
      search,
      solvedOnly,
      region,
      tag,
      page = 1,
      pageSize = 20,
    } = options || {};

    let filtered = [...this.posts];

    if (categorySlug) {
      filtered = filtered.filter((p) => p.channelId === categorySlug);
    } else if (channelId && channelId !== 'all') {
      filtered = filtered.filter((p) => p.channelId === channelId);
    }

    if (postType) {
      filtered = filtered.filter((p) => p.postType === postType);
    }

    if (solvedOnly) {
      filtered = filtered.filter((p) => p.status === 'Solved');
    }

    if (region && region !== 'All regions') {
      filtered = filtered.filter((p) => p.region?.toLowerCase() === region.toLowerCase());
    }

    if (tag) {
      const cleanTag = tag.replace(/^#/, '').toLowerCase();
      filtered = filtered.filter((p) => p.tags.some((t) => t.toLowerCase() === cleanTag));
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.channelName.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sort === 'hot') {
      filtered.sort((a, b) => b.likeCount * 2 + b.replyCount * 3 - (a.likeCount * 2 + a.replyCount * 3));
    } else if (sort === 'top') {
      filtered.sort((a, b) => b.voteScore - a.voteScore);
    } else if (sort === 'comments') {
      filtered.sort((a, b) => b.replyCount - a.replyCount);
    } else if (sort === 'unanswered') {
      filtered = filtered.filter((p) => p.replyCount === 0);
      filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
    } else {
      // newest
      filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
    }

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, totalCount, page, totalPages };
  }

  getPostById(id: string): CommunityPostDetailDto | undefined {
    const post = this.posts.find((p) => p.id === id);
    if (post) {
      post.views += 1;
    }
    return post;
  }

  createPost(authorName: string, req: CreateCommunityPostRequest): CommunityPostDetailDto {
    const category = this.getCategoryBySlug(req.channelId);
    const newPost: CommunityPostDetailDto = {
      id: `post-${Date.now()}`,
      channelId: req.channelId,
      channelName: category?.name || req.channelId,
      authorName,
      cohortLabel: req.cohortLabel || 'NURVIA Learner',
      title: req.title.trim(),
      content: req.content.trim(),
      replyCount: 0,
      likeCount: 0,
      voteScore: 1,
      views: 1,
      likedByCaller: false,
      isOwnedByCaller: true,
      createdAtUtc: new Date().toISOString(),
      postType: req.postType || 'Discussion',
      status: 'Open',
      tags: req.tags || [],
      region: req.region,
      examResultMeta: req.examResultMeta,
      pollMeta: req.pollMeta
        ? {
            question: req.pollMeta.question,
            options: req.pollMeta.options.map((opt, i) => ({ id: `opt-${i}`, text: opt, votes: 0 })),
            totalVotes: 0,
          }
        : undefined,
      replies: [],
    };

    this.posts.unshift(newPost);
    return newPost;
  }

  addReply(postId: string, authorName: string, content: string): CommunityReplyDto | null {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return null;

    const newReply: CommunityReplyDto = {
      id: `rep-${Date.now()}`,
      postId,
      authorName,
      content: content.trim(),
      isOwnedByCaller: true,
      createdAtUtc: new Date().toISOString(),
    };

    if (!post.replies) post.replies = [];
    post.replies.push(newReply);
    post.replyCount = post.replies.length;
    return newReply;
  }

  toggleVote(postId: string, direction: 'up' | 'down'): { voteScore: number; userVote: 'up' | 'down' | null } | null {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return null;

    if (post.userVote === direction) {
      // cancel vote
      post.voteScore += direction === 'up' ? -1 : 1;
      post.userVote = null;
    } else {
      if (post.userVote === 'up') post.voteScore -= 1;
      if (post.userVote === 'down') post.voteScore += 1;
      post.voteScore += direction === 'up' ? 1 : -1;
      post.userVote = direction;
    }
    return { voteScore: post.voteScore, userVote: post.userVote };
  }

  reportPost(postId: string, reason: string): boolean {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return false;
    this.reportedPostIds.add(postId);
    return true;
  }
}

export const communityStore = new CommunityStore();
