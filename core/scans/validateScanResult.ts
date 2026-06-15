/**
 * Pure integrity check for scan results before save.
 */
export function validateScanResult(result: {
  score?: unknown;
  issues?: unknown;
  url?: string;
  expectedUrl?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof result.score !== 'number' || Number.isNaN(result.score)) {
    errors.push('score must be a number');
  } else if (result.score < 0 || result.score > 100) {
    errors.push('score must be between 0 and 100');
  }

  if (!Array.isArray(result.issues)) {
    errors.push('issues must be an array');
  } else if (!result.issues.every((item) => typeof item === 'string')) {
    errors.push('issues must contain only strings');
  }

  if (result.url !== undefined && typeof result.url !== 'string') {
    errors.push('url must be a string');
  }

  if (
    result.expectedUrl &&
    result.url &&
    normalizeUrl(result.url) !== normalizeUrl(result.expectedUrl)
  ) {
    errors.push('url does not match expected website URL');
  }

  return { valid: errors.length === 0, errors };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '');
  }
}
