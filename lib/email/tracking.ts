import { createHmac } from 'crypto';
import { EMAIL_LINKS_DOMAIN, EMAIL_TRACK_DOMAIN, getTrackingBaseUrl } from './config';

const SECRET = process.env.EMAIL_TRACKING_SECRET ?? process.env.CRON_SECRET ?? 'dev-tracking';

export function signTrackingPayload(deliveryId: string, target?: string): string {
  const payload = target ? `${deliveryId}:${target}` : deliveryId;
  return createHmac('sha256', SECRET).update(payload).digest('base64url').slice(0, 16);
}

export function verifyTrackingSignature(
  deliveryId: string,
  signature: string,
  target?: string,
): boolean {
  const expected = signTrackingPayload(deliveryId, target);
  return expected === signature;
}

export function buildClickTrackingUrl(deliveryId: string, targetUrl: string): string {
  const sig = signTrackingPayload(deliveryId, targetUrl);
  const base = getTrackingBaseUrl(EMAIL_LINKS_DOMAIN, '/api/email/click');
  const params = new URLSearchParams({
    d: deliveryId,
    u: targetUrl,
    s: sig,
  });
  return `${base}?${params.toString()}`;
}

export function buildOpenTrackingUrl(deliveryId: string): string {
  const sig = signTrackingPayload(deliveryId);
  const base = getTrackingBaseUrl(EMAIL_TRACK_DOMAIN, '/api/email/open');
  return `${base}?d=${deliveryId}&s=${sig}`;
}

export function wrapLinksWithTracking(html: string, deliveryId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url: string) => {
    if (url.includes('/api/email/click')) return match;
    const tracked = buildClickTrackingUrl(deliveryId, url);
    return `href="${tracked}"`;
  });
}

export function injectOpenPixel(html: string, deliveryId: string): string {
  const pixel = buildOpenTrackingUrl(deliveryId);
  const img = `<img src="${pixel}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${img}</body>`);
  }
  return `${html}${img}`;
}
