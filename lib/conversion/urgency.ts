import type { BilledPlan } from '@/lib/billing/plans';
import { resolveScannedDomainLabel } from '@/lib/conversion/displayDomain';

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
  const site = resolveScannedDomainLabel({ url: domain }, 'your site');

  if (severity.level === 'high') {
    return {
      level: 'high',
      headline: 'Critical vulnerabilities found — your site is exposed right now.',
      subtext: `${site} scored ${score}/100. Enable continuous protection before attackers exploit these gaps.`,
      highlightPlan: 'growth',
    };
  }

  if (severity.level === 'medium') {
    return {
      level: 'medium',
      headline: 'Security gaps detected — one scan isn\'t enough.',
      subtext: `${site} needs ongoing monitoring. Continuous protection catches new risks between scans.`,
      highlightPlan: 'growth',
    };
  }

  return {
    level: 'low',
    headline: 'Good start — but threats evolve daily.',
    subtext: `${site} scored ${score}/100. A single scan misses changes. Enable protection to stay covered.`,
    highlightPlan: 'pro',
  };
}
