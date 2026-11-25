"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Users,
  FileText,
  Headphones,
} from "lucide-react";

const CJMM_STEPS = [
  { step: 1, title: "Recognize Cues", desc: "Identify relevant and important clinical data from patient chart and vitals" },
  { step: 2, title: "Analyze Cues", desc: "Connect client cues to pathophysiology and anticipate client needs" },
  { step: 3, title: "Prioritize Hypotheses", desc: "Rank client concerns by urgency, risk, and stability" },
  { step: 4, title: "Generate Solutions", desc: "Identify evidence-based interventions and expected outcomes" },
  { step: 5, title: "Take Action", desc: "Implement highest-priority nursing interventions safely" },
  { step: 6, title: "Evaluate Outcomes", desc: "Compare observed client findings against expected responses" },
];

export default function RNExamPathwayPage() {
  return (
    <PublicShell>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 mb-4">
            <Link href="/learner" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/nursing-exams" className="hover:underline">
              Exams
            </Link>
            <span>/</span>
            <span className="text-slate-700">RN Pathway</span>
          </div>

          {/* Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 p-8 sm:p-10 text-white shadow-xl mb-10">
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold mb-3">
              Registered Nurse (RN) Licensure & Exit Suite
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              RN Examination & Clinical Judgment Hub
            </h1>
            <p className="mt-3 text-base text-slate-300 max-w-2xl leading-relaxed">
              Master the Next Generation NCLEX-RN and high-stakes RN exit predictor examinations with full case studies, bowtie items, and clinical decision models.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/learner/rn">
                <Button className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-5 py-2.5">
                  Launch RN Exam Workspace
                </Button>
              </Link>
              <Link href="/learner/rn-exit">
                <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                  RN Exit & Predictors
                </Button>
              </Link>
              <Link href="/nclex/study">
                <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                  NCLEX Study Hub
                </Button>
              </Link>
            </div>
          </div>

          {/* Clinical Judgment Framework */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900">
              NCSBN Clinical Judgment Measurement Model (CJMM)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Every NGN item evaluates one of these six cognitive functions. QuizNurse test items mirror this exact structure.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CJMM_STEPS.map((s) => (
                <Card key={s.step} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-800 font-bold text-sm">
                      {s.step}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Integrated Study Assets Grid */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Integrated RN Preparation Tools</h2>
            <p className="mt-1 text-sm text-slate-600">
              Directly connected learning modules designed to accelerate your clinical reasoning:
            </p>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/mark-k">
                <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <Headphones className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900">Mark Klimek Lectures</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    12 high-yield audio lectures and yellow book study notes on Acid-Base, Cardiac, Maternity, and Prioritization.
                  </p>
                </Card>
              </Link>

              <Link href="/care-plans">
                <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900">Nursing Care Plans</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Over 50 evidence-based care plans categorized by body system with NANDA diagnoses, NOC goals, and NIC interventions.
                  </p>
                </Card>
              </Link>

              <Link href="/groups?track=NCLEX-RN">
                <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-rose-600" />
                    <h3 className="font-bold text-slate-900">RN Study Groups</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Join live virtual study pods targeting upcoming testing dates with shared question targets and peer accountability.
                  </p>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
