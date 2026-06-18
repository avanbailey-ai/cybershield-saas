import type { FindingCategory, Severity } from '@/lib/securityIntelligence/types';
import type { RiskLevel } from '@/types';

export function severityBadgeClass(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-green-500/15 text-green-400 border-green-500/30';
  }
}

export function severityGlowClass(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'border-red-500/40 shadow-[0_0_24px_rgba(239,68,68,0.22)]';
    case 'high':
      return 'border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.18)]';
    case 'medium':
      return 'border-yellow-500/40 shadow-[0_0_16px_rgba(234,179,8,0.14)]';
    case 'low':
      return 'border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.12)]';
  }
}

export function riskBadgeClass(level: RiskLevel | string): string {
  switch (level) {
    case 'critical':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-green-500/15 text-green-400 border-green-500/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
}

export function riskScoreColor(level: RiskLevel | string | null): string {
  switch (level) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-green-400';
    default:
      return 'text-gray-400';
  }
}

export function categoryLabel(category: FindingCategory): string {
  switch (category) {
    case 'transport':
      return 'Connection security';
    case 'headers':
      return 'Security headers';
    case 'attack_surface':
      return 'Page exposure';
    case 'authentication':
      return 'Login & forms';
    case 'third_party':
      return 'Third-party scripts';
  }
}

export function formatSeverity(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function formatRiskLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}
