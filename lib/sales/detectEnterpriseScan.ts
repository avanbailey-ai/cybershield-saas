const ENTERPRISE_TLD_PATTERN = /\.(gov|edu|mil|org)$/i;
const SUBDOMAIN_DEPTH_THRESHOLD = 2;

export interface EnterpriseScanSignals {
  vulnerabilitiesCount: number;
  score: number;
  url: string;
}

export function isLargeDomainPattern(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const parts = hostname.split('.');
    if (parts.length > SUBDOMAIN_DEPTH_THRESHOLD + 1) return true;
    if (ENTERPRISE_TLD_PATTERN.test(hostname)) return true;
    if (hostname.length > 30) return true;
    return false;
  } catch {
    return false;
  }
}

export function hasEnterpriseLevelIssues(signals: EnterpriseScanSignals): boolean {
  const manyIssues = signals.vulnerabilitiesCount >= 5;
  const criticalScore = signals.score < 40;
  const largeDomain = isLargeDomainPattern(signals.url);
  return manyIssues || criticalScore || (largeDomain && signals.vulnerabilitiesCount >= 3);
}
