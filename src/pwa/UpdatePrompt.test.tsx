import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';
import type { UpdateState, UpdateStore } from './updateStore';

function storeIn(state: UpdateState): UpdateStore {
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => state,
    apply: () => undefined,
    dismiss: () => undefined,
  };
}

describe('UpdatePrompt', () => {
  it('renders an empty polite live region when idle', () => {
    const html = renderToStaticMarkup(<UpdatePrompt store={storeIn('idle')} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('Nová verze');
    expect(html).not.toContain('<button');
  });

  it('offers both Czech buttons when a version is ready', () => {
    const html = renderToStaticMarkup(<UpdatePrompt store={storeIn('ready')} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Nová verze');
    expect(html).toContain('Načíst novou verzi');
    expect(html).toContain('Později');
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });

  it('tells the user to save unfinished edits', () => {
    expect(renderToStaticMarkup(<UpdatePrompt store={storeIn('ready')} />)).toContain('ulož rozdělané úpravy');
  });
});
