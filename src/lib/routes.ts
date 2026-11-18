/**
 * Centralized Route Registry for NURVIA
 * Eliminates broken links and maintains consistent application routing across Public, Learner, and Admin areas.
 */

export const ROUTES = {
  // Public Approved 9-Item Navigation
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  accessDenied: "/access-denied",
  exams: "/exams",
  study: "/study",
  carePlans: "/care-plans",
  markK: "/mark-k",
  community: "/community",
  faq: "/faq",
  nclex: "/nclex",
  teas: "/teas",

  // Additive Ecosystem Routes
  categories: "/community/categories",
  qotd: "/qotd",
  groups: "/groups",
  groupDetail: (id: string) => `/groups/${id}`,
  mentors: "/mentors",
  forum: "/forum",
  insights: "/insights",
  search: "/search",
  newPost: "/new",
  nursingExams: "/nursing-exams",
  nursingExamsRn: "/nursing-exams/rn",
  nursingExamsLpn: "/nursing-exams/lpn",
  studyGuides: "/study-guides",
  nclexStudy: "/nclex/study",

  // Public Supporting / Experience Routes
  examSession: "/exam-session",
  designSystem: "/design-system",
  terms: "/terms",
  privacy: "/privacy",

  // Learner Application
  learner: {
    dashboard: "/learner",
    performance: "/learner/performance",
    planner: "/learner/planner",
    exams: "/learner/exams",
    library: "/learner/library",
    myExams: "/learner/my-exams",
    customPractice: "/learner/custom-practice",
    history: "/learner/history",
    hub: "/learner/hub",
    guides: "/learner/guides",
    flashcards: "/learner/flashcards",
    carePlans: "/learner/care-plans",
    calculators: "/learner/calculators",
    aiTutor: "/learner/ai-tutor",
    savedQuestions: "/learner/saved-questions",
    community: "/learner/community",
    account: "/learner/account",
    notifications: "/learner/notifications",
    settings: "/learner/settings",
    subscription: "/learner/subscription",
  },

  // Admin Management Studio
  admin: {
    overview: "/admin",
    analytics: "/admin/analytics",
    audit: "/admin/audit",
    questions: "/admin/questions",
    questionsNew: "/admin/questions/new",
    questionEdit: (id: string) => `/admin/questions/${id}/edit`,
    questionTypes: "/admin/question-types",
    exams: "/admin/exams",
    reviews: "/admin/reviews",
    taxonomy: "/admin/taxonomy",
    cases: "/admin/cases",
    learners: "/admin/learners",
    rbac: "/admin/rbac",
    plans: "/admin/plans",
    settings: "/admin/settings",
  },
} as const;

export type AppRoutes = typeof ROUTES;
