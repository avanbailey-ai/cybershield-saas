/**
 * CEO recommendations — maps insights to safe autopilot_config previews.
 * ADVISORY ONLY until admin clicks "Apply suggestion".
 */

import { randomUUID } from 'crypto';
import type { CEOInsight } from './insights';

export type AllowedAction =
  | 'improve_cta_copy'
  | 'reorder_pricing'
  | 'highlight_plan'
  | 'adjust_paywall_timing'
  | 'improve_onboarding'
  | 'add_clarification';

export interface Recommendation {
  id: string;
  action: AllowedAction;
  title: string;
  description: string;
  configPreview: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high';
  insightCategory?: string;
}

function rec(
  action: AllowedAction,
  title: string,
  description: string,
  configPreview: Record<string, unknown>,
  priority: 'low' | 'medium' | 'high',
  insightCategory?: string,
): Recommendation {
  return {
    id: randomUUID(),
    action,
    title,
    description,
    configPreview,
    priority,
    insightCategory,
  };
}

export function insightsToRecommendations(insights: CEOInsight[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const insight of insights) {
    const category = insight.category ?? 'general';
    const priority = insight.priority;

    if (category === 'pricing' && insight.positive) {
      recommendations.push(
        rec(
          'highlight_plan',
          'Highlight Growth plan',
          insight.recommended_action,
          { highlighted_plan: 'growth' },
          priority,
          category,
        ),
      );
      continue;
    }

    if (category === 'conversion' && insight.metadata?.pricingDropoff) {
      recommendations.push(
        rec(
          'adjust_paywall_timing',
          'Soften paywall timing',
          insight.recommended_action,
          { paywall_delay_ms: 3500, trust_signals_visible: true },
          priority,
          category,
        ),
      );
      recommendations.push(
        rec(
          'reorder_pricing',
          'Reorder pricing layout',
          'Surface Growth before Pro to reduce pricing drop-off',
          { pricing_layout_order: ['growth', 'pro', 'agency'] },
          priority,
          category,
        ),
      );
      continue;
    }

    if (category === 'onboarding') {
      if (insight.metadata?.scanReportDropoff) {
        recommendations.push(
          rec(
            'improve_onboarding',
            'Show partial AI earlier',
            insight.recommended_action,
            { show_partial_ai_earlier: true, cta_placement: 'top' },
            priority,
            category,
          ),
        );
      } else {
        recommendations.push(
          rec(
            'add_clarification',
            'Add scan onboarding hints',
            insight.recommended_action,
            { headline_variant: 'educational', trust_signals_visible: true },
            priority,
            category,
          ),
        );
      }
      continue;
    }

    if (category === 'conversion' && insight.metadata?.checkoutDropoff) {
      recommendations.push(
        rec(
          'improve_cta_copy',
          'Strengthen checkout CTA',
          insight.recommended_action,
          {
            cta_text_variant: 'Start monitoring now',
            cta_placement: 'both',
            urgency_level: 'high',
          },
          priority,
          category,
        ),
      );
      continue;
    }

    if (category === 'enterprise') {
      recommendations.push(
        rec(
          'add_clarification',
          'Enterprise follow-up (manual)',
          insight.recommended_action,
          {},
          priority,
          category,
        ),
      );
      continue;
    }

    if (!insight.positive) {
      recommendations.push(
        rec(
          'improve_cta_copy',
          insight.problem.slice(0, 80),
          insight.recommended_action,
          { cta_text_variant: 'Protect your site' },
          priority,
          category,
        ),
      );
    }
  }

  const seen = new Set<string>();
  return recommendations.filter((r) => {
    const key = `${r.action}:${JSON.stringify(r.configPreview)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Object.keys(r.configPreview).length > 0 || r.insightCategory === 'enterprise';
  });
}
