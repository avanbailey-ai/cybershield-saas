import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { defaultCampaignTasks } from '@/lib/owner/campaignTemplates';

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const view = req.nextUrl.searchParams.get('view') ?? 'active';
  const admin = createAdminClient();
  let query = admin
    .from('owner_campaigns')
    .select('*, owner_campaign_tasks(*)')
    .is('deleted_at', null);
  if (view === 'archived') query = query.not('archived_at', 'is', null);
  else if (view === 'active') query = query.is('archived_at', null);

  const { data: campaigns, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaigns: campaigns ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  const name = body.name?.trim();
  const durationDays = Number(body.duration_days) as 7 | 30;

  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (durationDays !== 7 && durationDays !== 30) {
    return NextResponse.json({ error: 'duration_days must be 7 or 30' }, { status: 400 });
  }

  const activate = body.activate === true;
  const today = new Date().toISOString().slice(0, 10);

  const admin = createAdminClient();
  const { data: campaign, error: campErr } = await admin
    .from('owner_campaigns')
    .insert({
      name,
      duration_days: durationDays,
      status: activate ? 'active' : 'draft',
      start_date: body.start_date ?? (activate ? today : null),
      daily_goal: defaultCampaignTasks(durationDays)[0]?.title ?? null,
    })
    .select()
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message ?? 'Create failed' }, { status: 500 });
  }

  const tasks = defaultCampaignTasks(durationDays).map((t) => ({
    campaign_id: campaign.id,
    title: t.title,
    day_offset: t.day_offset,
  }));

  const { error: taskErr } = await admin.from('owner_campaign_tasks').insert(tasks);
  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const { data: full } = await admin
    .from('owner_campaigns')
    .select('*, owner_campaign_tasks(*)')
    .eq('id', campaign.id)
    .single();

  return NextResponse.json({ ok: true, campaign: full });
}
