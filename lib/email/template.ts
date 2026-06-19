import { getReplyToAddress, type EmailCategory } from './config';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export interface EmailDocumentInput {
  title: string;
  bodyHtml: string;
  bodyText: string;
  category: EmailCategory;
  reason: string;
  ctaLabel?: string;
  ctaHref?: string;
  includeUnsubscribe?: boolean;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export function buildEmailDocument(input: EmailDocumentInput): {
  html: string;
  text: string;
  replyTo: string;
} {
  const site = resolveSiteUrl();
  const replyTo = getReplyToAddress(input.category);
  const ctaBlock =
    input.ctaLabel && input.ctaHref
      ? `<a href="${input.ctaHref}" style="display:inline-block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;">${input.ctaLabel}</a>`
      : '';

  const unsubscribe =
    input.includeUnsubscribe !== false
      ? `<p style="margin-top:16px;font-size:12px;color:#9ca3af;">To stop outreach emails, reply with STOP or email ${replyTo}.</p>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;margin:0;padding:24px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">CyberShield Cloud</p>
      <h1 style="color:#fff;margin:0;font-size:22px;line-height:1.3;">${input.title}</h1>
    </div>
    <div style="padding:32px;">
      <div style="color:#374151;font-size:16px;line-height:1.65;">${input.bodyHtml}</div>
      ${ctaBlock}
    </div>
    <div style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;"><strong>CyberShield Cloud</strong></p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Website: <a href="${site}" style="color:#2563eb;">${site.replace(/^https?:\/\//, '')}</a></p>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Reply-to: <a href="mailto:${replyTo}" style="color:#2563eb;">${replyTo}</a></p>
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Why you received this: ${input.reason}</p>
      ${unsubscribe}
      <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
        <a href="${site}/privacy" style="color:#6b7280;">Privacy</a> ·
        <a href="${site}/terms" style="color:#6b7280;">Terms</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `${input.title}

${input.bodyText}

${input.ctaLabel && input.ctaHref ? `${input.ctaLabel}: ${input.ctaHref}\n` : ''}
---
CyberShield Cloud
${site}
Reply-to: ${replyTo}
Why you received this: ${input.reason}
${input.includeUnsubscribe !== false ? `Unsubscribe: reply STOP or email ${replyTo}` : ''}
Privacy: ${site}/privacy
Terms: ${site}/terms`;

  return { html, text, replyTo };
}

export { htmlToPlain };
