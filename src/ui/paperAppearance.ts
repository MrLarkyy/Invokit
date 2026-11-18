import { inkOn, isAccent, type InvoiceAppearance, type TemplateId } from '../domain/invoiceAppearance';

export interface PaperAppearance {
  template: TemplateId;
  /** CSS custom properties for the paper's `style`; empty for the template's own colours. */
  style: Record<string, string>;
}

/**
 * How the invoice paper applies a look: the template as `data-template`, an accent as a fill colour with readable text
 * on it. Klasik prints black and white and ignores the accent. Only a checked "#rrggbb" ever reaches the CSS.
 */
export function paperAppearance(appearance: InvoiceAppearance): PaperAppearance {
  const { template, accent } = appearance;
  if (template === 'klasik' || !isAccent(accent)) return { template, style: {} };
  return { template, style: { '--paper-accent': accent, '--paper-on-accent': inkOn(accent) } };
}
