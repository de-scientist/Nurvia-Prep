// Root Application Layout — QuizNurse Design System
import "./globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LeftSidebarProvider } from "@/lib/contexts/panel/layout/includes/sidebar/LeftSidebarContext";
import { RightSidebarProvider } from "@/lib/contexts/panel/layout/includes/sidebar/RightSidebarContext";
import { ThemeProvider } from "@/lib/contexts/panel/layout/theme/PanelThemeContext";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FeedbackProvider } from "@/lib/feedback/feedback-context";
import { AppInitializationSplash, RouteTransitionBar } from "@/components/shared/feedback";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://quiznurse.com"),
  title: "QuizNurse — Nursing Examination Preparation Platform",
  description:
    "QuizNurse is the premier nursing examination preparation and learning platform for NCLEX-RN, NCLEX-PN, ATI TEAS 7, HESI A2, and RN/LPN exit examinations.",
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/quiznurse-app-icon.svg",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "QuizNurse — Nursing Examination Preparation Platform",
    description: "Prepare with clinical confidence for NCLEX-RN, NCLEX-PN, ATI TEAS 7, and HESI A2 with QuizNurse.",
    url: "https://quiznurse.com",
    siteName: "QuizNurse",
    images: [
      {
        url: "/brand/quiznurse-social-preview.svg",
        width: 1200,
        height: 630,
        alt: "QuizNurse — Nursing Examination Preparation Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizNurse — Nursing Examination Preparation Platform",
    description: "Prepare with clinical confidence for NCLEX-RN, NCLEX-PN, ATI TEAS 7, and HESI A2 with QuizNurse.",
    images: ["/brand/quiznurse-social-preview.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`light ${plusJakartaSans.variable} ${inter.variable}`}>
      <body className="antialiased bg-background text-foreground selection:bg-[#0A6265] selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <LeftSidebarProvider>
                <RightSidebarProvider>
                  <Suspense fallback={null}>
                    <RouteTransitionBar />
                  </Suspense>
                  <AppInitializationSplash />
                  {children}
                </RightSidebarProvider>
              </LeftSidebarProvider>
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
