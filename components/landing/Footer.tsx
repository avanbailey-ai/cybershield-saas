import Link from "next/link";
import TrustSignals from "@/components/enterprise/TrustSignals";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-10 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
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

          <div className="flex items-center gap-5">
            <Link href="/enterprise/pricing" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Enterprise
            </Link>
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
