import { describe, expect, it } from 'vitest';
import { fixtureInvoice } from '../test/invoiceFixture';
import { diffDays, isIsoDate } from './dates';
import { daysToDue, getStatus } from './invoiceStatus';

describe('getStatus', () => {
  it('is paid, pending or overdue', () => {
    expect(getStatus(fixtureInvoice({ paid: true }), '2026-12-01')).toBe('paid');
    expect(getStatus(fixtureInvoice(), '2026-09-16')).toBe('pending');
    expect(getStatus(fixtureInvoice(), '2026-09-17')).toBe('overdue');
    expect(getStatus(fixtureInvoice({ dueDate: '' }), '2026-12-01')).toBe('pending');
  });

  it('counts days to the due date across a DST change', () => {
    expect(daysToDue(fixtureInvoice({ dueDate: '2026-10-30' }), '2026-10-20')).toBe(10);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-09-16', '2026-09-02')).toBe(-14);
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-45')).toBe(false);
    expect(isIsoDate('2.9.2026')).toBe(false);
  });
});
