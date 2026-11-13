import { useState } from 'react';
import { downloadBackup, downloadText } from '../../storage/backupFile';
import { todayIso } from '../clock';
import { useStore } from '../StoreProvider';
import { IconAlert, IconDownload } from './Icons';
import { useToast } from './Toast';

/** Warnings about the browser storage: blocked, unreadable data, or Invokit data that no longer fits. */
export function StorageNotice() {
  const { data, dispatch, persistent, canWrite, loaded, legacyBlocking, removeLegacy } = useStore();
  const toast = useToast();
  const [backupTaken, setBackupTaken] = useState(false);

  const downloadOriginal = () => {
    if (loaded.unreadableText !== null) downloadText(loaded.unreadableText, `invoo-puvodni-data-${todayIso()}.json`);
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
              Uložená data v tomhle prohlížeči se nepodařilo přečíst, proto začínáš s prázdným přehledem.{' '}
              {canWrite
                ? 'Původní data zůstala v prohlížeči uložená stranou.'
                : 'Původní data se nepodařilo uložit stranou, proto teď nic neukládám. Stáhni si je.'}{' '}
              Máš-li zálohu, obnov ji v nastavení.
            </p>
            {loaded.unreadableText !== null ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={downloadOriginal}>
                <IconDownload size={16} />
                Stáhnout původní data
              </button>
            ) : null}
          </div>
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
