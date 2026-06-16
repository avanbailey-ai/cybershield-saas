import type { ScanResult } from '@/lib/scanner/runScan';

import type { AttackSurfaceLevel } from './types';



function isExternalScript(script: string, siteUrl: string): boolean {

  if (script.startsWith('inline:')) return false;

  try {

    const base = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);

    const src = script.startsWith('http') ? script : `https://${script.replace(/^\/\//, '')}`;

    const parsed = new URL(src);

    return parsed.hostname !== base.hostname;

  } catch {

    return /cdn|googleapis|cloudflare|unpkg|jsdelivr|gstatic/i.test(script);

  }

}



/** Compute raw exposure points from scan signals. */

export function computeExposurePoints(scan: ScanResult): number {

  let exposure = 0;

  const externalScripts = scan.pageSnapshot.scripts.filter((s) => isExternalScript(s, scan.url));

  exposure += externalScripts.length * 5;

  exposure += scan.pageSnapshot.thirdPartyScripts.length * 3;

  exposure += scan.pageSnapshot.endpoints.filter((e) => /\/admin|\/auth|\/login/i.test(e)).length * 8;

  if (scan.pageSnapshot.loginFormDetected) exposure += 5;

  exposure += scan.pageSnapshot.formsDetected * 2;

  exposure += scan.pageSnapshot.externalApiCalls.length * 4;

  return exposure;

}



/** Attack surface score 0–100 (higher = smaller surface). */

export function computeAttackSurfaceScore(scan: ScanResult): number {

  return Math.max(0, Math.min(100, 100 - computeExposurePoints(scan)));

}



/** Classify attack surface into enterprise risk tiers. */

export function classifyAttackSurface(score: ScanResult): AttackSurfaceLevel {

  const exposure = computeExposurePoints(score);

  if (exposure >= 40) return 'Critical';

  if (exposure >= 25) return 'High';

  if (exposure >= 10) return 'Medium';

  return 'Low';

}



/** Human-readable attack surface summary for reports. */

export function describeAttackSurface(level: AttackSurfaceLevel, score: number): string {

  const tierDescriptions: Record<AttackSurfaceLevel, string> = {

    Low: 'Minimal external dependencies and authentication exposure.',

    Medium: 'Moderate third-party scripts or auth endpoints increase monitoring requirements.',

    High: 'Significant external dependencies, forms, or admin paths expand the exploitable surface.',

    Critical: 'Large attack surface with multiple high-value entry points requiring immediate review.',

  };

  return `Attack surface: ${level} (${score}/100). ${tierDescriptions[level]}`;

}

