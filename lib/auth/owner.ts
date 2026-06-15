export const OWNER_EMAIL = 'avanbailey@gmail.com';

export function isOwner(email: string | null | undefined): boolean {
  return email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
}
