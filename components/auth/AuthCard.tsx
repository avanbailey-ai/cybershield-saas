import type { ReactNode } from "react";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  panelHeadline: string;
  panelDescription: string;
  panelBullets: string[];
  children: ReactNode;
}

export default function AuthCard({
  title,
  subtitle,
  footerText,
  footerLinkText,
  footerLinkHref,
  panelHeadline,
  panelDescription,
  panelBullets,
  children,
}: AuthCardProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-[#0a0f1e] border-r border-gray-800 p-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">CyberShield</span>
        </Link>

        {/* Center content */}
        <div>
          <h2 className="mb-3 text-3xl font-bold text-white leading-tight">{panelHeadline}</h2>
          <p className="mb-8 text-gray-400 text-sm leading-relaxed">{panelDescription}</p>
          <ul className="space-y-4">
            {panelBullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-gray-300">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-700">
          &copy; {new Date().getFullYear()} CyberShield SaaS
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-950 px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">CyberShield</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1.5 text-sm text-gray-400">{subtitle}</p>
          </div>

          {children}

          <p className="mt-7 text-center text-sm text-gray-500">
            {footerText}{" "}
            <Link href={footerLinkHref} className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
              {footerLinkText}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
