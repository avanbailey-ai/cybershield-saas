import { NextResponse } from 'next/server';
import { getPlanDisplayAmounts } from '@/lib/billing/stripeDisplayPrices';

export const runtime = 'nodejs';

/** GET /api/billing/prices — display amounts from Stripe (not billing authority). */
export async function GET() {
  try {
    const prices = await getPlanDisplayAmounts();
    return NextResponse.json({ prices });
  } catch (err) {
    console.error('[billing/prices] error:', err);
    return NextResponse.json({ prices: {} });
  }
}
