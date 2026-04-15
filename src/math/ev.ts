import { eligiblePlayers } from './eligibility';
import type { Contributor, FullData, Team } from '../types';

// Closed-form expected value for a single team spot in a PYT hobby case break.
// Iterates card categories × eligible players and sums expected_count × tier_value.
// The Monte Carlo simulation draws from the SAME eligibility function, so the
// two are guaranteed consistent (the codex-flagged v2 fix).
//
// Returns the total EV plus:
// - `contributors`: top-5 by contribution (for REQ-018 UI panel)
// - `allContributors`: full list before top-5 slice (for tests, per-category aggregation, future UI)
export function computeEV(team: Team, data: FullData): {
  ev: number;
  contributors: Contributor[];
  allContributors: Contributor[];
} {
  let totalEV = 0;
  const allContributors: Contributor[] = [];

  for (const [category, cat] of Object.entries(data.card_categories)) {
    const eligible = eligiblePlayers(category, team);
    if (eligible.length === 0) continue;

    const denom = data.checklist_totals[cat.denominator_key];
    if (!denom || denom <= 0) continue;

    // Expected count per player per category = slots_per_case / total_eligible_population
    const expectedCountPerPlayer = cat.slots_per_case / denom;

    for (const playerName of eligible) {
      const tier = team.tiers[playerName];
      if (!tier) continue;
      const tierValue = data.tier_values_usd[tier]?.[category];
      if (tierValue === undefined) continue;

      const contribution = expectedCountPerPlayer * tierValue;
      totalEV += contribution;

      allContributors.push({
        player: playerName,
        tier,
        category,
        expectedValue: contribution,
        isChase: team.chase_players.includes(playerName),
      });
    }
  }

  // Top-5 contributors for the UI panel (REQ-018).
  const sorted = [...allContributors].sort((a, b) => b.expectedValue - a.expectedValue);
  const contributors = sorted.slice(0, 5);

  return { ev: totalEV, contributors, allContributors: sorted };
}
