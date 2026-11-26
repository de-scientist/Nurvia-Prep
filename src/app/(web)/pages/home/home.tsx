"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/config";
import AuthModal from "@/app/(web)/auth/modals/auth";
import Contact from "@/app/(web)/components/sections/Contact";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  HeartPulse,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  GraduationCap,
  Award,
  Layers,
} from "lucide-react";

interface SampleQuestion {
  id: string;
  questionNumber: number;
  modeBadge: string;
  topic: string;
  stem: string;
  options: { letter: string; text: string; isCorrect: boolean }[];
  rationale: string;
  clinicalTip: string;
}

const HERO_PRACTICE_QUESTIONS: SampleQuestion[] = [
  {
    id: "q-hero-01",
    questionNumber: 1,
    modeBadge: "Learn-as-you-go mode",
    topic: "PHARMACOLOGY",
    stem: "A nurse is caring for a client who has been prescribed warfarin. The client asks why frequent blood tests are necessary. Which response by the nurse is most appropriate?",
    options: [
      { letter: "A", text: "To check your blood sugar levels regularly", isCorrect: false },
      { letter: "B", text: "To monitor the time it takes for your blood to clot and adjust the dose accordingly", isCorrect: true },
      { letter: "C", text: "To ensure your kidneys are functioning properly", isCorrect: false },
      { letter: "D", text: "To check for any signs of infection in the blood", isCorrect: false },
    ],
    rationale:
      "Warfarin is a vitamin K antagonist oral anticoagulant. Frequent monitoring of Prothrombin Time (PT) and International Normalized Ratio (INR) is critical to balance antithrombotic efficacy with bleeding risk (target therapeutic INR typically 2.0 to 3.0).",
    clinicalTip:
      "Clinical judgment reminder: Warfarin does not alter blood glucose, renal clearance, or leukocyte counts. Emphasize consistency in dietary vitamin K intake.",
  },
  {
    id: "q-hero-02",
    questionNumber: 2,
    modeBadge: "Learn-as-you-go mode",
    topic: "CARDIOVASCULAR / ATI PHARM",
    stem: "A nurse is preparing to administer digoxin 0.25 mg PO to an adult client diagnosed with heart failure. Which clinical assessment is a priority before administering this medication?",
    options: [
      { letter: "A", text: "Measure the client's blood pressure in both arms", isCorrect: false },
      { letter: "B", text: "Auscultate the apical pulse rate for one full minute", isCorrect: true },
      { letter: "C", text: "Check the client's capillary blood glucose level", isCorrect: false },
      { letter: "D", text: "Check the client's most recent sodium laboratory value", isCorrect: false },
    ],
    rationale:
      "Digoxin is a cardiac glycoside with positive inotropic and negative chronotropic effects. The apical pulse must be counted for 60 seconds prior to administration. If the rate is < 60 bpm in adults, withhold the dose and notify the prescriber.",
    clinicalTip:
      "Hypokalemia (potassium < 3.5 mEq/L) potentiates digoxin toxicity; always assess serum potassium alongside apical heart rate.",
  },
  {
    id: "q-hero-03",
    questionNumber: 3,
    modeBadge: "Learn-as-you-go mode",
    topic: "CLINICAL JUDGMENT / NGN MED-SURG",
    stem: "A nurse on an inpatient surgical unit cares for a client on postoperative Day 2 following total knee arthroplasty who develops acute-onset chest pain and tachypnea. Which clinical findings support a hypothesis of Pulmonary Embolism (PE)?",
    options: [
      { letter: "A", text: "Sudden sharp pleuritic chest pain and unexplained tachycardia (HR 120)", isCorrect: true },
      { letter: "B", text: "Gradual low-grade temperature elevation (38.0°C) responsive to incentive spirometry", isCorrect: false },
      { letter: "C", text: "Diminished breath sounds at bilateral bases with dry nonproductive cough", isCorrect: false },
      { letter: "D", text: "Decreased urine output with clear bilateral lung sounds", isCorrect: false },
    ],
    rationale:
      "Acute pulmonary embolism presents characteristically with sudden-onset sharp pleuritic chest pain, unexplained tachycardia, tachypnea, and hypoxia in high-risk postoperative orthopedic patients.",
    clinicalTip:
      "NGN Recognize & Analyze Cues: Orthopedic surgery carries high Virchow's triad risk. Sudden dyspnea + tachycardia = immediate PE protocol.",
  },
];

