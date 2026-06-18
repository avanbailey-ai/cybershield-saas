'use client';

import { FounderNavProvider, useFounderNav } from './FounderNavContext';
import FounderShell from './FounderShell';
import OverviewView from './views/OverviewView';
import ProspectsView from './views/ProspectsView';
import OutreachView from './views/OutreachView';
import CrmView from './views/CrmView';
import CustomersView from './views/CustomersView';
import InsightsView from './views/InsightsView';
import SettingsView from './views/SettingsView';
import type { FounderCommandCenterProps } from './FounderCommandCenter';

function FounderContent(props: FounderCommandCenterProps) {
  const { section } = useFounderNav();

  switch (section) {
    case 'overview':
      return <OverviewView briefing={props.briefing} windows={props.windows} />;
    case 'prospects':
      return <ProspectsView prospects={props.prospects} revenue={props.revenue} />;
    case 'outreach':
      return (
        <OutreachView
          prospects={props.prospects}
          campaigns={props.campaigns}
          contentSuggestions={props.contentSuggestions}
        />
      );
    case 'crm':
      return <CrmView crmLeads={props.crmLeads} />;
    case 'customers':
      return (
        <CustomersView
          intelligence={props.intelligence}
          contentPosts={props.contentPosts}
          ceoAdvisory={props.ceoAdvisory}
        />
      );
    case 'insights':
      return (
        <InsightsView
          insights={props.insights}
          moat={props.moat}
          competitors={props.competitors}
          ceoAdvisory={props.ceoAdvisory}
          windows={props.windows}
        />
      );
    case 'settings':
      return <SettingsView />;
    default:
      return null;
  }
}

export default function FounderOs(props: FounderCommandCenterProps & { email: string }) {
  const { email, ...data } = props;
  return (
    <FounderNavProvider email={email}>
      <div className="flex h-full min-h-screen w-full overflow-hidden bg-[#050810]">
        <FounderShell />
        <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 lg:py-12">
          <FounderContent {...data} />
        </main>
      </div>
    </FounderNavProvider>
  );
}
