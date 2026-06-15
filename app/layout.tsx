import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CyberShield SaaS",
    template: "%s | CyberShield SaaS",
  },
  description:
    "Enterprise-grade cybersecurity monitoring platform. Protect your web assets with real-time threat detection and security scoring.",
  keywords: ["cybersecurity", "monitoring", "security", "SaaS", "web protection"],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0f1e] text-white antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
