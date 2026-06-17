const INVALID_DOMAIN_VALUES = new Set(['undefined', 'null', 'nan']);

function isInvalidDomainValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (INVALID_DOMAIN_VALUES.has(normalized)) return true;
  return /undefined|null|nan/i.test(normalized);
}

function hostnameFromRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (isInvalidDomainValue(trimmed)) return null;

  try {
    const host = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).hostname;
    if (isInvalidDomainValue(host)) return null;
    return host;
  } catch {
    const host = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    if (isInvalidDomainValue(host)) return null;
    return host;
  }
}

/** Resolve a user-facing domain label from scan context (never returns undefined/null/NaN). */
export function resolveScannedDomainLabel(
  options: {
    normalizedDomain?: string | null;
    submittedDomain?: string | null;
    url?: string | null;
  },
  fallback = 'this website',
): string {
  for (const raw of [options.normalizedDomain, options.submittedDomain, options.url]) {
    const host = typeof raw === 'string' ? hostnameFromRaw(raw) : null;
    if (host) return host;
  }
  return fallback;
}
