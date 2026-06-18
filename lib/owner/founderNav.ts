export const FOUNDER_SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'customers', label: 'Customers' },
  { id: 'settings', label: 'Settings' },
] as const;

export type FounderSectionId = (typeof FOUNDER_SECTIONS)[number]['id'];

const LEGACY_SECTION_MAP: Record<string, FounderSectionId> = {
  overview: 'home',
  outreach: 'inbox',
  crm: 'inbox',
  insights: 'home',
};

export function isFounderSectionId(value: string): value is FounderSectionId {
  if (FOUNDER_SECTIONS.some((s) => s.id === value)) return true;
  return value in LEGACY_SECTION_MAP;
}

export function resolveFounderSection(value: string): FounderSectionId | null {
  if (FOUNDER_SECTIONS.some((s) => s.id === value)) return value as FounderSectionId;
  return LEGACY_SECTION_MAP[value] ?? null;
}

export const BANNED_DEMO_PATTERNS = [
  'example-health.org',
  'example-sass.com',
  'Premier Medical Group',
  'Main Street Co',
  'Community Health Center',
  'Valley Urgent Care',
  'Summit Dental',
  'City Partners',
  'Trusted Group',
  'Premier Solutions',
  'generateProspectList',
];
