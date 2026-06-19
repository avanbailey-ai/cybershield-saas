import { classifyContactConfidence, type ContactConfidence } from './prospectQualityBrain';
import { sanitizePhone } from './placeholderPhone';

export interface ContactSignals {
  contact_page_found: boolean;
  contact_email_found: boolean;
  contact_phone_found: boolean;
  contact_linkedin_found: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  contact_confidence: ContactConfidence;
}

const EMPTY_SIGNALS: ContactSignals = {
  contact_page_found: false,
  contact_email_found: false,
  contact_phone_found: false,
  contact_linkedin_found: false,
  contact_email: null,
  contact_phone: null,
  contact_linkedin: null,
  contact_confidence: 'no_contact',
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi;
const CONTACT_PATH_RE = /href=["'][^"']*\/(contact|about|get-in-touch)[^"']*["']/i;

const PLACEHOLDER_LOCAL = /^(example|test|yourname|email|placeholder|user|name|admin)$/i;

function pickBestEmail(matches: string[]): string | null {
  const filtered = matches.filter((e) => {
    const lower = e.toLowerCase();
    const local = lower.split('@')[0] ?? '';
    return (
      !e.endsWith('.png') &&
      !e.endsWith('.jpg') &&
      !lower.includes('example.com') &&
      !lower.includes('sentry.io') &&
      !lower.includes('wixpress.com') &&
      !lower.startsWith('noreply@') &&
      !lower.startsWith('no-reply@') &&
      !lower.startsWith('donotreply@') &&
      !PLACEHOLDER_LOCAL.test(local)
    );
  });
  const preferred = filtered.find(
    (e) =>
      e.startsWith('info@') ||
      e.startsWith('contact@') ||
      e.startsWith('hello@') ||
      e.startsWith('sales@') ||
      e.startsWith('support@'),
  );
  return preferred ?? filtered[0] ?? null;
}

const CONTACT_PATHS = ['/contact', '/contact-us', '/contactus', '/about', '/about-us', '/get-in-touch'];

export function parseContactSignalsFromHtml(html: string, pageUrl: string): ContactSignals {
  const signals = { ...EMPTY_SIGNALS };

  const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailto?.[1]) {
    const candidate = mailto[1].toLowerCase();
    const local = candidate.split('@')[0] ?? '';
    if (!candidate.includes('example.com') && !PLACEHOLDER_LOCAL.test(local)) {
      signals.contact_email_found = true;
      signals.contact_email = mailto[1];
    }
  }
  if (!signals.contact_email_found) {
    const emails = pickBestEmail(html.match(EMAIL_RE) ?? []);
    if (emails) {
      signals.contact_email_found = true;
      signals.contact_email = emails;
    }
  }

  const tel = html.match(/tel:([+\d().\s-]+)/i);
  if (tel?.[1]) {
    const phone = sanitizePhone(tel[1]);
    if (phone) {
      signals.contact_phone_found = true;
      signals.contact_phone = phone;
    }
  } else {
    const phones = html.match(PHONE_RE);
    if (phones?.[0]) {
      const phone = sanitizePhone(phones[0]);
      if (phone) {
        signals.contact_phone_found = true;
        signals.contact_phone = phone;
      }
    }
  }

  const linkedin = html.match(LINKEDIN_RE);
  if (linkedin?.[0]) {
    signals.contact_linkedin_found = true;
    signals.contact_linkedin = linkedin[0];
  }

  if (CONTACT_PATH_RE.test(html)) {
    signals.contact_page_found = true;
  }

  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    if (path.includes('contact') || path.includes('about')) {
      signals.contact_page_found = true;
    }
  } catch {
    /* ignore */
  }

  finalizeContactConfidence(signals, pageUrl);
  return signals;
}

function finalizeContactConfidence(signals: ContactSignals, website: string): void {
  if (signals.contact_email) {
    signals.contact_confidence = classifyContactConfidence(signals.contact_email, website, {
      fromPublicPage: true,
    });
    if (signals.contact_confidence === 'no_contact') {
      signals.contact_email_found = false;
      signals.contact_email = null;
    }
  } else {
    signals.contact_confidence = 'no_contact';
  }
}

export async function discoverContactSignals(website: string): Promise<ContactSignals> {
  let url = website.trim();
  if (!url.startsWith('http')) url = `https://${url}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com' },
    });
    if (!res.ok) return { ...EMPTY_SIGNALS };

    const html = (await res.text()).slice(0, 120_000);
    const signals = parseContactSignalsFromHtml(html, res.url || url);

    if (!signals.contact_email_found) {
      for (const path of CONTACT_PATHS) {
        try {
          const pageUrl = new URL(path, res.url || url).toString();
          const pageRes = await fetch(pageUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com' },
          });
          if (!pageRes.ok) continue;
          signals.contact_page_found = true;
          const pageHtml = (await pageRes.text()).slice(0, 80_000);
          const extra = parseContactSignalsFromHtml(pageHtml, pageUrl);
          if (extra.contact_email_found && extra.contact_email) {
            signals.contact_email_found = true;
            signals.contact_email = extra.contact_email;
            break;
          }
          if (!signals.contact_phone_found && extra.contact_phone_found) {
            signals.contact_phone_found = true;
            signals.contact_phone = extra.contact_phone;
          }
        } catch {
          /* try next path */
        }
      }
    }

    if (!signals.contact_page_found) {
      try {
        const contactUrl = new URL('/contact', res.url || url).toString();
        const contactRes = await fetch(contactUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com' },
        });
        if (contactRes.ok) {
          signals.contact_page_found = true;
          const contactHtml = (await contactRes.text()).slice(0, 80_000);
          const extra = parseContactSignalsFromHtml(contactHtml, contactUrl);
          if (!signals.contact_email_found && extra.contact_email_found) {
            signals.contact_email_found = true;
            signals.contact_email = extra.contact_email;
          }
          if (!signals.contact_phone_found && extra.contact_phone_found) {
            signals.contact_phone_found = true;
            signals.contact_phone = extra.contact_phone;
          }
        }
      } catch {
        /* contact path optional */
      }
    }

    finalizeContactConfidence(signals, res.url || url);
    return signals;
  } catch {
    return { ...EMPTY_SIGNALS };
  } finally {
    clearTimeout(timer);
  }
}
