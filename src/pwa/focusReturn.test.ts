import { describe, expect, it } from 'vitest';
import { nextReturnFocus } from './focusReturn';

describe('nextReturnFocus', () => {
  it('remembers the element focus came from outside the prompt', () => {
    expect(nextReturnFocus(null, 'button', false)).toBe('button');
    expect(nextReturnFocus('old', 'button', false)).toBe('button');
  });

  it('keeps the remembered element when focus moves inside the prompt', () => {
    expect(nextReturnFocus('button', 'apply', true)).toBe('button');
  });

  it('keeps the remembered element when focus came from nowhere', () => {
    expect(nextReturnFocus('button', null, false)).toBe('button');
    expect(nextReturnFocus(null, null, false)).toBeNull();
  });
});
