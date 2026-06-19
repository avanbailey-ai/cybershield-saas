import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findDeliveryByResendId,
  logEngagementEvent,
} from '@/lib/email/deliveryLog';

export const dynamic = 'force-dynamic';

const EVENT_MAP: Record<string, 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  const eventType = body?.type as string | undefined;
  const mapped = eventType ? EVENT_MAP[eventType] : undefined;

  if (!mapped || !body?.data) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const resendId = body.data.email_id as string | undefined;
  if (!resendId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createAdminClient();
  const delivery = await findDeliveryByResendId(admin, resendId);

  await logEngagementEvent(admin, {
    deliveryId: delivery?.id ?? null,
    resendMessageId: resendId,
    prospectId: delivery?.prospect_id ?? null,
    eventType: mapped,
    linkUrl: body.data.click?.link ?? null,
    metadata: { raw_type: eventType },
  });

  if (delivery?.id) {
    await admin
      .from('owner_email_deliveries')
      .update({ status: mapped, updated_at: new Date().toISOString() })
      .eq('id', delivery.id);
  }

  return NextResponse.json({ ok: true, event: mapped });
}
