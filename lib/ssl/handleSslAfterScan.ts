import { probeCertificate, hostnameFromUrl } from './probeCertificate';
import type { SslCertificateInfo } from './types';

export async function probeSslCertificateForUrl(url: string): Promise<SslCertificateInfo | null> {
  if (!url.toLowerCase().startsWith('https://')) return null;
  const host = hostnameFromUrl(url);
  if (!host) return null;
  return probeCertificate(host);
}

export async function handleSslCertificateAfterScan(params: {
  websiteId: string;
  websiteUrl: string;
  userId: string;
  orgId: string | null;
  scanId: string;
  certificate: SslCertificateInfo;
}): Promise<void> {
  const { persistSslCertificate } = await import('./persistSslCertificate');
  const { processSslExpiryAlerts } = await import('./processSslExpiryAlerts');

  await persistSslCertificate({
    websiteId: params.websiteId,
    scanId: params.scanId,
    certificate: params.certificate,
  });

  const alertResult = await processSslExpiryAlerts({
    websiteId: params.websiteId,
    websiteUrl: params.websiteUrl,
    userId: params.userId,
    orgId: params.orgId,
    scanId: params.scanId,
    certificate: params.certificate,
  });

  if (alertResult.alertsCreated > 0) {
    console.log(
      `[ssl] expiry alerts website=${params.websiteId} thresholds=${alertResult.thresholdsFired.join(',')}`,
    );
  }
}
