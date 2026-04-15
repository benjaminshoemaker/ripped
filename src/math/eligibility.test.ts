import { describe, it, expect } from 'vitest';
import { eligiblePlayers } from './eligibility';
import type { Team } from '../types';

const testTeam: Team = {
  base_veterans: ['Malik Nabers', 'Russell Wilson', 'Dexter Lawrence II'],
  rookies: ['Jaxson Dart', 'Cam Skattebo', 'Abdul Carter'],
  base_auto_signers: ['Malik Nabers', 'Russell Wilson'],
  rookie_auto_signers: ['Jaxson Dart', 'Cam Skattebo', 'Abdul Carter'],
  chase_players: ['Jaxson Dart', 'Malik Nabers'],
  tiers: {
    'Malik Nabers': 'tier_1_chase',
    'Russell Wilson': 'tier_2_strong',
    'Dexter Lawrence II': 'tier_3_fair',
    'Jaxson Dart': 'tier_1_chase',
    'Cam Skattebo': 'tier_2_strong',
    'Abdul Carter': 'tier_2_strong',
  },
};

// Titans-like team: zero base_auto_signers (real edge case from the JSON).
const tennesseeLike: Team = {
  base_veterans: ['Jeffery Simmons', 'Calvin Ridley'],
  rookies: ['Cam Ward', 'Gunnar Helm'],
  base_auto_signers: [],
  rookie_auto_signers: ['Cam Ward', 'Gunnar Helm'],
  chase_players: ['Cam Ward'],
  tiers: {
    'Jeffery Simmons': 'tier_2_strong',
    'Calvin Ridley': 'tier_3_fair',
    'Cam Ward': 'tier_1_chase',
    'Gunnar Helm': 'tier_3_fair',
  },
};

describe('eligiblePlayers', () => {
  it('returns base_veterans for base category', () => {
    expect(eligiblePlayers('base', testTeam)).toEqual([
      'Malik Nabers',
      'Russell Wilson',
      'Dexter Lawrence II',
    ]);
  });

  it('returns base_veterans for base_refractor', () => {
    expect(eligiblePlayers('base_refractor', testTeam)).toEqual(testTeam.base_veterans);
  });

  it('returns rookies for rookie category', () => {
    expect(eligiblePlayers('rookie', testTeam)).toEqual(testTeam.rookies);
  });

  it('returns base_auto_signers for base_auto', () => {
    expect(eligiblePlayers('base_auto', testTeam)).toEqual(['Malik Nabers', 'Russell Wilson']);
  });

  it('rookie autos', () => {
    expect(eligiblePlayers('rookie_auto', testTeam)).toEqual([
      'Jaxson Dart',
      'Cam Skattebo',
      'Abdul Carter',
    ]);
  });

  it('numbered parallel combines base_veterans + rookies', () => {
    const gold = eligiblePlayers('gold_refractor_50', testTeam);
    expect(gold).toEqual([
      ...testTeam.base_veterans,
      ...testTeam.rookies,
    ]);
  });

  it('numbered parallel combines (red_refractor_5)', () => {
    expect(eligiblePlayers('red_refractor_5', testTeam).length).toBe(
      testTeam.base_veterans.length + testTeam.rookies.length,
    );
  });

  it('rpa_gold_50 returns rookie_auto_signers only', () => {
    expect(eligiblePlayers('rpa_gold_50', testTeam)).toEqual(testTeam.rookie_auto_signers);
  });

  it('zero eligible: Tennessee-like team has no base_auto_signers', () => {
    expect(eligiblePlayers('base_auto', tennesseeLike)).toEqual([]);
  });

  it('unknown category throws fail-loud error', () => {
    expect(() => eligiblePlayers('unknown_category_123', testTeam)).toThrow(
      /Unknown category/,
    );
  });
});
