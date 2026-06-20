'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import TrustSignals from '@/components/enterprise/TrustSignals';
import { getSessionId, trackEvent } from '@/lib/analytics/events';
import { normalizeDomain } from '@/lib/cache/scanCache';
import { validateEnterpriseLead, isValidLeadDomain } from '@/lib/sales/leadValidation';

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

interface EnterpriseLeadFormProps {
  variant?: 'lead' | 'review';
}

export default function EnterpriseLeadForm({ variant = 'lead' }: EnterpriseLeadFormProps) {
  const searchParams = useSearchParams();
  const isReview = variant === 'review' || searchParams.get('source') === 'scan_review';
  const scanDomain = resolveScanDomain(searchParams.get('domain'));
  const scanScoreRaw = searchParams.get('score');
  const scanScore = scanScoreRaw ? parseInt(scanScoreRaw, 10) : null;
  const fromScan = scanDomain.length > 0;
  const needsEnterpriseAccess = searchParams.get('access') === 'required';
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
    leadId?: string;
    risk_score?: number | null;
    security_score?: number | null;
    risk_level?: string | null;
    remediationInsights?: string[];
    reportUrl?: string | null;
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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCompany = company.trim();
    const trimmedDomain = domain.trim();
    const trimmedMessage = message.trim();

    const validation = validateEnterpriseLead(
      {
        name: trimmedName,
        email: trimmedEmail,
        company: trimmedCompany || undefined,
        domain: trimmedDomain || undefined,
        message: trimmedMessage || undefined,
      },
      {
        requireDomain: isReview,
        requireMessage: isReview,
      },
    );

    if (!validation.valid) {
      setError(validation.firstError ?? 'Please check your form and try again.');
      setLoading(false);
      return;
    }

    if (trimmedDomain) {
      const normalized = normalizeDomain(trimmedDomain);
      if (!isValidLeadDomain(normalized)) {
        setError('Please enter a valid website domain (e.g. example.com).');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/enterprise/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          company: trimmedCompany || undefined,
          domain: trimmedDomain || undefined,
          company_size: companySize || undefined,
          security_needs: securityNeeds,
          message: trimmedMessage || undefined,
          session_id: getSessionId(),
          source: isReview ? 'scan_review' : 'lead',
          last_scan_score: scanScore ?? undefined,
          risk_level:
            scanScore != null
              ? scanScore < 40
                ? 'critical'
                : scanScore < 60
                  ? 'high'
                  : scanScore < 70
                    ? 'medium'
                    : 'low'
              : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data);
      trackEvent('enterprise_form_submitted', {
        domain: domain || scanDomain || undefined,
        score: scanScore ?? undefined,
        variant: isReview ? 'review' : 'lead',
        leadId: data.leadId,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const displayDomain = domain || scanDomain || 'your domain';
    const insights = result.remediationInsights ?? [];

    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <EnterpriseHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300/80">
              Automated Security Review System
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">Security review received</h1>
            <p className="mt-3 text-gray-300">
              Thank you, {name}. An automated analysis for {displayDomain} has been queued. Check
              your inbox for remediation insights from the CyberShield Security Intelligence Engine.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              No phone call is required or scheduled — all responses are delivered by email.
            </p>

            {(result.risk_score != null || result.security_score != null) && (
              <div className="mt-6 rounded-lg border border-gray-700/50 bg-gray-900/40 p-4 text-left">
                <p className="text-sm font-medium text-gray-300">Risk summary</p>
                {result.security_score != null && (
                  <p className="mt-1 text-white">
                    Security score: <strong>{result.security_score}/100</strong>
                    {result.risk_level ? ` (${result.risk_level} risk)` : ''}
                  </p>
                )}
                {result.risk_score != null && result.security_score == null && (
                  <p className="mt-1 text-white">
                    Risk score: <strong>{result.risk_score}</strong>
                  </p>
                )}
              </div>
            )}

            {insights.length > 0 && (
              <div className="mt-4 rounded-lg border border-gray-700/50 bg-gray-900/40 p-4 text-left">
                <p className="text-sm font-medium text-gray-300">Top remediation priorities</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-400">
                  {insights.slice(0, 5).map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {result.reportUrl && (
                <Link
                  href={result.reportUrl}
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
                >
                  View full report
                </Link>
              )}
              <Link
                href="/enterprise/pricing?focus=continuousMonitoring"
                className="inline-block rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-200 hover:border-gray-500"
              >
                Upgrade to continuous monitoring
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Responses generated by CyberShield Security Intelligence Engine
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        {needsEnterpriseAccess && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
            <h2 className="text-lg font-semibold text-white">Enterprise access required</h2>
            <p className="mt-2 text-sm text-gray-300">
              Your account does not have enterprise portal access yet. Enterprise access is created
              after a security review. Submit the form below to request access, or{' '}
              <Link href="/dashboard" className="font-medium text-blue-400 hover:text-blue-300">
                return to your dashboard
              </Link>{' '}
              if you only need self-serve monitoring.
            </p>
          </div>
        )}
        {(fromScan || isReview) && !needsEnterpriseAccess && scanScore != null && scanScore < 70 && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
            <h2 className="text-lg font-semibold text-white">
              Follow-up review available
              {scanDomain ? ` for ${scanDomain}` : ''}
            </h2>
            <p className="mt-2 text-sm text-amber-200/80">
              Your site scored {scanScore}/100. Request a security review if you need help prioritizing
              fixes or custom monitoring coverage.
            </p>
          </div>
        )}

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400/80">
            Enterprise &amp; regulated teams
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Request a Security Review</h1>
          <p className="mt-2 text-gray-400">
            For agencies, larger organizations, and teams that need custom monitoring, reporting, or
            security review support.
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
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit for Automated Review'}
          </button>

          <p className="text-center text-xs text-gray-500">
            Responses generated by CyberShield Security Intelligence Engine
          </p>
        </form>

        <div className="mt-12">
          <TrustSignals compact />
        </div>
      </main>
    </div>
  );
}
