import type { Metadata } from 'next';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ScanInput from '@/components/landing/ScanInput';
import ReportProblemWidget from '@/components/beta/ReportProblemWidget';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Free Website Security Scan — CyberShield Cloud',
  description:
    'Scan your website for common security issues and get a plain-English security score and risk summary.',
  path: '/scan',
});

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar />
      <main className="pt-16">
        <ScanInput showUpgradeCta />
      </main>
      <Footer />
      <ReportProblemWidget />
    </div>
  );
}
