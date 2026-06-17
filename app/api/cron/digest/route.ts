import { isWorkerAuthorized } from '@/lib/queue/workerAuth';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/owner';
import { sendWeeklyDigests } from '@/lib/alerts/weeklyDigestService';

export async function POST(request: Request) {
  const cronAuthorized = isWorkerAuthorized(request);

  if (!cronAuthorized) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isOwner(user.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const result = await sendWeeklyDigests();
  return Response.json({ ok: true, ...result });
}
