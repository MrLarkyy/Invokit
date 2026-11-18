import type { AppData } from '../storage/appData';

interface Raw {
  version: number;
  logos?: unknown;
  supplier: { appearance?: unknown } | null;
  invoices: { appearance?: unknown }[];
}

/** The text an Invoo from before schema version 3 stores for this data: version 2, without looks and logos. */
export function olderAppData(data: AppData): string {
  const raw = JSON.parse(JSON.stringify(data)) as Raw;
  raw.version = 2;
  delete raw.logos;
  delete raw.supplier?.appearance;
  for (const invoice of raw.invoices) delete invoice.appearance;
  return JSON.stringify(raw);
}
