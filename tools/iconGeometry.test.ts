import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT, CORNER_RADIUS, EYES, EYE_RADIUS, INK, PUPIL_RADIUS, VIEW, WHITE, type Rgb } from './iconPng.ts';

const svg = readFileSync(join(import.meta.dirname, '..', 'public', 'favicon.svg'), 'utf8');

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([A-Za-z-]+)="([^"]*)"/g)].map((match) => [match[1] ?? '', match[2] ?? '']),
  );
}

function hex(colour: Rgb): string {
  return '#' + colour.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function normaliseColour(value: string | undefined): string {
  const text = (value ?? '').toLowerCase();
  return /^#[0-9a-f]{3}$/.test(text) ? '#' + [...text.slice(1)].map((digit) => digit + digit).join('') : text;
}

describe('icon geometry', () => {
  const rect = attributes(svg.match(/<rect[^>]*>/)?.[0] ?? '');
  const circles = [...svg.matchAll(/<circle[^>]*>/g)].map((match) => attributes(match[0]));
  const eyes = circles.filter((circle) => Number(circle.r) === EYE_RADIUS);
  const pupils = circles.filter((circle) => Number(circle.r) === PUPIL_RADIUS);

  it('matches the viewBox, the rounded square and its colour', () => {
    expect(attributes(svg.match(/<svg[^>]*>/)?.[0] ?? '').viewBox).toBe(`0 0 ${VIEW} ${VIEW}`);
    expect(Number(rect.width)).toBe(VIEW);
    expect(Number(rect.rx)).toBe(CORNER_RADIUS);
    expect(normaliseColour(rect.fill)).toBe(hex(ACCENT));
  });

  it('matches the eyes and pupils', () => {
    expect(circles).toHaveLength(EYES.length * 2);
    expect(eyes.map((circle) => [Number(circle.cx), Number(circle.cy)])).toEqual(EYES.map((eye) => [eye.x, eye.y]));
    expect(pupils.map((circle) => [Number(circle.cx), Number(circle.cy)])).toEqual(
      EYES.map((eye) => [eye.pupilX, eye.pupilY]),
    );
    for (const eye of eyes) expect(normaliseColour(eye.fill)).toBe(hex(WHITE));
    for (const pupil of pupils) expect(normaliseColour(pupil.fill)).toBe(hex(INK));
  });
});
