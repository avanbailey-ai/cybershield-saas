import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OWNER_EMAIL } from '@/lib/auth/owner';
import {
  computeLeadScore,
  detectEnterpriseIntentFromEvents,
} from '@/lib/sales/intent';
import {
  sendEnterpriseLeadAdminEmail,
  sendEnterpriseLeadCustomerEmail,
} from '@/lib/email/enterpriseLead';
import { fetchLeadScanContext } from '@/lib/enterprise/leadScanContext';
import { normalizeDomain } from '@/lib/cache/scanCache';
import { emitEvent } from '@/lib/brain/eventBus';

interface LeadBody {
  name?: string;
  email?: string;
  company?: string;
  domain?: string;
  company_size?: string;
  security_needs?: string[];
  message?: string;
  session_id?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: LeadBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, email, company, domain, company_size, security_needs, message, session_id } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  if (!isValidEmail(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const normalizedDomain = domain?.trim() ? normalizeDomain(domain.trim()) : null;

  const analyticsSignals = await detectEnterpriseIntentFromEvents(session_id);

  const leadScore = computeLeadScore({
    companySize: company_size,
    securityNeeds: security_needs,
    domain: normalizedDomain ?? undefined,
    message,
    analyticsSignals,
  });

  const scanContext = normalizedDomain ? await fetchLeadScanContext(normalizedDomain) : null;

  const admin = createAdminClient();

  const { data: lead, error: insertError } = await admin
    .from('enterprise_leads')
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      domain: normalizedDomain,
      company_size: company_size || null,
      security_needs: security_needs ?? [],
      message: message?.trim() || null,
      lead_score: leadScore,
      scan_id: scanContext?.scanId ?? null,
      risk_score: scanContext?.riskScore ?? null,
      status: 'received',
    })
    .select('id, name, email, company, domain, company_size, security_needs, message, lead_score, status, scan_id, risk_score')
    .single();

  if (insertError || !lead) {
    console.error('[enterprise/leads] insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
  }

  const valueEstimate = leadScore >= 70 ? 12000 : company_size === '500+' ? 8000 : 5000;

  await admin.from('enterprise_pipeline').insert({
    lead_id: lead.id,
    stage: leadScore >= 70 ? 'qualified' : 'new',
    owner_email: OWNER_EMAIL,
    value_estimate: valueEstimate,
    notes: scanContext?.summary ? `Auto-analyzed: ${scanContext.summary.slice(0, 200)}` : null,
  });

  await admin
    .from('enterprise_leads')
    .update({ status: 'analyzed' })
    .eq('id', lead.id);

  const emailLead = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    domain: lead.domain,
    company_size: lead.company_size,
    security_needs: lead.security_needs as string[] | null,
    message: lead.message,
    lead_score: leadScore,
  };

  await Promise.all([
    sendEnterpriseLeadAdminEmail(emailLead, scanContext),
    sendEnterpriseLeadCustomerEmail(emailLead, scanContext),
  ]);

  await admin
    .from('enterprise_leads')
    .update({ status: 'responded' })
    .eq('id', lead.id);

  void emitEvent(
    'enterprise_lead_created',
    {
      leadId: lead.id,
      leadScore,
      domain: lead.domain,
      riskScore: scanContext?.riskScore ?? null,
      automated: true,
    },
    null,
    session_id ?? null,
  );

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    lead_score: leadScore,
    risk_score: scanContext?.riskScore ?? null,
    security_score: scanContext?.securityScore ?? null,
    risk_level: scanContext?.riskLevel ?? null,
    remediationInsights: scanContext?.remediationInsights ?? [],
    reportUrl: scanContext?.reportUrl ?? null,
  });
}
