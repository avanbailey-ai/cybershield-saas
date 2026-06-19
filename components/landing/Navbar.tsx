import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <ShieldIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">CyberShield</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/features" className="hidden text-sm text-gray-400 hover:text-white lg:inline">
            Features
          </Link>
          <Link href="/#health-center" className="hidden text-sm text-gray-400 hover:text-white lg:inline">
            Health Center
          </Link>
          <Link href="/#agencies" className="hidden text-sm text-gray-400 hover:text-white md:inline">
            Agencies
          </Link>
          <Link href="/pricing" className="hidden text-sm text-gray-400 hover:text-white sm:inline">
            Pricing
          </Link>
          <Link href="/enterprise/login" className="hidden text-sm text-gray-400 hover:text-white md:inline">
            Enterprise Login
          </Link>
          <Link href="/#scan">
            <Button variant="primary" size="sm">
              Run free scan
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
    </svg>
  );
}
