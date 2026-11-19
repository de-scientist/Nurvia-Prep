export type ContentStatus =
  | 'Draft'
  | 'ValidationFailed'
  | 'PendingReview'
  | 'Approved'
  | 'Published'
  | 'Archived'
  | 'Rejected';

export type ExamStatus =
  | 'Draft'
  | 'Configured'
  | 'PendingReview'
  | 'Approved'
  | 'Published'
  | 'Archived';

export type QuestionType =
  | 'MultipleChoice'
  | 'MultipleResponse'
  | 'MultipleSelect'
  | 'SelectAllThatApply'
  | 'TrueFalse'
  | 'FillInTheBlank'
  | 'BlankFill'
  | 'BlankSelect'
  | 'Cloze'
  | 'NumericResponse'
  | 'NumericCalculation'
  | 'OrderedResponse'
  | 'OrderingNumber'
  | 'OrderingItem'
  | 'OrderingDragDrop'
  | 'Matching'
  | 'MatrixGrid'
  | 'MatrixSingleChoice'
  | 'MatrixMultipleSelect'
  | 'ClinicalCaseStudy'
  | 'UnfoldingCaseStudy'
  | 'BowTie'
  | 'DynamicLabBowTie'
  | 'MultipleTrueFalse'
  | 'ImageBased'
  | 'DynamicImage'
  | 'MultipleImage'
  | 'MultipleImageSelection'
  | 'Hotspot'
  | 'DragAndDrop'
  | 'ExtendedResponse'
  | 'TabularResponse'
  | 'ShortAnswer'
  | 'OpenEnded'
  | 'HighLight'
  | 'AudioBased'
  | 'VideoBased'
  | 'SingleChoice'
  | 'CaseBasedSingleChoice'
  | 'CaseBasedMultipleSelect'
  | 'CaseBasedTrueFalse'
  | 'CaseBasedNumericResponse'
  | 'CaseBasedMatching'
  | 'CaseBasedOrderingNumber'
  | 'CaseBasedOrderingItem'
  | 'CaseBasedOrderingDragDrop'
  | 'CaseBasedDynamicImage'
  | 'CaseBasedMultipleImage'
  | 'CaseBasedBlankSelect'
  | 'CaseBasedBlankFill'
  | 'CaseBasedHotspot'
  | 'CaseBasedOpenEnded'
  | 'CaseBasedHighLight'
  | 'CaseBasedAudioBased'
  | 'CaseBasedVideoBased'
  | 'CaseBasedMatrixSingleChoice'
  | 'CaseBasedMatrixMultipleSelect'
  | number;

export type NursingPathway = 'RN' | 'PN_LPN' | 'RN_Exit' | 'PN_Exit';

export type ExamCategory = 'ATI' | 'HESI' | 'RegularCourse' | 'Certification' | 'ExitPredictor';

export type DifficultyLevel = 'Foundational' | 'Intermediate' | 'Advanced' | 'Benchmark';

export type CognitiveSkill =
  | 'RecognizeCues'
  | 'AnalyzeCues'
  | 'PrioritizeHypotheses'
  | 'GenerateSolutions'
  | 'TakeActions'
  | 'EvaluateOutcomes';

export type ClientNeedCategory =
  | 'SafeEffectiveCareEnvironment'
  | 'HealthPromotionAndMaintenance'
  | 'PsychosocialIntegrity'
  | 'PhysiologicalIntegrity';

export type ExhibitType =
  | 'NursesNotes'
  | 'VitalSigns'
  | 'LabResults'
  | 'ProviderOrders'
  | 'RadiologyReport';

export type ExamDeliveryMode = 'Review' | 'Exam' | 'Tutor' | 'All' | 'Both';

export type ReviewReleasePolicy = 'Immediate' | 'ManualRelease';

export type ExamLayoutPolicy = 'AllInOneOnly' | 'SequentialOnly' | 'Both';

export type ExamLayout = 'AllInOne' | 'Sequential';

