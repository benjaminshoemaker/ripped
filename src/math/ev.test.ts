import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { computeEV } from './ev';
import type { FullData, Team } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validFull = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'valid-full.json'), 'utf-8'),
) as FullData;

// Augment the fixture with Jets (cold) and Titans (rookie-auto-only) for EV comparison tests.
function buildTestData(): FullData {
  const data = JSON.parse(JSON.stringify(validFull)) as FullData;
  data.teams['Jets'] = {
    base_veterans: ['Role Player'],
    rookies: ['Cold Rookie'],
    base_auto_signers: [],
    rookie_auto_signers: [],
    chase_players: [],
    tiers: {
      'Role Player': 'tier_4_cold',
      'Cold Rookie': 'tier_4_cold',
    },
  };
  data.teams['Titans'] = {
    base_veterans: ['Jeffery Simmons', 'Calvin Ridley'],
    rookies: ['Cam Ward', 'Gunnar Helm'],
    base_auto_signers: [], // 0 base auto signers — real Tennessee edge case
    rookie_auto_signers: ['Cam Ward', 'Gunnar Helm'],
    chase_players: ['Cam Ward'],
    tiers: {
      'Jeffery Simmons': 'tier_2_strong',
      'Calvin Ridley': 'tier_3_fair',
      'Cam Ward': 'tier_1_chase',
      'Gunnar Helm': 'tier_3_fair',
    },
  };
  return data;
}

describe('computeEV', () => {
  const data = buildTestData();
  const giants = data.teams['New York Giants']!;
  const jets = data.teams['Jets']!;
  const titans = data.teams['Titans']!;

  it('Giants EV is a positive number', () => {
    const { ev } = computeEV(giants, data);
    expect(ev).toBeGreaterThan(0);
    expect(Number.isFinite(ev)).toBe(true);
  });

  it('Giants EV > Jets EV (chase-heavy beats cold)', () => {
    const giantsEV = computeEV(giants, data).ev;
    const jetsEV = computeEV(jets, data).ev;
    expect(giantsEV).toBeGreaterThan(jetsEV);
  });

  it('Titans: rookie_auto contribution > base_auto contribution (base_auto = 0)', () => {
    // Use allContributors (not top-5) — rookie_auto contributions are small
    // per-player and routinely fall below the top-5 cutoff for chase-heavy teams.
    const { allContributors } = computeEV(titans, data);
    const baseAutoTotal = allContributors
      .filter((c) => c.category === 'base_auto')
      .reduce((s, c) => s + c.expectedValue, 0);
    const rookieAutoTotal = allContributors
      .filter((c) => c.category === 'rookie_auto')
      .reduce((s, c) => s + c.expectedValue, 0);
    expect(baseAutoTotal).toBe(0);
    expect(rookieAutoTotal).toBeGreaterThan(0);
  });

  it('contributors array has at most 5 entries and is sorted descending', () => {
    const { contributors } = computeEV(giants, data);
    expect(contributors.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < contributors.length; i++) {
      expect(contributors[i - 1]!.expectedValue).toBeGreaterThanOrEqual(
        contributors[i]!.expectedValue,
      );
    }
  });

  it('every contributor category is in eligiblePlayers for that team (eligibility consistency)', () => {
    const { contributors } = computeEV(giants, data);
    for (const c of contributors) {
      // If a contributor is attributed to rookie_auto, they must be in rookie_auto_signers
      if (c.category === 'rookie_auto') {
        expect(giants.rookie_auto_signers).toContain(c.player);
      }
      if (c.category === 'base_auto') {
        expect(giants.base_auto_signers).toContain(c.player);
      }
      if (c.category === 'rookie') {
        expect(giants.rookies).toContain(c.player);
      }
      if (c.category === 'base') {
        expect(giants.base_veterans).toContain(c.player);
      }
    }
  });

  it('contributors include isChase=true for tier-1 players', () => {
    const { contributors } = computeEV(giants, data);
    const chaseContrib = contributors.filter((c) => c.isChase);
    expect(chaseContrib.length).toBeGreaterThan(0);
    for (const c of chaseContrib) {
      expect(giants.chase_players).toContain(c.player);
    }
  });
});
