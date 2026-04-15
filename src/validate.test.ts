import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { validate } from './validate';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8'));
}

describe('validate()', () => {
  it('valid full fixture → full mode', () => {
    const result = validate(loadFixture('valid-full.json'));
    expect(result.mode).toBe('full');
    expect(result.data).not.toBeNull();
    expect(result.errors).toEqual([]);
  });

  it('core-only fixture (missing tier_values_usd) → probability_only mode', () => {
    const result = validate(loadFixture('core-only.json'));
    expect(result.mode).toBe('probability_only');
    expect(result.data).not.toBeNull();
    // Non-empty errors from the failed FullDataSchema parse are preserved.
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('broken fixture (empty teams) → error mode', () => {
    const result = validate(loadFixture('broken.json'));
    expect(result.mode).toBe('error');
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('no-confidence-inputs fixture → full mode (warning-level, not fatal)', () => {
    const result = validate(loadFixture('no-confidence-inputs.json'));
    expect(result.mode).toBe('full');
  });

  it('completely empty object → error mode', () => {
    const result = validate({});
    expect(result.mode).toBe('error');
  });

  it('non-object input → error mode', () => {
    const result = validate('not an object');
    expect(result.mode).toBe('error');
  });
});
