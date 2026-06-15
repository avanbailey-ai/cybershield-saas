import { getLastScannedDomain } from './limits';

export type CtaAction = 'monitor' | 'upgrade' | 'protect' | 'export' | 'full_report';

export function getPersonalizedCta(domain: string | null | undefined, action: CtaAction): string {
  const site =
    domain ??
    (typeof window !== 'undefined' ? getLastScannedDomain() : null) ??
    'your site';

  const hostname = site.replace(/^https?:\/\//, '').replace(/\/$/, '');

  switch (action) {
    case 'monitor':
      return `Enable daily monitoring for ${hostname}`;
    case 'protect':
      return `Protect ${hostname} continuously`;
    case 'full_report':
      return `Unlock full report for ${hostname}`;
    case 'export':
      return `Export ${hostname} security report`;
    case 'upgrade':
    default:
      return `Upgrade to protect ${hostname}`;
  }
}
