import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { runScan } from '@/lib/scanner/runScan';
import { computeLeadScore } from '@/lib/owner/leadScore';
import { scoreOpportunity } from '@/lib/owner/opportunityScore';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: prospect, error: fetchErr } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  await admin
    .from('owner_prospects')
    .update({ scan_status: 'running' })
    .eq('id', id);

  try {
    let url = prospect.website.trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    const result = await runScan(url);
    const leadScore = computeLeadScore(result);
    const issueCount = result.issues?.length ?? 0;
    const opp = scoreOpportunity({
      leadScore,
      scanScore: result.score,
      scanRiskLevel: result.riskLevel,
      industry: prospect.industry,
      issueCount,
      scanCompleted: true,
    });

    const { data: updated, error: updateErr } = await admin
      .from('owner_prospects')
      .update({
        scan_status: 'completed',
        scan_score: result.score,
        scan_risk_level: result.riskLevel,
        scan_findings: {
          issues: result.issues,
          passed: result.passed,
          headers: result.headers,
          ssl: result.ssl,
          explanation: result.explanation,
        },
        lead_score: leadScore,
        conversion_likelihood: opp.conversionLikelihood,
        estimated_mrr: opp.estimatedMrr,
        estimated_arr: opp.estimatedArr,
        opportunity_priority: opp.priority,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, prospect: updated, scan: result });
  } catch (err) {
    await admin
      .from('owner_prospects')
      .update({ scan_status: 'failed' })
      .eq('id', id);
    console.error('[owner/prospects/scan]', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
