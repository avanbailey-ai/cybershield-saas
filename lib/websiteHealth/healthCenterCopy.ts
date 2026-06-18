import type { SslHealthStatus } from '@/lib/ssl/types';
import type { DomainHealthStatus } from '@/lib/domain/types';
import type { WebsiteHealthAlert, WebsiteHealthCenterData } from './fetchWebsiteHealthCenter';
import type { HealthVerdict, UptimeStatus } from './healthStatus';
import { securityScoreLabel } from './healthStatus';

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'unknown';

export interface SecurityScorePresentation {
  score: number | null;
  band: string;
  explanation: string;
  effort: string;
  contributors: string[];
}

export interface DomainDisplay {
  headline: string;
  badge: string;
  badgeClass: string;
  message: string;
  isInitializing: boolean;
}

export interface UptimeDisplay {
  headline: string;
  badge: string;
  badgeClass: string;
  message: string;
  isCollecting: boolean;
}

export interface SecurityTrend {
  currentScore: number | null;
  previousScore: number | null;
  direction: TrendDirection;
  deltaLabel: string;
}

export interface ExecutiveHealthSummary {
  overallLabel: string;
  overallTone: 'good' | 'warn' | 'bad' | 'neutral';
  rows: Array<{ label: string; value: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }>;
  lastFullScanLabel: string;
}

export interface HealthCenterAlertView {
  title: string;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  severity: string;
}

export function securityScoreBand(score: number | null): string {
  if (score === null) return 'Not yet scored';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Below average';
  return 'Needs immediate attention';
}

export function securityScorePresentation(score: number | null): SecurityScorePresentation {
  const band = securityScoreBand(score);
  if (score === null) {
    return {
      score: null,
      band,
      explanation:
        'Run a full security scan to see how well your website is protected and where improvements can be made.',
      effort: '—',
      contributors: [],
    };
  }

  if (score >= 70) {
    return {
      score,
      band,
      explanation:
        'CyberShield found a solid security baseline. A few optional improvements could further strengthen browser protections.',
      effort: 'Low',
      contributors: ['Optional hardening opportunities', 'Minor configuration tweaks'],
    };
  }

  return {
    score,
    band,
    explanation:
      'CyberShield found several missing browser security protections and website hardening controls. Most issues are configuration-related rather than signs of active compromise.',
    effort: score >= 50 ? 'Low to medium' : 'Medium',
    contributors: [
      'Missing security headers',
      'Browser protection gaps',
      'Configuration weaknesses',
    ],
  };
}

export function domainDisplay(
  status: DomainHealthStatus,
  checkedAt: string | null,
  message: string,
): DomainDisplay {
  if (status === 'unknown' || !checkedAt) {
    return {
      headline: 'Domain monitoring initializing',
      badge: 'Initializing',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      message:
        'CyberShield is collecting domain registration and DNS information. Monitoring normally becomes available within 24 hours of onboarding.',
      isInitializing: true,
    };
  }

  if (status === 'healthy') {
    return {
      headline: 'Healthy',
      badge: 'Monitoring active',
      badgeClass: 'bg-green-500/15 text-green-300 border-green-500/30',
      message,
      isInitializing: false,
    };
  }

  if (status === 'warning') {
    return {
      headline: 'Renew soon',
      badge: 'Warning',
      badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
      message,
      isInitializing: false,
    };
  }

  return {
    headline: 'Critical',
    badge: 'Action required',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    message,
    isInitializing: false,
  };
}

export function uptimeDisplay(status: UptimeStatus, httpStatus: number | null): UptimeDisplay {
  if (status === 'pending' || (status === 'unknown' && httpStatus === null)) {
    return {
      headline: 'Monitoring baseline in progress',
      badge: 'Collecting data',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      message:
        'CyberShield is collecting uptime data to establish a monitoring baseline. Checks run automatically in the background.',
      isCollecting: true,
    };
  }

  if (status === 'online') {
    return {
      headline: 'Healthy',
      badge: httpStatus !== null ? `HTTP ${httpStatus}` : 'Healthy',
      badgeClass: 'bg-green-500/15 text-green-300 border-green-500/30',
      message: 'Your website responded successfully during the most recent check.',
      isCollecting: false,
    };
  }

  if (status === 'degraded') {
    return {
      headline: 'Needs attention',
      badge: httpStatus !== null ? `HTTP ${httpStatus}` : 'Warning',
      badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
      message:
        'Your website is reachable, but returned an error response. Visitors may see broken pages or error messages.',
      isCollecting: false,
    };
  }

  if (status === 'offline') {
    return {
      headline: 'Critical',
      badge: 'Offline',
      badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
      message:
        'CyberShield could not reach your website or received a server error. Investigate hosting or DNS immediately.',
      isCollecting: false,
    };
  }

  return {
    headline: 'Monitoring baseline in progress',
    badge: 'Collecting data',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    message: 'CyberShield is establishing uptime monitoring for this website.',
    isCollecting: true,
  };
}

