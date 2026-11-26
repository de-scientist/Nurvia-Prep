import type {
  QotdQuestionDto,
  QotdSubmissionResultDto,
  CognitiveSkill,
  ClientNeedCategory,
} from '@/lib/api-types';
import {
  PublishedBankDailyQuestionProvider,
  computeConsecutiveUtcStreak,
  getUtcDateKey,
  sanitizeDailyQuestionForPreSubmit,
} from './daily-question-core.mjs';

export interface InternalQotdRecord {
  id: string;
  dateStr: string; // YYYY-MM-DD
  title: string;
  stem: string;
  category: string;
  examContext: string;
  cognitiveSkill: CognitiveSkill;
  clientNeedCategory: ClientNeedCategory;
  options: {
    id: string;
    letter: 'A' | 'B' | 'C' | 'D';
    text: string;
    isCorrect: boolean;
    specificRationale: string;
  }[];
  generalRationale: string;
  totalAnswers: number;
  correctAnswers: number;
}

const SEED_QUESTIONS: InternalQotdRecord[] = [
  {
    id: 'qotd-2026-11-18',
    dateStr: '2026-11-18',
    title: 'IV Heparin Infusion and Elevated aPTT Management',
    stem: 'A client receiving an intravenous heparin infusion has an activated partial thromboplastin time (aPTT) of 120 seconds (laboratory reference control: 30 seconds). Which nursing action should the nurse take first?',
    category: 'Pharmacology & Parenteral Therapies',
    examContext: 'RN / Med-Surg',
    cognitiveSkill: 'TakeActions',
    clientNeedCategory: 'PhysiologicalIntegrity',
    options: [
      {
        id: 'opt-a',
        letter: 'A',
        text: 'Continue the infusion and recheck the aPTT in 6 hours.',
        isCorrect: false,
        specificRationale: 'Continuing the infusion exposes the client to life-threatening spontaneous hemorrhage because the aPTT is 4 times the control value.',
      },
      {
        id: 'opt-b',
        letter: 'B',
        text: 'Stop the heparin infusion and notify the primary healthcare provider.',
        isCorrect: true,
        specificRationale: 'Correct. Therapeutic aPTT during heparin therapy is 1.5 to 2.5 times control (45 to 75 seconds). An aPTT of 120 seconds indicates severe anticoagulation and high risk of bleeding; stopping the infusion is the priority immediate nursing action.',
      },
      {
        id: 'opt-c',
        letter: 'C',
        text: 'Administer vitamin K intramuscularly immediately.',
        isCorrect: false,
        specificRationale: 'Vitamin K is the reversal agent for warfarin (Coumadin), not heparin. The specific reversal agent for heparin is protamine sulfate.',
      },
      {
        id: 'opt-d',
        letter: 'D',
        text: 'Increase the infusion rate per institutional weight-based protocol.',
        isCorrect: false,
        specificRationale: 'Increasing the rate would exacerbate the severe coagulopathy and drastically increase the risk of fatal intracranial or retroperitoneal bleeding.',
      },
    ],
    generalRationale: 'Therapeutic target aPTT for unfractionated heparin is 1.5 to 2.5 times the normal baseline (approximately 45–75 seconds). An aPTT of 120 seconds is critical and significantly exceeds therapeutic limits. The nurse must immediately cease the heparin infusion to prevent hemorrhagic complications, assess for signs of bleeding (hematuria, melena, ecchymosis, neurological changes), notify the provider, and prepare protamine sulfate if ordered.',
    totalAnswers: 342,
    correctAnswers: 289,
  },
  {
    id: 'qotd-2026-11-17',
    dateStr: '2026-11-17',
    title: 'Triage & Client Prioritization Following In-Hospital Fall',
    stem: 'A charge nurse finds an elderly client on the floor in their room. After assisting the client back to bed and taking initial vital signs, which nursing action is the most critical next step?',
    category: 'Management of Care',
    examContext: 'RN / Leadership',
    cognitiveSkill: 'PrioritizeHypotheses',
    clientNeedCategory: 'SafeEffectiveCareEnvironment',
    options: [
      {
        id: 'opt-a1',
        letter: 'A',
        text: 'Delegate hourly neurologic checks to the unlicensed assistive personnel (UAP).',
        isCorrect: false,
        specificRationale: 'Neurologic assessment requires clinical judgment and can never be delegated to unlicensed assistive personnel.',
      },
      {
        id: 'opt-b1',
        letter: 'B',
        text: 'Perform a comprehensive head-to-toe assessment for hidden injuries and notify the provider.',
        isCorrect: true,
        specificRationale: 'Correct. The registered nurse must perform an immediate thorough physical and neurological assessment to detect fractures, cervical injury, or acute subdural hematoma prior to moving or leaving the client, followed by provider notification.',
      },
      {
        id: 'opt-c1',
        letter: 'C',
        text: 'Fill out an incident report and document in the medical record that an incident report was completed.',
        isCorrect: false,
        specificRationale: 'Incident reports are confidential internal risk management documents and must never be referenced or documented within the patient medical record.',
      },
      {
        id: 'opt-d1',
        letter: 'D',
        text: 'Apply bilateral soft wrist restraints to prevent repeated falls.',
        isCorrect: false,
        specificRationale: 'Restraints require a specific provider order, are a last resort, and are contraindicated as a routine fall prevention measure.',
      },
    ],
    generalRationale: 'Following a patient fall, the priority is immediate clinical assessment for occult trauma (cervical spine, long bone fractures, hematomas) before provider notification. Physical assessments cannot be delegated to UAP.',
    totalAnswers: 512,
    correctAnswers: 441,
  },
  {
    id: 'qotd-2026-11-16',
    dateStr: '2026-11-16',
    title: 'Pediatric Digoxin Toxicity Signs',
    stem: 'A 2-year-old child with congenital heart disease is receiving oral digoxin. Which assessment finding should alert the nurse to potential digoxin toxicity?',
    category: 'Pediatric Nursing & Pharmacology',
    examContext: 'RN / Pediatrics',
    cognitiveSkill: 'RecognizeCues',
    clientNeedCategory: 'PhysiologicalIntegrity',
    options: [
      {
        id: 'opt-a2',
        letter: 'A',
        text: 'Sudden onset of vomiting and bradycardia.',
        isCorrect: true,
        specificRationale: 'Correct. In infants and young children, gastrointestinal symptoms (anorexia, nausea, and particularly repeated vomiting) accompanied by bradycardia or cardiac dysrhythmias are the earliest and most reliable indicators of digoxin toxicity.',
      },
      {
        id: 'opt-b2',
        letter: 'B',
        text: 'Hyperactivity and loud crying.',
        isCorrect: false,
        specificRationale: 'Toxicity typically causes lethargy and drowsiness, not hyperactivity.',
      },
      {
        id: 'opt-c2',
        letter: 'C',
        text: 'Bilateral pedal edema and tachypnea.',
        isCorrect: false,
        specificRationale: 'These are clinical manifestations of worsening congestive heart failure, not classic early signs of digoxin toxicity.',
      },
      {
        id: 'opt-d2',
        letter: 'D',
        text: 'Constipation and flushed dry skin.',
        isCorrect: false,
        specificRationale: 'These are anticholinergic effects, not characteristic of digitalis toxicity.',
      },
    ],
    generalRationale: 'Digoxin has a narrow therapeutic window (0.8–2.0 ng/mL). In young pediatric clients, vomiting is the classic hallmark of toxicity. The nurse must withhold the dose and immediately check serum digoxin and potassium levels.',
    totalAnswers: 420,
    correctAnswers: 365,
  },
];

