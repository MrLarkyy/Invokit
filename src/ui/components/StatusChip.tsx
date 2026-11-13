import type { InvoiceStatus } from '../../domain/invoiceStatus';
import { STATUS_LABEL } from '../texts';
import { IconAlert, IconCheck } from './Icons';

export function StatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`chip chip--${status}`}>
      {status === 'paid' ? <IconCheck size={14} /> : null}
      {status === 'overdue' ? <IconAlert size={14} /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
