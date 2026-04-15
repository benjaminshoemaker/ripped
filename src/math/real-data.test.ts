import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { computeEV } from './ev';
import { probAtLeastOne } from './probability';
import type { FullData } from '../types';

// Sanity tests against the real (currently synthetic) public/data.json.
// These are the Task 2.1.B "3 known team sanity checks" required by REQ-040.

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', 'public', 'data.json'), 'utf-8'),
) as FullData;

const giants = data.teams['New York Giants']!;
const jets = data.teams['New York Jets']!;
const titans = data.teams['Tennessee Titans']!;

describe('Real data sanity checks (Task 2.1.B)', () => {
  it('Giants EV is a positive finite number in plausible range $50–$5,000', () => {
    const { ev } = computeEV(giants, data);
    expect(ev).toBeGreaterThan(50);
    expect(ev).toBeLessThan(5000);
    expect(Number.isFinite(ev)).toBe(true);
  });

  it('Jets EV < Giants EV (cold team < chase-heavy team)', () => {
    const giantsEV = computeEV(giants, data).ev;
    const jetsEV = computeEV(jets, data).ev;
    expect(jetsEV).toBeLessThan(giantsEV);
  });

  it('Titans: rookie_auto contribution > base_auto contribution (base_auto=0)', () => {
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

  it("Giants: probAtLeastOne('rookie', ...) is very likely (> 0.95)", () => {
    // Rookies have 240 slots/case; even with only 3 Giants rookies / 100 total,
    // the probability of pulling at least one rookie of any Giants player is very high.
    const p = probAtLeastOne('rookie', giants, data);
    expect(p).toBeGreaterThan(0.95);
  });

  it("Giants: probAtLeastOne('rookie_auto', ...) is in realistic range [0, 0.5]", () => {
    // ~0.5 slots × ~4/94 chase ≈ 2% — small but non-zero
    const p = probAtLeastOne('rookie_auto', giants, data);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(0.5);
  });

  it('Every team has finite, non-negative EV', () => {
    for (const teamName of Object.keys(data.teams)) {
      const team = data.teams[teamName]!;
      const { ev } = computeEV(team, data);
      expect(Number.isFinite(ev), `${teamName} EV not finite: ${ev}`).toBe(true);
      expect(ev).toBeGreaterThanOrEqual(0);
    }
  });

  it("Top-rookie teams' top contributor is one of their chase players", () => {
    // More meaningful than "above median EV" — small-roster teams (e.g. Patriots
    // with only 11 players) can sit below median even when their chase players
    // dominate their own per-team EV. What we ACTUALLY care about is that
    // chase players are correctly identified as the EV drivers within each team.
    const premium = [
      'New York Giants',
      'Las Vegas Raiders',
      'Jacksonville Jaguars',
      'New England Patriots',
      'Cleveland Browns',
      'Tennessee Titans',
    ];
    for (const name of premium) {
      const team = data.teams[name]!;
      const { contributors } = computeEV(team, data);
      const topPlayer = contributors[0]!.player;
      const isChase = team.chase_players.includes(topPlayer);
      expect(
        isChase,
        `${name}: top EV contributor "${topPlayer}" should be in chase_players ${JSON.stringify(team.chase_players)}`,
      ).toBe(true);
    }
  });
});
