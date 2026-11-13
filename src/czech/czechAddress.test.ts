import { describe, expect, it } from 'vitest';
import { splitZipCity } from './czechAddress';

describe('splitZipCity', () => {
  it('splits a leading PSČ from the city', () => {
    expect(splitZipCity('110 00 Praha 1')).toEqual({ zip: '110 00', city: 'Praha 1' });
    expect(splitZipCity('11000 Praha')).toEqual({ zip: '110 00', city: 'Praha' });
  });

  it('keeps the text as the city without a PSČ', () => {
    expect(splitZipCity('Praha')).toEqual({ zip: '', city: 'Praha' });
    expect(splitZipCity('')).toEqual({ zip: '', city: '' });
  });
});
