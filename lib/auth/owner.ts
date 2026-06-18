const DEFAULT_OWNER_EMAIL = 'avanbailey@gmail.com';

export const OWNER_EMAIL =
  process.env.OWNER_EMAIL?.trim().toLowerCase() || DEFAULT_OWNER_EMAIL;

export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}
