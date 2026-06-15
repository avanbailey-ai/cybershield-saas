'use client';

import { useState } from 'react';
import ScanResultPaywall, { type PublicScanResult } from '@/components/conversion/ScanResultPaywall';
import { ConversionProvider, useConversion } from '@/components/conversion/ConversionProvider';
import {
  canRunPublicScan,
  getOrCreateScanSessionId,
  recordPublicScan,
  MAX_PUBLIC_SCANS_PER_DAY,
} from '@/lib/conversion/limits';
import { trackEvent } from '@/lib/conversion/track';
import { getUrgencyMessage } from '@/lib/conversion/urgency';

interface ScanInputProps {
  showUpgradeCta?: boolean;
}

function ScanInputInner(_props: ScanInputProps) {
  const { openUpgradeModal } = useConversion();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicScanResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    let normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setError('Please enter a URL');
      return;
    }
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError('Please enter a valid URL (e.g. https://yoursite.com)');
      return;
    }

    const { allowed, count } = canRunPublicScan();
    if (!allowed) {
      openUpgradeModal({ trigger: 'second_scan', score: 50, domain: normalizedUrl });
      setError(`Daily free scan limit reached (${MAX_PUBLIC_SCANS_PER_DAY}/day). Upgrade for unlimited monitoring.`);
      return;
    }

    if (count >= 1) {
      openUpgradeModal({ trigger: 'second_scan', score: 50, domain: normalizedUrl });
    }

    setLoading(true);
    trackEvent('scan_started', { domain: normalizedUrl });

    try {
      const sessionId = getOrCreateScanSessionId();
      const res = await fetch('/api/scan/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-scan-session-id': sessionId,
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (res.status === 429) {
        openUpgradeModal({ trigger: 'second_scan', domain: normalizedUrl });
        throw new Error('Daily scan limit reached. Upgrade for unlimited monitoring.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Scan failed');
      }

      const data = (await res.json()) as PublicScanResult;
      setResult(data);

      recordPublicScan(normalizedUrl);
      sessionStorage.setItem('cybershield_last_score', String(data.score));

      trackEvent('scan_completed', {
        score: data.score,
        domain: normalizedUrl,
        vulnerabilitiesCount: data.vulnerabilitiesCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative py-16 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
          Check Your Website Security — Free
        </h2>
        <p className="mb-8 text-gray-400">
          Enter your URL below for an instant security risk assessment. No login required.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter your website URL (e.g. https://yoursite.com)"
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning…
              </>
            ) : (
              'Check Security'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <ScanResultPaywall
            result={result}
            onUpgradeClick={() =>
              openUpgradeModal({
                score: result.score,
                domain: result.url,
                trigger: 'full_report',
                recommendedPlan: getUrgencyMessage(result.score, result.url).highlightPlan,
              })
            }
          />
        )}
      </div>
    </section>
  );
}

export default function ScanInput(props: ScanInputProps) {
  return (
    <ConversionProvider>
      <ScanInputInner {...props} />
    </ConversionProvider>
  );
}
