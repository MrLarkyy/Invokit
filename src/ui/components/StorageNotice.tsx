import { useState } from 'react';
import { downloadBackup, downloadText } from '../../storage/backupFile';
import { todayIso } from '../clock';
import { useStore } from '../StoreProvider';
import { IconAlert, IconDownload } from './Icons';
import { useToast } from './Toast';

/**
 * Warnings about the browser storage: blocked, unreadable data, Invokit data that no longer fits, or an older Invoo
 * open in another tab.
 */
export function StorageNotice() {
  const { data, dispatch, persistent, canWrite, dataReplaced, olderTab, loaded, legacyBlocking, removeLegacy } =
    useStore();
  const toast = useToast();
  const [backupTaken, setBackupTaken] = useState(false);
  const [originalTaken, setOriginalTaken] = useState(false);

  const downloadOriginal = () => {
    if (loaded.unreadableText === null) return;
    downloadText(loaded.unreadableText, `invoo-puvodni-data-${todayIso()}.json`);
    setOriginalTaken(true);
  };

  // The first write replaces the unreadable data, so it waits for the download and the user's consent.
  const resumeSaving = () => {
    const agreed = window.confirm('Zapnout ukládání? Původní data se v prohlížeči přepíšou, zůstanou jen v souboru.');
    if (agreed && dispatch({ type: 'saving/resume' })) toast('Ukládání je zapnuté, data jsou uložená.', 'happy');
  };

  const takeBackup = () => {
    const today = todayIso();
    downloadBackup({ ...data, lastBackupAt: today }, today);
    dispatch({ type: 'backup/exported', at: today });
    setBackupTaken(true);
  };

  const removeOld = () => {
    if (!window.confirm('Odstranit stará data Invokitu z tohoto prohlížeče? Záloha, kterou sis stáhl, je obsahuje.')) {
      return;
    }
    if (removeLegacy()) toast('Stará data Invokitu jsou pryč a nová data jsou uložená.', 'happy');
    else toast('Data se ani teď nepodařilo uložit. Záloha je ve stažených souborech.');
  };

  return (
    <>
      {!persistent ? (
        <div className="container banner" role="alert">
          <IconAlert size={18} />
          <p>
            Prohlížeč nedovoluje ukládat data (soukromý režim nebo zakázané úložiště). Co vyplníš, zmizí po zavření
            stránky. Než odejdeš, stáhni si zálohu v nastavení.
          </p>
        </div>
      ) : null}

      {loaded.recovered ? (
        <div className="container banner" role="alert">
          <IconAlert size={18} />
          <div className="banner__body">
            <p>
              Uložená data v tomhle prohlížeči se nepodařilo přečíst
              {dataReplaced ? '.' : ', proto začínáš s prázdným přehledem.'}{' '}
              {dataReplaced
                ? 'Data jsou teď obnovená.'
                : !loaded.readOnly
                  ? 'Původní data zůstala v prohlížeči uložená stranou. Máš-li zálohu, obnov ji v nastavení.'
                  : canWrite
                    ? 'Ukládání je zase zapnuté. Původní data si můžeš stáhnout, dokud stránku nezavřeš.'
                    : 'Původní data se nepodařilo uložit stranou, proto teď nic neukládám. Stáhni si je a zapni ' +
                      'ukládání, nebo obnov zálohu v nastavení.'}
            </p>
            {loaded.unreadableText !== null ? (
              <div className="banner__actions">
                <button type="button" className="btn btn--outline btn--sm" onClick={downloadOriginal}>
                  <IconDownload size={16} />
                  Stáhnout původní data
                </button>
                {!canWrite ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={resumeSaving}
                    disabled={!originalTaken}
                  >
                    Zapnout ukládání
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {olderTab ? (
        <div className="container banner" role="alert">
          <IconAlert size={18} />
          <p>
            Invoo je otevřené i ve starší verzi v jiné záložce a přepsalo uložená data. Tady zůstala data aktuální a
            znovu se uložila. Tu druhou záložku obnov, jinak může data zase přepsat; co jsi v ní změnil, se neuložilo.
          </p>
        </div>
      ) : null}

      {legacyBlocking ? (
        <div className="container banner" role="alert">
          <IconAlert size={18} />
          <div className="banner__body">
            <p>
              Úložiště prohlížeče je plné: data převedená z Invokitu se nepodařilo uložit. Stáhni si zálohu, potom můžeš
              stará data Invokitu z prohlížeče odstranit a uvolnit tak místo.
            </p>
            <div className="banner__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={takeBackup}>
                <IconDownload size={16} />
                Stáhnout zálohu
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={removeOld} disabled={!backupTaken}>
                Odstranit stará data Invokitu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
