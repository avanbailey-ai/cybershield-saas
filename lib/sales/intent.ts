import { createAdminClient } from '@/lib/supabase/admin';

export interface LeadScoreInputs {
  companySize?: string;
  securityNeeds?: string[];
  domain?: string;
  message?: string;
  analyticsSignals?: {
    pricingVisits?: number;
    scanCount?: number;
    enterprisePageViews?: number;
  };
}

const LARGE_COMPANY_SIZES = ['201-500', '500+', '500-1000', '1000+', 'enterprise'];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function computeLeadScore(inputs: LeadScoreInputs): number {
  let score = 0;
  const needs = inputs.securityNeeds ?? [];

  if (inputs.companySize && LARGE_COMPANY_SIZES.includes(inputs.companySize)) {
    score += 20;
  } else if (inputs.companySize === '51-200') {
    score += 10;
  }

  if (needs.length >= 2) {
    score += 15 * (needs.length - 1);
  }
  if (needs.length >= 1) {
    score += 10;
  }

  if (inputs.domain?.trim()) {
    score += 10;
  }

  const signals = inputs.analyticsSignals ?? {};

  if ((signals.pricingVisits ?? 0) > 3) {
    score += 20;
  } else if ((signals.pricingVisits ?? 0) >= 1) {
    score += 8;
  }

  if ((signals.scanCount ?? 0) > 2) {
    score += 15;
  } else if ((signals.scanCount ?? 0) >= 1) {
    score += 5;
  }

  if ((signals.enterprisePageViews ?? 0) > 1) {
    score += 15;
  } else if ((signals.enterprisePageViews ?? 0) >= 1) {
    score += 8;
  }

  const msg = (inputs.message ?? '').toLowerCase();
  if (/\b(compliance|soc2|sso|enterprise|audit|penetration|sla)\b/.test(msg)) {
    score += 10;
  }

  return clampScore(score);
}

export interface EnterpriseIntentSignals {
  pricingVisits: number;
  scanCount: number;
  enterprisePageViews: number;
}

export async function detectEnterpriseIntentFromEvents(
  sessionId: string | null | undefined,
): Promise<EnterpriseIntentSignals> {
  const empty: EnterpriseIntentSignals = {
    pricingVisits: 0,
    scanCount: 0,
    enterprisePageViews: 0,
  };

  if (!sessionId) return empty;

  try {
    const supabase = createAdminClient();
    const { data: events } = await supabase
      .from('analytics_events')
      .select('event_type, metadata')
      .eq('session_id', sessionId);

    if (!events?.length) return empty;

    let pricingVisits = 0;
    let scanCount = 0;
    let enterprisePageViews = 0;

    for (const event of events) {
      const meta = (event.metadata ?? {}) as { path?: string };
      const path = meta.path ?? '';

      if (event.event_type === 'bounce_pricing' || path.includes('/pricing')) {
        pricingVisits++;
      }
      if (event.event_type === 'scan_completed' || event.event_type === 'scan_started') {
        scanCount++;
      }
      if (path.includes('/enterprise')) {
        enterprisePageViews++;
      }
    }

    return { pricingVisits, scanCount, enterprisePageViews };
  } catch {
    return empty;
  }
}

export const QUALIFIED_LEAD_THRESHOLD = 70;
