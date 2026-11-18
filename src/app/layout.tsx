// Root Application Layout — NURVIA Design System
import "./globals.css";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import type { Metadata } from "next";
import { LeftSidebarProvider } from "@/lib/contexts/panel/layout/includes/sidebar/LeftSidebarContext";
import { RightSidebarProvider } from "@/lib/contexts/panel/layout/includes/sidebar/RightSidebarContext";
import { ThemeProvider } from "@/lib/contexts/panel/layout/theme/PanelThemeContext";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FeedbackProvider } from "@/lib/feedback/feedback-context";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-brand",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nurvia-Prep — Your Path to Nursing Confidence",
  description:
    "NURVIA comprehensive nursing education and exam-preparation platform for ATI TEAS, HESI A2, RN, LPN, NCLEX-RN, and NCLEX-PN.",
  icons: {
    icon: "/brand/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body className="antialiased bg-background text-foreground selection:bg-[#0D9488] selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <LeftSidebarProvider>
                <RightSidebarProvider>
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
