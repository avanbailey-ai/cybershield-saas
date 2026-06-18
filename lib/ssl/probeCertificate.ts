import tls from 'node:tls';
import type { SslCertificateInfo } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;

function parseSans(subjectaltname: string | undefined): string[] {
  if (!subjectaltname) return [];
  return subjectaltname
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('DNS:'))
    .map((part) => part.slice(4))
    .filter(Boolean);
}

function certField(value: string | string[] | undefined | null): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parsePeerCertificate(cert: tls.PeerCertificate): SslCertificateInfo | null {
  if (!cert || !cert.valid_to) return null;

  const expiresAt = new Date(cert.valid_to);
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : expiresAt;
  if (Number.isNaN(expiresAt.getTime())) return null;

  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / MS_DAY);

  return {
    issuer: certField(cert.issuer?.O) ?? certField(cert.issuer?.CN),
    subject: certField(cert.subject?.CN),
    sans: parseSans(cert.subjectaltname),
    validFrom: validFrom.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysUntilExpiry,
    chainValid: true,
  };
}

/** TLS handshake probe — works on Node/Vercel serverless for HTTPS sites. */
export async function probeCertificate(
  hostname: string,
  port = 443,
  timeoutMs = 8000,
): Promise<SslCertificateInfo | null> {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: SslCertificateInfo | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(false);
          socket.end();
          finish(parsePeerCertificate(cert));
        } catch {
          socket.destroy();
          finish(null);
        }
      },
    );

    socket.on('error', () => finish(null));
    socket.on('timeout', () => {
      socket.destroy();
      finish(null);
    });
  });
}

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
