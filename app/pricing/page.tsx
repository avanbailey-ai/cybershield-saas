import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Try your first scan free, then enable continuous protection. Most SMBs choose daily monitoring for live websites.',
  openGraph: {
    title: 'CyberShield Pricing — Continuous Protection',
    description: 'Start with a free scan. Enable protection when you\'re ready.',
    type: 'website',
  },
};

export const revalidate = 3600;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="pt-16">
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
