import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { validate } from './validate';

// Regression test: Phase 2's `public/data.json` (synthetic for now, real once
// DJ delivers it) MUST parse against FullDataSchema cleanly. If this test
// fails, the data file is broken — fix the data, not the schema.

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '..', 'public', 'data.json');
const raw = JSON.parse(readFileSync(dataPath, 'utf-8'));
const playerListFields = [
  'base_veterans',
  'rookies',
  'base_auto_signers',
  'rookie_auto_signers',
  'chase_players',
] as const;

describe('public/data.json (Task 2.1.A)', () => {
  it('real data parses against FullDataSchema (or CoreDataSchema if values_ready=false)', () => {
    const result = validate(raw);
    if (result.mode === 'error') {
      // Surface the first 5 issues for fast debugging
      console.error('validate() returned error mode:', JSON.stringify(result.errors.slice(0, 5), null, 2));
    }
    if (raw.values_ready === true) {
      expect(result.mode).toBe('full');
    } else {
      expect(result.mode).toBe('probability_only');
    }
  });

  it('values_ready=false forces probability_only mode even when full fields are present', () => {
    const data = structuredClone(raw);
    data.values_ready = false;

    const result = validate(data);

    expect(result.mode).toBe('probability_only');
    expect(result.errors.some((issue) => issue.path.join('.') === 'values_ready')).toBe(true);
  });

  it('all 32 NFL teams present', () => {
    expect(Object.keys(raw.teams).length).toBe(32);
  });

  it('every team has all 6 required category lists + tiers', () => {
    for (const [name, team] of Object.entries<any>(raw.teams)) {
      expect(team).toHaveProperty('base_veterans');
      expect(team).toHaveProperty('rookies');
      expect(team).toHaveProperty('base_auto_signers');
      expect(team).toHaveProperty('rookie_auto_signers');
      expect(team).toHaveProperty('chase_players');
      expect(team).toHaveProperty('tiers');
      expect(Array.isArray(team.base_veterans), `${name} base_veterans is array`).toBe(true);
      expect(Array.isArray(team.rookies), `${name} rookies is array`).toBe(true);
    }
  });

  it('every player named in any category list has a tier assignment', () => {
    for (const [name, team] of Object.entries<any>(raw.teams)) {
      const allPlayers = new Set<string>();
      for (const field of playerListFields) {
        for (const player of team[field]) allPlayers.add(player);
      }
      for (const player of allPlayers) {
        expect(team.tiers[player], `${name}/${player} missing tier`).toBeDefined();
      }
    }
  });

  it('every tier referenced is one of the 4 enum values', () => {
    const validTiers = new Set(['tier_1_chase', 'tier_2_strong', 'tier_3_fair', 'tier_4_cold']);
    for (const team of Object.values<any>(raw.teams)) {
      for (const tier of Object.values(team.tiers)) {
        expect(validTiers.has(tier as string)).toBe(true);
      }
    }
  });

  it('Tennessee Titans preserves the 0 base_auto_signers edge case', () => {
    expect(raw.teams['Tennessee Titans'].base_auto_signers).toEqual([]);
  });
});
