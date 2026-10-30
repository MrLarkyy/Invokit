/** "1 faktura", "2 faktury", "5 faktur": forms are [one, two to four, five and more]. */
export function czechPlural(count: number, forms: [string, string, string]): string {
  const form = count === 1 ? forms[0] : count >= 2 && count <= 4 ? forms[1] : forms[2];
  return `${count} ${form}`;
}

export const INVOICES: [string, string, string] = ['faktura', 'faktury', 'faktur'];
export const CUSTOMERS: [string, string, string] = ['odběratel', 'odběratelé', 'odběratelů'];
