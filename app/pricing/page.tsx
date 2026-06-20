import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'CyberShield Pricing — Website Security Monitoring Plans',
  description:
    'Compare Pro, Growth, and Agency plans for website security monitoring, alerts, reports, and agency client reporting.',
  path: '/pricing',
});

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
