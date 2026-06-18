import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { rootMetadata } from "@/lib/seo/metadata";
import {
  organizationSchema,
  softwareApplicationSchema,
  webSiteSchema,
} from "@/lib/seo/structured-data";
import "./globals.css";

export const metadata = rootMetadata;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0f1e] text-white antialiased">
        <JsonLd data={[organizationSchema(), webSiteSchema(), softwareApplicationSchema()]} />
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