export function sslSummaryLabel(status: SslHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Renew soon';
    case 'critical':
      return 'Critical';
    default:
      return 'Checking';
  }
}

export function securityTrend(
  current: number | null,
  previous: number | null,
): SecurityTrend {
  if (current === null) {
    return {
      currentScore: null,
      previousScore: previous,
      direction: 'unknown',
      deltaLabel: 'Run a scan to start tracking',
    };
  }

  if (previous === null) {
    return {
      currentScore: current,
      previousScore: null,
      direction: 'unknown',
      deltaLabel: 'First score recorded — trend available after next scan',
    };
  }

  const delta = current - previous;
  if (delta > 0) {
    return {
      currentScore: current,
      previousScore: previous,
      direction: 'improving',
      deltaLabel: `+${delta} since last full scan`,
    };
  }
  if (delta < 0) {
    return {
      currentScore: current,
      previousScore: previous,
      direction: 'declining',
      deltaLabel: `${delta} since last full scan`,
    };
  }
  return {
    currentScore: current,
    previousScore: previous,
    direction: 'stable',
    deltaLabel: 'No change since last full scan',
  };
}

function toneFromSsl(status: SslHealthStatus): ExecutiveHealthSummary['rows'][0]['tone'] {
  if (status === 'healthy') return 'good';
  if (status === 'warning') return 'warn';
  if (status === 'critical') return 'bad';
  return 'neutral';
}

function toneFromDomain(status: DomainHealthStatus): ExecutiveHealthSummary['rows'][0]['tone'] {
  if (status === 'healthy') return 'good';
  if (status === 'warning') return 'warn';
  if (status === 'critical') return 'bad';
  return 'neutral';
}

export function buildExecutiveSummary(
  data: WebsiteHealthCenterData,
  verdictLabel: string,
  verdict: HealthVerdict,
): ExecutiveHealthSummary {
  const domain = domainDisplay(data.domain.status, data.domain.checkedAt, data.domain.message);
  const uptime = uptimeDisplay(data.uptime.status, data.uptime.httpStatus);
  const security = securityScorePresentation(data.security.score);

  const overallTone: ExecutiveHealthSummary['overallTone'] =
    verdict === 'all_clear'
      ? 'good'
      : verdict === 'minor_issues'
        ? 'warn'
        : verdict === 'attention_needed'
          ? 'warn'
          : 'bad';

  const lastFullScanLabel = data.security.completedAt
    ? formatRelativeScanTime(data.security.completedAt)
    : 'Not yet run';

  return {
    overallLabel: verdictLabel,
    overallTone,
    rows: [
      {
        label: 'Security',
        value: security.score !== null ? securityScoreLabel(security.score) : 'Not scanned',
        tone:
          security.score === null
            ? 'neutral'
            : security.score >= 70
              ? 'good'
              : security.score >= 50
                ? 'warn'
                : 'bad',
      },
      {
        label: 'SSL',
        value: sslSummaryLabel(data.ssl.status),
        tone: toneFromSsl(data.ssl.status),
      },
      {
        label: 'Domain',
        value: domain.isInitializing ? 'Monitoring active' : domain.headline,
        tone: domain.isInitializing ? 'neutral' : toneFromDomain(data.domain.status),
      },
      {
        label: 'Uptime',
        value: uptime.isCollecting ? 'Collecting data' : uptime.headline,
        tone: uptime.isCollecting
          ? 'neutral'
          : data.uptime.status === 'online'
            ? 'good'
            : data.uptime.status === 'offline'
              ? 'bad'
              : 'warn',
      },
      {
        label: 'Monitoring',
        value: data.monitoring.enabled ? 'Active' : 'Paused',
        tone: data.monitoring.enabled ? 'good' : 'neutral',
      },
    ],
    lastFullScanLabel,
  };
}

