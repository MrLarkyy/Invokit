import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  DARK_ON_ACCENT,
  defaultAppearance,
  inkOn,
  isAccent,
  isTemplateId,
  LIGHT_ON_ACCENT,
  TEMPLATES,
} from './invoiceAppearance';

const hex = (n: number) => n.toString(16).padStart(2, '0');

describe('templates', () => {
  it('are exactly Invoo, Klasik and Minimal, and nothing else passes as one', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['invoo', 'klasik', 'minimal']);
    expect(TEMPLATES.every((t) => isTemplateId(t.id))).toBe(true);
    for (const value of ['Invoo', 'KLASIK', '', '__proto__', 'constructor', null, 1, undefined]) {
      expect(isTemplateId(value)).toBe(false);
    }
  });

  it('default to Invoo, no accent, no logo and the Invoo footer (INV-7)', () => {
    expect(defaultAppearance()).toEqual({ template: 'invoo', accent: null, logoId: null, brandFooter: true });
    expect(defaultAppearance()).not.toBe(defaultAppearance());
  });
});

describe('isAccent', () => {
  it('accepts lowercase #rrggbb only', () => {
    expect(isAccent('#ff5b1f')).toBe(true);
    expect(isAccent('#000000')).toBe(true);
    for (const value of [
      '#FF5B1F',
      '#fff',
      'red',
      'url(x)',
      '#ff5b1f;x',
      '#ff5b1f ',
      ' #ff5b1f',
      '#ff5b1f00',
      null,
      1,
    ]) {
      expect(isAccent(value)).toBe(false);
    }
  });
});

describe('inkOn', () => {
  it('puts black or white text on the accent, whichever contrasts more', () => {
    expect(inkOn('#ff5b1f')).toBe(DARK_ON_ACCENT);
    expect(inkOn('#000000')).toBe(LIGHT_ON_ACCENT);
    expect(inkOn('#ffffff')).toBe(DARK_ON_ACCENT);
    expect(inkOn('#767676')).toBe(DARK_ON_ACCENT);
    expect(inkOn('#1d4ed8')).toBe(LIGHT_ON_ACCENT);
  });

  it('reaches at least 4.5:1 on every grey and on a grid of colours', () => {
    for (let n = 0; n <= 255; n++) {
      const grey = `#${hex(n)}${hex(n)}${hex(n)}`;
      expect(contrastRatio(grey, inkOn(grey)), grey).toBeGreaterThanOrEqual(4.5);
    }
    for (let r = 0; r <= 255; r += 17) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 17) {
          const colour = `#${hex(r)}${hex(g)}${hex(b)}`;
          expect(contrastRatio(colour, inkOn(colour)), colour).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('measures contrast as WCAG does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
