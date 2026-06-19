/** Enterprise / large-org detection — not routine SMB or agency cold outreach targets. */
export function isEnterpriseProspect(businessName: string, industry?: string | null): boolean {
  const hay = `${businessName} ${industry ?? ''}`.toLowerCase();
  if (/\b(dsv|fedex|ups|maersk|sap|oracle|salesforce)\b/i.test(hay)) return true;
  if (/\b(global logistics|freight forwarding|supply chain|fortune 500|enterprise software)\b/i.test(hay)) {
    return true;
  }
  if (/\b(healthcare systems|health care systems|healthcare software|hospital system)\b/i.test(hay)) {
    return true;
  }
  if (/\b(plexis)\b/i.test(hay)) return true;
  return false;
}
