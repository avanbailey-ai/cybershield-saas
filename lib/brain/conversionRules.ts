import type { BusinessInsights } from './insights';

export interface BrainConfigUpdate {
  headline_variant?: string;
  cta_text_variant?: string;
  cta_placement?: 'top' | 'bottom' | 'both';
  highlighted_plan?: 'growth' | 'pro' | 'agency';
  paywall_delay_ms?: number;
  pricing_layout_order?: string[];
  trust_signals_visible?: boolean;
  urgency_level?: 'low' | 'medium' | 'high';
  show_partial_ai_earlier?: boolean;
}

/**
 * Maps insight weaknesses to safe autopilot_config changes.
 */
export function deriveConfigFromInsights(insights: BusinessInsights): BrainConfigUpdate {
  const updates: BrainConfigUpdate = {};
  const weakest = insights.weakestFunnelStage;
  const dropoff = insights.worstDropoffPoint;

  if (
    weakest === 'upgrade_clicked' ||
    weakest === 'paywall_viewed' ||
    dropoff.includes('pricing') ||
    dropoff.includes('upgrade')
  ) {
    updates.urgency_level = 'high';
    updates.highlighted_plan = 'growth';
    updates.pricing_layout_order = ['growth', 'pro', 'agency'];
  }

  if (weakest === 'scan_completed' || dropoff.includes('scan') || dropoff.includes('report')) {
    updates.show_partial_ai_earlier = true;
    updates.paywall_delay_ms = 1500;
  }

  if (
    weakest === 'checkout_started' ||
    weakest === 'checkout_completed' ||
    dropoff.includes('checkout')
  ) {
    updates.trust_signals_visible = true;
    updates.cta_placement = 'top';
  }

  if (insights.viralLoopConversionRate < 5) {
    updates.headline_variant = 'educational';
  }

  if (insights.enterpriseLeadConversionRate > 20) {
    updates.cta_text_variant = 'Book a Security Demo';
  }

  return updates;
}
