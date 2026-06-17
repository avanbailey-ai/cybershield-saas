import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { sendAdminDigest } from '@/lib/alerts/adminDigestService';

export async function POST(request: Request) {
  const cronAuthorized = isWorkerAuthorized(request);

  let ownerEmail: string | null = null;

  if (cronAuthorized) {
    ownerEmail = process.env.OWNER_EMAIL ?? process.env.PLATFORM_OWNER_EMAIL ?? null;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && isOwner(user.email)) {
      ownerEmail = user.email!;
    }
  }

  if (!ownerEmail) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sent = await sendAdminDigest(ownerEmail);
  return Response.json({ ok: true, sent });
}
