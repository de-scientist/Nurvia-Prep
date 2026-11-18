"use client";

import { useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/config";
import Annex from "@/app/(web)/auth/modals/Annex";
import { NurviaLogo } from "@/components/common/NurviaLogo";
import { ShieldCheck } from "lucide-react";

export default function Footer() {
  const [annexOpen, setAnnexOpen] = useState(false);

  return (
    <>
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Brand Column */}
            <div className="md:col-span-2 space-y-4">
              <NurviaLogo
                size="md"
                variant="full"
                label="NURVIA"
                subtitle="NURVIA-PREP"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
                {APP_NAME} provides structured nursing exam preparation, Next-Gen clinical
                judgment training, and personalized revision analytics across ATI TEAS,
                HESI A2, RN, LPN, and NCLEX licensure tracks.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
                <span>Evidence-based clinical education architecture</span>
              </div>
            </div>

            {/* Examination Tracks */}
            <div>
              <h4 className="font-brand font-bold text-sm text-slate-900 dark:text-white mb-3">
                Exam Tracks
              </h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/pages/exams/ati-teas" className="hover:text-[#0D9488] transition-colors">
                    ATI TEAS 7 Prep
                  </Link>
                </li>
                <li>
                  <Link href="/pages/exams/hesi-a2" className="hover:text-[#0D9488] transition-colors">
                    HESI A2 Admissions
                  </Link>
                </li>
                <li>
                  <Link href="/pages/exams/rn-nursing" className="hover:text-[#0D9488] transition-colors">
                    RN Nursing &amp; Exit
                  </Link>
                </li>
                <li>
                  <Link href="/pages/exams/lpn-nursing" className="hover:text-[#0D9488] transition-colors">
                    LPN / PN Nursing
                  </Link>
                </li>
                <li>
                  <Link href="/pages/exams/nclex-rn" className="hover:text-[#0D9488] transition-colors">
                    NCLEX-RN Licensure
                  </Link>
                </li>
                <li>
                  <Link href="/pages/exams/nclex-pn" className="hover:text-[#0D9488] transition-colors">
                    NCLEX-PN Licensure
                  </Link>
                </li>
              </ul>
            </div>

            {/* Learning Tools */}
            <div>
              <h4 className="font-brand font-bold text-sm text-slate-900 dark:text-white mb-3">
                Learning &amp; Study
              </h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/pages/entrance" className="hover:text-[#0D9488] transition-colors">
                    Study Track Selector
                  </Link>
                </li>
                <li>
                  <Link href="/pages/notes" className="hover:text-[#0D9488] transition-colors">
                    Nursing Study Notes
                  </Link>
                </li>
                <li>
                  <Link href="/pages/resources" className="hover:text-[#0D9488] transition-colors">
                    Resource Library
                  </Link>
                </li>
                <li>
                  <Link href="/pages/seek" className="hover:text-[#0D9488] transition-colors">
                    Advanced Search
                  </Link>
                </li>
                <li>
                  <Link href="/pages/live-sessions" className="hover:text-[#0D9488] transition-colors">
                    Live Review Sessions
                  </Link>
                </li>
                <li>
                  <Link href="/pages/social-groups" className="hover:text-[#0D9488] transition-colors">
                    Student Study Groups
                  </Link>
                </li>
              </ul>
            </div>

            {/* Platform & Support */}
            <div>
              <h4 className="font-brand font-bold text-sm text-slate-900 dark:text-white mb-3">
                Platform &amp; Support
              </h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/pages/about-us" className="hover:text-[#0D9488] transition-colors">
                    About {APP_NAME}
                  </Link>
                </li>
                <li>
                  <Link href="/pages/faqs" className="hover:text-[#0D9488] transition-colors">
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link href="/pages/reviews" className="hover:text-[#0D9488] transition-colors">
                    Student Reviews
                  </Link>
                </li>
                <li>
                  <Link href="/pages/contact-us" className="hover:text-[#0D9488] transition-colors">
                    Contact Support
                  </Link>
                </li>
                <li>
                  <Link href="/explore" className="hover:text-[#0D9488] transition-colors">
                    Site Directory
                  </Link>
                </li>
                <li>
                  <Link href="/pages/terms-of-service" className="hover:text-[#0D9488] transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/pages/privacy-policy" className="hover:text-[#0D9488] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
            <p className="font-medium text-slate-700 dark:text-slate-300">
              &copy; {new Date().getFullYear()} {APP_NAME} (NURVIA). All rights reserved. Your Path to Nursing Confidence.
            </p>

            <button
              type="button"
              onClick={() => setAnnexOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-[#0D9488] hover:text-[#0D9488]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Powered By {APP_NAME} Team
            </button>

            <p className="max-w-md text-center md:text-right text-[11px]">
              Disclaimer: {APP_NAME} is an independent educational preparation platform. Rationales and simulations are designed strictly for academic study.
            </p>
          </div>
        </div>
      </footer>

      <Annex isOpen={annexOpen} onClose={() => setAnnexOpen(false)} />
    </>
  );
}
