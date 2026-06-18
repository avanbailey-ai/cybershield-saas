import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { getCustomerIntelligence } from '@/lib/owner/customerIntelligence';
import { generateContentSuggestions } from '@/lib/owner/generators/contentIntel';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const intelligence = await getCustomerIntelligence();
  const suggestions = generateContentSuggestions({
    commonFindings: intelligence.commonFindings,
    avgRiskScore: intelligence.avgRiskScore,
    hotProspects: intelligence.hotProspects,
  });

  return NextResponse.json({ ok: true, suggestions, intelligence });
}
