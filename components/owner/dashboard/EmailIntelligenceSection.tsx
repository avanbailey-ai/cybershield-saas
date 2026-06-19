'use client';

import type { EmailIntelligenceSummary } from '@/lib/owner/emailIntelligence';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function EmailIntelligenceSection({
  intel,
}: {
  intel: EmailIntelligenceSummary;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
        Email intelligence (today)
      </h2>
      <p className="mt-1 text-xs text-gray-600">Actionable delivery and engagement — not vanity metrics</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sent" value={intel.sentToday} />
        <Stat label="Delivered" value={intel.delivered} />
        <Stat label="Opened" value={intel.opened} />
        <Stat label="Clicked" value={intel.clicked} />
        <Stat label="Bounced" value={intel.bounced} />
        <Stat label="Conversions" value={intel.conversions} />
      </div>
      {intel.topCategories.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Top categories
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-300">
            {intel.topCategories.map((c) => (
              <li key={c.category}>
                {c.category}: {c.sent} sent · {c.openRate}% open rate
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
