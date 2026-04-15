import { describe, it, expect } from 'vitest';
import { computeVerdict } from './verdict';

describe('computeVerdict', () => {
  it('exactly -25% gap + high confidence → RIPPED (hard, inclusive boundary)', () => {
    // spotPrice 400, ev 300 → gapPct = -0.25
    const result = computeVerdict(300, 400, 'high');
    expect(result.verdict).toBe('RIPPED');
    expect(result.isHard).toBe(true);
  });

  it('exactly +25% gap + high confidence → STEAL (hard, inclusive boundary)', () => {
    // spotPrice 400, ev 500 → gapPct = 0.25
    const result = computeVerdict(500, 400, 'high');
    expect(result.verdict).toBe('STEAL');
    expect(result.isHard).toBe(true);
  });

  it('-25% gap + medium confidence → ABOVE_MARKET (soft)', () => {
    const result = computeVerdict(300, 400, 'medium');
    expect(result.verdict).toBe('ABOVE_MARKET');
    expect(result.isHard).toBe(false);
  });

  it('-25% gap + low confidence → ABOVE_MARKET (soft)', () => {
    const result = computeVerdict(300, 400, 'low');
    expect(result.verdict).toBe('ABOVE_MARKET');
    expect(result.isHard).toBe(false);
  });

  it('0% gap → NEAR_MARKET', () => {
    const result = computeVerdict(400, 400, 'high');
    expect(result.verdict).toBe('NEAR_MARKET');
    expect(result.isHard).toBe(false);
  });

  it('soft boundaries inclusive at -10%', () => {
    // spotPrice 100, ev 90 → gapPct = -0.1
    const result = computeVerdict(90, 100, 'medium');
    expect(result.verdict).toBe('ABOVE_MARKET');
  });

  it('soft boundaries inclusive at +10%', () => {
    // spotPrice 100, ev 110 → gapPct = +0.1
    const result = computeVerdict(110, 100, 'medium');
    expect(result.verdict).toBe('BELOW_MARKET');
  });

  it('just inside NEAR_MARKET at -9.9%', () => {
    const result = computeVerdict(90.1, 100, 'medium');
    expect(result.verdict).toBe('NEAR_MARKET');
  });

  it('just inside NEAR_MARKET at +9.9%', () => {
    const result = computeVerdict(109.9, 100, 'medium');
    expect(result.verdict).toBe('NEAR_MARKET');
  });

  it('spotPrice 0 → NEAR_MARKET (no comparison)', () => {
    const result = computeVerdict(300, 0, 'high');
    expect(result.verdict).toBe('NEAR_MARKET');
    expect(result.isHard).toBe(false);
  });

  it('NaN inputs → NEAR_MARKET', () => {
    const result = computeVerdict(NaN, 100, 'high');
    expect(result.verdict).toBe('NEAR_MARKET');
    expect(result.isHard).toBe(false);
  });
});
