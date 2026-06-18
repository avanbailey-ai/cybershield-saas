import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_content_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const body = await req.json();
  if (!body.platform?.trim()) {
    return NextResponse.json({ error: 'platform required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('owner_content_posts')
    .insert({
      platform: body.platform.trim(),
      title: body.title?.trim() || null,
      content: body.content?.trim() || null,
      status: body.status ?? 'draft',
      views: body.views ?? 0,
      leads_generated: body.leads_generated ?? 0,
      customers_acquired: body.customers_acquired ?? 0,
      published_at: body.published_at ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post: data });
}
