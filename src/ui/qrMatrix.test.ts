import { describe, expect, it } from 'vitest';
import { qrMatrix } from './qrMatrix';

const SPD = 'SPD*1.0*ACC:CZ6508000000192000145399*AM:168.33*CC:CZK*DT:20260916*X-VS:202609001*MSG:Faktura 2026-09-001';

describe('qrMatrix', () => {
  it('gives a square matrix with the three finder patterns', () => {
    const matrix = qrMatrix(SPD);
    const size = matrix.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === size)).toBe(true);
    const dark = (row: number, col: number) => matrix[row]?.[col] === true;
    for (const [row, col] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const) {
      // Outer ring dark, the ring inside it light, the 3×3 centre dark.
      expect(dark(row, col) && dark(row + 6, col + 6)).toBe(true);
      expect(dark(row + 1, col + 1)).toBe(false);
      expect(dark(row + 3, col + 3)).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(qrMatrix(SPD)).toEqual(qrMatrix(SPD));
  });
});
