// Short Payment Descriptor 1.0 (QR Platba, Czech Banking Association).

export interface PaymentRequest {
  iban: string;
  amountCents: number;
  variableSymbol: string;
  dueDate: string;
  message: string;
}

// Values must not contain the field separator; diacritics are dropped because some banking apps misread UTF-8.
function clean(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*\r\n]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function buildSpayd(request: PaymentRequest): string {
  const fields = ['SPD', '1.0', `ACC:${request.iban}`, `AM:${(request.amountCents / 100).toFixed(2)}`, 'CC:CZK'];
  if (/^\d{8}$/.test(request.dueDate.replace(/-/g, ''))) fields.push(`DT:${request.dueDate.replace(/-/g, '')}`);
  const vs = request.variableSymbol.replace(/\D/g, '');
  if (vs) fields.push(`X-VS:${vs.slice(0, 10)}`);
  const message = clean(request.message, 60);
  if (message) fields.push(`MSG:${message}`);
  return fields.join('*');
}
