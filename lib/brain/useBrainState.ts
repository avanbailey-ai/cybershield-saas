'use client';

import { useEffect, useState } from 'react';
import { getSessionId } from '@/lib/analytics/events';
import type { RecommendedAction, UserBrainState } from './controller';

const DEFAULT_STATE: UserBrainState = {
  intentScore: 0,
  churnRisk: 0,
  funnelStage: 'anonymous',
  recommendedAction: 'none',
};

export function useBrainState(): UserBrainState & { loading: boolean } {
  const [state, setState] = useState<UserBrainState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sessionId = getSessionId();
        const res = await fetch(`/api/brain/state?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          setState(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { ...state, loading };
}

export type { RecommendedAction, UserBrainState };
