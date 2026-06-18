export const FOUNDER_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'crm', label: 'CRM' },
  { id: 'customers', label: 'Customers' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
] as const;

export type FounderSectionId = (typeof FOUNDER_SECTIONS)[number]['id'];

export function isFounderSectionId(value: string): value is FounderSectionId {
  return FOUNDER_SECTIONS.some((s) => s.id === value);
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
