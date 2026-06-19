/** Strip non-digits for placeholder detection. */
export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

const KNOWN_PLACEHOLDER_DIGITS = new Set([
  '0000000000',
  '1111111111',
  '1234567890',
  '123456789',
  '9999999999',
  '5555555555',
  '0123456789',
]);

/** Treat fake or junk phone values as missing — never show in UI or scoring. */
export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  const digits = phoneDigitsOnly(phone);
  if (digits.length < 7) return true;
  if (KNOWN_PLACEHOLDER_DIGITS.has(digits)) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/^1234567/.test(digits)) return true;
  return false;
}

export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  if (isPlaceholderPhone(phone)) return null;
  return phone.trim().slice(0, 32);
}
