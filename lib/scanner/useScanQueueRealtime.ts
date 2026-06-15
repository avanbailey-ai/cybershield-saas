'use client';



import { useCallback, useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';



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

  result: ScanQueueJobResult | null;

  error: string | null;

  created_at: string;

  started_at: string | null;

  completed_at: string | null;

  attempts: number | null;

}



const FALLBACK_REFETCH_MS = 60_000;



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

 * Subscribe to scan_queue INSERT/UPDATE for the authenticated user.

 * Initial load via GET /api/scan/queue — fallback refetch on disconnect/error.

 */

export function useScanQueueRealtime(userId: string | null | undefined) {

  const [jobsById, setJobsById] = useState<Map<string, ScanQueueJob>>(() => new Map());

  const [jobsByWebsite, setJobsByWebsite] = useState<Map<string, ScanQueueJob>>(() => new Map());

  const [loading, setLoading] = useState(true);

  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);



  const applyJob = useCallback((job: ScanQueueJob) => {

    setJobsById((prev) => {

      const next = new Map(prev);

      next.set(job.id, job);

      return next;

    });

    setJobsByWebsite((prev) => mergeLatestByWebsite(prev, job));

  }, []);



  const fetchQueueSnapshot = useCallback(async (): Promise<boolean> => {

    try {

      const res = await fetch('/api/scan/queue?limit=200');

      if (!res.ok) return false;

      const data = (await res.json()) as { jobs: ScanQueueJob[] };

      const { byId, byWebsite } = indexJobs(data.jobs ?? []);

      setJobsById(byId);

      setJobsByWebsite(byWebsite);

      return true;

    } catch (err) {

      console.warn('[useScanQueueRealtime] fallback fetch failed', err);

      return false;

    }

  }, []);



  const startFallbackPolling = useCallback(() => {

    if (fallbackTimerRef.current) return;

    fallbackTimerRef.current = setInterval(() => {

      void fetchQueueSnapshot();

    }, FALLBACK_REFETCH_MS);

  }, [fetchQueueSnapshot]);



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

        await fetchQueueSnapshot();

      } finally {

        if (!cancelled) setLoading(false);

      }

    }



    void loadInitial();



    const channel = supabase

      .channel(`scan_queue:${userId}`)

      .on(

        'postgres_changes',

        {

          event: 'INSERT',

          schema: 'public',

          table: 'scan_queue',

          filter: `user_id=eq.${userId}`,

        },

        (payload) => {

          applyJob(payload.new as ScanQueueJob);

        },

      )

      .on(

        'postgres_changes',

        {

          event: 'UPDATE',

          schema: 'public',

          table: 'scan_queue',

          filter: `user_id=eq.${userId}`,

        },

        (payload) => {

          applyJob(payload.new as ScanQueueJob);

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

          void fetchQueueSnapshot();

          startFallbackPolling();

        }

      });



    return () => {

      cancelled = true;

      stopFallbackPolling();

      void supabase.removeChannel(channel);

    };

  }, [userId, applyJob, fetchQueueSnapshot, startFallbackPolling, stopFallbackPolling]);



  const getWebsiteJob = useCallback(

    (websiteId: string) => jobsByWebsite.get(websiteId),

    [jobsByWebsite],

  );



  const getActiveJob = useCallback(

    (websiteId: string) => {

      const job = jobsByWebsite.get(websiteId);

      if (job && (job.status === 'pending' || job.status === 'processing')) return job;

      return null;

    },

    [jobsByWebsite],

  );



  const jobs = Array.from(jobsById.values()).sort(

    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),

  );



  return { jobs, jobsByWebsite, loading, realtimeConnected, getWebsiteJob, getActiveJob };

}