const HERO_TRACK_CHIPS = [
  { label: "ATI TEAS 7", href: "/pages/exams/ati-teas", dashboard: "/dashboards/ati-teas" },
  { label: "HESI A2 Prep", href: "/pages/exams/hesi-a2", dashboard: "/dashboards/hesi-a2" },
  { label: "RN Nursing", href: "/pages/exams/rn-nursing", dashboard: "/dashboards/rn-nursing" },
  { label: "LPN Nursing", href: "/pages/exams/lpn-nursing", dashboard: "/dashboards/lpn-nursing" },
  { label: "RN Licensure", href: "/pages/exams/nclex-rn", dashboard: "/dashboards/nclex-rn" },
  { label: "LPN Licensure", href: "/pages/exams/nclex-pn", dashboard: "/dashboards/nclex-pn" },
];

const PRACTICE_SPOTLIGHTS = [
  {
    id: "spotlight-ngn",
    track: "RN Licensure",
    focus: "Unfolding Case Studies",
    status: "NGN Ready",
    title: "Next-Gen Clinical Judgment Vignettes",
    quote:
      "Work through unfolding 6-part patient scenarios built on the NCSBN Clinical Judgment Measurement Model, with detailed option-by-option rationales.",
  },
  {
    id: "spotlight-teas",
    track: "ATI TEAS 7",
    focus: "All 4 Subject Domains",
    status: "Course-Aligned",
    title: "Reading, Math, Science & English Mastery",
    quote:
      "Prepare for nursing school admission with targeted TEAS 7 simulations covering Human Anatomy & Physiology, Dosage Math, and Scientific Reasoning.",
  },
  {
    id: "spotlight-hesi",
    track: "HESI A2 & Exit",
    focus: "Specialty & Exit Banks",
    status: "High-Yield",
    title: "Specialty & Comprehensive Exit Readiness",
    quote:
      "Practice specialty exams and full exit-predictor simulations with immediate feedback in Review Mode or timed conditions in Exam Mode.",
  },
];

interface StudySetCardItem {
  id: string;
  title: string;
  category: "FUNDAMENTALS" | "CORE SERIES" | "SPECIALTIES" | "NURSING MATH" | "EXIT EXAM" | "ADMISSIONS";
  examTrack: string;
  pathway: string;
  badge: string;
  description: string;
  examHref: string;
  dashboardHref: string;
}

