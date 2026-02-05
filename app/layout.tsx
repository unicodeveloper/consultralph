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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://consulting-research.valyu.network"
  ),
  title: "Consult Ralph | AI-Powered Deep Research for Consultants",
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
  authors: [{ name: "Consulting Research Intelligence" }],
  creator: "Consulting Research Intelligence",
  publisher: "Consulting Research Intelligence",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Consult Ralph | AI-Powered Deep Research",
    description:
      "Generate comprehensive research reports in minutes. AI-powered deep research for due diligence, market analysis, and competitive intelligence. Built for consultants at top firms.",
    type: "website",
    siteName: "Consult Ralph",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Consult Ralph - AI-Powered Deep Research",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Consult Ralph | AI-Powered Deep Research",
    description:
      "Generate comprehensive research reports in minutes. AI-powered deep research for due diligence, market analysis, and competitive intelligence.",
    creator: "@valaboratory",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