export function formatRelativeScanTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function rewriteHealthVerdict(input: {
  verdict: HealthVerdict;
  securityScore: number | null;
  unreadAlerts: number;
  uptimeCollecting: boolean;
  domainInitializing: boolean;
  recentChangeCount: number;
}): {
  label: string;
  intro: string;
  attentionAreas: string[];
  nextStep: string;
} {
  if (input.verdict === 'all_clear') {
    return {
      label: 'CyberShield monitoring active',
      intro: 'No significant issues detected. Your website appears operational and secure overall.',
      attentionAreas: [],
      nextStep: 'No action needed — monitoring continues automatically.',
    };
  }

  if (input.verdict === 'minor_issues') {
    const areas: string[] = [];
    if (input.securityScore !== null && input.securityScore < 70) {
      areas.push('Security score improvements available');
    }
    if (input.uptimeCollecting) {
      areas.push('Monitoring baseline still being established');
    }
    if (input.domainInitializing) {
      areas.push('Domain monitoring still initializing');
    }
    if (input.unreadAlerts > 0) {
      areas.push(
        `${input.unreadAlerts} active alert${input.unreadAlerts === 1 ? '' : 's'} require${input.unreadAlerts === 1 ? 's' : ''} review`,
      );
    }
    if (areas.length === 0) {
      areas.push('Minor configuration improvements available');
    }

    return {
      label: 'Minor issues detected',
      intro:
        'Your website appears operational and secure overall. CyberShield identified several areas that could improve security posture and long-term resilience.',
      attentionAreas: areas,
      nextStep: 'Review your findings and change timeline.',
    };
  }

  if (input.verdict === 'attention_needed') {
    return {
      label: 'Attention needed',
      intro:
        'CyberShield detected issues that should be addressed soon to protect visitors and avoid disruption.',
      attentionAreas: [
        ...(input.unreadAlerts > 0 ? [`${input.unreadAlerts} active alert(s) need review`] : []),
        ...(input.securityScore !== null && input.securityScore < 70
          ? ['Security score below recommended threshold']
          : []),
      ],
      nextStep: 'Review alerts and your latest security report this week.',
    };
  }

  return {
    label: 'Critical action required',
    intro:
      'CyberShield detected urgent issues that may affect website availability, trust, or visitor safety.',
    attentionAreas: ['Immediate review recommended'],
    nextStep: 'Address critical alerts and SSL, domain, or uptime issues today.',
  };
}

export function formatAlertForHealthCenter(alert: WebsiteHealthAlert): HealthCenterAlertView {
  const raw = `${alert.title} ${alert.message}`.toLowerCase();

  if (raw.includes('security score') || raw.includes('scored') || raw.includes('/100')) {
    const countMatch = alert.message.match(/(\d+)\s*item/i);
    const count = countMatch ? countMatch[1] : 'several';
    return {
      title: 'Website security needs attention',
      summary: `CyberShield identified ${count} security improvement${count === '1' ? '' : 's'} that could strengthen browser protections and website hardening. Most findings appear to be configuration-related and do not indicate active compromise.`,
      whyItMatters:
        'Missing protections can make it easier for attackers to intercept data, impersonate your site, or exploit visitor browsers — even when nothing looks wrong on the surface.',
      recommendedAction:
        'Review findings and prioritize high-impact improvements first.',
      severity: alert.severity,
    };
  }

  if (raw.includes('ssl') || raw.includes('certificate')) {
    return {
      title: alert.title.replace(/TLS/i, 'SSL'),
      summary:
        alert.message.length > 40
          ? alert.message
          : 'Your SSL certificate needs attention to keep visitor connections trusted and secure.',
      whyItMatters:
        'Expired or misconfigured certificates cause browser warnings that erode customer trust and can interrupt sales or lead forms.',
      recommendedAction: 'Renew or fix the certificate with your hosting provider or registrar.',
      severity: alert.severity,
    };
  }

  if (raw.includes('domain')) {
    return {
      title: alert.title,
      summary: alert.message,
      whyItMatters:
        'If your domain registration lapses, your website and email can go offline without warning.',
      recommendedAction: 'Confirm renewal dates with your domain registrar.',
      severity: alert.severity,
    };
  }

  return {
    title: alert.title,
    summary:
      alert.message.length > 200 ? `${alert.message.slice(0, 200)}…` : alert.message,
    whyItMatters:
      'Unresolved security or monitoring issues can grow into downtime, lost trust, or data exposure over time.',
    recommendedAction: 'Review the details and take action when you have a few minutes.',
    severity: alert.severity,
  };
}

export function retentionMessage(data: WebsiteHealthCenterData): string | null {
  const allClear =
    data.alerts.unreadCount === 0 &&
    data.ssl.status === 'healthy' &&
    (data.uptime.status === 'online' || data.uptime.status === 'pending') &&
    data.recentChanges.length === 0;

  if (!allClear) return null;

  return 'SSL certificates healthy. No meaningful website changes detected. Monitoring continues automatically.';
}

/** Copy constants for verification script */
export const BANNED_HEALTH_CENTER_PHRASES = [
  'Monitoring pending',
  'Not checked yet',
  'Unknown',
] as const;

export const REQUIRED_HEALTH_CENTER_PHRASES = [
  'Collecting data',
  'Initializing',
  'Below average',
  'CyberShield monitoring active',
] as const;
