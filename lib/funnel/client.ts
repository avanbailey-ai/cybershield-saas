'use client';

import { normalizeDomain } from '@/lib/cache/scanCache';

const SCORE_HISTORY_PREFIX = 'cybershield_domain_score_';

/** Read prior score for domain from session, then persist current score. */
export function readAndRecordDomainScore(domain: string, currentScore: number): number | null {
  if (typeof window === 'undefined') return null;

  const key = `${SCORE_HISTORY_PREFIX}${normalizeDomain(domain)}`;
  const raw = sessionStorage.getItem(key);
  sessionStorage.setItem(key, String(currentScore));

  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
