export interface HeaderChecks {
  csp: boolean;
  hsts: boolean;
  xFrame: boolean;
  xContentType: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
}

export interface ScanResult {
  url: string;
  ssl: boolean;
  headers: HeaderChecks;
  rawHeaders: Record<string, string>;
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  passed: string[];
  explanation: string;
  error?: string;
}

export async function runScan(url: string): Promise<ScanResult> {
  // Safety guard: runScan should only be called by the queue worker (processQueue.ts).
  // We log a warning (not an error) if it appears to be called from outside that context,
  // so misuse is visible in logs without breaking anything.
  const stack = new Error().stack ?? '';
  if (!stack.includes('processQueue')) {
    console.warn(
      '[SECURITY] runScan called outside worker context. This should only be called by processQueue.ts.',
      '\nCall stack:', stack,
    );
  }

  console.log(`[SCAN ENTRY] ${new Date().toISOString()} — starting scan for ${url}`);

  const issues: string[] = [];
  const passed: string[] = [];
  let rawHeaders: Record<string, string> = {};

  const ssl = url.toLowerCase().startsWith('https://');

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    rawHeaders = Object.fromEntries(response.headers.entries());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      ssl: false,
      headers: {
        csp: false,
        hsts: false,
        xFrame: false,
        xContentType: false,
        referrerPolicy: false,
        permissionsPolicy: false,
      },
      rawHeaders: {},
      score: 0,
      riskLevel: 'critical',
      issues: [`Could not reach website: ${message}`],
      passed: [],
      explanation: `Scan failed: ${message}`,
      error: message,
    };
  }

  let score = 100;

  if (!ssl) {
    score -= 25;
    issues.push('No HTTPS — traffic is transmitted in plaintext');
  } else {
    passed.push('HTTPS/SSL enabled');
  }

  const h = rawHeaders;
  const hasCsp = !!h['content-security-policy'];
  const hasHsts = !!h['strict-transport-security'];
  const hasXFrame = !!h['x-frame-options'];
  const hasXContentType = !!h['x-content-type-options'];
  const hasReferrer = !!h['referrer-policy'];
  const hasPermissions = !!h['permissions-policy'];

  if (!hasCsp) {
    score -= 15;
    issues.push('Missing Content-Security-Policy header — increases XSS risk');
  } else {
    passed.push('Content-Security-Policy header present');
  }

  if (!hasHsts) {
    score -= 15;
    issues.push('Missing Strict-Transport-Security (HSTS) header — connections can be downgraded');
  } else {
    passed.push('Strict-Transport-Security (HSTS) header present');
  }

  if (!hasXFrame) {
    score -= 10;
    issues.push('Missing X-Frame-Options header — site may be vulnerable to clickjacking');
  } else {
    passed.push('X-Frame-Options header present');
  }

  if (!hasXContentType) {
    score -= 10;
    issues.push('Missing X-Content-Type-Options header — MIME-sniffing possible');
  } else {
    passed.push('X-Content-Type-Options header present');
  }

  if (!hasReferrer) {
    score -= 10;
    issues.push('Missing Referrer-Policy header — may leak sensitive URL information');
  } else {
    passed.push('Referrer-Policy header present');
  }

  if (!hasPermissions) {
    score -= 10;
    issues.push('Missing Permissions-Policy header — browser features unrestricted');
  } else {
    passed.push('Permissions-Policy header present');
  }

  score = Math.max(0, score);

  const riskLevel: ScanResult['riskLevel'] =
    score >= 80 ? 'low' :
    score >= 60 ? 'medium' :
    score >= 40 ? 'high' : 'critical';

  const missingHeaders = [
    !hasCsp && 'CSP',
    !hasHsts && 'HSTS',
    !hasXFrame && 'X-Frame-Options',
    !hasXContentType && 'X-Content-Type-Options',
    !hasReferrer && 'Referrer-Policy',
    !hasPermissions && 'Permissions-Policy',
  ].filter(Boolean) as string[];

  let explanation = `Score is ${score}/100. `;
  explanation += ssl ? 'SSL is enabled. ' : 'SSL is not enabled. ';
  if (missingHeaders.length > 0) {
    explanation += `Missing headers: ${missingHeaders.join(', ')} — these increase XSS and MITM risk.`;
  } else {
    explanation += 'All major security headers are present.';
  }

  return {
    url,
    ssl,
    headers: {
      csp: hasCsp,
      hsts: hasHsts,
      xFrame: hasXFrame,
      xContentType: hasXContentType,
      referrerPolicy: hasReferrer,
      permissionsPolicy: hasPermissions,
    },
    rawHeaders,
    score,
    riskLevel,
    issues,
    passed,
    explanation,
  };
}
