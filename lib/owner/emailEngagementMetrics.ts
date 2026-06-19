/** Unique opens per delivery — open rate capped at 100%. */

export interface EmailEngagementRates {
  sent: number;
  bounced: number;
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  uniqueOpenRate: number;
  uniqueClickRate: number;
  bounceRate: number;
}

export function computeEmailEngagementRates(input: {
  sent: number;
  bounced: number;
  openEvents: { delivery_id: string | null }[];
  clickEvents: { delivery_id: string | null }[];
}): EmailEngagementRates {
  const sent = input.sent;
  const bounced = input.bounced;

  const uniqueOpenIds = new Set<string>();
  let totalOpens = 0;
  for (const e of input.openEvents) {
    totalOpens++;
    if (e.delivery_id) uniqueOpenIds.add(e.delivery_id);
  }

  const uniqueClickIds = new Set<string>();
  let totalClicks = 0;
  for (const e of input.clickEvents) {
    totalClicks++;
    if (e.delivery_id) uniqueClickIds.add(e.delivery_id);
  }

  const uniqueOpens = uniqueOpenIds.size;
  const uniqueClicks = uniqueClickIds.size;

  const uniqueOpenRate =
    sent > 0 ? Math.min(100, Math.round((uniqueOpens / sent) * 1000) / 10) : 0;
  const uniqueClickRate =
    sent > 0 ? Math.min(100, Math.round((uniqueClicks / sent) * 1000) / 10) : 0;
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0;

  return {
    sent,
    bounced,
    uniqueOpens,
    totalOpens,
    uniqueClicks,
    totalClicks,
    uniqueOpenRate,
    uniqueClickRate,
    bounceRate,
  };
}

export function formatDeliveryEngagementDetail(rates: EmailEngagementRates): string {
  if (rates.sent === 0) return 'No sends logged in 24h';
  return `${rates.sent} sent · ${rates.bounceRate.toFixed(1)}% bounce · Unique open rate: ${rates.uniqueOpenRate.toFixed(1)}% · Total opens: ${rates.totalOpens}`;
}
