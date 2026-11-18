import type { Invoice, InvoiceItem, VatRate } from '../domain/invoice';
import { defaultAppearance } from '../domain/invoiceAppearance';
import type { SupplierProfile } from '../domain/supplierProfile';

// Invented companies and numbers only. 27410587 passes the IČO check; both accounts pass mod 11.

/** A 1×1 transparent PNG, the smallest valid logo. */
export const FIXTURE_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** A distinct valid PNG data URL per n: the 1×1 PNG with a different filler block after its header. */
export function fixtureLogo(n: number): string {
  const block = n.toString(36).padStart(4, 'A').slice(-4);
  return `${FIXTURE_LOGO.slice(0, -4)}${block}${FIXTURE_LOGO.slice(-4)}`;
}

export function fixtureItem(
  description: string,
  quantity: string,
  unitPriceCents: number,
  vatRate: VatRate = 0,
  id = `i-${description.normalize('NFD').replace(/[^A-Za-z0-9]/g, '') || 'row'}`,
): InvoiceItem {
  return { id, description, quantity, unit: 'ks', unitPriceCents, vatRate };
}

export function fixtureProfile(overrides: Partial<SupplierProfile> = {}): SupplierProfile {
  return {
    party: { name: 'Ukázka s.r.o.', street: 'Vymyšlená 1', city: 'Praha', zip: '110 00', ico: '27410587', dic: '' },
    vatPayer: false,
    email: '',
    registryNote: 'Zapsáno v obchodním rejstříku (smyšlený záznam).',
    accountPrefix: '19',
    accountNumber: '2000145399',
    bankCode: '0800',
    appearance: defaultAppearance(),
    ...overrides,
  };
}

export function fixtureInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: '2026-09-001',
    number: '2026-09-001',
    issueDate: '2026-09-02',
    dueDate: '2026-09-16',
    taxableSupplyDate: '2026-09-02',
    variableSymbol: '202609001',
    supplier: {
      party: { name: 'Ukázka s.r.o.', street: 'Vymyšlená 1', city: 'Praha', zip: '110 00', ico: '27410587', dic: '' },
      vatPayer: false,
      email: '',
      registryNote: '',
      bankAccount: '19-2000145399/0800',
    },
    appearance: defaultAppearance(),
    customer: { name: 'Odběratel Test a.s.', street: 'Testovací 5', city: 'Brno', zip: '602 00', ico: '', dic: '' },
    items: [fixtureItem('Vývoj', '10', 80_000)],
    note: '',
    paymentMethod: 'Převodem',
    showQr: true,
    paid: false,
    paidAt: null,
    savedAt: '',
    ...overrides,
  };
}
