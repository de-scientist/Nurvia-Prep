"use client";

import * as React from "react";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  Users,
  Sparkles,
  HeartPulse,
} from "lucide-react";

const PN_SCOPE_RULES = [
  {
    title: "Data Collection vs. Initial Assessment",
    rule: "LPNs collect clinical data and observe signs/symptoms. Comprehensive initial assessments and discharge evaluations remain RN responsibility.",
  },
  {
    title: "Client Stability & Predictability",
    rule: "LPNs provide direct care to stable clients with predictable health outcomes under the direction of an RN or physician.",
  },
  {
    title: "Medication Administration & IV Scope",
    rule: "LPNs administer oral, subcutaneous, and intramuscular medications. IV push medications and blood product administration are restricted by state practice acts.",
  },
  {
    title: "Care Planning Collaboration",
    rule: "LPNs actively contribute to and update the nursing care plan, reinforcing patient education originally established by the RN.",
  },
];

export default function LPNExamPathwayPage() {
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
            <span className="text-slate-700">LPN/LVN Pathway</span>
          </div>

          {/* Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-teal-900 to-slate-950 p-8 sm:p-10 text-white shadow-xl mb-10">
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold mb-3">
              Practical & Vocational Nurse (LPN / LVN) Suite
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              LPN/LVN Licensure & Scope Hub
            </h1>
            <p className="mt-3 text-base text-slate-300 max-w-2xl leading-relaxed">
              Targeted preparation for the NextGen NCLEX-PN, PN exit examinations, pharmacology math, and scope-of-practice decision questions.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/learner/pn">
                <Button className="rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-5 py-2.5">
                  Launch PN Exam Workspace
                </Button>
              </Link>
              <Link href="/learner/pn-exit">
                <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                  PN Exit Predictors
                </Button>
              </Link>
              <Link href="/learner/library?pathway=PN_LPN">
                <Button variant="outline" className="rounded-xl border-teal-300 text-teal-100 hover:bg-teal-800/40 font-semibold px-5 py-2.5">
                  PN Study Library
                </Button>
              </Link>
            </div>
          </div>

          {/* Scope of Practice Critical Rules */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900">
              NCLEX-PN Scope of Practice Guidelines
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Delegation and assignment questions on the NCLEX-PN test whether you understand the legal boundaries between RN, LPN, and UAP.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PN_SCOPE_RULES.map((item, idx) => (
                <Card key={idx} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-teal-800 font-bold text-sm">
                    <ShieldCheck className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.rule}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Link href="/groups?track=NCLEX-PN">
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                <Users className="h-5 w-5 text-rose-600 mb-2" />
                <h3 className="font-bold text-slate-900 text-sm">PN Study Groups</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Connect with fellow practical nursing candidates studying for upcoming test dates.
                </p>
              </Card>
            </Link>

            <Link href="/qotd">
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                <HeartPulse className="h-5 w-5 text-teal-600 mb-2" />
                <h3 className="font-bold text-slate-900 text-sm">Question of the Day</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Build daily testing stamina with daily clinical practice items and rationales.
                </p>
              </Card>
            </Link>

            <Link href="/insights">
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all h-full">
                <Sparkles className="h-5 w-5 text-amber-600 mb-2" />
                <h3 className="font-bold text-slate-900 text-sm">PN Pass Rates</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Review self-reported outcomes and high-yield resources for PN candidates.
                </p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
