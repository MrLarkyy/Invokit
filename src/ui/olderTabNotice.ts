const OPEN = 'Invoo je otevřené i ve starší verzi v jiné záložce';

/**
 * The warning about an Invoo from before the current data format open in another tab. `stored` is whether this
 * tab's data is in the browser storage, so a write-back the browser refused is never reported as done.
 */
export function olderTabNotice(olderTab: 'followed' | 'overwrote', stored: boolean): string {
  if (olderTab === 'followed') {
    return (
      `${OPEN}. Co jsi v ní uložil, se převzalo i sem. Tu druhou záložku teď obnov a do té doby v ní nic neměň: ` +
      'jakmile tady něco uložíš, starší verze už data nepřečte a co v ní změníš potom, se neuloží.'
    );
  }
  if (!stored) {
    return (
      `${OPEN} a přepsalo uložená data. Aktuální data jsou teď jen v téhle záložce, zpátky do prohlížeče se je ` +
      'uložit nepodařilo. Než ji zavřeš, stáhni si zálohu v nastavení, a tu druhou záložku obnov.'
    );
  }
  return (
    `${OPEN} a přepsalo uložená data. Tady zůstala data aktuální a znovu se uložila. Tu druhou záložku obnov, ` +
    'jinak může data zase přepsat; co jsi v ní změnil, se neuložilo.'
  );
}
