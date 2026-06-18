import type { DomainHealthStatus } from '@/lib/domain/types';
import type { SslHealthStatus } from '@/lib/ssl/types';

export type UptimeStatus = 'online' | 'degraded' | 'offline' | 'unknown' | 'pending';
export type DomainStatus = DomainHealthStatus;

export type HealthVerdict = 'all_clear' | 'minor_issues' | 'attention_needed' | 'critical_action';

export interface HealthVerdictResult {
  verdict: HealthVerdict;
  label: string;
  reason: string;
  affectedSystems: string[];
  nextStep: string;
}

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
    case 'pending':
      return 'Monitoring pending';
    default:
      return 'Monitoring pending';
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
    case 'pending':
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
}

export {
  domainStatusLabel,
  domainStatusBadgeClass,
  domainExpirySummary,
} from '@/lib/domain/domainStatus';

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
  if (status === 'healthy' && days > 30) return 'All monitored certificates healthy';
  return `${days} days until expiry`;
}

export function computeHealthVerdict(input: {
  securityScore: number | null;
  sslStatus: SslHealthStatus;
  domainStatus: DomainHealthStatus;
  uptimeStatus: UptimeStatus;
  unreadAlerts: number;
  hasCriticalAlerts?: boolean;
}): HealthVerdictResult {
  const affected: string[] = [];
  let severity = 0;

  if (input.sslStatus === 'critical') {
    affected.push('SSL certificate');
    severity = Math.max(severity, 4);
  } else if (input.sslStatus === 'warning') {
    affected.push('SSL certificate');
    severity = Math.max(severity, 2);
  }

  if (input.domainStatus === 'critical') {
    affected.push('Domain registration');
    severity = Math.max(severity, 4);
  } else if (input.domainStatus === 'warning') {
    affected.push('Domain registration');
    severity = Math.max(severity, 2);
  }

  if (input.uptimeStatus === 'offline') {
    affected.push('Website uptime');
    severity = Math.max(severity, 4);
  } else if (input.uptimeStatus === 'degraded') {
    affected.push('Website uptime');
    severity = Math.max(severity, 3);
  } else if (input.uptimeStatus === 'unknown' || input.uptimeStatus === 'pending') {
    affected.push('Uptime monitoring');
    severity = Math.max(severity, 1);
  }

  if (input.securityScore !== null && input.securityScore < 50) {
    affected.push('Security score');
    severity = Math.max(severity, 4);
  } else if (input.securityScore !== null && input.securityScore < 70) {
    affected.push('Security score');
    severity = Math.max(severity, 2);
  }

  if (input.hasCriticalAlerts || (input.unreadAlerts > 0 && severity >= 3)) {
    affected.push('Active alerts');
    severity = Math.max(severity, 3);
  } else if (input.unreadAlerts > 0) {
    affected.push('Active alerts');
    severity = Math.max(severity, 2);
  }

  if (severity >= 4) {
    return {
      verdict: 'critical_action',
      label: 'Critical Action Required',
      reason:
        affected.length > 0
          ? `${affected.slice(0, 2).join(' and ')} need immediate attention.`
          : 'One or more systems need immediate attention.',
      affectedSystems: [...new Set(affected)],
      nextStep: 'Review alerts and fix critical SSL, domain, or uptime issues today.',
    };
  }

  if (severity >= 3) {
    return {
      verdict: 'attention_needed',
      label: 'Attention Needed',
      reason:
        affected.length > 0
          ? `Issues detected with ${affected.join(', ').toLowerCase()}.`
          : 'Some areas need review.',
      affectedSystems: [...new Set(affected)],
      nextStep: 'Open your latest report and address the flagged items this week.',
    };
  }

  if (severity >= 1) {
    return {
      verdict: 'minor_issues',
      label: 'Minor Issues Detected',
      reason:
        affected.length > 0
          ? `Small items to watch: ${affected.join(', ').toLowerCase()}.`
          : 'A few minor items are worth reviewing.',
      affectedSystems: [...new Set(affected)],
      nextStep: 'Check your change timeline when you have a few minutes.',
    };
  }

  return {
    verdict: 'all_clear',
    label: 'All Clear',
    reason: 'Security, SSL, domain, and uptime look healthy. No unread alerts.',
    affectedSystems: [],
    nextStep: 'No action needed — CyberShield will keep monitoring and alert you if anything changes.',
  };
}
