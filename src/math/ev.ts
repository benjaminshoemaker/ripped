import { eligiblePlayers } from './eligibility';
import type { Contributor, FullData, Team } from '../types';

interface PlayerContributionAggregate {
  total: number;
  representative: Contributor;
}

function missingTierValueMessage(tier: string, category: string): string {
  return `missing tier_values_usd[${tier}][${category}]`;
}

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
    if (!denom || denom <= 0) {
      throw new Error(`missing checklist_totals[${cat.denominator_key}] for ${category}`);
    }

    // Expected count per player per category = slots_per_case / total_eligible_population
    const expectedCountPerPlayer = cat.slots_per_case / denom;

    for (const playerName of eligible) {
      const tier = team.tiers[playerName];
      if (!tier) {
        throw new Error(`missing tiers[${playerName}]`);
      }

      const tierValue = data.tier_values_usd[tier]?.[category];
      if (tierValue === undefined) {
        throw new Error(missingTierValueMessage(tier, category));
      }
      if (!Number.isFinite(tierValue) || tierValue < 0) {
        throw new Error(`invalid tier_values_usd[${tier}][${category}]`);
      }

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

  // Top-5 contributing players for the UI panel (REQ-018).
  const playerTotals = new Map<string, PlayerContributionAggregate>();
  for (const contributor of allContributors) {
    const existing = playerTotals.get(contributor.player);
    if (!existing) {
      playerTotals.set(contributor.player, {
        total: contributor.expectedValue,
        representative: contributor,
      });
      continue;
    }

    existing.total += contributor.expectedValue;
    if (contributor.expectedValue > existing.representative.expectedValue) {
      existing.representative = contributor;
    }
  }

  const contributors = [...playerTotals.values()]
    .map(({ total, representative }) => ({
      ...representative,
      expectedValue: total,
    }))
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .slice(0, 5);

  const sorted = [...allContributors].sort((a, b) => b.expectedValue - a.expectedValue);

  return { ev: totalEV, contributors, allContributors: sorted };
}
