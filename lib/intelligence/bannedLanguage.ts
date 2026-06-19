/** Phrases that must never appear in customer-facing intelligence copy. */
export const BANNED_INTELLIGENCE_PHRASES = [
  'you are hacked',
  'you are compromised',
  'you have been hacked',
  'you have been compromised',
  'guaranteed secure',
  'attackers are targeting you',
  'attackers are actively targeting',
  'under active attack',
  'breach confirmed',
] as const;

export function containsBannedLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_INTELLIGENCE_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function assertSafeCopy(text: string, context: string): void {
  const hit = containsBannedLanguage(text);
  if (hit) {
    throw new Error(`Banned phrase "${hit}" in ${context}`);
  }
}
