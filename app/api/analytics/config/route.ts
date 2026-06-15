import { NextResponse } from 'next/server';
import { getBrainConfig } from '@/lib/brain/optimizer';

export async function GET() {
  try {
    const config = await getBrainConfig();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({
      highlighted_plan: 'growth',
      cta_placement: 'both',
      headline_variant: 'default',
      paywall_delay_ms: 2000,
      cta_text_variant: 'Protect your site',
      pricing_layout_order: ['pro', 'growth', 'agency'],
      trust_signals_visible: true,
      urgency_level: 'medium',
      show_partial_ai_earlier: false,
    });
  }
}
