import { useSyncExternalStore, type KeyboardEvent } from 'react';
import type { UpdateStore } from './updateStore';

interface UpdatePromptProps {
  store: UpdateStore;
}

export function UpdatePrompt({ store }: UpdatePromptProps) {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') store.dismiss();
  }

  return (
    <div aria-live="polite" className="update-prompt-region">
      {state === 'ready' && (
        <div className="update-prompt" role="group" aria-label="Nová verze" onKeyDown={onKeyDown}>
          <p className="update-prompt__text">
            <strong>Nová verze</strong> Je připravená nová verze Invoo. Před načtením si ulož rozdělané úpravy.
          </p>
          <div className="update-prompt__actions">
            <button type="button" className="btn btn--sm btn--primary" onClick={() => store.apply()}>
              Načíst novou verzi
            </button>
            <button type="button" className="btn btn--sm update-prompt__later" onClick={() => store.dismiss()}>
              Později
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
