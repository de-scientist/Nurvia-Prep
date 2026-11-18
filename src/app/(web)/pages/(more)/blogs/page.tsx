"use client";

import Link from "next/link";
import {
    ClipboardList,
    Stethoscope,
    HeartPulse,
    GraduationCap,
    Award,
    BookOpen,
    Syringe,
    School,
    ArrowRight,
    Layers,
    LucideIcon,
} from "lucide-react";
import { useRelativeStrataPrograms } from "@/lib/hooks/nexus/strata/learning/programs/relative/useRelativeStrataPrograms";

// ─────────────────────────────────────────────────────────────────────────────
// Segment → presentation mapping (icons/colors aren't stored in the DB,
// so we key visual presentation off the known segment enum values)
// ─────────────────────────────────────────────────────────────────────────────
interface SegmentPresentation {
    icon: LucideIcon;
    accent: string; // gradient classes for the icon badge
    ring: string;   // hover ring color
}

const SEGMENT_PRESENTATION: Record<string, SegmentPresentation> = {
    ATI_TEAS: { icon: ClipboardList, accent: "from-indigo-500 to-indigo-700", ring: "hover:ring-indigo-400" },
    HESI_A2: { icon: Stethoscope, accent: "from-sky-500 to-sky-700", ring: "hover:ring-sky-400" },
    RN_NURSING: { icon: HeartPulse, accent: "from-rose-500 to-rose-700", ring: "hover:ring-rose-400" },
    LPN_NURSING: { icon: Syringe, accent: "from-emerald-500 to-emerald-700", ring: "hover:ring-emerald-400" },
    PRE_NURSING: { icon: School, accent: "from-amber-500 to-amber-700", ring: "hover:ring-amber-400" },
    CERTIFICATION: { icon: Award, accent: "from-purple-500 to-purple-700", ring: "hover:ring-purple-400" },
    GED: { icon: GraduationCap, accent: "from-teal-500 to-teal-700", ring: "hover:ring-teal-400" },
    CNA: { icon: BookOpen, accent: "from-orange-500 to-orange-700", ring: "hover:ring-orange-400" },
};

const DEFAULT_PRESENTATION: SegmentPresentation = {
    icon: Layers,
    accent: "from-slate-500 to-slate-700",
    ring: "hover:ring-slate-400",
};

const SEGMENT_DASHBOARD_MAP: Record<string, string> = {
  ATI_TEAS: 'ati-teas',
  HESI_A2: 'hesi-a2',
  PRE_NURSING: 'pre-nursing',
  RN_NURSING: 'rn-nursing',
  LPN_NURSING: 'lpn-nursing',
  NCLEX_RN: 'nclex-rn',
  NCLEX_PN: 'nclex-pn',
  CERTIFICATION: 'certification',
};

const SEGMENT_ORDER = [
    "ATI_TEAS",
    "HESI_A2",
    "PRE_NURSING",
    "RN_NURSING",
    "LPN_NURSING",
    "GED",
    "CNA",
    "CERTIFICATION",
] as const;

export default function EntrancePage() {
    const { programs, isLoading } = useRelativeStrataPrograms();

    // Order programs to match the intended display order, unknown segments fall to the end
    const orderedPrograms = [...programs].sort((a, b) => {
        const aIndex = SEGMENT_ORDER.indexOf((a.segment ?? "") as (typeof SEGMENT_ORDER)[number]);
        const bIndex = SEGMENT_ORDER.indexOf((b.segment ?? "") as (typeof SEGMENT_ORDER)[number]);
        const aRank = aIndex === -1 ? SEGMENT_ORDER.length : aIndex;
        const bRank = bIndex === -1 ? SEGMENT_ORDER.length : bIndex;
        return aRank - bRank;
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12 sm:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
                        NURVIA Clinical Guides & Articles
                    </div>
                    <h1 className="text-3xl font-extrabold text-[#0F172A] dark:text-white sm:text-4xl">
                        Where would you like to Start Reading?
                    </h1>
                    <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                        Pick a clinical track below to jump into practice exams, study resources, and progress tracking built for that path.
                    </p>
                </div>

                {isLoading && (
                    <p className="text-center text-slate-500 dark:text-slate-400">Loading Programs…</p>
                )}

                {!isLoading && orderedPrograms.length === 0 && (
                    <p className="text-center text-slate-500 dark:text-slate-400">No Programs Found</p>
                )}

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {orderedPrograms.map((program) => {
                        const segment = program.segment ?? "";
                        const presentation = SEGMENT_PRESENTATION[segment] ?? DEFAULT_PRESENTATION;
                        const Icon = presentation.icon;

                        const dashboardSlug = SEGMENT_DASHBOARD_MAP[segment];
                        if (!dashboardSlug) return null;

                        const accessHref = `/dashboards/${dashboardSlug}`;
                        const subscriptionsHref = `/pages/exams/${dashboardSlug}`;

                        return (
                            <div
                                key={program.guidId}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D9488]/50 hover:shadow-md"
                            >
                                {/* Featured badge */}
                                {program.isFeatured && (
                                    <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0D9488] dark:text-teal-300">
                                        Featured
                                    </div>
                                )}

                                <div>
                                    {/* Icon + Name on the same row */}
                                    <div className="mb-3 flex items-center gap-3 pr-16">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#142B4A] text-white shadow-xs">
                                            <Icon size={22} />
                                        </div>
                                        <h2 className="text-lg font-bold leading-snug text-[#0F172A] dark:text-white">
                                            {program.name}
                                        </h2>
                                    </div>

                                    {/* Description */}
                                    {program.description && (
                                        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                            {program.description}
                                        </p>
                                    )}

                                    {/* Meta row — courses count + level, if present */}
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {typeof program.coursesCount === "number" && (
                                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {program.coursesCount} Course{program.coursesCount !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                        {program.level && (
                                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {program.level}
                                            </span>
                                        )}
                                        {program.difficulty && (
                                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {program.difficulty}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Action row — two buttons side by side */}
                                <div className="mt-6 grid grid-cols-2 gap-2.5">
                                    <Link
                                        href={subscriptionsHref}
                                        className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-[#0D9488] hover:text-[#0D9488]"
                                    >
                                        Start Reading
                                    </Link>

                                    <Link
                                        href={accessHref}
                                        className="flex items-center justify-center gap-1.5 rounded-xl bg-[#142B4A] hover:bg-[#1E3A5F] px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition"
                                    >
                                        Open Exams
                                        <ArrowRight
                                            size={14}
                                            className="transition-transform group-hover:translate-x-0.5"
                                        />
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  Skewblanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────