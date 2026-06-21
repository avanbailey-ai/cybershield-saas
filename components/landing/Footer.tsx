import Link from "next/link";
import TrustSignals from "@/components/enterprise/TrustSignals";
import {
  SEO_SUPPORT_EMAIL,
} from "@/lib/seo/constants";

const productLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/scan", label: "Free Scan" },
  { href: "/features/website-security-monitoring", label: "Reports" },
  { href: "/features/website-change-detection", label: "Monitoring" },
];

const companyLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/contact#partners", label: "Partners" },
  { href: "/agency", label: "Agencies" },
];

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/security-disclaimer", label: "Security Disclaimer" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-gray-200"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-gray-200"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-12 md:px-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <TrustSignals compact />
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white">CyberShield Cloud</span>
            </div>
            <p className="text-sm text-gray-500">
              Website security monitoring for businesses and agencies.
            </p>
            <a
              href={`mailto:${SEO_SUPPORT_EMAIL}`}
              className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              {SEO_SUPPORT_EMAIL}
            </a>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-800/80 pt-6 sm:flex-row">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CyberShield SaaS. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <Link href="/login" className="hover:text-gray-300">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-gray-300">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
