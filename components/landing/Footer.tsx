import Link from "next/link";
import TrustSignals from "@/components/enterprise/TrustSignals";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-10 md:px-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 sm:mb-8">
          <TrustSignals compact />
        </div>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white">CyberShield</span>
            </div>
            <p className="text-xs text-gray-600">Security monitoring for modern businesses.</p>
          </div>

          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CyberShield SaaS. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Home
            </Link>
            <Link href="/scan" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Free Scan
            </Link>
            <Link href="/pricing" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Pricing
            </Link>
            <Link href="/about" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              About
            </Link>
            <Link href="/contact" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Contact
            </Link>
            <Link href="/enterprise/review" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Request Security Review
            </Link>
            <Link href="/features" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Features
            </Link>
            <Link href="/terms" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Terms
            </Link>
            <Link href="/privacy" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Privacy
            </Link>
            <Link href="/security" className="text-xs text-gray-500 transition-colors hover:text-gray-300">
              Security
            </Link>
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
