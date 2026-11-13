import { describe, expect, it } from 'vitest';
import { defaultAppearance } from '../domain/invoiceAppearance';
import { paperAppearance } from './paperAppearance';

describe('paperAppearance', () => {
  it('sets the accent and a readable text colour on it', () => {
    expect(paperAppearance({ ...defaultAppearance(), accent: '#1d4ed8' })).toEqual({
      template: 'invoo',
      style: { '--paper-accent': '#1d4ed8', '--paper-on-accent': '#ffffff' },
    });
    expect(paperAppearance({ ...defaultAppearance(), template: 'minimal', accent: '#ffd400' }).style).toEqual({
      '--paper-accent': '#ffd400',
      '--paper-on-accent': '#000000',
    });
  });

  it('leaves the template colours without an accent, and Klasik always', () => {
    expect(paperAppearance(defaultAppearance())).toEqual({ template: 'invoo', style: {} });
    expect(paperAppearance({ ...defaultAppearance(), template: 'klasik', accent: '#1d4ed8' })).toEqual({
      template: 'klasik',
      style: {},
    });
  });

  it('never passes an unchecked value into CSS', () => {
    const hostile = { ...defaultAppearance(), accent: 'red;background:url(https://example.invalid/x)' };
    expect(paperAppearance(hostile).style).toEqual({});
  });
});
