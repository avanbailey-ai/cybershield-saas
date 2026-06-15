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



const ScanInput = dynamic(() => import("@/components/landing/ScanInput"), {

  loading: () => (

    <div className="mx-auto max-w-xl animate-pulse rounded-xl border border-gray-800 bg-gray-900/50 p-8">

      <div className="h-10 rounded-lg bg-gray-800" />

    </div>

  ),

});



const Pricing = dynamic(() => import("@/components/landing/Pricing"), {

  loading: () => <div className="h-96 animate-pulse bg-gray-900/30" />,

});



export const metadata: Metadata = {

  title: "Free Website Security Scanner",

  description:

    "Scan any website for free. Get an instant security score, SSL check, and vulnerability preview with CyberShield.",

  openGraph: {

    title: "CyberShield — Free Website Security Scanner",

    description: "Instant security score and vulnerability preview for any website.",

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

        <Features />

        <HowItWorks />

        <Pricing />

        <FAQ />

        <CTA />

      </main>

      <Footer />

    </div>

  );

}

