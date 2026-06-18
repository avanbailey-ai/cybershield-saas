'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ScanPhase = 'idle' | 'loading' | 'success' | 'error';

interface ScanAllButtonProps {
  label?: string;
  className?: string;
}

export default function ScanAllButton({
  label = 'Scan all websites',
  className,
}: ScanAllButtonProps) {
  const router = useRouter();
  const isScanningRef = useRef(false);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'success' && phase !== 'error') return;
    const timer = setTimeout(() => {
      setPhase('idle');
      setMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  async function handleScanAll() {
    if (isScanningRef.current || phase === 'loading') return;

    isScanningRef.current = true;
    setPhase('loading');
    setMessage(null);

    try {
      const enqueueRes = await fetch('/api/scan/trigger-all', { method: 'POST' });
      const enqueueData = await enqueueRes.json();

      if (enqueueRes.status === 403) {
        setPhase('error');
        setMessage(
          enqueueData.message ??
            (enqueueData.code === 'SCAN_LIMIT_EXCEEDED'
              ? 'Daily scan limit reached.'
              : 'Plan limit reached.'),
        );
        return;
      }

      if (enqueueRes.status === 503 || enqueueData.error === 'QUEUE_BUSY') {
        setPhase('error');
        setMessage('Queue is busy — try again in a moment.');
        return;
      }

      if (enqueueRes.status === 429) {
        setPhase('error');
        setMessage('Please wait before scanning again.');
        return;
      }

      if (!enqueueData.queued) {
        setPhase('error');
        setMessage(enqueueData.message ?? 'No websites to scan.');
        return;
      }

      setPhase('success');
      setMessage(enqueueData.message ?? `Scanning ${enqueueData.queued} site(s)…`);
      router.refresh();
    } catch {
      setPhase('error');
      setMessage('Scan failed — try again.');
    } finally {
      isScanningRef.current = false;
    }
  }

  const isLoading = phase === 'loading';

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleScanAll}
        disabled={isLoading}
        className={
          className ??
          'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50'
        }
      >
        {isLoading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {isLoading ? 'Queuing scans…' : label}
      </button>
      {message && (
        <span
          className={`text-xs ${
            phase === 'error' ? 'text-red-400' : phase === 'success' ? 'text-green-400' : 'text-gray-400'
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
