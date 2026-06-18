'use client';

import { useEffect, useRef, useState } from 'react';
import ScanResultPaywall, { type PublicScanResult } from '@/components/conversion/ScanResultPaywall';
import { ConversionProvider } from '@/components/conversion/ConversionProvider';
import {
  canRunPublicScan,
  getOrCreateScanSessionId,
  getCachedPublicScanResult,
  recordPublicScan,
  savePublicScanResult,
  MAX_PUBLIC_SCANS_PER_DAY,
} from '@/lib/conversion/limits';
import { trackEvent } from '@/lib/conversion/track';
import { getUrgencyMessage } from '@/lib/conversion/urgency';
import { readAndRecordDomainScore } from '@/lib/funnel/client';
import { saveFunnelSession, buildPricingHref } from '@/lib/funnel/session';

interface ScanInputProps {
  showUpgradeCta?: boolean;
}

const SCAN_STAGES = [
  { label: 'Checking SSL and security headers…', progress: 35 },
  { label: 'Building your monitoring baseline…', progress: 70 },
  { label: 'Calculating your security score…', progress: 95 },
] as const;

function ScanInputInner(_props: ScanInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [repeatScanToday, setRepeatScanToday] = useState(false);
  const [priorScore, setPriorScore] = useState<number | null>(null);
  const [isSecondScan, setIsSecondScan] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [revealedIssues, setRevealedIssues] = useState(0);
  const [revealedScore, setRevealedScore] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const pendingResultRef = useRef<PublicScanResult | null>(null);

  useEffect(() => {
    if (!loading) {
      setScanStage(0);
      return;
    }

    const timers = SCAN_STAGES.map((_, i) =>
      setTimeout(() => setScanStage(i), i * 1200),
    );

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  useEffect(() => {
    if (!revealing || !pendingResultRef.current) return;

    const data = pendingResultRef.current;
    const issueCount = Math.min(3, data.issues.length);
    let issueIdx = 0;

    const issueTimer = setInterval(() => {
      issueIdx += 1;
      setRevealedIssues(issueIdx);
      if (issueIdx >= issueCount) clearInterval(issueTimer);
    }, 400);

    const scoreDelay = setTimeout(() => {
      const target = data.score;
      if (target === null || !Number.isFinite(target)) {
        setRevealing(false);
        setResult(data);
        pendingResultRef.current = null;
        return;
      }
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 20));
      const scoreTimer = setInterval(() => {
        current = Math.min(target, current + step);
        setRevealedScore(current);
        if (current >= target) {
          clearInterval(scoreTimer);
          setTimeout(() => {
            setRevealing(false);
            setResult(data);
            pendingResultRef.current = null;
          }, 600);
        }
      }, 50);
    }, issueCount * 400 + 300);

    return () => {
      clearInterval(issueTimer);
      clearTimeout(scoreDelay);
    };
  }, [revealing]);

  function mergePublicScanResult(data: PublicScanResult, normalizedUrl: string): PublicScanResult {
    const displayUrl =
      typeof data.url === 'string' && data.url.trim().length > 0 && !data.url.includes('undefined')
        ? data.url.trim()
        : normalizedUrl;
    return {
      ...data,
      url: displayUrl,
      score: typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : null,
      issues: Array.isArray(data.issues)
        ? data.issues.map((issue) => (typeof issue === 'string' ? issue : String(issue)))
        : [],
      riskLevel: data.riskLevel ?? 'medium',
      vulnerabilitiesCount: data.vulnerabilitiesCount ?? data.issues?.length ?? 0,
      genericMessage:
        data.genericMessage ??
        (typeof data.score === 'number' && data.score < 60
          ? 'Risk Detected — upgrade to see full details'
          : 'Scan complete'),
      riskDetected: data.riskDetected ?? (typeof data.score === 'number' ? data.score < 60 : true),
    };
  }

  async function showRepeatScanResult(normalizedUrl: string) {
    const sessionCached = getCachedPublicScanResult(normalizedUrl);
    if (sessionCached) {
      const merged = mergePublicScanResult(sessionCached, normalizedUrl);
      setRepeatScanToday(true);
      setResult(merged);
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);

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

      if (res.ok) {
        const data = (await res.json()) as PublicScanResult & { repeatScanToday?: boolean };
        const merged = mergePublicScanResult(data, normalizedUrl);
        savePublicScanResult(normalizedUrl, {
        ...merged,
        score: merged.score ?? 0,
      });
        setRepeatScanToday(Boolean(data.repeatScanToday ?? data.cached));
        setResult(merged);
        return;
      }

      setError(
        'You already scanned this website today. Enable continuous protection to monitor changes.',
      );
    } catch {
      setError(
        'You already scanned this website today. Enable continuous protection to monitor changes.',
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setError(null);
    setResult(null);
    setRepeatScanToday(false);
    setPriorScore(null);
    setIsSecondScan(false);
    setRevealedIssues(0);
    setRevealedScore(null);

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

    const { allowed, domainAlreadyScanned } = canRunPublicScan(normalizedUrl);
    if (!allowed) {
      if (domainAlreadyScanned) {
        await showRepeatScanResult(normalizedUrl);
      } else {
        setError(
          `Daily free scan limit reached (${MAX_PUBLIC_SCANS_PER_DAY} websites/day). Enable continuous protection for unlimited monitoring.`,
        );
      }
      return;
    }

    submittingRef.current = true;
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
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            'Daily scan limit reached. Enable continuous protection for unlimited monitoring.',
        );
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Scan failed');
      }

      const data = (await res.json()) as PublicScanResult & { repeatScanToday?: boolean; cached?: boolean };
      const merged = mergePublicScanResult(data, normalizedUrl);
      const previousScore =
        merged.score !== null ? readAndRecordDomainScore(normalizedUrl, merged.score) : null;
      setPriorScore(previousScore);

      saveFunnelSession({
        scanned_site: merged.url,
        score: merged.score ?? 0,
        risk_level: merged.riskLevel,
        issue_count: merged.vulnerabilitiesCount,
      });

      const { isSecondScan: second } = recordPublicScan(normalizedUrl);
      setIsSecondScan(second);
      savePublicScanResult(normalizedUrl, {
        ...merged,
        score: merged.score ?? 0,
      });
      setRepeatScanToday(Boolean(data.repeatScanToday ?? data.cached));

      trackEvent('scan_completed', {
        score: merged.score ?? undefined,
        domain: merged.url,
        vulnerabilitiesCount: merged.vulnerabilitiesCount,
      });

      pendingResultRef.current = merged;
      setRevealing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function handleUpgradeClick() {
    if (!result || result.score === null) return;
    const href = buildPricingHref(
      getUrgencyMessage(result.score, result.url).highlightPlan === 'pro' ? 'pro' : 'growth',
    );
    window.location.href = href;
  }

  const stage = SCAN_STAGES[scanStage] ?? SCAN_STAGES[0];
  const pendingData = pendingResultRef.current;

  return (
    <section id="scan" className="relative scroll-mt-20 px-5 py-14 sm:px-4 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-3 text-2xl font-bold text-white sm:mb-2 sm:text-3xl">
          Scan Your Website — Free
        </h2>
        <p className="mb-8 text-base text-gray-400 sm:text-gray-400">
          Instant security score. No login required.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          <input
            type="text"
            value={url ?? ''}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com"
            disabled={loading || revealing}
            className="min-h-[48px] flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3.5 text-base text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={loading || revealing}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {loading || revealing ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {loading ? 'Scanning…' : 'Analyzing…'}
              </>
            ) : (
              'Scan your website for free'
            )}
          </button>
        </form>

        {loading && (
          <div className="mt-8 rounded-xl border border-gray-700/60 bg-gray-900/60 p-6 text-left sm:p-6" aria-live="polite">
            <p className="text-sm font-medium text-blue-300">{stage.label}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700"
                style={{ width: `${stage.progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Stage {scanStage + 1} of {SCAN_STAGES.length} — scans can take up to 3 minutes
            </p>
          </div>
        )}

        {revealing && pendingData && (
          <div className="mt-8 rounded-xl border border-gray-700/60 bg-gray-900/60 p-6 text-left">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Preliminary findings
            </p>
            <ul className="space-y-2">
              {pendingData.issues.slice(0, 3).map((issue, i) => (
                <li
                  key={issue}
                  className={`flex items-start gap-2 text-sm transition-opacity duration-300 ${
                    i < revealedIssues ? 'text-gray-300 opacity-100' : 'text-gray-600 opacity-0'
                  }`}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {issue}
                </li>
              ))}
            </ul>
            {revealedScore != null && (
              <div className="mt-6 flex items-center justify-center">
                <div
                  className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 ${
                    revealedScore >= 70
                      ? 'border-green-500/40 text-green-400'
                      : revealedScore >= 40
                        ? 'border-yellow-500/40 text-yellow-400'
                        : 'border-red-500/40 text-red-400'
                  }`}
                >
                  <span className="text-4xl font-bold">{revealedScore}</span>
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            {(error.includes('protection') || error.includes('monitoring')) && (
              <>
                {' '}
                <a href="/pricing" className="font-semibold underline hover:text-red-300">
                  Enable continuous protection
                </a>
              </>
            )}
          </div>
        )}

        {result && (
          <ScanResultPaywall
            result={result}
            isSecondScan={isSecondScan}
            repeatScanToday={repeatScanToday}
            priorScore={priorScore}
            onUpgradeClick={handleUpgradeClick}
            onRescanClick={() => {
              setResult(null);
              setRepeatScanToday(false);
              setIsSecondScan(false);
              setRevealedIssues(0);
              setRevealedScore(null);
              setError(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
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
