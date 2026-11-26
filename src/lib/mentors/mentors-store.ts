import type { MentorProfileDto, MentorSessionRequestDto } from '@/lib/api-types';

const INITIAL_MENTORS: MentorProfileDto[] = [
  {
    id: 'mentor-1',
    name: 'Dr. Rebecca Chen, DNP, APRN, FNP-BC',
    qualification: 'DNP, APRN, FNP-BC',
    specialties: ['Med-Surg', 'NP school', 'Nurse education'],
    experienceYears: 12,
    examTracks: ['NCLEX-RN', 'ATI Predictor'],
    bio: 'Former clinical nurse educator and family nurse practitioner. Passionate about helping nursing students master clinical reasoning and pathophysiology without rote memorization.',
    avatarUrl: '/assets/media/avatars/avatar-1.jpg',
    isVerified: true,
    availabilityStatus: 'Available',
    sessionFormats: ['1-on-1 Q&A', 'Study Plan Review', 'Clinical Transition Guidance'],
    languages: ['English', 'Mandarin'],
    rating: 4.95,
    reviewCount: 38,
  },
  {
    id: 'mentor-2',
    name: 'Marcus Adebayo, MSN, RN, CCRN',
    qualification: 'MSN, RN, CCRN',
    specialties: ['ICU', 'Med-Surg', 'NCLEX prep'],
    experienceYears: 8,
    examTracks: ['NCLEX-RN', 'HESI Exit'],
    bio: 'Medical-Surgical and Cardiovascular ICU preceptor. Successfully mentored over 50 international and domestic nursing graduates to first-attempt licensure success.',
    avatarUrl: '/assets/media/avatars/avatar-2.jpg',
    isVerified: true,
    availabilityStatus: 'Available',
    sessionFormats: ['1-on-1 Q&A', 'Study Plan Review'],
    languages: ['English', 'Yoruba'],
    rating: 4.92,
    reviewCount: 29,
  },
  {
    id: 'mentor-3',
    name: 'Sarah Lindqvist, BSN, RN, CEN',
    qualification: 'BSN, RN, CEN',
    specialties: ['ER', 'New grad transition', 'Travel nursing'],
    experienceYears: 6,
    examTracks: ['NCLEX-RN'],
    bio: 'Emergency department charge nurse and travel nurse veteran. Specialize in rapid triage prioritization, test anxiety management, and surviving your residency year.',
    avatarUrl: '/assets/media/avatars/avatar-3.jpg',
    isVerified: true,
    availabilityStatus: 'Limited',
    sessionFormats: ['1-on-1 Q&A', 'Clinical Transition Guidance'],
    languages: ['English', 'Spanish'],
    rating: 4.88,
    reviewCount: 22,
  },
  {
    id: 'mentor-4',
    name: 'Amara Okafor, BSN, RN, RNC-OB',
    qualification: 'BSN, RN, RNC-OB',
    specialties: ['L&D', 'Peds', 'IEN / licensure abroad'],
    experienceYears: 9,
    examTracks: ['NCLEX-RN', 'NCLEX-PN'],
    bio: 'Labor & Delivery nurse and internationally educated nurse mentor. Transitioned from Lagos to the US healthcare system; here to help IENs navigate CGFNS and board registration.',
    avatarUrl: '/assets/media/avatars/avatar-4.jpg',
    isVerified: true,
    availabilityStatus: 'Available',
    sessionFormats: ['Study Plan Review', 'Clinical Transition Guidance'],
    languages: ['English', 'Igbo'],
    rating: 5.0,
    reviewCount: 45,
  },
  {
    id: 'mentor-5',
    name: 'David Kowalski, PMHNP-BC, RN',
    qualification: 'MSN, PMHNP-BC',
    specialties: ['Psych', 'Mental Health', 'NCLEX prep'],
    experienceYears: 7,
    examTracks: ['NCLEX-RN', 'NCLEX-PN'],
    bio: 'Psychiatric mental health nurse practitioner. Clinical focus on therapeutic communication questions, psychopharmacology mnemonics, and test day calm.',
    avatarUrl: '/assets/media/avatars/avatar-5.jpg',
    isVerified: true,
    availabilityStatus: 'Available',
    sessionFormats: ['1-on-1 Q&A', 'Study Plan Review'],
    languages: ['English'],
    rating: 4.91,
    reviewCount: 19,
  },
];

class MentorsStore {
  private mentors: MentorProfileDto[] = [...INITIAL_MENTORS];
  private sessionRequests: (MentorSessionRequestDto & { id: string; status: 'Pending' | 'Accepted' | 'Declined'; createdAtUtc: string })[] = [];

  getMentors(options?: {
    specialty?: string;
    search?: string;
    examTrack?: string;
  }): MentorProfileDto[] {
    const { specialty, search, examTrack } = options || {};
    let filtered = [...this.mentors];

    if (specialty && specialty !== 'All') {
      filtered = filtered.filter((m) =>
        m.specialties.some((s) => s.toLowerCase() === specialty.toLowerCase())
      );
    }

    if (examTrack && examTrack !== 'All') {
      filtered = filtered.filter((m) =>
        m.examTracks.some((t) => t.toLowerCase() === examTrack.toLowerCase())
      );
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.qualification.toLowerCase().includes(q) ||
          m.bio.toLowerCase().includes(q) ||
          m.specialties.some((s) => s.toLowerCase().includes(q))
      );
    }

    return filtered;
  }

  getMentorById(id: string): MentorProfileDto | undefined {
    return this.mentors.find((m) => m.id === id);
  }

  requestSession(userId: string, req: MentorSessionRequestDto): { success: boolean; message: string; requestId: string } {
    const mentor = this.getMentorById(req.mentorId);
    if (!mentor) {
      return { success: false, message: 'Mentor profile not found.', requestId: '' };
    }

    const newRequest = {
      ...req,
      id: `req-${Date.now()}`,
      learnerId: userId,
      status: 'Pending' as const,
      createdAtUtc: new Date().toISOString(),
    };

    this.sessionRequests.push(newRequest);
    return {
      success: true,
      message: `Your mentorship request has been submitted to ${mentor.name}. You will be notified when they accept.`,
      requestId: newRequest.id,
    };
  }
}

export const mentorsStore = new MentorsStore();
