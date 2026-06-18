import type { DomainHealthStatus } from './types';

/** Dashboard domain status bands — longer lead time than SSL (60-day first alert). */
export function domainHealthFromDays(daysUntilExpiry: number | null | undefined): DomainHealthStatus {
  if (daysUntilExpiry === null || daysUntilExpiry === undefined) return 'unknown';
  if (daysUntilExpiry <= 0) return 'critical';
  if (daysUntilExpiry <= 14) return 'critical';
  if (daysUntilExpiry <= 60) return 'warning';
  return 'healthy';
}

export function domainStatusLabel(status: DomainHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
}

export function domainStatusBadgeClass(status: DomainHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'warning':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

export function severityForDomainExpiryThreshold(thresholdDays: number): string {
  if (thresholdDays <= 0) return 'critical';
  if (thresholdDays <= 7) return 'critical';
  if (thresholdDays <= 14) return 'high';
  return 'medium';
}

export function domainExpiryAlertTitle(domain: string, thresholdDays: number): string {
  if (thresholdDays <= 0) {
    return `Domain registration expired for ${domain}`;
  }
  if (thresholdDays === 1) {
    return `Domain registration expires tomorrow for ${domain}`;
  }
  return `Domain registration expires in ${thresholdDays} days for ${domain}`;
}

export function domainExpiryAlertMessage(
  domain: string,
  thresholdDays: number,
  expiresAt: string,
  registrar: string | null,
): string {
  const expiryDate = new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const registrarLine = registrar ? ` Registrar: ${registrar}.` : '';
  if (thresholdDays <= 0) {
    return `The domain ${domain} expired on ${expiryDate}. Your website may stop working if the registration lapses.${registrarLine} Renew with your registrar immediately to avoid downtime.`;
  }
  return `The domain ${domain} expires on ${expiryDate} (${thresholdDays} day${thresholdDays === 1 ? '' : 's'} remaining).${registrarLine} Renew before expiry so visitors can still reach your site.`;
}

/** Which thresholds are crossed for current days-until-expiry. */
export function crossedDomainExpiryThresholds(daysUntilExpiry: number): number[] {
  const thresholds = [60, 30, 14, 7, 0];
  return thresholds.filter((t) => daysUntilExpiry <= t);
}

export function domainExpirySummary(
  days: number | null,
  status: DomainHealthStatus,
): string {
  if (status === 'unknown' || days === null) return 'Not checked yet';
  if (days <= 0) return 'Domain registration expired';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days until domain expiry`;
}

export function domainChangedAlertTitle(domain: string, changeType: 'registrar' | 'dns'): string {
  if (changeType === 'registrar') {
    return `Domain registrar changed for ${domain}`;
  }
  return `DNS records changed for ${domain}`;
}

export function domainChangedAlertMessage(
  domain: string,
  changeType: 'registrar',
  before: string,
  after: string,
): string;
export function domainChangedAlertMessage(
  domain: string,
  changeType: 'dns',
  before: string,
  after: string,
): string;
export function domainChangedAlertMessage(
  domain: string,
  changeType: 'registrar' | 'dns',
  before: string,
  after: string,
): string {
  if (changeType === 'registrar') {
    return `The registrar for ${domain} changed from "${before}" to "${after}". Verify this change was intentional — unauthorized transfers can indicate a takeover attempt.`;
  }
  return `DNS records for ${domain} changed. Before: ${before}. After: ${after}. Confirm updates match your hosting or CDN provider.`;
}
