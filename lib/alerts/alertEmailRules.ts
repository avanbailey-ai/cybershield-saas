const CRITICAL_HIGH = new Set(['critical', 'high']);

const SCORE_DROP_ATTACK_MIN = 15;

export interface AlertEmailCandidate {
  severity: string;
  type: string | null;
  message?: string;
  website_id?: string;
}

/** Only critical/high issues trigger grouped monitoring alert emails. */
export function shouldQueueAlertEmail(severity: string): boolean {
  return CRITICAL_HIGH.has(severity);
}

function parseScoreDropPoints(message: string): number | null {
  const match =
    message.match(/[−-](\d+)\s*points?/i) ??
    message.match(/decreased from \d+ to \d+ \([−-](\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Single alert signals an active attack or sharp worsening (bypasses daily owner email cap).
 */
export function isUnderAttackAlert(alert: AlertEmailCandidate): boolean {
  const type = alert.type ?? '';

  if (type === 'ssl_changed' && alert.severity === 'critical') return true;
  if (type === 'risk_increase') return true;
  if (type === 'header_removed' && alert.severity === 'critical') return true;

  if (type === 'security_score_drop') {
    if (alert.severity === 'critical') return true;
    if (alert.severity === 'high') {
      const drop = parseScoreDropPoints(alert.message ?? '');
      return drop === null || drop >= SCORE_DROP_ATTACK_MIN;
    }
  }

  return false;
}

/**
 * Batch-level attack: any worsening signal or multiple critical alerts in one flush.
 */
export function isBatchUnderAttack(alerts: AlertEmailCandidate[]): boolean {
  if (alerts.some(isUnderAttackAlert)) return true;
  return alerts.filter((a) => a.severity === 'critical').length >= 2;
}