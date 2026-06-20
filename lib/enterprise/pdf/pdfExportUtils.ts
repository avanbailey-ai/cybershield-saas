/** Safe filename for Content-Disposition headers (no quotes or control chars). */
export function sanitizePdfDownloadFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'CyberShield-Security-Posture-Report.pdf';
}

export function buildOrgPdfFilename(orgName: string | null | undefined, endDateIso: string | null | undefined): string {
  const orgLabel = (orgName || 'Organization').replace(/[^a-z0-9.-]/gi, '_').slice(0, 60);
  const endDate = endDateIso?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `CyberShield-Security-Posture-${orgLabel}-${endDate}.pdf`;
}
