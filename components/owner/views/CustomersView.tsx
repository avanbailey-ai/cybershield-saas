'use client';

import CustomerIntelligencePanel from '../CustomerIntelligence';
import ContentPerformance from '../ContentPerformance';
import EmptyState from '../EmptyState';
import type { CustomerIntelligenceSummary } from '@/lib/owner/customerIntelligence';
import type { OwnerContentPost } from '@/lib/owner/types';
import type { CeoAdvisoryData } from '@/lib/owner/ceoAdvisory';

interface Props {
  intelligence: CustomerIntelligenceSummary;
  contentPosts: OwnerContentPost[];
  ceoAdvisory: CeoAdvisoryData;
}

export default function CustomersView({ intelligence, contentPosts, ceoAdvisory }: Props) {
  const hasCustomers =
    intelligence.conversionSignals > 0 ||
    intelligence.churnSignals > 0 ||
    contentPosts.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Customers</h1>
        <p className="mt-2 text-gray-500">Retention, health, and expansion</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">Active subscribers</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {intelligence.conversionSignals}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">Churn risk</p>
          <p className="mt-2 text-3xl font-semibold text-amber-400">
            {ceoAdvisory.churnRisk.usersAtRisk}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-gray-500">High risk (&gt;70)</p>
          <p className="mt-2 text-3xl font-semibold text-red-400">
            {ceoAdvisory.churnRisk.highRisk}
          </p>
        </div>
      </section>

      {!hasCustomers ? (
        <EmptyState
          title="No customer data yet"
          description="Customer health and retention insights appear as users subscribe and scan."
        />
      ) : (
        <>
          <CustomerIntelligencePanel intelligence={intelligence} embedded />
          <ContentPerformance initialPosts={contentPosts} embedded />
        </>
      )}
    </div>
  );
}
