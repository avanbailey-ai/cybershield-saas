import { createAdminClient } from '@/lib/supabase/admin';
import type { SslCertificateInfo } from './types';

export async function persistSslCertificate(params: {
  websiteId: string;
  scanId: string | null;
  certificate: SslCertificateInfo;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { websiteId, scanId, certificate } = params;

  const { data, error } = await supabase
    .from('ssl_certificates')
    .insert({
      website_id: websiteId,
      scan_id: scanId,
      issuer: certificate.issuer,
      subject: certificate.subject,
      sans: certificate.sans,
      valid_from: certificate.validFrom,
      expires_at: certificate.expiresAt,
      days_until_expiry: certificate.daysUntilExpiry,
      chain_valid: certificate.chainValid,
      checked_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ssl] persist certificate failed:', error.message);
    return null;
  }

  return data?.id ?? null;
}
