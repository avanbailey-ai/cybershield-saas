import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailIntelligenceSummary {
  generatedAt: string;
  sentToday: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  conversions: number;
  topTemplates: { template: string; sent: number; clicked: number }[];
  topCategories: { category: string; sent: number; openRate: number }[];
}

export async function getEmailIntelligence(): Promise<EmailIntelligenceSummary> {
  const admin = createAdminClient();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const [deliveriesRes, eventsRes, conversionsRes] = await Promise.all([
    admin
      .from('owner_email_deliveries')
      .select('id, category, template, status')
      .gte('created_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('event_type, delivery_id')
      .gte('created_at', since),
    admin
      .from('owner_prospect_attributions')
      .select('id', { count: 'exact', head: true })
      .not('converted_at', 'is', null)
      .gte('converted_at', since),
  ]);

  const deliveries = deliveriesRes.data ?? [];
  const events = eventsRes.data ?? [];

  const eventCounts = {
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
  };

  for (const e of events) {
    const t = e.event_type as keyof typeof eventCounts;
    if (t in eventCounts) eventCounts[t]++;
  }

  const categoryStats = new Map<string, { sent: number; opened: number }>();
  const templateStats = new Map<string, { sent: number; clicked: number }>();

  for (const d of deliveries) {
    const cat = (d.category as string) ?? 'system';
    const cur = categoryStats.get(cat) ?? { sent: 0, opened: 0 };
    cur.sent++;
    if (d.status === 'opened') cur.opened++;
    categoryStats.set(cat, cur);

    const tpl = (d.template as string) ?? cat;
    const tcur = templateStats.get(tpl) ?? { sent: 0, clicked: 0 };
    tcur.sent++;
    if (d.status === 'clicked') tcur.clicked++;
    templateStats.set(tpl, tcur);
  }

  const topCategories = [...categoryStats.entries()]
    .map(([category, s]) => ({
      category,
      sent: s.sent,
      openRate: s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5);

  const topTemplates = [...templateStats.entries()]
    .map(([template, s]) => ({ template, sent: s.sent, clicked: s.clicked }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    sentToday: deliveries.length,
    delivered: eventCounts.delivered || deliveries.filter((d) => d.status === 'delivered').length,
    opened: eventCounts.opened,
    clicked: eventCounts.clicked,
    bounced: eventCounts.bounced,
    conversions: conversionsRes.count ?? 0,
    topTemplates,
    topCategories,
  };
}
