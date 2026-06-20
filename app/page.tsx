import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustBar from "@/components/landing/TrustBar";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import TrustSignals from "@/components/landing/TrustSignals";
import HealthCenterPreview from "@/components/landing/HealthCenterPreview";
import WebsiteMemory from "@/components/landing/WebsiteMemory";
import AgencySection from "@/components/landing/AgencySection";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LANDING_FAQS } from "@/lib/seo/faqs";
import { faqSchema } from "@/lib/seo/structured-data";

const ScanInput = dynamic(() => import("@/components/landing/ScanInput"), {
  loading: () => (
    <div className="mx-auto max-w-xl animate-pulse rounded-xl border border-gray-800 bg-gray-900/50 p-8">
      <div className="h-10 rounded-lg bg-gray-800" />
    </div>
  ),
});

export const metadata = buildPageMetadata({
  title: 'CyberShield Cloud — Website Security Monitoring for Businesses and Agencies',
  description:
    'Run a free website security scan, monitor security changes, receive alerts, and generate plain-English reports for your business or clients.',
  path: '/',
  keywords: [
    "website security monitoring",
    "website security scanner",
    "SSL monitoring",
    "website change detection",
    "website health monitoring",
    "website security alerts",
  ],
});

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0f1e]">
      <JsonLd data={faqSchema([...LANDING_FAQS])} />
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <ScanInput />
        <HealthCenterPreview />
        <Features />
        <WebsiteMemory />
        <HowItWorks />
        <TrustSignals />
        <AgencySection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
