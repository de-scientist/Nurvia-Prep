"use client";

import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/config";
import { useState, useMemo } from "react";
import { useRelativeStrataPrograms } from "@/lib/hooks/nexus/strata/learning/programs/relative/useRelativeStrataPrograms";
import {
  useDiscreteDominionSubscriptionPackages,
  type DiscreteSubscriptionPackage,
  type UserSubscriptionPackage,
} from "@/lib/hooks/nexus/subscription/packages/dicreate/useDiscreteDominionSubscriptionPackages";
import SubscriptionItem from "@/app/(web)/pages/subscription/item/SubscriptionItem";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import {
  DollarSign,
  PlayCircle,
  BarChart3,
  Lightbulb,
  ClipboardList, Pill, HeartPulse, Baby, Brain, Users,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Wallet,
  ArrowRight,
  Repeat,
} from "lucide-react";

import {
  FaYoutube,
  FaInstagram,
  FaXTwitter,
  FaFacebookF,
  FaLinkedinIn,
} from "react-icons/fa6";

import AuthModal from "@/app/(web)/auth/modals/auth";
import Contact from "@/app/(web)/components/sections/Contact";
import { useRouter } from "next/navigation";

const DASHBOARD_NAME = "rn-nursing"; // Lowercase hyphened as per dashboard path expectation 
const PROGRAM_NAME = "RN NURSING";
const PARENT_TABLE_NAME = "program";
const PARENT_NAME = "RN_NURSING"; // Uppercase and Underscore as per backend program Segment column expectation

// Wire these up to real config/env values when available
const SOCIAL_LINKS = {
  youtube: "#",
  FaInstagram: "#",
  FaXTwitter: "#",
  FaFacebookF: "#",
  linkedin: "#",
};

// ─────────────────────────────────────────────────────────────
// Why Choose Section data
// ─────────────────────────────────────────────────────────────
const whyChooseFeatures = [
  {
    icon: DollarSign,
    color: "text-emerald-600",
    title: "Affordable Packages",
    text: "Flexible pricing so every student can prepare without breaking the bank.",
  },
  {
    icon: PlayCircle,
    color: "text-rose-600",
    title: "Video Explanations",
    text: "Step-by-step breakdowns for complex problems, explained by experts.",
  },
  {
    icon: BarChart3,
    color: "text-blue-600",
    title: "Subject Analysis",
    text: "Pinpoint strengths and weaknesses with in-depth subject performance insights.",
  },
  {
    icon: Lightbulb,
    color: "text-amber-600",
    title: "Adaptive Learning",
    text: "AI-driven study plans that adapt to your pace and focus where needed most.",
  },
];

// ─────────────────────────────────────────────────────────────
// What is {PROGRAM_NAME} Exam Section data
// ─────────────────────────────────────────────────────────────
const examSubjects = [
  {
    icon: ClipboardList,
    color: "text-blue-600",
    title: "Fundamentals & Health Assessment",
    points: [
      "Comprehensive head-to-toe assessment and clinical reasoning",
      "Nursing process, care planning, and evidence-based practice",
      "Patient safety, communication, and professional standards",
    ],
  },
  {
    icon: Pill,
    color: "text-emerald-600",
    title: "Pharmacology",
    points: [
      "Medication classes, mechanisms, and nursing implications",
      "Safe administration, calculations, and adverse effect management",
      "Patient education and monitoring of therapeutic outcomes",
    ],
  },
  {
    icon: HeartPulse,
    color: "text-rose-600",
    title: "Adult Health & Critical Care",
    points: [
      "Complex acute and chronic conditions across body systems",
      "Prioritization, delegation, and rapid response to deterioration",
      "Critical care concepts, monitoring, and emergency interventions",
    ],
  },
  {
    icon: Baby,
    color: "text-amber-600",
    title: "Maternal-Newborn & Pediatrics",
    points: [
      "Antepartum, intrapartum, postpartum, and newborn care",
      "Pediatric growth, development, and common childhood illnesses",
      "Family-centered care and age-appropriate interventions",
    ],
  },
  {
    icon: Brain,
    color: "text-purple-600",
    title: "Mental Health",
    points: [
      "Common psychiatric disorders and treatment approaches",
      "Therapeutic communication and crisis intervention",
      "Psychosocial assessment and patient advocacy",
    ],
  },
  {
    icon: Users,
    color: "text-teal-600",
    title: "Community Health & Leadership",
    points: [
      "Public health, disease prevention, and population health",
      "Leadership, delegation, and management of care teams",
      "Quality improvement, ethics, and healthcare policy",
    ],
  },
];


