// Shared by the editor and the backup validator. With these bounds every sum of haléře stays below 2^53.
export const LIMITS = {
  // Above what a browser lets localStorage hold, so every backup of data Invoo could store also restores.
  fileBytes: 10 * 1024 * 1024,
  invoices: 10_000,
  customers: 5_000,
  catalog: 5_000,
  itemsPerInvoice: 200,
  text: 300,
  note: 2_000,
  registryNote: 500,
  quantity: 1_000_000,
  unitPriceCents: 100_000_000_000,
  lineCents: 1_000_000_000_000,
} as const;

export const FILE_TOO_LARGE = 'Soubor je příliš velký (nejvýš 10 MB).';
