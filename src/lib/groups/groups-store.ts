import type { StudyGroupDto, CreateStudyGroupRequest } from '@/lib/api-types';

const INITIAL_GROUPS: StudyGroupDto[] = [
  {
    id: 'grp-nclex-rn-dec',
    title: 'NCLEX-RN December Intensive Study Cohort',
    description: 'Daily 50 NGN practice questions and weekly evening Zoom case study review sessions. Focus on prioritization, delegation, and safety.',
    examTrack: 'NCLEX-RN',
    subject: 'All Subjects · Comprehensive',
    topic: 'Prioritization & NGN Clinical Judgment',
    targetExamDate: '2026-12-15',
    meetingCadence: 'Tue & Thu 8:00 PM EST',
    timezone: 'America/New_York',
    maxMembers: 8,
    currentMembers: 5,
    isPrivate: false,
    createdByUserId: 'user-elena',
    creatorName: 'Elena V., RN Candidate',
    createdAtUtc: new Date(Date.now() - 10 * 86400000).toISOString(),
    objectives: [
      'Complete 50 daily questions on NURVIA Study Library',
      'Debrief 2 NGN unfolding case studies per weekly session',
      'Master the 6 CJMM cognitive steps for passing in 85 questions',
    ],
  },
  {
    id: 'grp-hesi-exit-sprint',
    title: 'HESI Exit 900+ Sprint Cohort',
    description: 'Targeted med-surg and pharmacology review for nursing students preparing for graduation HESI Exit benchmark examinations.',
    examTrack: 'HESI Exit',
    subject: 'Med-Surg & Pharm',
    targetExamDate: '2026-12-05',
    meetingCadence: 'Mon & Wed 7:00 PM CST',
    timezone: 'America/Chicago',
    maxMembers: 10,
    currentMembers: 7,
    isPrivate: false,
    createdByUserId: 'user-marcus',
    creatorName: 'Marcus T., Senior BSN',
    createdAtUtc: new Date(Date.now() - 8 * 86400000).toISOString(),
    objectives: [
      'Review high-yield conversion score strategies',
      'Master fluid, electrolyte, and ABG interpretation',
      'Complete HESI specialty review quizzes',
    ],
  },
  {
    id: 'grp-ati-comp-predictor',
    title: 'ATI Comprehensive Predictor 95% Probability Group',
    description: 'Working together through ATI focused reviews, VATI modules, and remediation templates to hit 95%+ probability of passing.',
    examTrack: 'ATI Predictor',
    subject: 'Comprehensive Nursing',
    targetExamDate: '2026-12-18',
    meetingCadence: 'Sundays 4:00 PM EST',
    timezone: 'America/New_York',
    maxMembers: 8,
    currentMembers: 4,
    isPrivate: false,
    createdByUserId: 'user-sarah',
    creatorName: 'Sarah K., BSN Student',
    createdAtUtc: new Date(Date.now() - 5 * 86400000).toISOString(),
    objectives: [
      'Analyze weak areas from practice assessments',
      'Exchange mnemonic cheat sheets',
      'Practice timed mock blocks under strict exam conditions',
    ],
  },
  {
    id: 'grp-nclex-pn-mastery',
    title: 'NCLEX-PN Practical Nurse Study Pod',
    description: 'Focused practice on PN scope of practice, stable vs unstable clients, wound care, and medication administration rules.',
    examTrack: 'NCLEX-PN',
    subject: 'PN Clinical Skills & Scenarios',
    targetExamDate: '2026-12-20',
    meetingCadence: 'Saturdays 10:00 AM PST',
    timezone: 'America/Los_Angeles',
    maxMembers: 6,
    currentMembers: 3,
    isPrivate: false,
    createdByUserId: 'user-maya',
    creatorName: 'Maya R., LPN Graduate',
    createdAtUtc: new Date(Date.now() - 7 * 86400000).toISOString(),
    objectives: [
      'Distinguish RN delegation vs LPN assignment boundaries',
      'Master adult pharmacology and vital sign cues',
    ],
  },
  {
    id: 'grp-teas-prep-circle',
    title: 'TEAS 7 Science & Math Ace Group',
    description: 'Pre-nursing students conquering TEAS A&P, biology, chemistry, and algebra sections to maximize program admission points.',
    examTrack: 'TEAS',
    subject: 'TEAS Science & Math',
    targetExamDate: '2026-12-30',
    meetingCadence: 'Fridays 6:00 PM EST',
    timezone: 'America/New_York',
    maxMembers: 12,
    currentMembers: 8,
    isPrivate: false,
    createdByUserId: 'user-alex',
    creatorName: 'Alex P., Pre-Nursing',
    createdAtUtc: new Date(Date.now() - 4 * 86400000).toISOString(),
    objectives: [
      'Review human body systems and endocrine pathways',
      'Solve metric system and fractional dosage calculations',
    ],
  },
];

