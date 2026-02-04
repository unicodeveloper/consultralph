import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthInitializer } from "@/app/components/auth/auth-initializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consulting Research Intelligence | AI-Powered Deep Research",
  description:
    "Generate comprehensive research reports for due diligence, market analysis, competitive landscapes, and strategic insights. Built for consultants at top firms.",
  keywords: [
    "consulting",
    "research",
    "due diligence",
    "market analysis",
    "competitive intelligence",
    "AI research",
    "business intelligence",
    "strategy consulting",
  ],
  openGraph: {
    title: "Consulting Research Intelligence",
    description:
      "AI-powered deep research for consultants. Generate comprehensive reports in minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthInitializer>{children}</AuthInitializer>
      </body>
    </html>
  );
}
