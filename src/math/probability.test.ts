import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  probAtLeastOne,
  probAnyNumberedParallel,
  probAnyChase,
} from './probability';
import type { FullData, Team } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validFull = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'valid-full.json'), 'utf-8'),
) as FullData;

const giants = validFull.teams['New York Giants']!;

// Build a second small fixture with base_veterans count we can predict
function synthetic(data: FullData, baseVetCount: number): FullData {
  const synth = JSON.parse(JSON.stringify(data)) as FullData;
  const names = Array.from({ length: baseVetCount }, (_, i) => `Vet ${i + 1}`);
  synth.teams['Synth'] = {
    base_veterans: names,
    rookies: [],
    base_auto_signers: [],
    rookie_auto_signers: [],
    chase_players: [],
    tiers: Object.fromEntries(names.map((n) => [n, 'tier_4_cold'])),
  } satisfies Team;
  return synth;
}

describe('probAtLeastOne', () => {
  it('binomial branch: base with 3 vets / 300 checklist / 720 slots matches closed form', () => {
    // Fixture Giants: 3 base_veterans, checklist_totals.base_veterans=300, base.slots_per_case=720
    const expected = 1 - Math.pow(1 - 3 / 300, 720);
    const actual = probAtLeastOne('base', giants, validFull);
    expect(actual).toBeCloseTo(expected, 9);
  });

  it('Poisson branch: rookie_auto has fractional slots (0.5) and small p', () => {
    // slots=0.5, eligible=3, denom=94 → lambda = 0.5 * (3/94)
    const lambda = 0.5 * (3 / 94);
    const expected = 1 - Math.exp(-lambda);
    const actual = probAtLeastOne('rookie_auto', giants, validFull);
    expect(actual).toBeCloseTo(expected, 9);
  });

  it('zero eligible → probability is 0', () => {
    const synth = synthetic(validFull, 3);
    synth.teams['EmptyTeam'] = {
      base_veterans: [],
      rookies: [],
      base_auto_signers: [],
      rookie_auto_signers: [],
      chase_players: [],
      tiers: {},
    };
    expect(probAtLeastOne('base', synth.teams['EmptyTeam']!, synth)).toBe(0);
  });

  it('probability bounds: every (category × team) is in [0, 1]', () => {
    for (const teamName of Object.keys(validFull.teams)) {
      const team = validFull.teams[teamName]!;
      for (const cat of Object.keys(validFull.card_categories)) {
        const p = probAtLeastOne(cat, team, validFull);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('larger eligible player set → higher probability (monotonicity)', () => {
    const small = synthetic(validFull, 5);
    const large = synthetic(validFull, 20);
    const pSmall = probAtLeastOne('base', small.teams['Synth']!, small);
    const pLarge = probAtLeastOne('base', large.teams['Synth']!, large);
    expect(pLarge).toBeGreaterThan(pSmall);
  });
});

describe('probAnyNumberedParallel', () => {
  it('monotonic non-decreasing in team size', () => {
    const small = synthetic(validFull, 5);
    const large = synthetic(validFull, 20);
    const pSmall = probAnyNumberedParallel(small.teams['Synth']!, small);
    const pLarge = probAnyNumberedParallel(large.teams['Synth']!, large);
    expect(pLarge).toBeGreaterThanOrEqual(pSmall);
  });

  it('returns 0 when no parallel categories in the data', () => {
    const strippedData: FullData = JSON.parse(JSON.stringify(validFull));
    // Remove any parallel categories from the fixture
    for (const cat of Object.keys(strippedData.card_categories)) {
      if (cat.includes('refractor_50') || cat.includes('refractor_25') || cat.includes('refractor_5') || cat.includes('superfractor')) {
        delete strippedData.card_categories[cat];
      }
    }
    expect(probAnyNumberedParallel(giants, strippedData)).toBe(0);
  });
});

describe('probAnyChase', () => {
  it('returns 0 for a team with zero tier-1 players', () => {
    const data = synthetic(validFull, 5);
    expect(probAnyChase(data.teams['Synth']!, data)).toBe(0);
  });

  it('returns positive probability for Giants (2 chase players)', () => {
    const p = probAnyChase(giants, validFull);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
