'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PublicScanResult {
  url: string;
  genericMessage: string;
  riskDetected: boolean;
}

interface AuthScanResult {
  scan: { id: string };
}

export default function ScanInput() {
  const router = useRouter();
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

    setLoading(true);

    try {
      // Try authenticated scan first
      const authRes = await fetch('/api/scan/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!authRes.ok) {
        const data = await authRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Scan failed');
      }

      const data = await authRes.json() as PublicScanResult | AuthScanResult;

      // If returned a scan ID, user is authenticated — redirect to report
      if ('scan' in data && data.scan?.id) {
        router.push(`/report/${data.scan.id}`);
        return;
      }

      setResult(data as PublicScanResult);
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
          Enter your URL below for an instant security risk assessment.
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
          <div
            className={`mt-6 rounded-xl border p-6 text-left ${
              result.riskDetected
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-green-500/30 bg-green-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  result.riskDetected ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                }`}
              >
                {result.riskDetected ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${result.riskDetected ? 'text-red-300' : 'text-green-300'}`}>
                  {result.riskDetected
                    ? `Risk Detected on ${result.url}`
                    : `No major issues found on ${result.url}`}
                </p>
                <p className="mt-1 text-sm text-gray-400">{result.genericMessage}</p>
                <a
                  href="/login"
                  className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    result.riskDetected
                      ? 'bg-red-600/80 text-white hover:bg-red-600'
                      : 'bg-green-600/80 text-white hover:bg-green-600'
                  }`}
                >
                  {result.riskDetected ? 'Sign up free to learn more →' : 'Sign up to monitor over time →'}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
