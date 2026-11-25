"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  Heart,
  BookOpen,
  Award,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Logo, QuizNurseLogo } from "@/components/brand/logo";

export type AuthMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "reset-password"
  | "verify";

interface PoemContent {
  heading: string;
  lines: string[];
  mobileSummary: string;
}

interface HighlightItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}

interface ModeStory {
  tag: string;
  image: string;
  imageAlt: string;
  poem: PoemContent;
  mission: string;
  highlights: HighlightItem[];
}

const AUTH_STORIES: Record<AuthMode, ModeStory> = {
  "sign-in": {
    tag: "QuizNurse Learner Sanctuary",
    image: "/web/auth/login/loginFoto.jpg",
    imageAlt: "Nursing professional reviewing patient charts with calm focus",
    poem: {
      heading: "Welcome back. Your next chapter begins here.",
      lines: [
        "Every lesson brings you closer to the nurse you're becoming.",
        "Welcome back.",
        "Your next chapter begins here.",
      ],
      mobileSummary: "Every lesson brings you closer to the nurse you're becoming. Welcome back. Your next chapter begins here.",
    },
    mission:
      "Every lesson brings you closer to the nurse you're becoming. Welcome back. Your next chapter begins here.",
    highlights: [
      {
        icon: Stethoscope,
        title: "Adaptive Clinical Sets",
        detail: "Structured Next-Gen clinical judgment, ATI TEAS, and HESI A2 simulations.",
      },
      {
        icon: BookOpen,
        title: "Evidence-Based Rationales",
        detail: "Deep physiological breakdowns for every question and option.",
      },
      {
        icon: ShieldCheck,
        title: "Protected Study Workspace",
        detail: "Encrypted sessions preserve your timed trials and notebook progress.",
      },
    ],
  },
  "sign-up": {
    tag: "Begin Your Nursing Calling",
    image: "/web/auth/register/registerFoto.jpg",
    imageAlt: "Nursing student in clinical lab practicing diagnostic care",
    poem: {
      heading: "Let's build your next chapter.",
      lines: [
        "Every great nursing journey begins with curiosity, courage and the willingness to learn.",
        "Let's build your next chapter.",
      ],
      mobileSummary: "Every great nursing journey begins with curiosity, courage and the willingness to learn. Let's build your next chapter.",
    },
    mission:
      "Every great nursing journey begins with curiosity, courage and the willingness to learn. Let's build your next chapter.",
    highlights: [
      {
        icon: Award,
        title: "Clinical Judgment Mastery",
        detail: "Master the 6 cognitive steps of the NCSBN Clinical Judgment Measurement Model.",
      },
      {
        icon: Heart,
        title: "Compassion Meets Rigor",
        detail: "Realistic multisystem case studies built by practicing nurse educators.",
      },
      {
        icon: Sparkles,
        title: "Lifetime Nursing Community",
        detail: "Collaborative study circles, mentor rationales, and verified prep cohorts.",
      },
    ],
  },
  "forgot-password": {
    tag: "Account Recovery & Care",
    image: "/web/auth/recovery/password/passwordFoto.jpg",
    imageAlt: "Nurse resting hands peacefully over notes in an educational library",
    poem: {
      heading: "Every journey deserves another beginning.",
      lines: [
        "Every journey deserves another beginning.",
        "Let's help you find your way back.",
      ],
      mobileSummary: "Every journey deserves another beginning. Let's help you find your way back.",
    },
    mission:
      "Every journey deserves another beginning. Let's help you find your way back.",
    highlights: [
      {
        icon: ShieldCheck,
        title: "Encrypted Single-Use Link",
        detail: "Dispatched straight to your verified email with expiration safeguards.",
      },
      {
        icon: BookOpen,
        title: "Unbroken Progress",
        detail: "All bookmarked questions, exam attempts, and personal notes remain secure.",
      },
      {
        icon: Heart,
        title: "Patient & Responsive Support",
        detail: "Our education support team is ready whenever you encounter an obstacle.",
      },
    ],
  },
  "reset-password": {
    tag: "Credential Renewal",
    image: "/web/auth/recovery/password/passwordFoto.jpg",
    imageAlt: "Healthcare candidate writing study goals under morning clinical light",
    poem: {
      heading: "Every journey deserves another beginning.",
      lines: [
        "Every journey deserves another beginning.",
        "Let's help you find your way back.",
      ],
      mobileSummary: "Every journey deserves another beginning. Let's help you find your way back.",
    },
    mission:
      "Every journey deserves another beginning. Let's help you find your way back.",
    highlights: [
      {
        icon: ShieldCheck,
        title: "Enforced Complexity",
        detail: "Safeguards your learner profile against unauthorized credential access.",
      },
      {
        icon: Award,
        title: "Immediate Session Re-entry",
        detail: "Authenticate instantly once your new credentials are saved.",
      },
      {
        icon: Stethoscope,
        title: "Continuous Clinical Readiness",
        detail: "Return directly to your active test bank or study guide without delay.",
      },
    ],
  },
  "verify": {
    tag: "Candidate Verification",
    image: "/auth/loginImage.jpg",
    imageAlt: "Candidate smiling with confidence in modern clinical learning hall",
    poem: {
      heading: "One small step brings your journey closer.",
      lines: [
        "One small step brings your learning journey closer to its destination.",
        "Confirm your email to continue.",
      ],
      mobileSummary: "One small step brings your learning journey closer to its destination. Confirm your email to continue.",
    },
    mission:
      "One small step brings your learning journey closer to its destination. Confirm your email to continue.",
    highlights: [
      {
        icon: ShieldCheck,
        title: "Trusted Nursing Community",
        detail: "Guarantees authentic peer cohorts and protected examination integrity.",
      },
      {
        icon: Sparkles,
        title: "One-Click Validation",
        detail: "Fast token confirmation via email link or secure numerical code.",
      },
      {
        icon: BookOpen,
        title: "Complete Access Unlocked",
        detail: "Instantly enables high-yield test banks, rationale filters, and exams.",
      },
    ],
  },
};