interface QotdAttemptRecord {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  date: string;
}

interface GlobalQotdState {
  questions: InternalQotdRecord[];
  userAttempts: Map<string, QotdAttemptRecord[]>;
}

const globalForQotd = globalThis as typeof globalThis & {
  __nurviaQotdState?: GlobalQotdState;
};

function getGlobalQotdState(): GlobalQotdState {
  if (!globalForQotd.__nurviaQotdState) {
    globalForQotd.__nurviaQotdState = {
      questions: [...SEED_QUESTIONS],
      userAttempts: new Map(),
    };
  }
  return globalForQotd.__nurviaQotdState;
}

class QotdStore {
  private provider = new PublishedBankDailyQuestionProvider();

  private get questions(): InternalQotdRecord[] {
    return getGlobalQotdState().questions;
  }

  private get userAttempts(): Map<string, QotdAttemptRecord[]> {
    return getGlobalQotdState().userAttempts;
  }

  getTodayQuestion(userId?: string): QotdQuestionDto {
    const todayStr = getUtcDateKey();
    const record: InternalQotdRecord =
      (this.provider.selectQuestion(this.questions, todayStr) as InternalQotdRecord | null) ??
      this.questions[0];

    const attempts = userId ? this.userAttempts.get(userId) || [] : [];
    const attempt = attempts.find((a) => a.questionId === record.id && a.date === todayStr);
    const hasAnswered = Boolean(attempt);
    const correctOpt = record.options.find(
      (o: InternalQotdRecord['options'][number]) => o.isCorrect
    );

    return sanitizeDailyQuestionForPreSubmit(record, {
      hasAnswered,
      userSelectedOptionId: attempt?.selectedOptionId,
      userIsCorrect: attempt?.isCorrect,
      correctOptionId: hasAnswered ? correctOpt?.id : undefined,
      dateKey: todayStr,
      source: 'published_bank',
      persistenceScope: 'session_local',
    });
  }

