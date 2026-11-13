/** "2026-09-02" → "02. 09. 2026"; anything else is returned unchanged. */
export function formatCzechDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}. ${match[2]}. ${match[1]}` : isoDate;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}
