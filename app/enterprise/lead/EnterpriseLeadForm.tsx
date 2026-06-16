'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import TrustSignals from '@/components/enterprise/TrustSignals';
import { getSessionId } from '@/lib/analytics/events';
import { normalizeDomain } from '@/lib/cache/scanCache';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

const SECURITY_NEED_GROUPS = [
  {
    title: 'Compliance',
    needs: ['SOC2', 'Audit Logs', 'Custom SLA'],
  },
  {
    title: 'Identity',
    needs: ['SSO / SAML', 'Multi-tenant Management'],
  },
  {
    title: 'Security Coverage',
    needs: ['Continuous Monitoring', 'Penetration Testing', 'API Security'],
  },
] as const;

function resolveScanDomain(raw: string | null): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  return normalizeDomain(trimmed);
}

export default function EnterpriseLeadForm() {
  const searchParams = useSearchParams();
  const scanDomain = resolveScanDomain(searchParams.get('domain'));
  const fromScan = scanDomain.length > 0;
  const prefilledMessage = searchParams.get('message')?.trim() ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState(scanDomain);
  const [companySize, setCompanySize] = useState('');
  const [securityNeeds, setSecurityNeeds] = useState<string[]>([]);
  const [message, setMessage] = useState(prefilledMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    qualified?: boolean;
    cta?: string;
    leadId?: string;
  } | null>(null);

  function toggleNeed(need: string) {
    setSecurityNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enterprise/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          domain: domain || undefined,
          company_size: companySize || undefined,
          security_needs: securityNeeds,
          message: message || undefined,
          session_id: getSessionId(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result?.qualified) {
    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <EnterpriseHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8">
            <h1 className="text-2xl font-bold text-white">Security review scheduled</h1>
            <p className="mt-3 text-gray-300">
              Your escalation is prioritized. Our security team will reach out within one business day
              to coordinate remediation and coverage options.
            </p>
            <Link
              href={`/enterprise/demo?lead_id=${result.leadId ?? ''}`}
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
            >
              {result.cta ?? 'Book a Security Review'}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <EnterpriseHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-8">
            <h1 className="text-2xl font-bold text-white">Escalation received</h1>
            <p className="mt-3 text-gray-300">
              Thank you, {name}. Our security team will review your request and respond within one
              business day.
            </p>
            <Link href="/enterprise/pricing" className="mt-6 inline-block text-blue-400 hover:text-blue-300">
              View enterprise coverage options →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        {fromScan && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
            <h2 className="text-xl font-semibold text-white">
              Security Review Recommended for {scanDomain}
            </h2>
            <p className="mt-2 text-sm text-amber-200/80">
              Critical security issues were detected during automated scanning.
            </p>
          </div>
        )}

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            {fromScan ? 'Request Enterprise Security Review' : 'Enterprise Security Escalation'}
          </h1>
          <p className="mt-2 text-gray-400">
            {fromScan
              ? 'Escalate scan findings to our security team for remediation planning, compliance alignment, and continuous coverage.'
              : 'Coordinate remediation, compliance requirements, and continuous monitoring with our security team.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-300">
                Full Name *
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
                Work Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-300">
                Company
              </label>
              <input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="domain" className="mb-1 block text-sm font-medium text-gray-300">
                Affected Domain (from scan)
              </label>
              <input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="companySize" className="mb-1 block text-sm font-medium text-gray-300">
              Company Size
            </label>
            <select
              id="companySize"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} employees
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-gray-300">Security Needs</legend>
            <div className="space-y-4">
              {SECURITY_NEED_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {group.title}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.needs.map((need) => (
                      <label
                        key={need}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-gray-300 hover:border-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={securityNeeds.includes(need)}
                          onChange={() => toggleNeed(need)}
                          className="rounded border-gray-600 bg-gray-700 text-blue-600"
                        />
                        {need}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-300">
              Security context
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe critical findings, compliance deadlines, or coverage requirements..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Request Security Review'}
          </button>
        </form>

        <div className="mt-12">
          <TrustSignals compact />
        </div>
      </main>
    </div>
  );
}
