import { NextResponse } from 'next/server';
import { getExperiment } from '@/lib/analytics/experiments';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const exp = await getExperiment(name);
  if (!exp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    traffic_split: exp.traffic_split,
    winner: exp.winner,
    active: exp.active,
    variant_a: exp.variant_a,
    variant_b: exp.variant_b,
    impressions_a: exp.impressions_a,
    impressions_b: exp.impressions_b,
    conversions_a: exp.conversions_a,
    conversions_b: exp.conversions_b,
  });
}
