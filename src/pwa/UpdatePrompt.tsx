import { useRef, useSyncExternalStore, type FocusEvent, type KeyboardEvent } from 'react';
import { nextReturnFocus } from './focusReturn';
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
  const banner = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  function onFocus(event: FocusEvent): void {
    const from = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    returnTo.current = nextReturnFocus(returnTo.current, from, from !== null && !!banner.current?.contains(from));
  }

  function dismiss(): void {
    const target = returnTo.current;
    store.dismiss();
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') dismiss();
  }

  return (
    <div aria-live="polite" className="update-prompt-region">
      {state === 'ready' && (
        <div
          ref={banner}
          className="update-prompt"
          role="group"
          aria-label="Nová verze"
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        >
          <div className="update-prompt__inner">
            <p className="update-prompt__text">
              <strong>Nová verze</strong> Je připravená nová verze Invoo. Před načtením si ulož rozdělané úpravy.
            </p>
            <div className="update-prompt__actions">
              <button type="button" className="btn btn--sm btn--primary" onClick={() => store.apply()}>
                Načíst novou verzi
              </button>
              <button type="button" className="btn btn--sm update-prompt__later" onClick={dismiss}>
                Později
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
