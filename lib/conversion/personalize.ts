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
      return 'Enable protection';
    case 'full_report':
      return 'Unlock full protection report';
    case 'export':
      return 'Enable protection to export';
    case 'upgrade':
    default:
      return 'Enable protection';
  }
}
