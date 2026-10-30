export interface Party {
  name: string;
  street: string;
  city: string;
  ico: string;
  dic: string;
}

export interface InvoiceItem {
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
}

export interface Invoice {
  number: string;
  issueDate: string;
  dueDate: string;
  variableSymbol: string;
  bankAccount: string;
  paymentMethod: string;
  supplier: Party;
  vatPayer: boolean;
  registryNote: string;
  customer: Party;
  items: InvoiceItem[];
}
