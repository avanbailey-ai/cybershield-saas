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

/** Conversion-critical App Router pages shipped with every production deploy. */
const SHIPPED_CONVERSION_PAGES = new Set([
  'app/summary/page.tsx',
  'app/agency/page.tsx',
  'app/signup/page.tsx',
  'app/pricing/page.tsx',
  'app/scan/page.tsx',
  'app/page.tsx',
]);

function pageExistsOnDisk(appRelative: string): boolean {
  return existsSync(join(process.cwd(), appRelative));
}

function pageExistsInRegistry(appRelative: string): boolean {
  return SHIPPED_CONVERSION_PAGES.has(appRelative);
}

/** CI/local verification — may read the repo filesystem. */
export function checkConversionPaths(): ConversionPathReport {
  const smbSummary =
    pageExistsOnDisk('app/summary/page.tsx') || pageExistsInRegistry('app/summary/page.tsx');
  const agencyLanding =
    pageExistsOnDisk('app/agency/page.tsx') || pageExistsInRegistry('app/agency/page.tsx');
  const signup =
    pageExistsOnDisk('app/signup/page.tsx') || pageExistsInRegistry('app/signup/page.tsx');
  const pricing =
    pageExistsOnDisk('app/pricing/page.tsx') || pageExistsInRegistry('app/pricing/page.tsx');
  const publicScan =
    pageExistsOnDisk('app/scan/page.tsx') ||
    pageExistsOnDisk('app/page.tsx') ||
    pageExistsInRegistry('app/scan/page.tsx') ||
    pageExistsInRegistry('app/page.tsx');

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

/**
 * Runtime send gate — registry only, never filesystem.
 * Vercel/serverless API functions do not have app/ sources on disk.
 */
export function conversionBlockReason(isAgency: boolean): string | null {
  const smbSummary = pageExistsInRegistry('app/summary/page.tsx');
  const agencyLanding = pageExistsInRegistry('app/agency/page.tsx');
  const signup = pageExistsInRegistry('app/signup/page.tsx');
  const pricing = pageExistsInRegistry('app/pricing/page.tsx');

  if (isAgency) {
    if (!agencyLanding) return '/agency page missing';
    if (!smbSummary) return '/summary page missing for agency handoff';
  } else {
    if (!smbSummary) return '/summary page missing';
    if (!signup) return '/signup page missing';
  }

  if (!pricing) return '/pricing page missing';
  return null;
}
