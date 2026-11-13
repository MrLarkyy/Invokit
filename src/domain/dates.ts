const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-02" → "02. 09. 2026"; anything else is returned unchanged. */
export function formatCzechDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  return match ? `${match[3]}. ${match[2]}. ${match[1]}` : isoDate;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A real calendar date in ISO form: "2026-02-30" and "2026-13-45" are not. */
export function isIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function utcDay(isoDate: string): number {
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function addDays(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** Days from `from` to `to`, negative when `to` is earlier; counted in UTC so a DST change never shifts it. */
export function diffDays(from: string, to: string): number {
  return Math.round(utcDay(to) - utcDay(from));
}
