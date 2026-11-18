import { defaultAppearance } from '../domain/invoiceAppearance';
import { LIMITS } from '../domain/limits';
import { emptyAppData, type AppData } from '../storage/appData';
import { fixtureInvoice, fixtureLogo, fixtureProfile } from './invoiceFixture';

/** Data with every logo slot taken: as many invoices as logos fit, each printing its own; the profile has none. */
export function fullLogoData(): AppData {
  const numbers = Array.from({ length: LIMITS.logos }, (_, i) => i + 1);
  return {
    ...emptyAppData(),
    supplier: fixtureProfile(),
    invoices: numbers.map((n) =>
      fixtureInvoice({
        id: `f${n}`,
        number: `2026-08-${String(n).padStart(3, '0')}`,
        appearance: { ...defaultAppearance(), logoId: `logo-${n}` },
      }),
    ),
    logos: numbers.map((n) => ({ id: `logo-${n}`, dataUrl: fixtureLogo(n) })),
  };
}

/** The logo each invoice prints, by invoice id; `missing` for an id that names no stored logo. */
export function printedLogos(data: AppData): Record<string, string | null> {
  const printed: Record<string, string | null> = {};
  for (const invoice of data.invoices) {
    const { logoId } = invoice.appearance;
    printed[invoice.id] = logoId === null ? null : (data.logos.find((l) => l.id === logoId)?.dataUrl ?? 'missing');
  }
  return printed;
}
