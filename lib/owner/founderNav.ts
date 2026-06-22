export const FOUNDER_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'funnel', label: 'Traffic & Funnel' },
  { id: 'product', label: 'Product Usage' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sales', label: 'Sales / CRM' },
  { id: 'content', label: 'Site Content' },
  { id: 'alerts', label: 'Operations' },
] as const;

export type FounderSectionId = (typeof FOUNDER_SECTIONS)[number]['id'];

const LEGACY_SECTION_MAP: Record<string, FounderSectionId> = {
  home: 'overview',
  overview: 'overview',
  inbox: 'marketing',
  prospects: 'sales',
  success: 'product',
  customers: 'product',
  settings: 'alerts',
  insights: 'overview',
  crm: 'sales',
  outreach: 'marketing',
};

export function isFounderSectionId(value: string): value is FounderSectionId {
  if (FOUNDER_SECTIONS.some((s) => s.id === value)) return true;
  return value in LEGACY_SECTION_MAP;
}

export function resolveFounderSection(value: string): FounderSectionId | null {
  if (FOUNDER_SECTIONS.some((s) => s.id === value)) return value as FounderSectionId;
  return LEGACY_SECTION_MAP[value] ?? null;
}

/** Map legacy inbox modules to new nav sections. */
export function resolveReviewSection(
  module: 'inbox' | 'prospects' | 'customers' | 'success' | 'outreach',
): FounderSectionId {
  if (module === 'prospects') return 'sales';
  if (module === 'customers' || module === 'success') return 'product';
  if (module === 'outreach') return 'marketing';
  return 'marketing';
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
