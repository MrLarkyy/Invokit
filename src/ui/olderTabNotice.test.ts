import { describe, expect, it } from 'vitest';
import { olderTabFileName, olderTabNotice } from './olderTabNotice';

describe('olderTabNotice', () => {
  it('asks to reload the older tab while its data is taken over, without speaking of lost data', () => {
    const text = olderTabNotice('followed');
    expect(text).toContain('se převzalo i sem');
    expect(text).toContain('záložku teď obnov');
    expect(text).not.toMatch(/přepsal|stranou/);
  });

  it('says the older tab’s data lies aside, that the current data is untouched, and how to get it back safely', () => {
    const text = olderTabNotice('aside');
    expect(text).toContain('Tvoje aktuální data zůstala beze změny');
    expect(text).toContain('stranou');
    expect(text).toContain('obnov ji');
    expect(text).toContain('stáhni si její data');
    // Restoring that file replaces the current data: a backup comes first.
    expect(text).toContain('obnovení ale nahradí současná data');
    expect(text).toContain('předtím stáhni i běžnou zálohu');
  });

  it('never claims that anything was written back or overwritten', () => {
    for (const text of [olderTabNotice('followed'), olderTabNotice('aside')]) {
      expect(text).not.toMatch(/znovu se uložil|přepsal/);
    }
  });

  it('names the download after the older tab and the day', () => {
    expect(olderTabFileName('2026-11-13')).toBe('invoo-starsi-zalozka-2026-11-13.json');
  });
});
