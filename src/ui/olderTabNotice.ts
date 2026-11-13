const OPEN = 'Invoo je otevřené i ve starší verzi v jiné záložce';

/**
 * The warning about an Invoo from before the current data format saving in another tab: `followed` while its data
 * is still taken over here, `aside` once this version has stored its own and the older one saved next to it.
 */
export function olderTabNotice(olderTab: 'followed' | 'aside'): string {
  if (olderTab === 'followed') {
    return (
      `${OPEN}. Co jsi v ní uložil, se převzalo i sem. Tu druhou záložku teď obnov a do té doby v ní nic neměň: ` +
      'jakmile tady něco uložíš, data se převedou do nového formátu a co potom uložíš ve starší záložce, se sem ' +
      'už nedostane.'
    );
  }
  return (
    'Starší verze Invoo v jiné záložce uložila svoje data. Tvoje aktuální data zůstala beze změny, ta ze starší ' +
    'záložky leží v prohlížeči stranou a nikam se nepřidala. Je-li ta záložka ještě otevřená, obnov ji. Chybí-li ti ' +
    'tady něco, co jsi v ní udělal, stáhni si její data: soubor jde obnovit v nastavení jako záloha, obnovení ale ' +
    'nahradí současná data, proto si předtím stáhni i běžnou zálohu. Co už nepotřebuješ, můžeš po stažení ' +
    'z prohlížeče odstranit.'
  );
}

/** The file the data an older Invoo saved aside is offered as. */
export function olderTabFileName(today: string): string {
  return `invoo-starsi-zalozka-${today}.json`;
}
