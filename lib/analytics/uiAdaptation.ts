export type IntentTier = 'low' | 'medium' | 'high';

export type HighlightPlan = 'growth' | 'pro' | 'agency';

export interface AdaptationConfig {
  ctaStyle: 'aggressive' | 'educational' | 'soft';
  highlightPlan: HighlightPlan;
  showUrgency: boolean;
  showPricingPressure: boolean;
}

export function getIntentTier(score: number): IntentTier {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getAdaptationConfig(tier: IntentTier): AdaptationConfig {
  switch (tier) {
    case 'high':
      return {
        ctaStyle: 'aggressive',
        highlightPlan: 'growth',
        showUrgency: true,
        showPricingPressure: true,
      };
    case 'medium':
      return {
        ctaStyle: 'educational',
        highlightPlan: 'growth',
        showUrgency: false,
        showPricingPressure: false,
      };
    case 'low':
    default:
      return {
        ctaStyle: 'soft',
        highlightPlan: 'growth',
        showUrgency: false,
        showPricingPressure: false,
      };
  }
}

export function getCtaLabel(
  style: AdaptationConfig['ctaStyle'],
  domain?: string,
  experimentText?: string,
): string {
  if (experimentText) return experimentText;

  const site = domain ? domain.replace(/^https?:\/\//, '').split('/')[0] : 'your site';

  switch (style) {
    case 'aggressive':
      return `Secure ${site} now — limited time`;
    case 'educational':
      return `See how ${site} compares to protected sites`;
    case 'soft':
    default:
      return `Run another free scan for ${site}`;
  }
}
