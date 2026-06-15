/**
 * Placeholder for future org support — pure function.
 */
export function isOrgActive(org: { status?: string } | null): boolean {
  return !org || org.status !== 'suspended';
}
