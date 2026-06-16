import type { HeaderChecks } from './runScan';

/** Comparable scan state persisted for change detection between scans. */
export interface ScanSnapshot {
  ssl: boolean;
  securityHeaders: Record<string, string>;
  metaTags: Record<string, string>;
  scripts: string[];
  loginFormDetected: boolean;
  endpoints: string[];
  formsDetected?: number;
  thirdPartyScripts?: string[];
  externalApiCalls?: string[];
  techFingerprint?: TechFingerprint;
}

export interface TechFingerprint {
  frameworks: string[];
  cdn: string[];
  analytics: string[];
}

export interface PageSnapshotPartial {
  metaTags: Record<string, string>;
  scripts: string[];
  loginFormDetected: boolean;
  endpoints: string[];
  formsDetected: number;
  thirdPartyScripts: string[];
  externalApiCalls: string[];
  techFingerprint: TechFingerprint;
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

const THIRD_PARTY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /google-analytics|googletagmanager|gtag\/js/i, label: 'Google Analytics' },
  { pattern: /facebook\.net|fbevents|connect\.facebook/i, label: 'Facebook Pixel' },
  { pattern: /hotjar|clarity\.ms|segment\.com|mixpanel/i, label: 'Analytics' },
  { pattern: /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i, label: 'Public CDN' },
  { pattern: /cdn\.shopify\.com|shopify/i, label: 'Shopify' },
  { pattern: /wp-content|wp-includes|wordpress/i, label: 'WordPress' },
];

const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /__NEXT_DATA__|_next\/static/i, label: 'Next.js' },
  { pattern: /react(?:\.production)?\.min\.js|data-reactroot|__REACT_DEVTOOLS/i, label: 'React' },
  { pattern: /wp-content|wp-includes/i, label: 'WordPress' },
  { pattern: /cdn\.shopify\.com/i, label: 'Shopify' },
];

const CDN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /cloudflare|cf-ray/i, label: 'Cloudflare' },
  { pattern: /fastly|akamai|cloudfront|azureedge/i, label: 'CDN' },
];

function matchLabels(text: string, patterns: Array<{ pattern: RegExp; label: string }>): string[] {
  const labels = new Set<string>();
  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) labels.add(label);
  }
  return [...labels];
}

function extractExternalOrigins(scripts: string[], baseUrl: string): string[] {
  const origins = new Set<string>();
  try {
    const base = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    for (const script of scripts) {
      if (script.startsWith('inline:')) continue;
      try {
        const src = script.startsWith('http') ? script : `https://${script.replace(/^\/\//, '')}`;
        const parsed = new URL(src);
        if (parsed.hostname !== base.hostname) {
          origins.add(parsed.origin);
        }
      } catch {
        // skip unparseable
      }
    }
  } catch {
    // skip
  }
  return [...origins].sort();
}

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

  const formMatches = html.match(/<form\b/gi);
  const formsDetected = formMatches ? formMatches.length : 0;

  const scriptList = [...scripts];
  const combinedText = html + scriptList.join(' ');
  const thirdPartyScripts = matchLabels(combinedText, THIRD_PARTY_PATTERNS);
  const frameworks = matchLabels(combinedText, FRAMEWORK_PATTERNS);
  const cdn = matchLabels(combinedText, CDN_PATTERNS);
  const analytics = thirdPartyScripts.filter((s) =>
    /Analytics|Google Analytics|Facebook Pixel/i.test(s),
  );
  const externalApiCalls = extractExternalOrigins(scriptList, baseUrl);

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
    scripts: scriptList.sort(),
    loginFormDetected,
    endpoints: [...endpoints].sort(),
    formsDetected,
    thirdPartyScripts,
    externalApiCalls,
    techFingerprint: { frameworks, cdn, analytics },
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
    formsDetected: 0,
    thirdPartyScripts: [],
    externalApiCalls: [],
    techFingerprint: { frameworks: [], cdn: [], analytics: [] },
  };

  return {
    ssl: params.ssl,
    securityHeaders: extractSecurityHeaders(params.rawHeaders),
    metaTags: page.metaTags,
    scripts: page.scripts,
    loginFormDetected: page.loginFormDetected,
    endpoints: page.endpoints,
    formsDetected: page.formsDetected,
    thirdPartyScripts: page.thirdPartyScripts,
    externalApiCalls: page.externalApiCalls,
    techFingerprint: page.techFingerprint,
  };
}

/** Fill derived snapshot fields when loading legacy rows that only stored scripts. */
export function enrichPageSnapshotPartial(
  partial: PageSnapshotPartial,
  baseUrl: string,
): PageSnapshotPartial {
  const combinedText = partial.scripts.join(' ');
  const thirdPartyScripts =
    partial.thirdPartyScripts.length > 0
      ? partial.thirdPartyScripts
      : matchLabels(combinedText, THIRD_PARTY_PATTERNS);
  const externalApiCalls =
    partial.externalApiCalls.length > 0
      ? partial.externalApiCalls
      : extractExternalOrigins(partial.scripts, baseUrl);
  const frameworks =
    partial.techFingerprint.frameworks.length > 0
      ? partial.techFingerprint.frameworks
      : matchLabels(combinedText, FRAMEWORK_PATTERNS);
  const cdn =
    partial.techFingerprint.cdn.length > 0
      ? partial.techFingerprint.cdn
      : matchLabels(combinedText, CDN_PATTERNS);
  const analytics =
    partial.techFingerprint.analytics.length > 0
      ? partial.techFingerprint.analytics
      : thirdPartyScripts.filter((s) => /Analytics|Google Analytics|Facebook Pixel/i.test(s));

  return {
    ...partial,
    thirdPartyScripts,
    externalApiCalls,
    techFingerprint: { frameworks, cdn, analytics },
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
      formsDetected: snap.formsDetected,
      thirdPartyScripts: snap.thirdPartyScripts,
      externalApiCalls: snap.externalApiCalls,
      techFingerprint: snap.techFingerprint,
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
