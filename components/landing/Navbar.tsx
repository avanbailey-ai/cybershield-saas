import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 md:h-16 md:gap-0 md:px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 shrink items-center gap-1.5 md:gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 md:h-8 md:w-8">
            <ShieldIcon className="h-4 w-4 text-white md:h-5 md:w-5" />
          </div>
          <span className="truncate text-base font-bold text-white md:text-lg">CyberShield</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
          <Link href="/features" className="hidden text-sm text-gray-400 hover:text-white lg:inline">
            Features
          </Link>
          <Link href="/#health-center" className="hidden text-sm text-gray-400 hover:text-white lg:inline">
            Health Center
          </Link>
          <Link href="/agency" className="hidden text-sm text-gray-400 hover:text-white md:inline">
            Agencies
          </Link>
          <Link href="/pricing" className="hidden text-sm text-gray-400 hover:text-white sm:inline">
            Pricing
          </Link>
          <Link href="/enterprise/login" className="hidden text-sm text-gray-400 hover:text-white md:inline">
            Enterprise Login
          </Link>
          <Link href="/#scan">
            <Button
              variant="primary"
              size="sm"
              className="whitespace-nowrap !px-2.5 !py-1 !text-xs md:!px-3 md:!py-1.5 md:!text-sm"
            >
              <span className="md:hidden">Start</span>
              <span className="hidden md:inline">Start monitoring</span>
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="whitespace-nowrap !px-2 !py-1 !text-xs md:!px-3 md:!py-1.5 md:!text-sm"
            >
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
