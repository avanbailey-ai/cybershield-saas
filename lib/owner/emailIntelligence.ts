import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailIntelligenceSummary {
  generatedAt: string;
  sentToday: number;
  delivered: number;
  opened: number;
  uniqueOpens: number;
  uniqueOpenRate: number;
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

  const openEvents = events.filter((e) => e.event_type === 'opened');
  const uniqueOpenIds = new Set<string>();
  for (const e of openEvents) {
    if (e.delivery_id) uniqueOpenIds.add(e.delivery_id as string);
  }
  const uniqueOpens = uniqueOpenIds.size;
  const sentToday = deliveries.length;
  const uniqueOpenRate =
    sentToday > 0 ? Math.min(100, Math.round((uniqueOpens / sentToday) * 100)) : 0;

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

  const categoryStats = new Map<string, { sent: number; openedIds: Set<string> }>();
  const templateStats = new Map<string, { sent: number; clicked: number }>();
  const deliveryCategory = new Map<string, string>();

  for (const d of deliveries) {
    const cat = (d.category as string) ?? 'system';
    const id = d.id as string;
    deliveryCategory.set(id, cat);
    const cur = categoryStats.get(cat) ?? { sent: 0, openedIds: new Set<string>() };
    cur.sent++;
    if (d.status === 'opened') cur.openedIds.add(id);
    categoryStats.set(cat, cur);

    const tpl = (d.template as string) ?? cat;
    const tcur = templateStats.get(tpl) ?? { sent: 0, clicked: 0 };
    tcur.sent++;
    if (d.status === 'clicked') tcur.clicked++;
    templateStats.set(tpl, tcur);
  }

  for (const e of events) {
    if (e.event_type !== 'opened' || !e.delivery_id) continue;
    const cat = deliveryCategory.get(e.delivery_id as string);
    if (!cat) continue;
    const cur = categoryStats.get(cat);
    if (cur) cur.openedIds.add(e.delivery_id as string);
  }

  const topCategories = [...categoryStats.entries()]
    .map(([category, s]) => ({
      category,
      sent: s.sent,
      openRate:
        s.sent > 0
          ? Math.min(100, Math.round((Math.min(s.openedIds.size, s.sent) / s.sent) * 100))
          : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5);

  const topTemplates = [...templateStats.entries()]
    .map(([template, s]) => ({ template, sent: s.sent, clicked: s.clicked }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    sentToday,
    delivered: eventCounts.delivered || deliveries.filter((d) => d.status === 'delivered').length,
    opened: eventCounts.opened,
    uniqueOpens,
    uniqueOpenRate,
    clicked: eventCounts.clicked,
    bounced: eventCounts.bounced,
    conversions: conversionsRes.count ?? 0,
    topTemplates,
    topCategories,
  };
}
