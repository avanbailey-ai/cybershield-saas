const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PREFIX = "CSHIELD-";

function randomSegment(): string {
  let segment = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    segment += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return segment;
}

export function generateReferralCode(_userId: string): string {
  return `${CODE_PREFIX}${randomSegment()}`;
}

export function isValidReferralCode(code: string): boolean {
  return /^CSHIELD-[A-Z2-9]{6}$/.test(code);
}

export function maskUserId(userId: string): string {
  return `User #${userId.replace(/-/g, "").slice(0, 6)}`;
}
