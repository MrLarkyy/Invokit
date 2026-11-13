export type PluralForms = readonly [string, string, string];

/** "1 faktura", "2 faktury", "5 faktur": forms are [one, two to four, five and more]. */
export function czechPlural(count: number, forms: PluralForms): string {
  const n = Math.abs(count);
  const form = n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2];
  return `${count} ${form}`;
}

export const INVOICES: PluralForms = ['faktura', 'faktury', 'faktur'];
export const CUSTOMERS: PluralForms = ['odběratel', 'odběratelé', 'odběratelů'];
export const ITEMS: PluralForms = ['položka', 'položky', 'položek'];
export const DAYS: PluralForms = ['den', 'dny', 'dní'];
