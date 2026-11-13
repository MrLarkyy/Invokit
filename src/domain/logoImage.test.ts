import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO } from '../test/invoiceFixture';
import { isLogoDataUrl } from './logoImage';

// Invented headers: the signature of each format followed by filler bytes.
const PNG_PAYLOAD = FIXTURE_LOGO.slice('data:image/png;base64,'.length);
const JPEG_PAYLOAD = btoa('\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00');
const WEBP_PAYLOAD = btoa('RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00');

/** A PNG data URL padded with base64 "A"s to exactly `length` characters (a multiple of 4 after the prefix). */
function pngOfLength(length: number): string {
  const prefix = 'data:image/png;base64,';
  const head = PNG_PAYLOAD.slice(0, 16);
  return prefix + head + 'A'.repeat(length - prefix.length - head.length);
}

describe('isLogoDataUrl', () => {
  it('accepts PNG, JPEG and WebP whose bytes match the declared type', () => {
    expect(isLogoDataUrl(FIXTURE_LOGO)).toBe(true);
    expect(isLogoDataUrl(`data:image/jpeg;base64,${JPEG_PAYLOAD}`)).toBe(true);
    expect(isLogoDataUrl(`data:image/webp;base64,${WEBP_PAYLOAD}`)).toBe(true);
  });

  it('refuses SVG, other schemes and a type that does not match the bytes', () => {
    expect(isLogoDataUrl(`data:image/svg+xml;base64,${btoa('<svg onload="alert(1)"></svg>')}`)).toBe(false);
    expect(isLogoDataUrl(`data:image/png;base64,${JPEG_PAYLOAD}`)).toBe(false);
    expect(isLogoDataUrl(`data:image/webp;base64,${PNG_PAYLOAD}`)).toBe(false);
    expect(isLogoDataUrl(`data:image/gif;base64,${btoa('GIF89a\x01\x00\x01\x00\x00\x00\x00\x00')}`)).toBe(false);
    expect(isLogoDataUrl('http://example.invalid/logo.png')).toBe(false);
    expect(isLogoDataUrl('javascript:alert(1)')).toBe(false);
    expect(isLogoDataUrl(`DATA:image/png;base64,${PNG_PAYLOAD}`)).toBe(false);
    expect(isLogoDataUrl(`data:image/png,${PNG_PAYLOAD}`)).toBe(false);
  });

  it('refuses broken base64', () => {
    expect(isLogoDataUrl('data:image/png;base64,')).toBe(false);
    expect(isLogoDataUrl(`data:image/png;base64,${PNG_PAYLOAD.slice(0, 16)}==AAAA`)).toBe(false);
    expect(isLogoDataUrl(`data:image/png;base64,${PNG_PAYLOAD.slice(0, 16)}A`)).toBe(false);
    expect(isLogoDataUrl(`data:image/png;base64,${PNG_PAYLOAD} `)).toBe(false);
    expect(isLogoDataUrl(`data:image/png;base64,${PNG_PAYLOAD}\n`)).toBe(false);
    expect(isLogoDataUrl('data:image/png;base64,iVBORw0K')).toBe(false);
  });

  it('refuses anything over 50,000 characters', () => {
    expect(isLogoDataUrl(pngOfLength(49_998))).toBe(true);
    expect(isLogoDataUrl(pngOfLength(50_002))).toBe(false);
  });

  it('refuses what is not a string', () => {
    for (const value of [null, undefined, 1, {}, [FIXTURE_LOGO]]) expect(isLogoDataUrl(value)).toBe(false);
  });
});
