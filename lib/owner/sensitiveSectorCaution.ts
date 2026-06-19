import { isSensitiveSector } from './prospectQualityBrain';
import type { OwnerProspect } from './types';

export const SENSITIVE_SECTOR_CAUTION =
  'Healthcare / medical prospect — manual review required before sending. Do not treat as a routine cold outreach target.';

export function prospectNeedsSensitiveReview(prospect: {
  industry?: string | null;
  business_name?: string | null;
  quality_label?: string | null;
  rejection_reason?: string | null;
  pipeline_state?: string | null;
}): boolean {
  if (prospect.rejection_reason === 'sensitive_sector_manual_review') return true;
  if (prospect.quality_label === 'NEEDS REVIEW' && prospect.pipeline_state === 'needs_review') {
    return isSensitiveSector(prospect.industry, prospect.business_name ?? '');
  }
  return isSensitiveSector(prospect.industry, prospect.business_name ?? '');
}

export function sensitiveSectorLabel(prospect: OwnerProspect): string | null {
  return prospectNeedsSensitiveReview(prospect) ? SENSITIVE_SECTOR_CAUTION : null;
}