const STUDY_SETS: StudySetCardItem[] = [
  {
    id: "set-teas-science",
    title: "ATI TEAS 7 Science & Anatomy",
    category: "ADMISSIONS",
    examTrack: "ATI TEAS",
    pathway: "Pre-Nursing",
    badge: "Featured",
    description:
      "Human anatomy and physiology, life sciences, chemistry, and scientific reasoning aligned with the current TEAS 7 blueprint.",
    examHref: "/pages/exams/ati-teas",
    dashboardHref: "/dashboards/ati-teas",
  },
  {
    id: "set-hesi-a2-complete",
    title: "HESI A2 Admissions Assessment",
    category: "ADMISSIONS",
    examTrack: "HESI A2",
    pathway: "Pre-Nursing",
    badge: "Featured",
    description:
      "Complete HESI A2 preparation across Mathematics, Reading Comprehension, Vocabulary, Grammar, Biology, and Anatomy & Physiology.",
    examHref: "/pages/exams/hesi-a2",
    dashboardHref: "/dashboards/hesi-a2",
  },
  {
    id: "set-rn-fundamentals",
    title: "RN Nursing Fundamentals",
    category: "FUNDAMENTALS",
    examTrack: "RN Nursing",
    pathway: "RN",
    badge: "NGN Ready",
    description:
      "Foundational nursing concepts — patient safety, infection control, vital signs, prioritization, and the nursing process with full rationales.",
    examHref: "/pages/exams/rn-nursing",
    dashboardHref: "/dashboards/rn-nursing",
  },
  {
    id: "set-rn-medsurg",
    title: "Adult Medical-Surgical Nursing",
    category: "CORE SERIES",
    examTrack: "RN Nursing",
    pathway: "RN",
    badge: "High-Yield",
    description:
      "Care of adult patients across cardiovascular, respiratory, renal, endocrine, gastrointestinal, and neurological systems.",
    examHref: "/pages/exams/rn-nursing",
    dashboardHref: "/dashboards/rn-nursing",
  },
  {
    id: "set-pharmacology",
    title: "Clinical Pharmacology & Med Safety",
    category: "CORE SERIES",
    examTrack: "RN & LPN",
    pathway: "All Tracks",
    badge: "Core Bank",
    description:
      "Drug classifications, mechanisms of action, adverse effects, antidotes, and high-alert nursing implications organized by drug class.",
    examHref: "/pages/exams/rn-nursing",
    dashboardHref: "/dashboards/rn-nursing",
  },
  {
    id: "set-dosage-math",
    title: "Dosage Calculations & IV Rates",
    category: "NURSING MATH",
    examTrack: "ATI & HESI",
    pathway: "RN & LPN",
    badge: "Step-by-Step",
    description:
      "Oral and parenteral dosages, IV drip rates, weight-based pediatric dosing, and unit conversions with step-by-step worked solutions.",
    examHref: "/pages/exams/ati-teas",
    dashboardHref: "/dashboards/ati-teas",
  },
  {
    id: "set-maternal-peds",
    title: "Maternal-Newborn & Pediatrics",
    category: "SPECIALTIES",
    examTrack: "Specialty",
    pathway: "RN & LPN",
    badge: "NGN Ready",
    description:
      "Antepartum, intrapartum, postpartum, newborn care, and pediatric growth and development milestones with clinical case scenarios.",
    examHref: "/pages/exams/lpn-nursing",
    dashboardHref: "/dashboards/lpn-nursing",
  },
  {
    id: "set-nclex-rn-predictor",
    title: "RN Licensure & Comprehensive Exit",
    category: "EXIT EXAM",
    examTrack: "RN",
    pathway: "RN Licensure",
    badge: "Predictor",
    description:
      "Full-length cumulative readiness simulations mirroring RN licensure and exit predictor blueprints with NGN unfolding case studies.",
    examHref: "/pages/exams/nclex-rn",
    dashboardHref: "/dashboards/nclex-rn",
  },
  {
    id: "set-nclex-pn-predictor",
    title: "LPN Practical Nurse Exit",
    category: "EXIT EXAM",
    examTrack: "LPN",
    pathway: "LPN",
    badge: "Predictor",
    description:
      " Targeted practical/vocational nursing licensure simulations covering coordinated care, safety, pharmacology, and physiological integrity.",
    examHref: "/pages/exams/nclex-pn",
    dashboardHref: "/dashboards/nclex-pn",
  },
];

const CATEGORIES = [
  "All",
  "ADMISSIONS",
  "FUNDAMENTALS",
  "CORE SERIES",
  "SPECIALTIES",
  "NURSING MATH",
  "EXIT EXAM",
];

function QuickPracticePreviewCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [seconds, setSeconds] = useState(18);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [completed, setCompleted] = useState(false);

  const currentQ = HERO_PRACTICE_QUESTIONS[currentIndex];
  const selectedOptionIndex = selectedAnswers[currentIndex];
  const hasSelected = selectedOptionIndex !== undefined;

  useEffect(() => {
    if (!isTimerRunning || completed) return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, completed]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleSelectOption = (index: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
  };

  const handleNext = () => {
    if (currentIndex < HERO_PRACTICE_QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
      setIsTimerRunning(false);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswers({});
    setCompleted(false);
    setSeconds(18);
    setIsTimerRunning(true);
  };

  const correctCount = HERO_PRACTICE_QUESTIONS.reduce((acc, q, idx) => {
    const chosen = selectedAnswers[idx];
    if (chosen !== undefined && q.options[chosen]?.isCorrect) return acc + 1;
    return acc;
  }, 0);

  return (
    <section
      aria-label="Quick Practice"
      className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-xl shadow-slate-900/10 overflow-hidden transition-all duration-200"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0D9488] from-45% via-[#0D9488]/25 to-transparent"
      />
      <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shadow-xs">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                QUICK PRACTICE
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                Question {currentIndex + 1} of {HERO_PRACTICE_QUESTIONS.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            title={isTimerRunning ? "Click to pause timer" : "Click to resume timer"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium hover:border-[#0D9488]/50 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTimer(seconds)}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0D9488]/10 text-[#0D9488] dark:text-teal-300 border border-[#0D9488]/25 text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            {currentQ.modeBadge}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
            {currentQ.topic}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {!completed ? (
          <>
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
              {currentQ.stem}
            </p>

            <div role="radiogroup" aria-label={`Question ${currentQ.questionNumber}`} className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOptionIndex === idx;
                const isCorrect = opt.isCorrect;

                let optionStyle =
                  "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 hover:border-[#0D9488]/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-100";
                let badgeStyle =
                  "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300";

                if (hasSelected) {
                  if (isSelected) {
                    if (isCorrect) {
                      optionStyle =
                        "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500";
                      badgeStyle = "bg-emerald-600 text-white border-emerald-600";
                    } else {
                      optionStyle =
                        "border-rose-400 bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-1 ring-rose-400";
                      badgeStyle = "bg-rose-600 text-white border-rose-600";
                    }
                  } else if (isCorrect) {
                    optionStyle =
                      "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/15 text-emerald-900 dark:text-emerald-200";
                    badgeStyle = "border-emerald-500 text-emerald-600 dark:text-emerald-400";
                  }
                }

                return (
                  <button
                    key={opt.letter}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-[#0D9488] ${optionStyle}`}
                  >
                    <span
                      className={`w-7 h-7 shrink-0 rounded-full border text-xs font-bold flex items-center justify-center transition-colors font-mono ${badgeStyle}`}
                    >
                      {opt.letter}
                    </span>
                    <span className="text-xs sm:text-sm font-medium leading-snug flex-1 pt-0.5">
                      {opt.text}
                    </span>
                    {hasSelected && isSelected && (
                      <span className="shrink-0 pt-0.5">
                        {isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {hasSelected && (
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                  currentQ.options[selectedOptionIndex]?.isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[#0D9488] dark:text-teal-300">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Clinical Reasoning &amp; Rationale</span>
                </div>
                <p>{currentQ.rationale}</p>
                <p className="text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700 text-[11px] italic">
                  {currentQ.clinicalTip}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-brand text-lg font-bold text-slate-900 dark:text-white">
                Quick Practice Completed!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You scored <strong>{correctCount} of {HERO_PRACTICE_QUESTIONS.length}</strong> correct on high-yield nursing vignettes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Link
                href="/pages/entrance"
                className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] px-4 text-xs font-semibold text-white transition-colors"
              >
                <span>Open Full Exam Tracks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!completed && (
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
              currentIndex === 0
                ? "text-slate-400 cursor-not-allowed opacity-50"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5" aria-label="Question progress">
            {HERO_PRACTICE_QUESTIONS.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Jump to question ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-200 ${
                  currentIndex === idx
                    ? "w-6 bg-[#0D9488]"
                    : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 rounded-full bg-[#0D9488] hover:bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            <span>{currentIndex === HERO_PRACTICE_QUESTIONS.length - 1 ? "Finish" : "Keep Going"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

type HomePageProps = {
  data?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function HomePage({ data }: HomePageProps) {
  const { user } = useCurrentSystemUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("register");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const startHref = "/learner/library";

  const filteredSets = useMemo(() => {
    return STUDY_SETS.filter((set) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.examTrack.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === "All" || set.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [searchQuery, selectedCategory]);

  const learningModes = [
    {
      mode: "Review Mode",
      badge: "Deep Learning",
      icon: BookOpen,
      desc: "Immediate rationale feedback with clinical judgment breakdowns after every question. Understand why options are right and wrong.",
      href: "/pages/entrance",
    },
    {
      mode: "Exam Mode",
      badge: "Simulation",
      icon: Clock,
      desc: "Timed, proctored environment mirroring actual ATI, HESI, and clinical examination interface rules. Deferred results for true readiness testing.",
      href: "/pages/entrance",
    },
    {
      mode: "Tutor & Adaptive Mode",
      badge: "Guided Mastery",
      icon: BrainCircuit,
      desc: "Guided hints, concept summaries, and Socratic clinical judgment questioning across 8 customizable examination themes.",
      href: "/pages/entrance",
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialTab={authTab}
      />

      {/* 1. HERO — Canonical NURVIA Split Composition */}
      <section
        aria-labelledby="hero-heading"
        className="relative isolate overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-[linear-gradient(150deg,#F4F7F6_0%,#EDF2F0_45%,#E9EFEC_100%)] dark:bg-[linear-gradient(150deg,#0B1220_0%,#0E1B30_55%,#0B1D33_100%)]"
      >
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-12">
            {/* Left Copy & Track Actions */}
            <div className="min-w-0 space-y-6 lg:col-span-7">
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-[#0D9488] dark:text-teal-400">
                <span aria-hidden="true" className="h-px w-10 bg-[#0D9488]/70" />
                Built for nursing school &amp; licensure exam days
                <span aria-hidden="true" className="h-px w-5 bg-[#0D9488]/30" />
              </p>

              <h1
                id="hero-heading"
                className="font-brand text-[2.5rem] font-extrabold leading-[1.06] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[3.35rem] xl:text-[3.6rem]"
              >
                <span className="block">
                  Turn Practice Into <span className="text-[#0D9488]">ATI</span>,
                </span>
                <span className="block">
                  <span className="text-[#0D9488]">HESI</span>, and <span className="text-[#0D9488]">General</span> Readiness
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                Work through ATI TEAS 7, HESI A2, RN, LPN, and clinical exit-exam practice at your own pace. Learn from clear clinical rationales, build comfort with NGN formats, and choose the study mode that fits today.
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-col gap-3 pt-1 min-[480px]:flex-row">
                <Link
                  href={startHref}
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#0D9488] hover:bg-[#0F766E] px-8 text-base font-bold text-white shadow-md transition-colors"
                >
                  <span>Try a Practice Set</span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  href="/pages/entrance"
                  className="inline-flex h-13 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-8 text-base font-bold text-slate-900 dark:text-white hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
                >
                  Explore the Exam Library
                </Link>
              </div>

              {/* Direct Track Chips preserving all 6 Nurvia-Prep exam track links */}
              <div className="pt-2 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Jump directly to your exam programme:
                </span>
                <div className="flex flex-wrap gap-2">
                  {HERO_TRACK_CHIPS.map((chip) => (
                    <Link
                      key={chip.label}
                      href={chip.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:border-[#0D9488] hover:bg-[#0D9488] hover:text-white transition-all"
                    >
                      <span>{chip.label}</span>
                      <ArrowRight className="w-3 h-3 opacity-70" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Mobile Quick Auth Buttons */}
              {!user && (
                <div className="flex sm:hidden w-full gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("login");
                      setAuthOpen(true);
                    }}
                    className="flex-1 rounded-full py-2.5 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 shadow-xs"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("register");
                      setAuthOpen(true);
                    }}
                    className="flex-1 rounded-full py-2.5 text-center text-xs font-bold text-white bg-[#142B4A]"
                  >
                    Join {APP_NAME}
                  </button>
                </div>
              )}

              {/* Trust Strip */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Clinical Precision
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  · 38 NGN &amp; standard question formats · 6 dedicated programme workspaces
                </span>
              </div>
            </div>

            {/* Right Interactive Quick Practice Card */}
            <div className="min-w-0 lg:col-span-5">
              <QuickPracticePreviewCard />
            </div>
          </div>
        </div>
      </section>

      {/* 2. CLINICAL PRACTICE SPOTLIGHTS BAR */}
      <section
        aria-label="Clinical practice spotlights"
        className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111C2E]/60 py-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-widest uppercase text-slate-900 dark:text-white">
                  STRUCTURED FOR EXAM DAY CONFIDENCE
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Evidence-based question banks, NGN clinical scenarios, and real-time analytics
                </p>
              </div>
            </div>
            <Link
              href="/pages/reviews"
              className="text-xs font-semibold text-[#0D9488] hover:underline inline-flex items-center gap-1"
            >
              <span>Read student stories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRACTICE_SPOTLIGHTS.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1220] p-5 shadow-2xs hover:border-[#0D9488]/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-brand font-bold text-xs px-2.5 py-0.5 rounded-md bg-[#142B4A]/10 dark:bg-[#0D9488]/15 text-[#142B4A] dark:text-teal-300 border border-[#142B4A]/20 dark:border-[#0D9488]/30">
                      {item.track}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-brand text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.quote}
                  </p>
                </div>
                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>{item.focus}</span>
                  <span className="text-[#0A6265] font-semibold">QuizNurse Standard</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FIND YOUR NEXT STUDY SET — Featured Programme Cards */}
      <section id="exam-tracks" className="py-16 sm:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] dark:text-teal-400">
              FIND YOUR NEXT STUDY SET
            </span>
            <h2 className="font-brand text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Start with the exam in front of you
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Pick a programme track, answer realistic clinical questions, and let your analytics guide what you review next.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "ATI TEAS 7 Prep",
                subtitle: "Nursing School Admissions",
                icon: Stethoscope,
                desc: "Master Reading, Mathematics, Science, and English & Language Usage with realistic TEAS 7 simulations and step-by-step rationales.",
                pills: ["TEAS 7 Blueprint", "3,000+ Questions", "Full Rationales"],
                pageHref: "/pages/exams/ati-teas",
                dashHref: "/dashboards/ati-teas",
                cta: "Open ATI TEAS Prep",
              },
              {
                title: "HESI A2 Admissions",
                subtitle: "Admissions & Specialty Edge",
                icon: HeartPulse,
                desc: "Prepare for every section of the HESI Admission Assessment with realistic timed tests, anatomy drills, and dosage math calculators.",
                pills: ["All Sections Covered", "4,500+ Questions", "Math Calculator"],
                pageHref: "/pages/exams/hesi-a2",
                dashHref: "/dashboards/hesi-a2",
                cta: "Open HESI A2 Prep",
              },
              {
                title: "RN Nursing Exams",
                subtitle: "Core Curriculum & Exit Banks",
                icon: GraduationCap,
                desc: "Follow your RN course sequence across Med-Surg, Pharmacology, Pediatrics, Maternity, and Comprehensive Exit Predictors.",
                pills: ["Course-Aligned", "NGN Included", "30,000+ Questions"],
                pageHref: "/pages/exams/rn-nursing",
                dashHref: "/dashboards/rn-nursing",
                cta: "Open RN Nursing",
              },
              {
                title: "LPN Nursing",
                subtitle: "Practical Nursing Mastery",
                icon: Layers,
                desc: "Excel in your LPN nursing courses and exit assessments with dedicated practical nursing test banks and clinical judgment drills.",
                pills: ["LPN Curriculum", "18,000+ Questions", "Exit Predictors"],
                pageHref: "/pages/exams/lpn-nursing",
                dashHref: "/dashboards/lpn-nursing",
                cta: "Open LPN Nursing",
              },
              {
                title: "RN Licensure Examination",
                subtitle: "Next Generation RN Preparation",
                icon: Award,
                desc: "Simulate the official clinical testing environment with unfolding case studies, bow-tie items, matrix grids, and adaptive analytics.",
                pills: ["NGN Case Studies", "Clinical Judgment", "Readiness Reports"],
                pageHref: "/pages/exams/nclex-rn",
                dashHref: "/dashboards/nclex-rn",
                cta: "Open RN Licensure",
              },
              {
                title: "LPN Licensure Examination",
                subtitle: "Practical Nurse Licensure",
                icon: ShieldCheck,
                desc: "Build licensure confidence for the practical nursing examination with targeted prioritization, coordinated care, pharmacology, and NGN item formats.",
                pills: ["LPN Test Plan", "Detailed Rationales", "8 Exam Themes"],
                pageHref: "/pages/exams/nclex-pn",
                dashHref: "/dashboards/nclex-pn",
                cta: "Open LPN Licensure",
              },
            ].map((track) => {
              const Icon = track.icon;
              return (
                <div
                  key={track.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111C2E] p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-2xs hover:border-[#0D9488]/50 hover:shadow-md transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-brand text-xl font-bold text-slate-900 dark:text-white">
                          {track.title}
                        </h3>
                        <p className="text-xs font-semibold text-[#0D9488]">
                          {track.subtitle}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {track.desc}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {track.pills.map((pill) => (
                        <span
                          key={pill}
                          className="px-3 py-1 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          • {pill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link
                      href={track.pageHref}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
                    >
                      Overview &amp; Plans
                    </Link>
                    <Link
                      href={track.dashHref}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#142B4A] hover:bg-[#0F2036] dark:bg-[#0D9488] dark:hover:bg-[#0F766E] px-3 text-xs font-semibold text-white transition-colors"
                    >
                      <span>Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. CHOOSE A STUDY SET — Interactive Filterable Study Sets Grid */}
      <section
        id="study-sets"
        className="py-16 sm:py-20 border-t border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC]/60 dark:bg-[#111C2E]/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
            <div className="space-y-2 max-w-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] dark:text-teal-400">
                CHOOSE A STUDY SET
              </span>
              <h2 className="font-brand text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                Find the exam you need today
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Browse by course, practice at your pace, and review the clinical reasoning behind every answer.
              </p>
            </div>

            <div className="w-full lg:w-96 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find Pharmacology, TEAS, Pediatrics, and more..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488] shadow-2xs"
              />
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 text-xs font-medium">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full border transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-[#142B4A] text-white border-[#142B4A] dark:bg-[#0D9488] dark:border-[#0D9488] font-semibold shadow-2xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#0D9488]/50 hover:text-slate-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>
              Showing {filteredSets.length} study set{filteredSets.length !== 1 ? "s" : ""}
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[#0D9488] hover:underline font-semibold"
              >
                Clear search filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSets.map((set) => (
              <div
                key={set.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 flex flex-col justify-between space-y-4 hover:border-[#0D9488]/50 hover:shadow-md transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">
                      {set.category}
                    </span>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ★ {set.badge}
                    </span>
                  </div>

                  <h3 className="font-brand text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-[#0D9488] transition-colors">
                    {set.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {set.examTrack} · {set.pathway}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-[#0D9488]" />
                      NGN-ready format
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                    <span>Detailed answer reasoning included</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Review, Practice &amp; Timed Exam modes</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1 line-clamp-3">
                    {set.description}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={set.examHref}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>View Track Overview</span>
                  </Link>

                  <Link
                    href={set.dashboardHref}
                    className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-[#142B4A] hover:bg-[#0F2036] dark:bg-[#0D9488] dark:hover:bg-[#0F766E] text-xs font-semibold text-white transition-colors"
                  >
                    <span className="truncate">Open Practice Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {filteredSets.length === 0 && (
            <div className="text-center py-12 space-y-3 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800">
              <Search className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="font-semibold text-slate-900 dark:text-white">
                No study sets match your query
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching for general terms like &quot;Pharmacology&quot;, &quot;TEAS&quot;, or select &quot;All&quot; categories.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 5. THE 3 CORE LEARNING MODES */}
      <section className="py-16 sm:py-20 border-t border-slate-200/80 dark:border-slate-800 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] dark:text-teal-400">
              PURPOSE-BUILT STUDY ENGINE
            </span>
            <h2 className="font-brand text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Built for How Nursing Students Truly Learn
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Unlike static quiz dumps, {APP_NAME} adapts to your immediate study goal—whether you are dissecting a complex clinical case or taking a proctored simulation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {learningModes.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.mode}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111C2E] p-6 sm:p-7 flex flex-col justify-between hover:border-[#0D9488]/50 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] dark:text-teal-300 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">
                        {m.badge}
                      </span>
                    </div>
                    <h3 className="font-brand text-lg font-bold text-slate-900 dark:text-white">
                      {m.mode}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                  <div className="pt-5">
                    <Link
                      href={m.href}
                      className="text-xs font-semibold text-[#0D9488] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Launch practice in {m.mode}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. CLINICAL JUDGMENT MEASUREMENT MODEL (NGN) */}
      <section className="py-16 sm:py-20 bg-[#F8FAFC] dark:bg-[#111C2E]/50 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">
                Clinical Judgment Measurement Model
              </span>
              <h2 className="font-brand text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Next Generation (NGN) Formats Fully Supported
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                Modern nursing assessments demand more than rote memorization. {APP_NAME}&apos;s 38-type question engine evaluates all six clinical judgment cognitive skills:
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium">
                {[
                  { num: "1", title: "Recognize Cues" },
                  { num: "2", title: "Analyze Cues" },
                  { num: "3", title: "Prioritize Hypotheses" },
                  { num: "4", title: "Generate Solutions" },
                  { num: "5", title: "Take Actions" },
                  { num: "6", title: "Evaluate Outcomes" },
                ].map((s) => (
                  <div
                    key={s.num}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1220] flex items-center gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#0D9488]/15 text-[#0D9488] flex items-center justify-center font-bold text-xs shrink-0">
                      {s.num}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1220] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Interactive Clinical Vignette
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Unfolding Case Study
                </span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Patient: M.K., 58yo Male · Post-Op Day 1 Total Knee Arthroplasty
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-[#F8FAFC] dark:bg-[#111C2E] p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  Patient presents with sudden-onset sharp pleuritic chest pain, tachypnea, and SpO2 88% on room air. Heart rate is 118 bpm, regular. Diminished breath sounds at right base.
                </p>
                <div className="p-3.5 rounded-xl bg-[#0D9488]/10 border border-[#0D9488]/20 text-slate-900 dark:text-slate-100">
                  <strong className="block mb-1 text-[#0D9488] font-bold">
                    Clinical Rationale Preview:
                  </strong>
                  Recognize sudden dyspnea, tachycardia, and pleuritic pain in an orthopedic surgical patient as high suspicion for acute Pulmonary Embolism (PE). Immediate priority: apply high-flow oxygen, elevate head of bed, and notify the rapid response team.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRIMARY CTA SECTION */}
      <section className="py-20 text-center bg-background border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="font-brand text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Begin Your Structured Nursing Preparation Today
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
            Experience the QuizNurse learning ecosystem, built from the ground up for nursing clarity, academic excellence, and clinical confidence.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href={startHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#0F2036] dark:bg-[#0D9488] dark:hover:bg-[#0F766E] px-8 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              <span>Start Practicing</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pages/entrance"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-8 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
            >
              Browse All Exam Tracks
            </Link>
          </div>
        </div>
      </section>

      {/* 8. INTEGRATED CONTACT & SUPPORT SECTION */}
      <Contact
        heading={`Have Questions About ${APP_NAME}?`}
        subheading="Reach out to our academic support team and we will respond promptly."
      />
    </div>
  );
}
