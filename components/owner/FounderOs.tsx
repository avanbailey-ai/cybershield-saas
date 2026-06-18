'use client';

import { FounderNavProvider, useFounderNav } from './FounderNavContext';
import FounderShell from './FounderShell';
import FounderHomeView from './views/FounderHomeView';
import FounderInboxView from './views/FounderInboxView';
import ProspectsView from './views/ProspectsView';
import CustomersView from './views/CustomersView';
import SettingsView from './views/SettingsView';
import type { FounderCommandCenterProps } from './FounderCommandCenter';

function FounderContent(props: FounderCommandCenterProps) {
  const { section } = useFounderNav();

  switch (section) {
    case 'home':
      return <FounderHomeView initial={props.founderOsV5} />;
    case 'inbox':
      return <FounderInboxView initial={props.founderOsV5} />;
    case 'prospects':
      return <ProspectsView prospects={props.prospects} revenue={props.revenue} />;
    case 'customers':
      return (
        <CustomersView
          intelligence={props.intelligence}
          contentPosts={props.contentPosts}
          ceoAdvisory={props.ceoAdvisory}
        />
      );
    case 'settings':
      return <SettingsView />;
    default:
      return <FounderHomeView initial={props.founderOsV5} />;
  }
}

export default function FounderOs(props: FounderCommandCenterProps & { email: string }) {
  const { email, ...data } = props;
  return (
    <FounderNavProvider email={email}>
      <div className="flex h-full min-h-screen w-full overflow-hidden bg-[#050810]">
        <FounderShell inboxCount={props.founderOsV5.inbox.length} />
        <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 lg:py-12">
          <FounderContent {...data} />
        </main>
      </div>
    </FounderNavProvider>
  );
}