class GroupsStore {
  private groups: StudyGroupDto[] = [...INITIAL_GROUPS];
  private memberships = new Map<string, Set<string>>(); // userId -> Set of groupIds

  getGroups(options?: {
    examTrack?: string;
    search?: string;
    userId?: string;
  }): StudyGroupDto[] {
    const { examTrack, search, userId } = options || {};
    let filtered = [...this.groups];

    if (examTrack && examTrack !== 'All') {
      filtered = filtered.filter((g) => g.examTrack.toLowerCase() === examTrack.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.examTrack.toLowerCase().includes(q) ||
          g.subject?.toLowerCase().includes(q)
      );
    }

    const userGroupSet = userId ? this.memberships.get(userId) || new Set<string>() : new Set<string>();

    return filtered.map((g) => ({
      ...g,
      isMember: userGroupSet.has(g.id),
      isOwner: userId === g.createdByUserId,
    }));
  }

  getGroupById(id: string, userId?: string): StudyGroupDto | undefined {
    const group = this.groups.find((g) => g.id === id);
    if (!group) return undefined;

    const userGroupSet = userId ? this.memberships.get(userId) || new Set<string>() : new Set<string>();
    return {
      ...group,
      isMember: userGroupSet.has(group.id),
      isOwner: userId === group.createdByUserId,
    };
  }

  createGroup(userId: string, creatorName: string, req: CreateStudyGroupRequest): StudyGroupDto {
    const newGroup: StudyGroupDto = {
      id: `grp-${Date.now()}`,
      title: req.title.trim(),
      description: req.description.trim(),
      examTrack: req.examTrack,
      subject: req.subject,
      targetExamDate: req.targetExamDate || '2026-12-31',
      meetingCadence: req.meetingCadence,
      timezone: req.timezone,
      maxMembers: req.maxMembers || 8,
      currentMembers: 1,
      isPrivate: Boolean(req.isPrivate),
      createdByUserId: userId,
      creatorName,
      createdAtUtc: new Date().toISOString(),
      isMember: true,
      isOwner: true,
      objectives: req.objectives || ['Collaborative practice questions', 'Weekly clinical review'],
    };

    this.groups.unshift(newGroup);

    let userSet = this.memberships.get(userId);
    if (!userSet) {
      userSet = new Set<string>();
      this.memberships.set(userId, userSet);
    }
    userSet.add(newGroup.id);

    return newGroup;
  }

  joinGroup(userId: string, groupId: string): { success: boolean; message: string; group?: StudyGroupDto } {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      return { success: false, message: 'Study group not found.' };
    }

    let userSet = this.memberships.get(userId);
    if (!userSet) {
      userSet = new Set<string>();
      this.memberships.set(userId, userSet);
    }

    if (userSet.has(groupId)) {
      return { success: true, message: 'You are already a member of this study group.', group: { ...group, isMember: true } };
    }

    if (group.currentMembers >= group.maxMembers) {
      return { success: false, message: 'This study group has reached its maximum member capacity.' };
    }

    userSet.add(groupId);
    group.currentMembers += 1;

    return {
      success: true,
      message: 'Successfully joined study group!',
      group: { ...group, isMember: true },
    };
  }

  leaveGroup(userId: string, groupId: string): { success: boolean; message: string; group?: StudyGroupDto } {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      return { success: false, message: 'Study group not found.' };
    }

    const userSet = this.memberships.get(userId);
    if (!userSet || !userSet.has(groupId)) {
      return { success: false, message: 'You are not a member of this group.' };
    }

    userSet.delete(groupId);
    group.currentMembers = Math.max(0, group.currentMembers - 1);

    return {
      success: true,
      message: 'Successfully left study group.',
      group: { ...group, isMember: false },
    };
  }
}

export const groupsStore = new GroupsStore();
