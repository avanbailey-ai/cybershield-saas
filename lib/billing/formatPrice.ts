export function formatDisplayPrice(amount: number | undefined | null): string {
  if (amount == null) return '—';
  return `$${amount}`;
}

export function formatDisplayPriceMonthly(amount: number | undefined | null): string {
  if (amount == null) return '—';
  return `$${amount}/mo`;
}
