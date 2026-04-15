import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';

describe('mulberry32', () => {
  it('same seed produces identical 100-draw sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const valA = a();
    const valB = b();
    expect(valA).not.toBe(valB);
  });

  it('all outputs are in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 10000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('distribution is roughly uniform over 10k draws (mean ≈ 0.5)', () => {
    const rng = mulberry32(999);
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) sum += rng();
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});
