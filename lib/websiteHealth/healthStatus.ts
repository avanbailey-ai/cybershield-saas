import type { SslHealthStatus } from '@/lib/ssl/types';

export type UptimeStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type DomainStatus = 'unknown';

export function uptimeStatusFromHttp(
  httpStatus: number | null,
  scanFailed?: boolean,
): UptimeStatus {
  if (scanFailed) return 'offline';
  if (httpStatus === null || httpStatus === undefined) return 'unknown';
  if (httpStatus >= 500) return 'offline';
  if (httpStatus >= 400) return 'degraded';
  if (httpStatus >= 200) return 'online';
  return 'unknown';
}

export function uptimeStatusLabel(status: UptimeStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'degraded':
      return 'Degraded';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
}

export function uptimeStatusBadgeClass(status: UptimeStatus): string {
  switch (status) {
    case 'online':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'degraded':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'offline':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

export function domainStatusLabel(_status: DomainStatus): string {
  return 'Not monitored';
}

export function domainStatusBadgeClass(_status: DomainStatus): string {
  return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

export function securityScoreBadgeClass(score: number | null): string {
  if (score === null) return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  if (score >= 90) return 'bg-green-500/15 text-green-300 border-green-500/30';
  if (score >= 70) return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
  if (score >= 50) return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

export function securityScoreLabel(score: number | null): string {
  if (score === null) return 'Not scanned';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs attention';
  return 'At risk';
}

export function riskLevelLabel(riskLevel: string | null): string {
  if (!riskLevel) return '';
  switch (riskLevel) {
    case 'low':
      return 'Low risk';
    case 'medium':
      return 'Medium risk';
    case 'high':
      return 'High risk';
    case 'critical':
      return 'Critical risk';
    default:
      return riskLevel;
  }
}

export function scanKindLabel(scanKind: string | null): string {
  switch (scanKind) {
    case 'monitoring_check':
      return 'Lightweight check';
    case 'deep_scan':
      return 'Full security scan';
    default:
      return 'Scan';
  }
}

export function monitoringEnabledLabel(enabled: boolean): string {
  return enabled ? 'Active' : 'Paused';
}

export function monitoringEnabledBadgeClass(enabled: boolean): string {
  return enabled
    ? 'bg-green-500/15 text-green-300 border-green-500/30'
    : 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

export function sslExpirySummary(days: number | null, status: SslHealthStatus): string {
  if (status === 'unknown' || days === null) return 'Not checked yet';
  if (days <= 0) return 'Certificate expired';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days until expiry`;
}
