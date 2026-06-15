import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OWNER_EMAIL } from '@/lib/auth/owner';
import {
  computeLeadScore,
  detectEnterpriseIntentFromEvents,
  QUALIFIED_LEAD_THRESHOLD,
} from '@/lib/sales/intent';
import { notifyAdminNewLead } from '@/lib/sales/notify';
import { scheduleEnterpriseEmailSequences } from '@/lib/sales/sequences';
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

  const analyticsSignals = await detectEnterpriseIntentFromEvents(session_id);

  const leadScore = computeLeadScore({
    companySize: company_size,
    securityNeeds: security_needs,
    domain,
    message,
    analyticsSignals,
  });

  const qualified = leadScore >= QUALIFIED_LEAD_THRESHOLD;
  const status = qualified ? 'qualified' : 'new';

  const admin = createAdminClient();

  const { data: lead, error: insertError } = await admin
    .from('enterprise_leads')
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      domain: domain?.trim() || null,
      company_size: company_size || null,
      security_needs: security_needs ?? [],
      message: message?.trim() || null,
      lead_score: leadScore,
      status,
    })
    .select('id, name, email, company, domain, company_size, security_needs, message, lead_score, status')
    .single();

  if (insertError || !lead) {
    console.error('[enterprise/leads] insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
  }

  const valueEstimate = qualified ? 12000 : company_size === '500+' ? 8000 : 5000;

  await admin.from('enterprise_pipeline').insert({
    lead_id: lead.id,
    stage: qualified ? 'qualified' : 'new',
    owner_email: OWNER_EMAIL,
    value_estimate: valueEstimate,
    notes: qualified ? 'Auto-qualified by lead score' : null,
  });

  void scheduleEnterpriseEmailSequences(lead.id, lead.email, lead.name, lead.domain);
  notifyAdminNewLead(lead);

  void emitEvent(
    'enterprise_lead_created',
    { leadId: lead.id, leadScore, qualified, company: lead.company },
    null,
    session_id ?? null,
  );

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    lead_score: leadScore,
    qualified,
    ...(qualified ? { cta: 'Book a Security Demo' } : {}),
  });
}
