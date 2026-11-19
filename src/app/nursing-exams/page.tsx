"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  GraduationCap,
  Award,
  ArrowRight,
} from "lucide-react";

interface ExamDirectoryItem {
  id: string;
  name: string;
  category: "Licensure" | "Exit & Predictor" | "Entrance" | "Certification";
  tagline: string;
  format: string;
  questionCount: string;
  timeLimit: string;
  passingStandard: string;
  description: string;
  workspaceUrl: string;
  studyTrack: string;
  ngnEnabled: boolean;
}

const EXAM_DIRECTORY: ExamDirectoryItem[] = [
  {
    id: "nclex-rn",
    name: "NCLEX-RN (Next Generation NCLEX)",
    category: "Licensure",
    tagline: "National Council Licensure Examination for Registered Nurses",
    format: "Computerized Adaptive Testing (CAT)",
    questionCount: "85 – 150 Questions",
    timeLimit: "5 Hours",
    passingStandard: "Logit Standard (Clinical Judgment Model)",
    description: "The primary licensure examination for registered nurses in the United States and Canada. Features NextGen NGN case studies, bowtie questions, trend items, and matrix grids.",
    workspaceUrl: "/learner/rn",
    studyTrack: "NCLEX-RN",
    ngnEnabled: true,
  },
  {
    id: "nclex-pn",
    name: "NCLEX-PN (Practical Nurse Licensure)",
    category: "Licensure",
    tagline: "National Council Licensure Examination for Practical/Vocational Nurses",
    format: "Computerized Adaptive Testing (CAT)",
    questionCount: "85 – 150 Questions",
    timeLimit: "5 Hours",
    passingStandard: "Logit Standard (Scope-of-Practice Focused)",
    description: "Evaluates the clinical judgment of prospective licensed practical/vocational nurses with emphasis on directed care, stable patients, data collection, and safety.",
    workspaceUrl: "/learner/pn",
    studyTrack: "NCLEX-PN",
    ngnEnabled: true,
  },
  {
    id: "hesi-exit",
    name: "HESI Exit Exam (RN & PN)",
    category: "Exit & Predictor",
    tagline: "Health Education Systems Inc. Comprehensive Exit Examination",
    format: "Standard Linear / Specialty Computerized",
    questionCount: "150 – 160 Questions",
    timeLimit: "4 Hours",
    passingStandard: "HESI Score 850 – 900+ (Predictive Benchmark)",
    description: "Used by over 80% of nursing schools to predict first-time NCLEX success and evaluate readiness before degree conferral. Thoroughly covers all major clinical areas.",
    workspaceUrl: "/learner/rn-exit",
    studyTrack: "HESI Exit",
    ngnEnabled: true,
  },
  {
    id: "ati-predictor",
    name: "ATI Comprehensive Predictor",
    category: "Exit & Predictor",
    tagline: "Assessment Technologies Institute RN & PN Predictor Examination",
    format: "Proctored Computer-Based Assessment",
    questionCount: "180 Questions (150 Scored)",
    timeLimit: "3 Hours 45 Min",
    passingStandard: "Predictability Probability (90%+ NCLEX Probability)",
    description: "High-stakes end-of-program examination assessing mastery of Nursing Care of Children, Adult Med-Surg, Maternal Newborn, Pharmacology, Leadership, and Mental Health.",
    workspaceUrl: "/learner/rn-exit",
    studyTrack: "ATI Predictor",
    ngnEnabled: true,
  },
  {
    id: "teas-7",
    name: "ATI TEAS Version 7",
    category: "Entrance",
    tagline: "Test of Essential Academic Skills for Nursing School Admissions",
    format: "Multiple Choice & Alternate Item Formats",
    questionCount: "170 Questions",
    timeLimit: "209 Minutes",
    passingStandard: "Institution-Specific (Typically 65% – 75%+)",
    description: "Standardized prerequisite exam evaluating readiness across Reading, Mathematics, Science (Anatomy & Physiology, Biology, Chemistry), and English Language Usage.",
    workspaceUrl: "/learner/library?category=TEAS",
    studyTrack: "TEAS",
    ngnEnabled: false,
  },
  {
    id: "hesi-a2",
    name: "HESI Admission Assessment (A2)",
    category: "Entrance",
    tagline: "Pre-admission exam for prospective nursing and allied health students",
    format: "Section-Based Computerized Test",
    questionCount: "Up to 326 Questions across 8 Modules",
    timeLimit: "4 – 5 Hours",
    passingStandard: "Institution-Specific (75% – 85%+ Per Subtest)",
    description: "Evaluates academic skills in Math, Reading Comprehension, Vocabulary, Grammar, Biology, Chemistry, Anatomy & Physiology, and Learner Learning Style.",
    workspaceUrl: "/learner/library?category=HESI-A2",
    studyTrack: "HESI A2",
    ngnEnabled: false,
  },
  {
    id: "nmc-cbt",
    name: "UK NMC CBT (Test of Competence 21)",
    category: "Licensure",
    tagline: "UK Nursing and Midwifery Council Computer Based Test",
    format: "Part A (Numeracy) + Part B (Clinical Theory)",
    questionCount: "115 Questions (15 Numeracy + 100 Theory)",
    timeLimit: "3 Hours",
    passingStandard: "Pass on both Part A and Part B independently",
    description: "Evaluates international registered nurses seeking registration in the United Kingdom based on the current NMC standards of proficiency and Code of Ethics.",
    workspaceUrl: "/learner/library?category=NMC-CBT",
    studyTrack: "NMC CBT",
    ngnEnabled: false,
  },
  {
    id: "nck-licensure",
    name: "NCK Licensure Examination",
    category: "Licensure",
    tagline: "Nursing Council of Kenya National Licensure Assessment",
    format: "General Nursing Paper + Specialty Assessment",
    questionCount: "100 – 150 Questions",
    timeLimit: "3 Hours",
    passingStandard: "50% Aggregate Pass Standard",
    description: "National examination for KRCHN, BScN, and KRN candidates testing comprehensive clinical knowledge, pharmacology, community health, and obstetric management.",
    workspaceUrl: "/learner/library?category=NCK",
    studyTrack: "NCK Licensure",
    ngnEnabled: false,
  },
  {
    id: "ccrn",
    name: "CCRN (Adult Critical Care)",
    category: "Certification",
    tagline: "AACN Critical Care Registered Nurse Specialty Certification",
    format: "Computerized Linear",
    questionCount: "150 Questions (125 Scored)",
    timeLimit: "3 Hours",
    passingStandard: "Cut-score 83/125 correct items",
    description: "Specialty board certification validating acute and critical care nursing practice with emphasis on clinical judgment (80%) and professional caring/ethics (20%).",
    workspaceUrl: "/learner/library?category=CCRN",
    studyTrack: "CCRN",
    ngnEnabled: false,
  },
];

