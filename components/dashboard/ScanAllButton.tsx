'use client';

import { useRef, useState } from 'react';
import { usePlan } from '@/lib/billing/usePlan';
import { useConversion } from '@/components/conversion/ConversionProvider';
import QueueDemandBanner from '@/components/dashboard/QueueDemandBanner';

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export default function ScanAllButton() {
  const { scansToday, scansRemaining, effectiveScansLimit, loading: planLoading } = usePlan();
  const { openUpgradeModal } = useConversion();
  const isScanningRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [queueWarning, setQueueWarning] = useState(false);

  const scanLimitReached = !planLoading && scansRemaining === 0;

  async function handleScanAll() {
    if (isScanningRef.current) return;

    if (scanLimitReached) {
      openUpgradeModal({
        trigger: 'scan_limit',
        recommendedPlan: 'growth',
      });
      return;
    }

    isScanningRef.current = true;
    setLoading(true);
    setStatus('Queuing websites...');
    setQueueWarning(false);

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = createIdempotencyKey();
      }
      const enqueueRes = await fetch('/api/scan/trigger-all', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
      });
      const enqueueData = await enqueueRes.json();

      if (enqueueRes.status === 403) {
        const isUsageLimit = enqueueData.error === 'USAGE_LIMIT_REACHED';
        if (isUsageLimit) {
          openUpgradeModal({
            trigger: 'scan_limit',
            recommendedPlan: 'growth',
          });
        }
        setStatus(
          enqueueData.message ??
            (isUsageLimit
              ? "You've reached your scan limit."
              : 'Website limit reached for your plan.'),
        );
        return;
      }

      if (enqueueRes.status === 503 || enqueueData.error === 'QUEUE_BUSY') {
        openUpgradeModal({
          trigger: 'queue_busy',
          recommendedPlan: 'pro',
        });
        setStatus(enqueueData.message ?? 'Scan queue is at capacity — try again shortly.');
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

      if (enqueueData.queueWarning) {
        setQueueWarning(true);
      }

      setStatus(`Queued ${enqueueData.queued} website(s) — updates appear live`);
    } catch (err) {
      setStatus('Error — check console for details');
      console.error('[ScanAll]', err);
    } finally {
      isScanningRef.current = false;
      idempotencyKeyRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <QueueDemandBanner show={queueWarning} onDismiss={() => setQueueWarning(false)} />
      <div className="flex items-center gap-3">
        <button
          onClick={handleScanAll}
          disabled={loading}
          title={scanLimitReached ? "You've reached your scan limit — upgrade for more scans" : undefined}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Scanning...' : 'Scan All Websites'}
        </button>
        {!planLoading && (
          <span className={`text-xs ${scansRemaining <= 1 ? 'text-orange-400' : 'text-gray-500'}`}>
            {scansToday} / {effectiveScansLimit === Infinity ? '∞' : effectiveScansLimit} scans today
          </span>
        )}
        {status && <span className="text-sm text-gray-400">{status}</span>}
      </div>
    </div>
  );
}
