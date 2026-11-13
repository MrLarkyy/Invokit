import { describe, expect, it } from 'vitest';
import { olderTabNotice } from './olderTabNotice';

describe('olderTabNotice', () => {
  it('asks to reload the older tab once its data was taken over, without speaking of lost data', () => {
    const text = olderTabNotice('followed', true);
    expect(text).toContain('se převzalo i sem');
    expect(text).toContain('záložku teď obnov');
    expect(text).not.toContain('přepsalo');
    expect(olderTabNotice('followed', false)).toBe(text);
  });

  it('says the current data was stored again only when it was', () => {
    const stored = olderTabNotice('overwrote', true);
    expect(stored).toContain('přepsalo uložená data');
    expect(stored).toContain('znovu se uložila');
    const unstored = olderTabNotice('overwrote', false);
    expect(unstored).toContain('přepsalo uložená data');
    expect(unstored).not.toContain('znovu se uložila');
    expect(unstored).toContain('stáhni si zálohu');
  });
});
