import type { HeaderChecks } from './runScan';

/** Comparable scan state persisted for change detection between scans. */
export interface ScanSnapshot {
  ssl: boolean;
  securityHeaders: Record<string, string>;
  metaTags: Record<string, string>;
  scripts: string[];
  loginFormDetected: boolean;
  endpoints: string[];
}

export interface PageSnapshotPartial {
  metaTags: Record<string, string>;
  scripts: string[];
  loginFormDetected: boolean;
  endpoints: string[];
}

const SECURITY_HEADER_KEYS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
] as const;

const HEADER_CHECK_MAP: Record<string, keyof HeaderChecks> = {
  'content-security-policy': 'csp',
  'strict-transport-security': 'hsts',
  'x-frame-options': 'xFrame',
  'x-content-type-options': 'xContentType',
  'referrer-policy': 'referrerPolicy',
  'permissions-policy': 'permissionsPolicy',
};

const INTERESTING_ENDPOINT =
  /\/api\b|\/admin\b|\/login\b|\/auth\b|\/graphql\b|\/webhook|\/v\d+\/|\.json$/i;

/** Extract security-relevant response headers for diffing. */
export function extractSecurityHeaders(rawHeaders: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    if (SECURITY_HEADER_KEYS.includes(lower as (typeof SECURITY_HEADER_KEYS)[number])) {
      result[lower] = value;
    }
  }
  return result;
}

function normalizeEndpoint(raw: string, baseUrl: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:')) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const base = new URL(baseUrl);
      if (parsed.origin !== base.origin) return null;
      return `${parsed.pathname}${parsed.search}`;
    }
    if (trimmed.startsWith('/')) {
      return trimmed.split('#')[0];
    }
  } catch {
    return null;
  }
  return null;
}

function isInterestingEndpoint(path: string): boolean {
  return INTERESTING_ENDPOINT.test(path);
}

/** Parse HTML body for scripts, meta tags, login forms, and sensitive endpoints. */
export function parseHtmlSnapshot(html: string, baseUrl: string): PageSnapshotPartial {
  const metaTags: Record<string, string> = {};
  const metaPatterns = [
    /<meta\s+[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi,
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']([^"']+)["'][^>]*>/gi,
  ];

  for (const pattern of metaPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2];
      if (pattern === metaPatterns[1]) {
        metaTags[match[2].toLowerCase()] = match[1];
      } else {
        metaTags[key] = value;
      }
    }
  }

  const scripts = new Set<string>();
  const scriptSrcPattern = /<script[^>]+src=["']([^"']+)["']/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptSrcPattern.exec(html)) !== null) {
    scripts.add(scriptMatch[1]);
  }

  const inlineScriptPattern = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let inlineCount = 0;
  while (inlineScriptPattern.exec(html) !== null) {
    inlineCount += 1;
  }
  if (inlineCount > 0) {
    scripts.add(`inline:${inlineCount}`);
  }

  const loginFormDetected =
    /<form\b/i.test(html) && /<input[^>]+type=["']password["']/i.test(html);

  const endpoints = new Set<string>();
  const linkPattern = /(?:href|action)=["']([^"']+)["']/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const normalized = normalizeEndpoint(linkMatch[1], baseUrl);
    if (normalized && isInterestingEndpoint(normalized)) {
      endpoints.add(normalized);
    }
  }

  return {
    metaTags,
    scripts: [...scripts].sort(),
    loginFormDetected,
    endpoints: [...endpoints].sort(),
  };
}

export function buildSnapshotFromScanResult(params: {
  ssl: boolean;
  rawHeaders: Record<string, string>;
  pageSnapshot?: PageSnapshotPartial;
}): ScanSnapshot {
  const page = params.pageSnapshot ?? {
    metaTags: {},
    scripts: [],
    loginFormDetected: false,
    endpoints: [],
  };

  return {
    ssl: params.ssl,
    securityHeaders: extractSecurityHeaders(params.rawHeaders),
    metaTags: page.metaTags,
    scripts: page.scripts,
    loginFormDetected: page.loginFormDetected,
    endpoints: page.endpoints,
  };
}

/** Reconstruct snapshot from a persisted scan row (supports legacy rows without scan_snapshot). */
export function buildSnapshotFromDbRow(row: {
  ssl_valid: boolean | null;
  headers: unknown;
  scan_snapshot: unknown;
}): ScanSnapshot | null {
  if (row.scan_snapshot && typeof row.scan_snapshot === 'object') {
    const snap = row.scan_snapshot as Partial<ScanSnapshot>;
    return {
      ssl: snap.ssl ?? row.ssl_valid ?? false,
      securityHeaders: snap.securityHeaders ?? {},
      metaTags: snap.metaTags ?? {},
      scripts: snap.scripts ?? [],
      loginFormDetected: snap.loginFormDetected ?? false,
      endpoints: snap.endpoints ?? [],
    };
  }

  if (row.ssl_valid === null && !row.headers) {
    return null;
  }

  const headers = (row.headers ?? {}) as HeaderChecks;
  const securityHeaders: Record<string, string> = {};
  for (const [headerName, checkKey] of Object.entries(HEADER_CHECK_MAP)) {
    if (headers[checkKey]) {
      securityHeaders[headerName] = 'present';
    }
  }

  return {
    ssl: row.ssl_valid ?? false,
    securityHeaders,
    metaTags: {},
    scripts: [],
    loginFormDetected: false,
    endpoints: [],
  };
}
