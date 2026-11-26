import Navbar from "@/app/(web)/includes/navbar";
import Footer from "@/app/(web)/includes/footer";
import type { Metadata } from "next";
import ScrollToTopButton from "@/components/common/ScrollToTopButton";
import Whastapp from "@/app/(web)/includes/partials/Whastapp";
import { APP_NAME } from "@/lib/config/config";
import Tawkto from "@/app/(web)/includes/partials/Tawkto";
import { SITE_URL, SITE_LINKS } from "@/lib/config/siteLinks";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — RN, LPN, ATI TEAS 7, HESI A2 & Nursing Exam Prep`,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_NAME} is the premier clinical exam preparation platform for nursing learners: RN, LPN, ATI TEAS 7, HESI A2, and clinical nursing Q-Banks.`,
  applicationName: APP_NAME,
  robots: { index: true, follow: true },
  openGraph: { siteName: APP_NAME, type: "website", url: SITE_URL, title: APP_NAME },
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    alternateName: APP_NAME.replace(/\s/g, ""),
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/quiznurse-logo-light.svg`,
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: SITE_LINKS.map((l, i) => ({
      "@type": "SiteNavigationElement",
      position: i + 1,
      name: l.name,
      url: `${SITE_URL}${l.href}`,
    })),
  },
];

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <Navbar />
      <main className="flex-1 w-full">{children}</main>
      <Footer />
      <ScrollToTopButton />
      <Whastapp />
      <Tawkto />
    </div>
  );
}
