import type { Metadata } from "next";

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



const ScanInput = dynamic(() => import("@/components/landing/ScanInput"), {

  loading: () => (

    <div className="mx-auto max-w-xl animate-pulse rounded-xl border border-gray-800 bg-gray-900/50 p-8">

      <div className="h-10 rounded-lg bg-gray-800" />

    </div>

  ),

});



export const metadata: Metadata = {

  title: "Website Monitoring & Security — CyberShield",

  description:

    "Continuously monitor your website and know when something changes. SSL, uptime, security headers, and change detection — with alerts before issues affect customers.",

  openGraph: {

    title: "CyberShield — Continuous Website Monitoring",

    description:

      "Monitor SSL, uptime, security posture, and website changes. Get alerted before issues impact trust and revenue.",

    type: "website",

  },

};



export default function HomePage() {

  return (

    <div className="min-h-screen bg-[#0a0f1e]">

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

