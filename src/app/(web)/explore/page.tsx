import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/config";
import { SITE_LINKS, SITE_URL } from "@/lib/config/siteLinks";

export const metadata: Metadata = {
  title: `Explore ${APP_NAME} – Nursing Licensure, TEAS, HESI, RN & LPN Exams`,
  description: `Quick links to ${APP_NAME}: RN, LPN, ATI TEAS 7, HESI A2, RN and LPN exams, pricing, sign in and registration.`,
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: SITE_LINKS.map((l, i) => ({
      "@type": "SiteNavigationElement",
      position: i + 1,
      name: l.name,
      description: l.description,
      url: `${SITE_URL}${l.href}`,
    })),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
          NURVIA Site Index
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-2">Explore {APP_NAME}</h1>
        <p className="text-slate-600 dark:text-slate-300">Everything you need for nursing exam success, in one place.</p>
      </div>
      <nav aria-label="Site directory">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SITE_LINKS.map((l) => (
            <li key={l.href} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 shadow-xs transition hover:border-[#0D9488]/50">
              <Link href={l.href} className="text-lg font-bold text-[#142B4A] dark:text-white hover:text-[#0D9488] transition-colors">
                {l.name}
              </Link>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{l.description}</p>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}