'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ScanAllButton() {
  const router = useRouter();
  const isScanningRef = useRef(false); // Ref guard prevents re-entrant calls even before state settles
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState<{ message: string; upgradeUrl: string } | null>(null);

  async function handleScanAll() {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setLoading(true);
    setStatus('Queuing websites...');
    setLimitHit(null);

    try {
      const enqueueRes = await fetch('/api/scan/trigger-all', { method: 'POST' });
      const enqueueData = await enqueueRes.json();

      // Plan limit hit → show upgrade banner
      if (enqueueRes.status === 403) {
        const isUsageLimit = enqueueData.error === 'USAGE_LIMIT_REACHED';
        setLimitHit({
          message: enqueueData.message ?? (isUsageLimit
            ? 'Daily scan limit reached. Upgrade your plan to scan more.'
            : 'Website limit reached for your plan.'),
          upgradeUrl: enqueueData.upgradeUrl ?? '/upgrade',
        });
        setStatus(null);
        return;
      }

      if (enqueueRes.status === 429) {
        setStatus(enqueueData.error ?? 'Rate limit — please wait before scanning again');
        return;
      }

      if (enqueueRes.status === 409) {
        setStatus(enqueueData.error ?? 'Already queued — scans are already in progress');
        return;
      }

      if (!enqueueData.queued) {
        setStatus(enqueueData.message ?? 'No websites to scan');
        return;
      }

      setStatus(`Processing ${enqueueData.queued} website(s)...`);

      const processRes = await fetch('/api/scan/process-queue', { method: 'POST' });
      const processData = await processRes.json();

      const parts: string[] = [];
      if (processData.succeeded > 0) parts.push(`${processData.succeeded} succeeded`);
      if (processData.failed > 0) parts.push(`${processData.failed} failed`);
      if (enqueueData.blocked > 0) parts.push(`${enqueueData.blocked} blocked by plan limit`);

      setStatus(`Done: ${parts.join(', ') || 'no results'}`);
      router.refresh();
    } catch (err) {
      setStatus('Error — check console for details');
      console.error('[ScanAll]', err);
    } finally {
      isScanningRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleScanAll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Scanning...' : 'Scan All Websites'}
        </button>
        {status && <span className="text-sm text-gray-400">{status}</span>}
      </div>

      {/* Upgrade prompt banner */}
      {limitHit && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-400">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{limitHit.message}</span>
          <Link href={limitHit.upgradeUrl} className="ml-1 font-semibold underline hover:text-orange-300 whitespace-nowrap">
            Upgrade plan →
          </Link>
        </div>
      )}
    </div>
  );
}
