'use client';

import { useCallback, useEffect, useState } from 'react';
import { computeConversionIntentScore } from './conversionScore';
import type { AnalyticsEvent } from './events';
import { getSessionId } from './events';

interface UseConversionScoreResult {
  score: number;
  loading: boolean;
  events: AnalyticsEvent[];
  refresh: () => void;
}

export function useConversionScore(): UseConversionScoreResult {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const sessionId = getSessionId();
    try {
      const res = await fetch(`/api/analytics/session?session_id=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = (await res.json()) as { events: AnalyticsEvent[] };
        setEvents(data.events ?? []);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const score = computeConversionIntentScore(events);

  return { score, loading, events, refresh: fetchEvents };
}
