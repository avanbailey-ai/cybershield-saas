/** Shared archive / soft-delete field updates for Founder OS entities. */

export function hygieneUpdates(body: {
  archive?: boolean;
  unarchive?: boolean;
  delete?: boolean;
}): Record<string, unknown> | null {
  const now = new Date().toISOString();
  if (body.delete === true) return { deleted_at: now };
  if (body.archive === true) return { archived_at: now };
  if (body.unarchive === true) return { archived_at: null };
  return null;
}
