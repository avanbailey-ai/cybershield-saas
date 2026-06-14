import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { weeklyDigestEmail } from '@/lib/emailTemplates';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email');

  if (!users) return Response.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const user of users) {
    const { data: websites } = await supabase
      .from('websites')
      .select('id, url, risk_score, last_scanned_at')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!websites || websites.length === 0) continue;

    const websiteData = await Promise.all(
      websites.map(async (site) => {
        const { data: scan } = await supabase
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
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    await sendEmail({
      to: user.email as string,
      subject: `Your weekly security digest — CyberShield`,
      html: weeklyDigestEmail({
        userEmail: user.email as string,
        websites: websiteData,
        digestUrl: `${siteUrl}/dashboard`,
      }),
    });

    sent++;
  }

  return Response.json({ ok: true, sent });
}