export default function NursingExamsDirectoryPage() {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");

  const categories = ["All", "Licensure", "Exit & Predictor", "Entrance", "Certification"];

  const filteredExams = EXAM_DIRECTORY.filter((exam) => {
    if (selectedCategory === "All") return true;
    return exam.category === selectedCategory;
  });

  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 mb-4">
            <Link href="/learner" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-700">Exam Directory</span>
          </div>

          {/* Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 sm:p-10 text-white shadow-xl mb-10">
            <div className="max-w-3xl">
              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold mb-3">
                Official Exam Blueprints & Practice Portals
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                Comprehensive Nursing Examination Directory
              </h1>
              <p className="mt-3 text-base text-slate-300 leading-relaxed">
                Explore testing specifications, question formats, passing thresholds, and official prep suites for licensure, exit predictors, and admissions across the US, UK, Canada, and East Africa.
              </p>

              {/* Dedicated Pathway Jump Links */}
              <div className="mt-6 flex flex-wrap items-center gap-4 pt-4 border-t border-teal-800/60">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  Specialized Tracks:
                </span>
                <Link
                  href="/nursing-exams/rn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-400/40 px-3.5 py-1.5 text-xs font-semibold text-teal-100 transition-colors"
                >
                  <GraduationCap className="h-4 w-4 text-teal-300" />
                  Registered Nurse (RN) Pathway →
                </Link>
                <Link
                  href="/nursing-exams/lpn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-400/40 px-3.5 py-1.5 text-xs font-semibold text-teal-100 transition-colors"
                >
                  <Award className="h-4 w-4 text-teal-300" />
                  Practical Nurse (LPN/LVN) Pathway →
                </Link>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-teal-700 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat} {cat === "All" ? `(${EXAM_DIRECTORY.length})` : ""}
                </button>
              );
            })}
          </div>

          {/* Exam Cards Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="group flex flex-col justify-between rounded-2xl border-slate-200 bg-white p-6 shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-semibold text-teal-800 bg-teal-50 border-teal-200">
                          {exam.category}
                        </Badge>
                        {exam.ngnEnabled && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] font-bold">
                            NextGen NGN Cases
                          </Badge>
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                        {exam.name}
                      </h2>
                      <p className="text-xs font-medium text-slate-500">{exam.tagline}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                    {exam.description}
                  </p>

                  {/* Spec Sheet Table */}
                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Testing Format</span>
                      <span className="font-semibold text-slate-800">{exam.format}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Question Count</span>
                      <span className="font-semibold text-slate-800">{exam.questionCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Time Limit</span>
                      <span className="font-semibold text-slate-800">{exam.timeLimit}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Passing Standard</span>
                      <span className="font-semibold text-slate-800">{exam.passingStandard}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Link
                      href={`/groups?track=${encodeURIComponent(exam.studyTrack)}`}
                      className="text-slate-600 hover:text-teal-700 font-semibold"
                    >
                      Study Groups
                    </Link>
                    <span className="text-slate-300">•</span>
                    <Link
                      href="/insights"
                      className="text-slate-600 hover:text-teal-700 font-semibold"
                    >
                      Pass Rates
                    </Link>
                  </div>

                  <Link href={exam.workspaceUrl}>
                    <Button className="rounded-xl bg-[#0A5C66] text-white hover:bg-[#084c55] text-xs font-bold px-4 py-2 inline-flex items-center gap-1.5">
                      Launch Practice Workspace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
