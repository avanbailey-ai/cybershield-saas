import type { BilledPlan } from '@/lib/billing/plans';

export type UrgencyLevel = 'low' | 'medium' | 'high';

export interface UrgencyMessage {
  level: UrgencyLevel;
  headline: string;
  subtext: string;
  highlightPlan: BilledPlan;
}

export function getSeverityCategory(score: number): {
  level: UrgencyLevel;
  label: string;
  description: string;
} {
  if (score >= 70) {
    return {
      level: 'low',
      label: 'Low',
      description: 'Good but improvements needed',
    };
  }
  if (score >= 40) {
    return {
      level: 'medium',
      label: 'Medium',
      description: 'Security gaps detected',
    };
  }
  return {
    level: 'high',
    label: 'High',
    description: 'Critical vulnerabilities found',
  };
}

export function getUrgencyMessage(score: number, domain?: string): UrgencyMessage {
  const severity = getSeverityCategory(score);
  const site = domain ? domain.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'your site';

  if (severity.level === 'high') {
    return {
      level: 'high',
      headline: 'Your site is actively exposed to security risks right now.',
      subtext: `${site} scored ${score}/100. Enable real-time protection with daily monitoring before attackers find these gaps.`,
      highlightPlan: 'growth',
    };
  }

  if (severity.level === 'medium') {
    return {
      level: 'medium',
      headline: 'Security gaps detected — fix them before they become breaches.',
      subtext: `${site} needs continuous scanning. Growth plan includes daily checks and priority alerts.`,
      highlightPlan: 'growth',
    };
  }

  return {
    level: 'low',
    headline: 'Good foundation — stay protected with continuous monitoring.',
    subtext: `${site} looks solid, but one-time scans miss new threats. Pro keeps you covered with daily monitoring.`,
    highlightPlan: 'pro',
  };
}
