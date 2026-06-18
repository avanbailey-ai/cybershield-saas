import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

interface DemoBody {
  lead_id?: string;
  email?: string;
  name?: string;
  scheduled_time?: string;
  notes?: string;
}

import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

const siteUrl = () => resolveSiteUrl();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function confirmationHtml(name: string, scheduledTime: string): string {
  const formatted = new Date(scheduledTime).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Security Demo Confirmed</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="color:#374151;font-size:14px;">Your CyberShield security demo is scheduled for:</p>
      <p style="color:#2563eb;font-size:18px;font-weight:600;margin:16px 0;">${escapeHtml(formatted)}</p>
      <p style="color:#374151;font-size:14px;">We'll send a calendar invite shortly. Prepare any domains or compliance questions you'd like us to address.</p>
      <a href="${siteUrl()}/enterprise/pricing" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Review Enterprise Plans →</a>
    </div>
  </div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  let body: DemoBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { lead_id, email, name, scheduled_time, notes } = body;

  if (!email?.trim() || !scheduled_time) {
    return NextResponse.json({ error: 'Email and scheduled time are required' }, { status: 400 });
  }

  const scheduledDate = new Date(scheduled_time);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: demo, error: insertError } = await admin
    .from('enterprise_demos')
    .insert({
      lead_id: lead_id || null,
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      scheduled_time: scheduledDate.toISOString(),
      notes: notes?.trim() || null,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (insertError || !demo) {
    console.error('[enterprise/demos] insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to book demo' }, { status: 500 });
  }

  if (lead_id) {
    await admin
      .from('enterprise_pipeline')
      .update({ stage: 'demo', updated_at: new Date().toISOString() })
      .eq('lead_id', lead_id);

    await admin
      .from('enterprise_leads')
      .update({ status: 'contacted' })
      .eq('id', lead_id)
      .eq('status', 'new');
  }

  void sendEmail({
    to: email.trim(),
    subject: 'Your CyberShield security demo is confirmed',
    html: confirmationHtml(name ?? '', scheduledDate.toISOString()),
  });

  return NextResponse.json({ ok: true, demoId: demo.id });
}
