import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CoreDataSchema, FullDataSchema } from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): unknown {
  const p = resolve(__dirname, 'fixtures', name);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

describe('Zod schemas', () => {
  describe('CoreDataSchema', () => {
    it('accepts a valid fixture', () => {
      const data = loadFixture('valid-full.json');
      const result = CoreDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts the core-only fixture (probability_only launch mode)', () => {
      const data = loadFixture('core-only.json');
      const result = CoreDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects the broken fixture (empty teams)', () => {
      const data = loadFixture('broken.json');
      const result = CoreDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('FullDataSchema', () => {
    it('accepts a valid fixture', () => {
      const data = loadFixture('valid-full.json');
      const result = FullDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects the core-only fixture (missing tier_values_usd)', () => {
      const data = loadFixture('core-only.json');
      const result = FullDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts a fixture missing confidence_inputs (warning-level, not fatal)', () => {
      const data = loadFixture('no-confidence-inputs.json');
      const result = FullDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects the broken fixture (empty teams)', () => {
      const data = loadFixture('broken.json');
      const result = FullDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('schema contract sanity', () => {
    it('CoreDataSchema exports as a Zod schema', () => {
      expect(CoreDataSchema._def).toBeDefined();
      expect(typeof CoreDataSchema.safeParse).toBe('function');
    });

    it('FullDataSchema extends CoreDataSchema', () => {
      // If FullData is a strict superset, any FullData-valid object is also Core-valid.
      const data = loadFixture('valid-full.json');
      const core = CoreDataSchema.safeParse(data);
      const full = FullDataSchema.safeParse(data);
      expect(core.success).toBe(true);
      expect(full.success).toBe(true);
    });
  });
});
