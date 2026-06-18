'use client';

import { FounderNavProvider, useFounderNav } from './FounderNavContext';
import FounderShell from './FounderShell';
import FounderHomeView from './views/FounderHomeView';
import FounderInboxView from './views/FounderInboxView';
import ProspectsView from './views/ProspectsView';
import CustomersView from './views/CustomersView';
import SettingsView from './views/SettingsView';
import CustomerSuccessView from './views/CustomerSuccessView';
import type { FounderCommandCenterProps } from './FounderCommandCenter';

function FounderContent(props: FounderCommandCenterProps) {
  const { section } = useFounderNav();

  switch (section) {
    case 'home':
      return <FounderHomeView />;
    case 'inbox':
      return <FounderInboxView />;
    case 'prospects':
      return <ProspectsView prospects={props.prospects} revenue={props.revenue} />;
    case 'success':
      return <CustomerSuccessView />;
    case 'customers':
      return <CustomersView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <FounderHomeView />;
  }
}

export default function FounderOs(props: FounderCommandCenterProps & { email: string }) {
  const { email, ...data } = props;
  return (
    <FounderNavProvider email={email} initialFounderData={props.founderOsV5}>
      <div className="flex h-full min-h-screen w-full overflow-hidden bg-[#050810]">
        <FounderShell />
        <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 lg:py-12">
          <FounderContent {...data} />
        </main>
      </div>
    </FounderNavProvider>
  );
}
