'use client';

import { FounderNavProvider, useFounderNav } from './FounderNavContext';
import FounderShell from './FounderShell';
import FounderOverviewView from './views/founder/FounderOverviewView';
import FounderFunnelView from './views/founder/FounderFunnelView';
import FounderProductView from './views/founder/FounderProductView';
import FounderRevenueView from './views/founder/FounderRevenueView';
import FounderMarketingView from './views/founder/FounderMarketingView';
import FounderSalesView from './views/founder/FounderSalesView';
import FounderSiteContentView from './views/founder/FounderSiteContentView';
import FounderOperationsView from './views/founder/FounderOperationsView';
import type { FounderCommandCenterProps } from './FounderCommandCenter';

function FounderContent({ crmLeads }: { crmLeads: FounderCommandCenterProps['crmLeads'] }) {
  const { section, commandCenter, refreshCommandCenter } = useFounderNav();

  switch (section) {
    case 'overview':
      return <FounderOverviewView data={commandCenter} />;
    case 'funnel':
      return <FounderFunnelView data={commandCenter} />;
    case 'product':
      return <FounderProductView data={commandCenter} />;
    case 'revenue':
      return <FounderRevenueView data={commandCenter} />;
    case 'marketing':
      return <FounderMarketingView data={commandCenter} />;
    case 'sales':
      return (
        <FounderSalesView
          data={commandCenter}
          crmLeads={crmLeads}
          onRefresh={() => void refreshCommandCenter()}
        />
      );
    case 'content':
      return <FounderSiteContentView data={commandCenter} />;
    case 'alerts':
      return <FounderOperationsView data={commandCenter} />;
    default:
      return <FounderOverviewView data={commandCenter} />;
  }
}

export default function FounderOs(props: FounderCommandCenterProps & { email: string }) {
  const { email, commandCenter, crmLeads, legacyFounder } = props;
  return (
    <FounderNavProvider
      email={email}
      initialCommandCenter={commandCenter}
      initialLegacyFounder={legacyFounder}
    >
      <div className="flex h-full min-h-screen w-full overflow-hidden bg-[#050810]">
        <FounderShell />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <FounderContent crmLeads={crmLeads} />
        </main>
      </div>
    </FounderNavProvider>
  );
}
