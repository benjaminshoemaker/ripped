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

  describe('core-level fail-loud invariants', () => {
    // Regression tests for the two gaps surfaced by the final codex-review:
    // denominator-key completeness and roster-tier completeness must both
    // be enforced at CoreDataSchema, not only at FullDataSchema. Otherwise
    // the probability_only fallback silently accepts data that later
    // crashes at runtime (worker throw) or renders undefined tier labels.

    function withDeepPatch<T>(source: T, patch: (clone: unknown) => void): unknown {
      const clone = structuredClone(source);
      patch(clone as unknown);
      return clone;
    }

    it('CoreDataSchema rejects data missing a denominator_key in checklist_totals', () => {
      const fixture = loadFixture('core-only.json');
      const mutated = withDeepPatch(fixture, (clone) => {
        const c = clone as {
          card_categories: Record<string, { denominator_key: string; slots_per_case: number }>;
        };
        // Force every numbered-parallel category to reference a denominator
        // key that is NOT present in checklist_totals.
        c.card_categories.gold_refractor_50 = {
          slots_per_case: 0.2,
          denominator_key: 'base_plus_rookies',
        };
        // Drop checklist_totals.base_plus_rookies via delete.
        const root = clone as { checklist_totals: Record<string, unknown> };
        delete root.checklist_totals.base_plus_rookies;
      });

      const result = CoreDataSchema.safeParse(mutated);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDenominatorIssue = result.error.issues.some((issue) =>
          issue.message.includes('missing checklist_totals[base_plus_rookies]'),
        );
        expect(hasDenominatorIssue).toBe(true);
      }
    });

    it('CoreDataSchema rejects data missing a tiers[player] entry for a roster player', () => {
      const fixture = loadFixture('core-only.json');
      const mutated = withDeepPatch(fixture, (clone) => {
        const root = clone as {
          teams: Record<string, { base_veterans: string[]; tiers: Record<string, string> }>;
        };
        const firstTeamName = Object.keys(root.teams)[0];
        const team = root.teams[firstTeamName];
        const firstPlayer = team.base_veterans[0];
        delete team.tiers[firstPlayer];
      });

      const result = CoreDataSchema.safeParse(mutated);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasTierIssue = result.error.issues.some((issue) =>
          issue.message.includes('missing tiers['),
        );
        expect(hasTierIssue).toBe(true);
      }
    });

    it('FullDataSchema also catches the Core-level denominator gap', () => {
      const fixture = loadFixture('valid-full.json');
      const mutated = withDeepPatch(fixture, (clone) => {
        const c = clone as {
          card_categories: Record<string, { denominator_key: string; slots_per_case: number }>;
        };
        c.card_categories.gold_refractor_50 = {
          slots_per_case: 0.2,
          denominator_key: 'base_plus_rookies',
        };
        const root = clone as { checklist_totals: Record<string, unknown> };
        delete root.checklist_totals.base_plus_rookies;
      });

      const result = FullDataSchema.safeParse(mutated);
      expect(result.success).toBe(false);
    });
  });
});
