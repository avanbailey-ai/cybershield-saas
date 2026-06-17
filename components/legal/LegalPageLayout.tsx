import type { ReactNode } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

interface LegalPageLayoutProps {
  title: string;
  children: ReactNode;
}

export default function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-24 sm:px-4">
        <h1 className="mb-8 text-3xl font-bold text-white">{title}</h1>
        <div className="space-y-6 text-base leading-relaxed text-gray-300">{children}</div>
        <p className="mt-10 text-sm text-gray-500">
          Questions?{' '}
          <Link href="/contact" className="text-blue-400 hover:text-blue-300">
            Contact support
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
