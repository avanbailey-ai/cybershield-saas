import type { OwnerCrmLead } from '@/lib/owner/types';
import type { FounderCommandCenterData } from '@/lib/owner/founderCommandCenterTypes';
import type { FounderOsV6Data } from '@/lib/owner/founderOsV6';

export interface FounderCommandCenterProps {
  commandCenter: FounderCommandCenterData;
  crmLeads: OwnerCrmLead[];
  legacyFounder: FounderOsV6Data;
}
