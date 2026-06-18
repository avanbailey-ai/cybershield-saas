import type { SslHealthStatus } from './types';

/** Dashboard SSL status bands for business-friendly display. */
export function sslHealthFromDays(daysUntilExpiry: number | null | undefined): SslHealthStatus {
  if (daysUntilExpiry === null || daysUntilExpiry === undefined) return 'unknown';
  if (daysUntilExpiry <= 0) return 'critical';
  if (daysUntilExpiry <= 7) return 'critical';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'healthy';
}

export function sslStatusLabel(status: SslHealthStatus): string {
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

export function sslStatusBadgeClass(status: SslHealthStatus): string {
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

export function severityForExpiryThreshold(thresholdDays: number): string {
  if (thresholdDays <= 0) return 'critical';
  if (thresholdDays <= 3) return 'critical';
  if (thresholdDays <= 7) return 'high';
  return 'medium';
}

export function expiryAlertTitle(hostname: string, thresholdDays: number): string {
  if (thresholdDays <= 0) {
    return `SSL certificate expired on ${hostname}`;
  }
  if (thresholdDays === 1) {
    return `SSL certificate expires tomorrow for ${hostname}`;
  }
  return `SSL certificate expires in ${thresholdDays} days for ${hostname}`;
}

export function expiryAlertMessage(
  hostname: string,
  thresholdDays: number,
  expiresAt: string,
  issuer: string | null,
): string {
  const expiryDate = new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const issuerLine = issuer ? ` Issuer: ${issuer}.` : '';
  if (thresholdDays <= 0) {
    return `The TLS certificate for ${hostname} expired on ${expiryDate}. Visitors may see browser security warnings.${issuerLine} Renew the certificate with your host or registrar immediately.`;
  }
  return `The TLS certificate for ${hostname} expires on ${expiryDate} (${thresholdDays} day${thresholdDays === 1 ? '' : 's'} remaining).${issuerLine} Plan renewal before expiry to avoid downtime and trust warnings.`;
}

/** Which thresholds are crossed for current days-until-expiry. */
export function crossedExpiryThresholds(daysUntilExpiry: number): number[] {
  const thresholds = [30, 14, 7, 3, 0];
  return thresholds.filter((t) => daysUntilExpiry <= t);
}
