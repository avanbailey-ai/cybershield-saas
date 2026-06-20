import type { Metadata } from 'next';

/** Standard robots directive for login, app, and utility routes. */
export const NO_INDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
};

export function noIndexMetadata(partial: Metadata = {}): Metadata {
  return {
    ...partial,
    robots: NO_INDEX_ROBOTS,
  };
}
