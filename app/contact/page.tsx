import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ContactEmailCard from '@/components/contact/ContactEmailCard';
import { buildPageMetadata } from '@/lib/seo/metadata';
import {
  SEO_OUTREACH_EMAIL,
  SEO_PARTNERS_EMAIL,
  SEO_SALES_EMAIL,
  SEO_SUPPORT_EMAIL,
} from '@/lib/seo/constants';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact CyberShield Cloud',
  description:
    'Contact CyberShield Cloud for support, sales, partnerships, and outreach.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-5">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">Contact CyberShield Cloud</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-400">
            Choose the right inbox for your question. We respond to support and sales inquiries as quickly
            as possible during business hours.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ContactEmailCard
            title="Support"
            email={SEO_SUPPORT_EMAIL}
            description="Billing, account access, scan and report questions, and technical help."
          />
          <ContactEmailCard
            title="Sales"
            email={SEO_SALES_EMAIL}
            description="Plan questions, demos, business accounts, and enterprise pricing."
          />
          <ContactEmailCard
            title="Partners"
            email={SEO_PARTNERS_EMAIL}
            description="Agencies, web developers, referral partners, and education pilots."
          />
          <ContactEmailCard
            title="Outreach"
            email={SEO_OUTREACH_EMAIL}
            description="Campaigns, local business outreach, and community partnerships."
          />
        </div>

        <div id="partners" className="mt-10 rounded-xl border border-gray-800 bg-gray-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Enterprise &amp; security reviews</h2>
          <p className="mt-2 text-sm text-gray-400">
            For custom monitoring, larger limits, or a formal security review request, use the{' '}
            <a href="/enterprise/review" className="text-blue-400 hover:text-blue-300">
              Request Security Review
            </a>{' '}
            form or email{' '}
            <a href={`mailto:${SEO_SALES_EMAIL}`} className="text-blue-400 hover:text-blue-300">
              {SEO_SALES_EMAIL}
            </a>
            .
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Signed-in users can also report product issues from the Report a Problem widget in the dashboard.
        </p>
      </main>
      <Footer />
    </div>
  );
}
