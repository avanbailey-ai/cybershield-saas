import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ConversionPathCheck {
  ok: boolean;
  path: string;
  reason: string | null;
}

export interface ConversionPathReport {
  smb: ConversionPathCheck;
  agency: ConversionPathCheck;
  pricing: ConversionPathCheck;
  publicScan: ConversionPathCheck;
  overallOk: boolean;
  blockReasons: string[];
}

function pageExists(appRelative: string): boolean {
  return existsSync(join(process.cwd(), appRelative));
}

/** Verify conversion paths exist before outreach sends to those audiences. */
export function checkConversionPaths(): ConversionPathReport {
  const smbSummary = pageExists('app/summary/page.tsx');
  const agencyLanding = pageExists('app/agency/page.tsx');
  const signup = pageExists('app/signup/page.tsx');
  const pricing = pageExists('app/pricing/page.tsx');
  const publicScan = pageExists('app/scan/page.tsx') || pageExists('app/page.tsx');

  const smb: ConversionPathCheck = {
    path: '/summary',
    ok: smbSummary && signup,
    reason: !smbSummary
      ? '/summary page missing'
      : !signup
        ? '/signup page missing'
        : null,
  };

  const agency: ConversionPathCheck = {
    path: '/agency',
    ok: agencyLanding && smbSummary,
    reason: !agencyLanding
      ? '/agency page missing'
      : !smbSummary
        ? '/summary page missing for agency handoff'
        : null,
  };

  const pricingCheck: ConversionPathCheck = {
    path: '/pricing',
    ok: pricing,
    reason: pricing ? null : '/pricing page missing',
  };

  const scanCheck: ConversionPathCheck = {
    path: '/scan',
    ok: publicScan,
    reason: publicScan ? null : 'Public scan entry missing',
  };

  const blockReasons = [smb, agency, pricingCheck, scanCheck]
    .filter((c) => !c.ok && c.reason)
    .map((c) => c.reason!);

  return {
    smb,
    agency,
    pricing: pricingCheck,
    publicScan: scanCheck,
    overallOk: blockReasons.length === 0,
    blockReasons,
  };
}

export function conversionBlockReason(isAgency: boolean): string | null {
  const report = checkConversionPaths();
  if (isAgency && !report.agency.ok) return report.agency.reason;
  if (!isAgency && !report.smb.ok) return report.smb.reason;
  if (!report.pricing.ok) return report.pricing.reason;
  return null;
}