// ─────────────────────────────────────────────────────────────
// Subscription Card Helper Functions
// ─────────────────────────────────────────────────────────────

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatMoney = (amount?: number | null, currency?: string | null) => {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
};

const humanizeMinutes = (raw?: string | number | null) => {
  if (raw == null || raw === "") return null;
  const total = Number(raw);
  if (!Number.isFinite(total) || total <= 0) return typeof raw === "string" ? raw : null;

  const units: [string, number][] = [
    ["year", 525600],
    ["month", 43200],
    ["week", 10080],
    ["day", 1440],
    ["hour", 60],
  ];

  let remaining = Math.floor(total);
  const parts: string[] = [];

  for (const [label, size] of units) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
      remaining -= count * size;
    }
  }

  if (parts.length === 0) {
    const mins = Math.floor(total);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
  }

  return parts.join(", ");
};

function ActiveSubscriptionCard({
  pkg,
  sub,
  activeCount,
  dashboardName,
}: {
  pkg: DiscreteSubscriptionPackage;
  sub: UserSubscriptionPackage;
  activeCount: number;
  dashboardName: string;
}) {
  const isActive = sub.subscriptionStatus === "Active";
  const isPaid = sub.subscriptionHasPaid === "Yes";
  const isAutoRenew = sub.subscriptionAutoRenew === "Yes";
  const cycle = humanizeMinutes(pkg.priceDuration || pkg.duration);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#0D9488]/40 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] p-6 md:p-8 shadow-lg text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 border border-white/20 shadow-sm ${
              isActive ? "bg-[#0D9488]" : "bg-amber-600"
            }`}
          >
            {isActive ? (
              <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={1.75} />
            ) : (
              <XCircle className="w-8 h-8 text-white" strokeWidth={1.75} />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">
              Active Entitlement ({activeCount} Plan{activeCount === 1 ? "" : "s"})
            </p>
            <h3 className="text-xl md:text-2xl font-bold truncate mt-0.5">{pkg.name}</h3>
            {pkg.description && (
              <p className="text-xs text-slate-200/80 line-clamp-2 mt-1">{pkg.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isActive ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" : "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                }`}
              >
                {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                Status: {sub.subscriptionStatus ?? "—"}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isPaid ? "bg-teal-500/20 text-teal-200 border border-teal-400/30" : "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                }`}
              >
                {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                Paid: {sub.subscriptionHasPaid ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/15">
                <Repeat className="w-3 h-3" />
                Auto Renew: {isAutoRenew ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/dashboards/${dashboardName}`}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#142B4A] shadow-sm transition hover:bg-slate-100 shrink-0"
        >
          <span>Go to Dashboard</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-200">
            <CalendarDays className="w-3.5 h-3.5" /> Valid From
          </div>
          <p className="mt-1 text-sm font-semibold">{formatShortDate(sub.validFrom)}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-200">
            <CalendarDays className="w-3.5 h-3.5" /> Valid Until
          </div>
          <p className="mt-1 text-sm font-semibold">{formatShortDate(sub.validUntil)}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-200">
            <Wallet className="w-3.5 h-3.5" /> Plan Rate
          </div>
          <p className="mt-1 text-sm font-semibold">
            {formatMoney(pkg.amount, pkg.currency)}
            {cycle ? <span className="font-normal text-slate-300"> / {cycle}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function RnNursingPage() {
  const router = useRouter();
  const { user, loading } = useCurrentSystemUser();
  const isAuthenticated = !!user;

  // Active subscription for THIS program (ATI_TEAS)
  const { programs } = useRelativeStrataPrograms();
  const { filteredSubscriptionPackages } = useDiscreteDominionSubscriptionPackages({
    page: 1,
    perPage: 100,
    sortColumn: null,
    sortDirection: "asc",
  });

  const currentProgramGuidIds = useMemo(
    () => new Set(programs.filter((p) => p.segment === PARENT_NAME).map((p) => p.guidId)),
    [programs]
  );

  const myActiveSubscription = useMemo(() => {
    if (!isAuthenticated) return null;

    type PackageWithCluster = DiscreteSubscriptionPackage & {
      terminalClusterTableName?: string;
      terminalClusterGuidId?: string;
    };

    const active: { pkg: DiscreteSubscriptionPackage; sub: UserSubscriptionPackage }[] = [];

    filteredSubscriptionPackages.forEach((pkg) => {
      const p = pkg as PackageWithCluster;
      const matches =
        p.terminalClusterTableName === "strata_programs" &&
        !!p.terminalClusterGuidId &&
        currentProgramGuidIds.has(p.terminalClusterGuidId);

      if (!matches) return;

      pkg.userSubscriptions?.forEach((sub) => {
        if (sub.subscriptionStatus === "Active") active.push({ pkg, sub });
      });
    });

    if (active.length === 0) return null;
    return { ...active[0], activeCount: active.length };
  }, [filteredSubscriptionPackages, currentProgramGuidIds, isAuthenticated]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  const handleStartPractice = () => {
    if (loading) return;
    if (!isAuthenticated) {
      setAuthTab("login");
      setAuthOpen(true);
      return;
    }

    router.push(`/dashboards/${DASHBOARD_NAME}`);
  };

  return (
    <main className="bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-slate-100">
      {/* {PROGRAM_NAME} Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-[#F8FAFC] to-white dark:from-[#111C2E] dark:to-[#0B1220] py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-4">
                <span>NURVIA Clinical Programme Track</span>
                <span className="text-slate-400">•</span>
                <span>{PROGRAM_NAME}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white mb-4">
                {PROGRAM_NAME} Exam Prep with <span className="text-[#0D9488]">{APP_NAME}</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                {PROGRAM_NAME} Exam is your first step — and <strong className="text-[#0F172A] dark:text-white">{APP_NAME}</strong> has the clinical preparation you
                need to succeed. Boost your confidence, sharpen your skills, and get test-ready
                with realistic practice questions and rationales.
              </p>
              <p className="mb-6">
                <a href="#pricing" className="text-sm font-semibold text-[#0D9488] hover:text-[#0F766E] underline underline-offset-4">
                  Ready to get started? Explore study plans below →
                </a>
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStartPractice}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#1E3A5F] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition"
                >
                  <span>Start Practice Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("login");
                      setAuthOpen(true);
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 py-3.5 text-sm font-semibold text-[#0F172A] dark:text-slate-100 shadow-xs transition"
                  >
                    Sign In Now
                  </button>
                ) : (
                  <a
                    href="#pricing"
                    className="inline-flex items-center justify-center rounded-xl border border-[#0D9488]/40 bg-[#0D9488]/10 hover:bg-[#0D9488]/20 px-6 py-3.5 text-sm font-semibold text-[#0D9488] dark:text-teal-300 transition"
                  >
                    View Our Plans
                  </a>
                )}
              </div>
            </div>

            {/* Right Column (Image) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 shadow-lg overflow-hidden">
                <Image
                  src="/images/pages/exams/rn-nursing/hero.png"
                  alt={`${PROGRAM_NAME} Exam Prep`}
                  width={560}
                  height={420}
                  className="w-full h-auto object-cover rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview Banner */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1220] py-10 text-center">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] dark:text-white mb-3">
            Start your <span className="text-[#0D9488]">{PROGRAM_NAME} Exam</span> with {APP_NAME}
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300 mx-auto max-w-3xl leading-relaxed">
            At <strong>{APP_NAME}</strong>, we&apos;re committed to your clinical readiness. Our educators have crafted{" "}
            <strong>up-to-date {PROGRAM_NAME} resources</strong>, ensuring our practice exams mirror the latest blueprints and item formats.
          </p>
        </div>
      </section>

      {/* Pricing / Subscription Items */}
      <section id="pricing" className="py-12 bg-[#F8FAFC] dark:bg-[#111C2E]/60 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {myActiveSubscription ? (
            <ActiveSubscriptionCard
              pkg={myActiveSubscription.pkg}
              sub={myActiveSubscription.sub}
              activeCount={myActiveSubscription.activeCount}
              dashboardName={DASHBOARD_NAME}
            />
          ) : (
            <SubscriptionItem
              parentTableName={PARENT_TABLE_NAME}
              parentName={PARENT_NAME}
              dashboardName={DASHBOARD_NAME}
              heading={`${PROGRAM_NAME} Exam Prep Plans`}
              showSearch={false}
            />
          )}
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-14 bg-white dark:bg-[#0B1220] border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <a
              href="#contact"
              className="order-2 md:order-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Need Support?
            </a>

            <h2 className="order-1 md:order-2 text-center text-2xl md:text-3xl font-bold text-[#0F172A] dark:text-white">
              Why Choose Our <span className="text-[#0D9488]">{PROGRAM_NAME}</span> Track?
            </h2>

            <a
              href="#contact"
              className="order-3 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
            >
              Contact Us →
            </a>
          </div>

          <p className="text-base text-slate-600 dark:text-slate-300 mx-auto mb-10 max-w-3xl text-center leading-relaxed">
            At <strong>{APP_NAME}</strong>, we&apos;ve built a structured study plan designed
            to help you succeed on the {PROGRAM_NAME} test. With <strong>flexible study packages</strong>,{" "}
            <strong>step-by-step explanations</strong>, <strong>subject-level analytics</strong>, and{" "}
            <strong>adaptive learning</strong>, our programme ensures you focus where it matters most.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {whyChooseFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111C2E] p-6 text-left transition hover:border-[#0D9488]/40 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#142B4A]/5 dark:bg-white/5">
                    <Icon className={`w-6 h-6 ${f.color}`} />
                  </div>
                  <h5 className="font-bold text-[#0F172A] dark:text-white mb-1.5">{f.title}</h5>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What is This Exam Section */}
      <section className="py-14 bg-[#F8FAFC] dark:bg-[#111C2E]/40 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] dark:text-white mb-3">
              What is Covered on the <span className="text-[#0D9488]">{PROGRAM_NAME} Exam?</span>
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Understanding the blueprint and core domains of your {PROGRAM_NAME} Exam is the first step toward focused preparation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {examSubjects.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-6 text-left shadow-xs transition hover:border-[#0D9488]/40"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <h5 className="font-bold text-lg text-[#0F172A] dark:text-white">{s.title}</h5>
                  </div>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-1.5">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <Contact
        heading={`Questions About ${PROGRAM_NAME}?`}
        subheading="Send us a message and our academic support team will get back to you shortly."
        defaultCategory="other"
      />

      {/* Community Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 my-10">
        <div
          id="moreDetails"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111C2E] p-8 text-center"
        >
          <h2 className="font-bold text-2xl text-[#0F172A] dark:text-white mb-2">
            Join the {APP_NAME} {PROGRAM_NAME} Community
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-6">
            Connect with peers and nursing educators on Instagram, Facebook, and YouTube. Access daily rationales,
            stay motivated, and engage in discussions to boost your {PROGRAM_NAME} score.
          </p>

          <div className="flex justify-center gap-4">
            <a href={SOCIAL_LINKS.youtube} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-300 transition-colors">
              <FaYoutube className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.FaInstagram} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 hover:border-pink-300 transition-colors">
              <FaInstagram className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.FaXTwitter} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              <FaXTwitter className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.FaFacebookF} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 transition-colors">
              <FaFacebookF className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.linkedin} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-700 hover:border-blue-300 transition-colors">
              <FaLinkedinIn className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 flex justify-between max-w-7xl mx-auto">
        <Link href="/pages/contact-us" className="rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white px-5 py-2.5 text-sm font-semibold transition">
          Contact Us
        </Link>
        <Link href="/" className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-5 py-2.5 text-sm font-semibold transition">
          Back Home
        </Link>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialTab={authTab}
        redirectPath={`/dashboards/${DASHBOARD_NAME}`}
      />
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  Skewblanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────