  submitAnswer(userId: string, questionId: string, optionId: string): QotdSubmissionResultDto | null {
    const record = this.questions.find((q) => q.id === questionId);
    if (!record) return null;

    const chosenOption = record.options.find((o) => o.id === optionId);
    if (!chosenOption) return null;

    let userList = this.userAttempts.get(userId);
    if (!userList) {
      userList = [];
      this.userAttempts.set(userId, userList);
    }

    const todayStr = getUtcDateKey();
    const existing = userList.find((a) => a.questionId === questionId && a.date === todayStr);
    const correctOption = record.options.find((o) => o.isCorrect);

    if (!existing) {
      const isCorrect = chosenOption.isCorrect;
      record.totalAnswers += 1;
      if (isCorrect) record.correctAnswers += 1;

      userList.push({
        questionId,
        selectedOptionId: optionId,
        isCorrect,
        date: todayStr,
      });
    }

    const effectiveAttempt = existing ?? userList[userList.length - 1];
    const streak = computeConsecutiveUtcStreak(
      userList.map((a) => a.date),
      todayStr
    );

    const totalAnswered = userList.length;
    const totalCorrect = userList.filter((a) => a.isCorrect).length;
    const overallAccuracy = Math.round((totalCorrect / Math.max(1, totalAnswered)) * 100);

    return {
      isCorrect: effectiveAttempt.isCorrect,
      correctOptionId: correctOption?.id || optionId,
      explanation: record.generalRationale,
      userStreak: streak,
      totalAnswered,
      overallAccuracyPercentage: overallAccuracy,
      persistenceScope: 'session_local',
      optionRationales: record.options.map((o) => ({
        id: o.id,
        isCorrect: o.isCorrect,
        rationale: o.specificRationale,
      })),
    };
  }

  getHistory(userId?: string): {
    streak: number;
    totalCompleted: number;
    pastQuestions: { id: string; dateStr: string; title: string; category: string }[];
  } {
    const attempts = userId ? this.userAttempts.get(userId) || [] : [];
    const todayStr = getUtcDateKey();
    const pastQuestions = this.questions.map((q) => ({
      id: q.id,
      dateStr: q.dateStr,
      title: q.title,
      category: q.category,
    }));

    return {
      streak: computeConsecutiveUtcStreak(
        attempts.map((a) => a.date),
        todayStr
      ),
      totalCompleted: attempts.length,
      pastQuestions,
    };
  }
}

export const qotdStore = new QotdStore();
