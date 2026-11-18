export type TemplateId = 'invoo' | 'klasik' | 'minimal';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATES: readonly TemplateInfo[] = [
  { id: 'invoo', name: 'Invoo', description: 'Barevný pruh se součtem a očka Invoo.' },
  { id: 'klasik', name: 'Klasik', description: 'Střídmý černobílý doklad s linkami.' },
  { id: 'minimal', name: 'Minimal', description: 'Hodně bílého místa a tenké linky.' },
];

/** How an invoice prints. Each invoice keeps its own copy, so a later change of the default never alters it. */
export interface InvoiceAppearance {
  template: TemplateId;
  /** Lowercase "#rrggbb", or null for the template's own colour. Only ever a fill, never the colour of text. */
  accent: string | null;
  /** An entry of AppData.logos, or null for no logo. */
  logoId: string | null;
  /** The "Vystaveno v Invoo · invoo.cz" line in the footer. */
  brandFooter: boolean;
}

export function defaultAppearance(): InvoiceAppearance {
  return { template: 'invoo', accent: null, logoId: null, brandFooter: true };
}

export function isTemplateId(value: unknown): value is TemplateId {
  return value === 'invoo' || value === 'klasik' || value === 'minimal';
}

// The value ends up in a CSS custom property: nothing but the six hex digits may pass.
const ACCENT = /^#[0-9a-f]{6}$/;

export function isAccent(value: unknown): value is string {
  return typeof value === 'string' && ACCENT.test(value);
}

export const DARK_ON_ACCENT = '#000000';
export const LIGHT_ON_ACCENT = '#ffffff';

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a "#rrggbb" colour. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio of two "#rrggbb" colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The text colour on an accent fill: black or white, whichever contrasts more. Pure black (not the brand ink) keeps
 * the better of the two at 4.58:1 or more for every colour; with #111413 a mid grey would get only 4.3:1.
 */
export function inkOn(accent: string): string {
  return contrastRatio(accent, DARK_ON_ACCENT) >= contrastRatio(accent, LIGHT_ON_ACCENT)
    ? DARK_ON_ACCENT
    : LIGHT_ON_ACCENT;
}