export interface QuestionOptionDto {
  id?: string;
  optionIndex: number;
  optionText: string;
  isCorrect: boolean;
  specificRationale?: string;
  displayOrder: number;
}

export interface QuestionExhibitDto {
  id?: string;
  type: ExhibitType;
  title: string;
  content: string;
  displayOrder: number;
}

export interface QuestionReviewDto {
  id?: string;
  reviewerId: string;
  reviewerName: string;
  decision: 'Approved' | 'Rejected' | 'ChangesRequested';
  comments: string;
  reviewedAtUtc: string;
}

export interface QuestionVersionDto {
  id: string;
  versionNumber: number;
  stem: string;
  questionType: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  generalRationale: string;
  contentJsonData?: string;
  status: ContentStatus;
  validationErrors?: string;
  reviewNotes?: string;
  createdAtUtc: string;
  createdBy: string;
  options: QuestionOptionDto[];
  exhibits: QuestionExhibitDto[];
  reviews: QuestionReviewDto[];
}

export interface QuestionDto {
  id: string;
  code: string;
  pathway: NursingPathway;
  category: ExamCategory;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: DifficultyLevel;
  status: ContentStatus;
  currentVersionId?: string;
  concurrencyToken: string;
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc?: string;
  updatedBy?: string;
  currentVersion?: QuestionVersionDto;
  versions?: QuestionVersionDto[];
  reviews?: QuestionReviewDto[];
}

export interface ExamBlueprintDto {
  id: string;
  examVersionId: string;
  targetQuestionCount: number;
  subjectDistributionJson?: string;
  cognitiveDistributionJson?: string;
  difficultyDistributionJson?: string;
}

export interface ExamQuestionDto {
  id: string;
  examVersionId: string;
  questionId: string;
  questionVersionId: string;
  orderIndex: number;
  points: number;
  question?: QuestionDto;
}

export interface ExamVersionDto {
  id: string;
  versionNumber: number;
  title: string;
  description: string;
  instructions: string;
  timeLimitMinutes: number;
  passingScorePercentage: number;
  status: ExamStatus;
  validationErrors?: string;
  reviewReleasePolicy: ReviewReleasePolicy;
  reviewReleasedAtUtc?: string;
  allowedLayouts: ExamLayoutPolicy;
  defaultLayout: ExamLayout;
  createdAtUtc: string;
  createdBy: string;
  blueprint?: ExamBlueprintDto;
  examQuestions: ExamQuestionDto[];
}

