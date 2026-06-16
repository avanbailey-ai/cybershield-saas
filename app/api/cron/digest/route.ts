// Weekly digest — triggered manually (authenticated). Not on Vercel Cron schedule.

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { weeklyDigestEmail } from '@/lib/emailTemplates';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: users } = await adminSupabase
    .from('profiles')
    .select('id, email');

  if (!users) return Response.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const recipient of users) {
    const { data: websites } = await adminSupabase
      .from('websites')
      .select('id, url, risk_score, last_scanned_at')
      .eq('user_id', recipient.id)
      .eq('is_active', true);

    if (!websites || websites.length === 0) continue;

    const websiteData = await Promise.all(
      websites.map(async (site) => {
        const { data: scan } = await adminSupabase
          .from('scans')
          .select('id, security_score, risk_level, completed_at')
          .eq('website_id', site.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        return {
          url: site.url as string,
          score: (scan?.security_score as number) ?? 0,
          riskLevel: (scan?.risk_level as string) ?? 'unknown',
          lastScanned:
            (scan?.completed_at as string) ??
            (site.last_scanned_at as string) ??
            'Never',
          scanId: (scan?.id as string) ?? '',
        };
      })
    );

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas.vercel.app';

    await sendEmail({
      to: recipient.email as string,
      subject: `Your weekly security digest — CyberShield`,
      html: weeklyDigestEmail({
        userEmail: recipient.email as string,
        websites: websiteData,
        digestUrl: `${siteUrl}/dashboard`,
      }),
    });

    sent++;
  }

  return Response.json({ ok: true, sent });
}
