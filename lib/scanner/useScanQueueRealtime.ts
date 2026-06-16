'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  isActiveScanStatus,
  type ScanRecordStatus,
} from '@/lib/scanner/scanStatus';

/** Queue-compat status labels — maps scans.pending→pending, scans.running→processing */
export type ScanQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScanQueueJobResult {
  score?: number;
  scanId?: string;
  riskLevel?: string;
  error?: string;
}

export interface ScanQueueJob {
  id: string;
  website_id: string;
  user_id: string;
  domain: string | null;
  status: ScanQueueStatus;
  /** Raw scans.status — SSOT */
  scanStatus: ScanRecordStatus;
  result: ScanQueueJobResult | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempts: number | null;
}

interface ActiveScanRow {
  id: string;
  website_id: string;
  user_id: string;
  status: ScanRecordStatus;
  security_score: number | null;
  risk_level: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const FALLBACK_REFETCH_MS = 15_000;

function toQueueStatus(status: ScanRecordStatus): ScanQueueStatus {
  if (status === 'pending') return 'pending';
  if (status === 'running') return 'processing';
  if (status === 'completed') return 'completed';
  return 'failed';
}

function mapScanRow(row: ActiveScanRow, domain?: string | null): ScanQueueJob {
  const queueStatus = toQueueStatus(row.status);
  const result: ScanQueueJobResult = { scanId: row.id };
  if (row.status === 'completed' && row.security_score !== null) {
    result.score = row.security_score;
    result.riskLevel = row.risk_level ?? undefined;
  }
  if (row.status === 'failed' && row.error_message) {
    result.error = row.error_message;
  }

  return {
    id: row.id,
    website_id: row.website_id,
    user_id: row.user_id,
    domain: domain ?? null,
    status: queueStatus,
    scanStatus: row.status,
    result,
    error: row.error_message,
    created_at: row.started_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    attempts: null,
  };
}

function mergeLatestByWebsite(
  map: Map<string, ScanQueueJob>,
  job: ScanQueueJob,
): Map<string, ScanQueueJob> {
  const existing = map.get(job.website_id);
  if (!existing || new Date(job.created_at) >= new Date(existing.created_at)) {
    const next = new Map(map);
    next.set(job.website_id, job);
    return next;
  }
  return map;
}

function indexJobs(jobs: ScanQueueJob[]): {
  byId: Map<string, ScanQueueJob>;
  byWebsite: Map<string, ScanQueueJob>;
} {
  const byId = new Map<string, ScanQueueJob>();
  let byWebsite = new Map<string, ScanQueueJob>();
  for (const job of jobs) {
    byId.set(job.id, job);
    byWebsite = mergeLatestByWebsite(byWebsite, job);
  }
  return { byId, byWebsite };
}

/**
 * Subscribe to scans INSERT/UPDATE for the authenticated user (SSOT).
 * Initial load via GET /api/scans/active — fallback polling on disconnect.
 */
export function useScanQueueRealtime(userId: string | null | undefined) {
  const [jobsById, setJobsById] = useState<Map<string, ScanQueueJob>>(() => new Map());
  const [jobsByWebsite, setJobsByWebsite] = useState<Map<string, ScanQueueJob>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyScan = useCallback((row: ActiveScanRow) => {
    const job = mapScanRow(row);
    setJobsById((prev) => {
      const next = new Map(prev);
      next.set(job.id, job);
      return next;
    });
    setJobsByWebsite((prev) => mergeLatestByWebsite(prev, job));
  }, []);

  const fetchScanSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/scans/active?limit=200');
      if (!res.ok) return false;
      const data = (await res.json()) as { scans: ActiveScanRow[] };
      const jobs = (data.scans ?? []).map((row) => mapScanRow(row));
      const { byId, byWebsite } = indexJobs(jobs);
      setJobsById(byId);
      setJobsByWebsite(byWebsite);
      return true;
    } catch (err) {
      console.warn('[useScanQueueRealtime] scans fetch failed', err);
      return false;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) return;
    fallbackTimerRef.current = setInterval(() => {
      void fetchScanSnapshot();
    }, FALLBACK_REFETCH_MS);
  }, [fetchScanSnapshot]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setRealtimeConnected(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    async function loadInitial() {
      try {
        await fetchScanSnapshot();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitial();

    const channel = supabase
      .channel(`scans:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scans',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          applyScan(payload.new as ActiveScanRow);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scans',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          applyScan(payload.new as ActiveScanRow);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;

        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          stopFallbackPolling();
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setRealtimeConnected(false);
          void fetchScanSnapshot();
          startFallbackPolling();
        }
      });

    return () => {
      cancelled = true;
      stopFallbackPolling();
      void supabase.removeChannel(channel);
    };
  }, [userId, applyScan, fetchScanSnapshot, startFallbackPolling, stopFallbackPolling]);

  const getWebsiteJob = useCallback(
    (websiteId: string) => jobsByWebsite.get(websiteId),
    [jobsByWebsite],
  );

  const getActiveJob = useCallback(
    (websiteId: string) => {
      const job = jobsByWebsite.get(websiteId);
      if (job && isActiveScanStatus(job.scanStatus)) return job;
      return null;
    },
    [jobsByWebsite],
  );

  const jobs = Array.from(jobsById.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return { jobs, jobsByWebsite, loading, realtimeConnected, getWebsiteJob, getActiveJob };
}
