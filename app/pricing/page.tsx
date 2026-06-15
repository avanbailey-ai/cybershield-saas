import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'CyberShield plans from free scans to Pro, Growth, and Agency monitoring. Compare features and upgrade anytime.',
  openGraph: {
    title: 'CyberShield Pricing',
    description: 'Affordable security monitoring for every team size.',
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
