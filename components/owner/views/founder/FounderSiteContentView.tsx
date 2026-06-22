'use client';

import { FounderPanel, FounderSectionHeader } from '../../command-center/FounderMetricsUI';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';

export default function FounderSiteContentView({ data }: { data: FounderCommandCenterData }) {
  const c = data.siteContent;

  return (
    <div>
      <FounderSectionHeader
        title="Site Content"
        subtitle="Read-only map of where marketing copy lives. Live CMS editing is not enabled yet to avoid breaking production pages."
        updatedAt={c.generatedAt}
      />

      {!c.cmsAvailable && (
        <FounderPanel className="mb-8 border-violet-500/20 bg-violet-950/10">
          <p className="text-sm text-violet-200/90">
            A database-backed CMS can be added via owner_founder_settings or a dedicated
            founder_site_settings table. For now, edit copy in the file paths below and keep
            lib/marketing/claims.ts aligned.
          </p>
        </FounderPanel>
      )}

      <FounderPanel title="Content locations">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-gray-500">
                <th className="pb-2 pr-4 font-medium">Element</th>
                <th className="pb-2 pr-4 font-medium">File / location</th>
                <th className="pb-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {c.entries.map((e) => (
                <tr key={e.key} className="border-b border-white/[0.04]">
                  <td className="py-3 pr-4 font-medium text-white">{e.label}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-violet-300/90">{e.location}</td>
                  <td className="py-3 text-gray-500">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FounderPanel>
    </div>
  );
}
