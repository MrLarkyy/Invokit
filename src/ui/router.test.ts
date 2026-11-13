import { describe, expect, it } from 'vitest';
import { parseHash, startRoute, toHash, type Route } from './router';

describe('parseHash', () => {
  it('reads the known routes and round-trips them', () => {
    const routes: Route[] = [
      { name: 'uvod' },
      { name: 'faktury' },
      { name: 'nova' },
      { name: 'nastaveni' },
      { name: 'upravit', id: '2026-09-001' },
      { name: 'faktura', id: '2026-09-001-2' },
    ];
    for (const route of routes) expect(parseHash(toHash(route))).toEqual(route);
  });

  it('treats an empty hash as no route', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
  });

  it('sends a hostile or oversized hash to the landing page', () => {
    expect(parseHash('#faktura-<img src=x onerror=alert(1)>')).toEqual({ name: 'uvod' });
    expect(parseHash('#faktura-')).toEqual({ name: 'uvod' });
    expect(parseHash(`#faktura-${'a'.repeat(200)}`)).toEqual({ name: 'uvod' });
    expect(parseHash('#__proto__')).toEqual({ name: 'uvod' });
  });

  it('keeps an unknown but well-formed id for the not-found page', () => {
    expect(parseHash('#upravit-neexistuje')).toEqual({ name: 'upravit', id: 'neexistuje' });
  });
});

describe('startRoute', () => {
  it('opens the invoices once there is data, else the landing page', () => {
    expect(startRoute({ invoices: [], supplier: null })).toEqual({ name: 'uvod' });
    expect(startRoute({ invoices: [{}], supplier: null })).toEqual({ name: 'faktury' });
    expect(startRoute({ invoices: [], supplier: {} })).toEqual({ name: 'faktury' });
  });
});
