export type SslHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface SslCertificateInfo {
  issuer: string | null;
  subject: string | null;
  sans: string[];
  validFrom: string;
  expiresAt: string;
  daysUntilExpiry: number;
  chainValid: boolean;
}

export interface SslWebsiteSummary {
  websiteId: string;
  url: string;
  label: string | null;
  status: SslHealthStatus;
  daysUntilExpiry: number | null;
  expiresAt: string | null;
  issuer: string | null;
  checkedAt: string | null;
}

export const SSL_EXPIRY_THRESHOLDS = [30, 14, 7, 3, 0] as const;

export type SslExpiryThreshold = (typeof SSL_EXPIRY_THRESHOLDS)[number];