export interface ExamDto {
  id: string;
  code: string;
  title: string;
  description: string;
  pathway: NursingPathway;
  category: ExamCategory;
  modeAllowed: ExamDeliveryMode;
  timeLimitMinutes: number;
  passingScorePercentage: number;
  status: ExamStatus;
  currentVersionId?: string;
  totalQuestions: number;
  concurrencyToken: string;
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc?: string;
  updatedBy?: string;
  currentVersion?: ExamVersionDto;
  versions?: ExamVersionDto[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errorCode?: string;
  errors?: string[];
  statusCode?: number;
}

export interface AuthUserDto {
  id: string;
  guidId?: string;
  name: string;
  email: string;
  role: string;
  dashboardName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

export interface QuestionMediaDto {
  id: string;
  numericId?: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
  instructions?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  isPrimary?: boolean;
}

export interface QuestionMatrixCellDto {
  id: string;
  numericId?: number;
  rowIndex: number;
  columnIndex: number;
  cellValue?: string;
  isLocked?: boolean;
  /** Stripped in active Exam mode; only populated in Review or evaluated Tutor mode. */
  isCorrect?: boolean;
  explanation?: string;
}

export interface QuestionMatrixDto {
  id: string;
  title?: string;
  description?: string;
  topLeftCell?: string;
  rowCount: number;
  columnCount: number;
  rowHeaders: string[];
  columnHeaders: string[];
  responseType: 'singleChoice' | 'multipleChoice' | string;
  instructions?: string;
  allowPartialCredit?: boolean;
  cells: QuestionMatrixCellDto[];
}

export interface QuestionCorrectAnswerMetaDto {
  correctOptionIds?: string[];
  correctMediaIds?: string[];
  correctCellIds?: string[];
  correctOrderIds?: string[];
  correctMatches?: Record<string, string>;
  correctBlanks?: Record<string, string>;
  expectedNumeric?: string;
  modelAnswerHtml?: string;
  explanationImages?: string[];
  allowPartialCredit?: boolean;
}

export interface ExamModePermissionsDto {
  canExam: boolean;
  canReview: boolean;
  canTutor: boolean;
  examReason?: string;
  reviewReason?: string;
  tutorReason?: string;
  allowLayoutSwitching: boolean;
  allowModeSwitching: boolean;
  reviewReleased: boolean;
}

export interface ActiveExamOptionDto {
  id: string;
  numericId?: number;
  optionIndex: number;
  optionText: string;
  displayOrder: number;
  description?: string;
  data?: string;
  label?: string;
  order?: string;
  link?: string;
  /** Only populated for Tutor-mode attempts; Exam mode is strictly sanitized server-side. */
  isCorrect?: boolean;
  specificRationale?: string;
}

export interface ActiveExamQuestionDto {
  id: string;
  numericId?: number;
  guidId?: string;
  examGuidId?: string;
  sectionId?: number;
  sectionGuidId?: string;
  sectionName?: string;
  orderIndex: number;
  stem: string;
  metaStem?: string;
  instructions?: string;
  questionType: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  contentJsonData?: string;
  /** Only populated for Tutor-mode attempts. */
  generalRationale?: string;
  options: ActiveExamOptionDto[];
  exhibits: QuestionExhibitDto[];
  media?: QuestionMediaDto[];
  matrix?: QuestionMatrixDto;
  blankSelectPassage?: string;
  highlightPassage?: string;
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  contentIntegrityError?: string;
}

export interface LearnerAnswerStateDto {
  responseJson?: string;
  isAnswered: boolean;
  isFlagged: boolean;
  savedAtUtc: string;
  /** Server-authoritative Tutor progression (0 for non-Tutor attempts). */
  tutorStageReached: number;
}

export interface StartAttemptRequestDto {
  deliveryMode: 'Exam' | 'Tutor';
  layoutMode?: ExamLayout | null;
}

export interface StartAttemptResultDto {
  attemptId: string;
  examId: string;
  examNumericId?: number;
  examTitle: string;
  timeLimitMinutes: number;
  remainingSeconds: number;
  startedAtUtc: string;
  deadlineUtc: string;
  totalQuestions: number;
  configuredQuestionCount?: number;
  loadedQuestionCount?: number;
  deliveryMode: 'Exam' | 'Tutor';
  layoutMode: ExamLayout;
  allowedLayouts: ExamLayoutPolicy;
  modePermissions?: ExamModePermissionsDto;
  attemptNumber?: number;
  isDurableBackendSynced?: boolean;
  integrityWarnings?: string[];
  questions: ActiveExamQuestionDto[];
  savedResponses: Record<string, LearnerAnswerStateDto>;
}

export interface AutosaveResponseRequest {
  questionId: string;
  responseJson?: string | null;
  isFlagged: boolean;
  layoutMode?: ExamLayout | null;
}

export interface AutosaveResultDto {
  questionId: string;
  isAnswered: boolean;
  isFlagged: boolean;
  savedAtUtc: string;
}

export interface ReviewOptionDto {
  id: string;
  numericId?: number;
  optionIndex: number;
  optionText: string;
  description?: string;
  data?: string;
  label?: string;
  order?: string;
  link?: string;
  isCorrect: boolean;
  specificRationale?: string;
  wasSelected: boolean;
}

export interface ReviewQuestionDto {
  questionId: string;
  numericId?: number;
  guidId?: string;
  sectionId?: number;
  sectionGuidId?: string;
  sectionName?: string;
  orderIndex: number;
  stem: string;
  metaStem?: string;
  instructions?: string;
  questionType: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  /** Null when the exam's review-release policy withholds rationales. */
  generalRationale?: string;
  learnerResponse?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  options: ReviewOptionDto[];
  exhibits: QuestionExhibitDto[];
  media?: QuestionMediaDto[];
  matrix?: QuestionMatrixDto;
  blankSelectPassage?: string;
  highlightPassage?: string;
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  contentIntegrityError?: string;
}

/** Review-mode study content for a published exam (answer keys + rationales, no graded attempt). */
export interface ExamReviewContentDto {
  examId: string;
  examTitle: string;
  pathway: NursingPathway;
  category: ExamCategory;
  instructions: string;
  timeLimitMinutes: number;
  configuredQuestionCount?: number;
  loadedQuestionCount?: number;
  modePermissions?: ExamModePermissionsDto;
  reviewReleased: boolean;
  questions: ReviewQuestionDto[];
}

export interface SubmittedExamResultDto {
  attemptId: string;
  examId: string;
  examTitle: string;
  pathway?: NursingPathway | string;
  examCategory?: ExamCategory | string;
  status: string;
  startedAtUtc: string;
  submittedAtUtc: string;
  timeSpentSeconds: number;
  timeLimitMinutes?: number;
  totalQuestions: number;
  totalAnswered?: number;
  correctQuestions: number;
  totalWrong?: number;
  scorePercentage: number;
  passingScorePercentage: number;
  passed: boolean;
  grade?: string;
  reviewReleased: boolean;
  modePermissions?: ExamModePermissionsDto;
  reviewQuestions: ReviewQuestionDto[];
}

export interface ExamAttemptSummaryDto {
  attemptId: string;
  examId: string;
  examTitle: string;
  examCategory?: string;
  pathway?: NursingPathway | string;
  status: string;
  startedAtUtc: string;
  submittedAtUtc?: string;
  scorePercentage?: number;
  passingScorePercentage?: number;
  passed?: boolean;
  totalQuestions: number;
  totalCorrect?: number;
  totalWrong?: number;
  totalAnswered?: number;
  timeSpentSeconds?: number;
  attemptNumber?: number;
  allowReview?: boolean;
  canReview?: boolean;
  canTutor?: boolean;
  subjectName?: string;
  topicName?: string;
  grade?: string;
}

export interface UserProfileDto {
  id: string;
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  biography?: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  professionalTitle?: string;
  organization?: string;
  avatarStorageKey?: string;
  pathway?: string;
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc?: string;
  updatedBy?: string;
}

export interface AvatarDto {
  storageKey: string;
  url: string;
  uploadedAtUtc: string;
}

export type LectureAccessLevel = 'Public' | 'AuthenticatedLearner';

export interface LectureCatalogueItemDto {
  id: string;
  number: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  highYieldConcepts: string[];
  accessLevel: LectureAccessLevel;
}

export interface LectureContentDto extends LectureCatalogueItemDto {
  bodyMarkdown: string;
}

export interface LectureManagementDto extends LectureContentDto {
  status: ContentStatus;
  reviewNotes: string;
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc?: string;
  updatedBy?: string;
}

export interface CreateLectureRequest {
  number: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  bodyMarkdown: string;
  highYieldConcepts: string[];
  accessLevel: LectureAccessLevel;
}

export interface UpdateLectureRequest {
  slug: string;
  title: string;
  category: string;
  summary: string;
  bodyMarkdown: string;
  highYieldConcepts: string[];
  accessLevel: LectureAccessLevel;
}

export interface ReviewLectureRequest {
  decision: 'Approved' | 'Rejected';
  comments: string;
}

export interface StudySetCardDto {
  id: string;
  code: string;
  title: string;
  description: string;
  pathway: NursingPathway;
  category: ExamCategory;
  modeAllowed: ExamDeliveryMode;
  timeLimitMinutes: number;
  passingScorePercentage: number;
  totalQuestions: number;
  school?: string | null;
  academicYear?: number | null;
  season?: string | null;
  subject?: string | null;
  topic?: string | null;
  difficulty?: DifficultyLevel | null;
  allowedLayouts: ExamLayoutPolicy;
  defaultLayout: ExamLayout;
  averageRating?: number | null;
  reviewCount: number;
  featuredTestimonial?: string | null;
  isSaved: boolean;
}

export interface ExamReviewDto {
  id: string;
  examId: string;
  learnerName: string;
  rating: number;
  comment?: string | null;
  createdAtUtc: string;
}

export interface StudySetDetailDto extends StudySetCardDto {
  instructions: string;
  learningObjectives: string[];
  subjectsCovered: string[];
  topicsCovered: string[];
  questionTypesIncluded: QuestionType[];
  reviews: ExamReviewDto[];
  canReview: boolean;
  learnerReview?: ExamReviewDto | null;
}

export interface StudyLibraryExamOptionDto {
  id: string;
  code: string;
  title: string;
  pathway?: string;
  category?: string;
}

export interface StudyLibraryFiltersDto {
  pathways: NursingPathway[];
  categories: ExamCategory[];
  schools: string[];
  academicYears: number[];
  seasons: string[];
  subjects: string[];
  topics: string[];
  difficulties: DifficultyLevel[];
  questionTypes: QuestionType[];
  exams: StudyLibraryExamOptionDto[];
}

export interface StudyLibrarySummaryDto {
  totalPublishedStudySets: number;
  totalAvailableQuestions: number;
  totalCategories: number;
  totalPathways: number;
}

export interface SubmitExamReviewRequest {
  rating: number;
  comment?: string | null;
}

export type TutorStage = 'FirstHint' | 'GuidedReasoning' | 'ExplainConcept';

export interface TutorHintResponseDto {
  questionId: string;
  stage: TutorStage;
  title: string;
  content: string;
  eliminatedOptionIds: string[];
  isAiGenerated: boolean;
}

export interface TutorOptionExplanationDto {
  optionId: string;
  optionIndex: string;
  optionText: string;
  isCorrect: boolean;
  specificRationale?: string | null;
}

export interface TutorEvaluateResponseDto {
  questionId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  generalRationale: string;
  optionRationales: TutorOptionExplanationDto[];
  clinicalConcept: string;
  nursingPrinciple: string;
  takeaway: string;
  isAiGenerated: boolean;
}

/** Server-authoritative Tutor progression state for one question. Stage numbering follows the six-stage learner experience (1 Independent Thinking … 6 Knowledge Reinforcement). Evaluation content appears only after server-side evaluation (stage >= 4). */
export interface TutorQuestionStateDto {
  questionId: string;
  stageReached: number;
  evaluation?: TutorEvaluateResponseDto | null;
}

/** Full Tutor session recovery payload with per-question stage state and already-authorized evaluation content. */
export interface TutorSessionStateDto {
  attemptId: string;
  deliveryMode: 'Exam' | 'Tutor';
  questions: TutorQuestionStateDto[];
}

export interface FlashcardDto {
  id: string;
  category: string;
  pathway: string;
  front: string;
  back: string;
  hint?: string | null;
  isSystemCard: boolean;
  isOwnedByCaller: boolean;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lastRating: string;
  nextReviewAtUtc: string;
  lastReviewedAtUtc?: string | null;
}

export interface CarePlanDto {
  id: string;
  title: string;
  specialty: string;
  diagnosis: string;
  relatedTo: string;
  outcomes: string[];
  interventions: string[];
  rationale: string;
  isSystemPlan: boolean;
  isOwnedByCaller: boolean;
  createdAtUtc: string;
}

export interface StudyGuideSummaryDto {
  id: string;
  title: string;
  slug: string;
  category: string;
  pathway: string;
  summary: string;
  readingMinutes: number;
  isPublished: boolean;
  createdAtUtc: string;
}

export interface StudyGuideDetailDto extends StudyGuideSummaryDto {
  contentMarkdown: string;
}

export interface CommunityReplyDto {
  id: string;
  postId: string;
  authorName: string;
  content: string;
  isOwnedByCaller: boolean;
  createdAtUtc: string;
}

export interface CommunityPostDto {
  id: string;
  channelId: string;
  channelName: string;
  authorName: string;
  cohortLabel: string;
  title: string;
  content: string;
  replyCount: number;
  likeCount: number;
  likedByCaller: boolean;
  isOwnedByCaller: boolean;
  createdAtUtc: string;
  replies?: CommunityReplyDto[] | null;
}

export interface TutorChatMessageDto {
  id: string;
  role: 'User' | 'Assistant';
  content: string;
  createdAtUtc: string;
}

export interface TutorChatSessionDto {
  id: string;
  title: string;
  pathway: string;
  topic: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  messages?: TutorChatMessageDto[] | null;
}

export interface SubscriptionPlanDto {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  billingInterval: string;
  features: string[];
  isActive: boolean;
}

export interface UserSubscriptionDto {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  planId: string;
  planCode: string;
  planName: string;
  status: string;
  source: string;
  startsAtUtc: string;
  expiresAtUtc?: string | null;
  notes?: string | null;
}

export interface StaffInvitationDto {
  id: string;
  email: string;
  role: string;
  invitedByUserId: string;
  expiresAtUtc: string;
  acceptedAtUtc?: string | null;
  revokedAtUtc?: string | null;
  createdAtUtc: string;
  status: 'Pending' | 'Accepted' | 'Revoked' | 'Expired';
}

// ============================================================================
// ADDITIVE PRODUCT EXPANSION TYPES (Community, QOTD, Groups, Mentors, Insights)
// ============================================================================

export type CommunityPostType = 'Discussion' | 'Question' | 'ExamResult' | 'StudyGroup' | 'Poll';
export type CommunityPostStatus = 'Open' | 'Solved' | 'Closed' | 'UnderReview';

export interface CommunityCategoryGroupDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  categories: CommunityCategoryDto[];
}

export interface CommunityCategoryDto {
  id: string;
  groupId: string;
  groupName?: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  postCount: number;
  isPinned?: boolean;
  examTrack?: string;
  visibility: 'Public' | 'LearnerOnly' | 'AdminOnly';
}

export interface CommunityPollOptionDto {
  id: string;
  text: string;
  votes: number;
  votedByCaller?: boolean;
}

export interface CommunityPostDetailDto extends CommunityPostDto {
  postType: CommunityPostType;
  status: CommunityPostStatus;
  slug?: string;
  tags: string[];
  region?: string;
  views: number;
  downvoteCount?: number;
  voteScore: number;
  userVote?: 'up' | 'down' | null;
  isBookmarked?: boolean;
  examResultMeta?: {
    examType: string;
    outcome: 'Pass' | 'Fail' | 'Waiting';
    examDate?: string;
    questionCount?: number;
    weeksStudied?: number;
    prepResourcesUsed?: string[];
  };
  pollMeta?: {
    question: string;
    options: CommunityPollOptionDto[];
    totalVotes: number;
  };
}

export interface CreateCommunityPostRequest {
  channelId: string;
  title: string;
  content: string;
  postType?: CommunityPostType;
  cohortLabel?: string;
  tags?: string[];
  region?: string;
  examResultMeta?: {
    examType: string;
    outcome: 'Pass' | 'Fail' | 'Waiting';
    examDate?: string;
    questionCount?: number;
    weeksStudied?: number;
    prepResourcesUsed?: string[];
  };
  pollMeta?: {
    question: string;
    options: string[];
  };
}

export interface QotdOptionDto {
  id: string;
  letter: string;
  text: string;
  rationale?: string;
  isCorrect?: boolean;
}

export interface QotdQuestionDto {
  id: string;
  dateStr: string; // YYYY-MM-DD
  timezone?: string;
  source?: 'published_bank' | 'backend' | 'unavailable';
  persistenceScope?: 'session_local' | 'backend_persisted';
  authRequired?: boolean;
  title: string;
  stem: string;
  category: string;
  examContext: string;
  questionType?: QuestionType;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  options: QotdOptionDto[];
  rendererQuestion?: import('../components/exam/renderers/types').RendererQuestion;
  totalAnswers: number;
  correctPercentage?: number;
  userAnswered?: boolean;
  userSelectedOptionId?: string;
  userResponseJson?: string;
  userIsCorrect?: boolean;
  correctOptionId?: string;
  explanation?: string;
}

export interface SubmitQotdAnswerRequest {
  questionId: string;
  selectedOptionId?: string;
  responseJson?: string;
}

export interface QotdSubmissionResultDto {
  isCorrect: boolean;
  correctOptionId: string;
  explanation: string;
  userStreak: number;
  totalAnswered: number;
  overallAccuracyPercentage: number;
  persistenceScope?: 'session_local' | 'backend_persisted';
  correctAnswerMeta?: QuestionCorrectAnswerMetaDto;
  optionRationales?: Array<{ id: string; isCorrect: boolean; rationale?: string }>;
}

export interface StudyGroupDto {
  id: string;
  title: string;
  description: string;
  examTrack: string;
  subject?: string;
  topic?: string;
  targetExamDate?: string;
  meetingCadence: string;
  timezone: string;
  maxMembers: number;
  currentMembers: number;
  isPrivate: boolean;
  createdByUserId: string;
  creatorName: string;
  createdAtUtc: string;
  isMember?: boolean;
  isOwner?: boolean;
  objectives?: string[];
}

export interface CreateStudyGroupRequest {
  title: string;
  description: string;
  examTrack: string;
  subject?: string;
  targetExamDate?: string;
  meetingCadence: string;
  timezone: string;
  maxMembers?: number;
  isPrivate?: boolean;
  objectives?: string[];
}

export interface MentorProfileDto {
  id: string;
  name: string;
  qualification: string; // e.g. MSN, RN, CCRN
  specialties: string[];
  experienceYears: number;
  examTracks: string[];
  bio: string;
  avatarUrl?: string;
  isVerified: boolean;
  availabilityStatus: 'Available' | 'Limited' | 'Unavailable';
  sessionFormats: ('1-on-1 Q&A' | 'Study Plan Review' | 'Clinical Transition Guidance')[];
  languages: string[];
  rating: number;
  reviewCount: number;
}

export interface MentorSessionRequestDto {
  mentorId: string;
  learnerId?: string;
  topic: string;
  examTrack: string;
  message: string;
  preferredCadence: string;
}

export interface CommunityExamOutcomeStatsDto {
  examName: string;
  passed: number;
  failed: number;
  waiting: number;
}

export interface CommunityInsightsSummaryDto {
  totalResultsReported: number;
  totalResults?: number;
  averageStudyWeeks: number;
  passPercentageOverall: number;
  outcomesByQuestionCount: {
    questionBracket: string; // e.g. "85 Qs", "86-100 Qs", "101-130 Qs", "131-150 Qs"
    passed: number;
    failed: number;
  }[];
  mostUsedResources: {
    resourceName: string;
    userCount: number;
    passPercentage: number;
  }[];
  byExam: CommunityExamOutcomeStatsDto[];
  recentSharedResults?: {
    id: string;
    examType: string;
    outcome: 'Pass' | 'Fail' | 'Waiting';
    examDate?: string;
    questionCount?: number;
    weeksStudied?: number;
    prepResources: string[];
    story?: string;
    createdAtUtc: string;
  }[];
}

export interface GlobalSearchFacetDto {
  type: string;
  label: string;
  count: number;
}

export interface GlobalSearchResultItemDto {
  id: string;
  type: 'exam' | 'study_set' | 'care_plan' | 'lecture' | 'study_guide' | 'community_post' | 'group' | 'mentor';
  title: string;
  excerpt: string;
  category: string;
  url: string;
  tags?: string[];
  badge?: string;
}

export interface GlobalSearchResponseDto {
  query: string;
  totalCount: number;
  items: GlobalSearchResultItemDto[];
  facets: GlobalSearchFacetDto[];
}