export interface AuthShellProps {
  mode: AuthMode;
  children: React.ReactNode;
  customHeading?: string;
  customDescription?: string;
}

export function AuthShell({ mode, children }: AuthShellProps) {
  const story = AUTH_STORIES[mode] || AUTH_STORIES["sign-in"];

  return (
    <PublicShell>
      <main
        id="main-content"
        className="mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-7xl items-center justify-center px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
      >
        {/* Unified Master Split-Screen Authentication Container */}
        <div className="relative w-full overflow-hidden rounded-3xl border border-border/80 bg-surface-elevated shadow-xl transition-all duration-300 lg:grid lg:min-h-[580px] lg:grid-cols-12 xl:min-h-[620px]">

          {/* ==============================================================
              LEFT PANEL — VISUAL STORYTELLING (Desktop & Tablet Split)
              Occupies 48% (col-span-6 or 5-6) on desktop
              ============================================================== */}
          <aside
            aria-label="QuizNurse Clinical Storytelling"
            className="relative hidden lg:col-span-5 lg:flex xl:col-span-5 flex-col justify-between overflow-hidden bg-clinical-slate p-6 lg:p-7 xl:p-9 text-white select-none"
          >
            {/* Background Nursing Photography with Smooth Image Reveal */}
            <div className="absolute inset-0 z-0">
              <Image
                src={story.image}
                alt={story.imageAlt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="auth-animate-image-reveal object-cover object-center filter saturate-[0.85] contrast-[1.05]"
              />

              {/* Rich Clinical Warmth Dual Overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(150deg, rgba(10, 98, 101, 0.92) 0%, rgba(25, 59, 66, 0.94) 48%, rgba(15, 32, 54, 0.98) 100%)",
                }}
              />

              {/* Subtle Ambient Radial Lighting */}
              <div className="auth-animate-pulse-glow absolute -top-24 -left-24 h-96 w-96 rounded-full bg-clinical-sage/20 blur-3xl pointer-events-none" />
              <div className="auth-animate-float-reverse absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-clinical-amber/15 blur-3xl pointer-events-none" />
            </div>

            {/* Floating Subtle Decorative Botanical / Clinical SVG Motifs */}
            <div
              className="auth-animate-float absolute top-16 right-10 z-10 pointer-events-none opacity-20"
              aria-hidden="true"
            >
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
                <path d="M 50 18 C 50 38, 70 50, 70 50 C 70 50, 50 62, 50 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="50" cy="50" r="6" fill="currentColor" />
              </svg>
            </div>

            <div
              className="auth-animate-float-reverse absolute bottom-36 left-8 z-10 pointer-events-none opacity-15"
              aria-hidden="true"
            >
              <svg width="84" height="84" viewBox="0 0 80 80" fill="none">
                <path
                  d="M10 40 Q 25 15, 40 40 T 70 40"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="40" cy="40" r="4" fill="currentColor" />
              </svg>
            </div>

            {/* TOP: Branding & Tag Pill */}
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <QuizNurseLogo variant="full" inverted={true} size="md" href="/" />

                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-clinical-mist backdrop-blur-md">
                  <Sparkles className="h-3 w-3 text-clinical-sand" aria-hidden="true" />
                  {story.tag}
                </span>
              </div>
            </div>

            {/* MIDDLE: Editorial Headline + Original Poetry Passage */}
            <div className="auth-animate-fade-in-up relative z-10 my-4 lg:my-5 xl:my-6 space-y-3.5 xl:space-y-4">
              <h2 className="font-brand text-xl xl:text-2xl font-extrabold leading-snug tracking-tight text-white">
                {story.poem.heading}
              </h2>

              {/* Original Poetry Passage with Clinical Warmth Styling */}
              <div className="relative rounded-2xl border-l-4 border-clinical-amber/90 bg-white/[0.08] p-3.5 xl:p-4.5 backdrop-blur-md shadow-inner">
                <blockquote className="space-y-1 font-serif italic text-xs xl:text-sm leading-relaxed text-clinical-mist/95">
                  {story.poem.lines.map((line, idx) => (
                    <p key={idx} className="tracking-wide">
                      {line}
                    </p>
                  ))}
                </blockquote>
                <p className="mt-2 text-[10px] font-sans font-medium uppercase tracking-widest text-clinical-sand/80">
                  — The Florence Nightingale Call to Knowledge
                </p>
              </div>

              {/* Small Supporting Purpose & Value Message */}
              <p className="text-xs xl:text-[13px] leading-relaxed text-white/80 max-w-lg">
                {story.mission}
              </p>
            </div>

            {/* BOTTOM: Trust Milestones */}
            <div className="relative z-10 border-t border-white/15 pt-3.5 xl:pt-4">
              <ul className="grid grid-cols-1 gap-2.5 xl:gap-3" role="list">
                {story.highlights.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white/10 text-clinical-sand">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-white">
                          {item.title}
                        </p>
                        <p className="text-[11px] leading-relaxed text-white/70">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* ==============================================================
              RIGHT PANEL — AUTHENTICATION FORMS (All Viewports)
              Occupies 52% (col-span-7) on desktop; full width on mobile/tablet
              ============================================================== */}
          <section
            aria-label="Authentication form"
            className="flex w-full flex-col justify-between bg-surface-elevated p-5 sm:p-7 lg:col-span-7 lg:p-7 xl:col-span-7 xl:p-9"
          >
            {/* Mobile / Tablet Compact Visual Storytelling Banner */}
            <div className="mb-3.5 lg:hidden">
              <div className="relative overflow-hidden rounded-2xl bg-clinical-slate p-3.5 sm:p-4 text-white shadow-md">
                {/* Background image & gradient overlay */}
                <div className="absolute inset-0 z-0">
                  <Image
                    src={story.image}
                    alt={story.imageAlt}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center opacity-30"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(10, 98, 101, 0.95) 0%, rgba(25, 59, 66, 0.98) 100%)",
                    }}
                  />
                </div>

                <div className="relative z-10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Logo variant="compact" size="sm" withLink={false} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-sand">
                      <Sparkles className="h-2.5 w-2.5" />
                      {story.tag}
                    </span>
                  </div>

                  <p className="font-serif italic text-xs leading-relaxed text-clinical-sand pt-0.5 border-l-2 border-clinical-amber pl-2">
                    {story.poem.mobileSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* Desktop Quick Header Indicator */}
            <div className="hidden lg:flex items-center justify-between pb-2 text-xs text-foreground-secondary border-b border-border/60 mb-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-clinical-teal">
                <CheckCircle2 className="h-3.5 w-3.5 text-clinical-teal" />
                Accredited Nursing Preparation Standards
              </span>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-foreground-muted">
                RN &amp; PN • ATI • HESI
              </span>
            </div>

            {/* Primary Form Children Slot */}
            <div className="auth-animate-fade-in-up w-full mx-auto max-w-md lg:max-w-lg flex-1 flex flex-col justify-center">
              {children}
            </div>

            {/* Bottom Security / Privacy Micro-Banner */}
            <footer className="mt-4 pt-3 border-t border-border/60 text-center text-xs text-foreground-muted">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1 font-medium text-foreground-secondary">
                  <ShieldCheck className="h-3.5 w-3.5 text-clinical-teal" />
                  256-bit Encrypted Transports
                </span>
                <span>•</span>
                <Link
                  href="/privacy"
                  className="hover:text-clinical-teal hover:underline transition-colors"
                >
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link
                  href="/terms"
                  className="hover:text-clinical-teal hover:underline transition-colors"
                >
                  Terms of Service
                </Link>
                <span>•</span>
                <Link
                  href="/faq"
                  className="hover:text-clinical-teal hover:underline transition-colors"
                >
                  Help & FAQ
                </Link>
              </div>
            </footer>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
