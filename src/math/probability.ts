import { eligiblePlayers } from './eligibility';
import type { CoreData, FullData, Team } from '../types';

type AppData = CoreData | FullData;

// Per-slot probability that a single slot in a given card category lands on
// the selected team. = (# eligible players on this team) / (category denominator).
function pSlotForTeam(category: string, team: Team, data: AppData): number {
  const cat = data.card_categories[category];
  if (!cat) return 0;
  const eligible = eligiblePlayers(category, team).length;
  if (eligible === 0) return 0;
  const denom = data.checklist_totals[cat.denominator_key];
  if (!denom || denom <= 0) return 0;
  return eligible / denom;
}

// Probability of pulling at least one card in `category` for the given team,
// across a full hobby case. Binomial complement for integer slots, Poisson
// approximation for fractional/rare slots (superfractors, RPAs).
//
//   p ≥ 1 slot:    P(≥1) = 1 - (1 - p_slot)^slots
//   p < 1 slot:    P(≥1) ≈ 1 - exp(-slots * p_slot)  (Poisson)
export function probAtLeastOne(category: string, team: Team, data: AppData): number {
  const cat = data.card_categories[category];
  if (!cat) return 0;
  const slots = cat.slots_per_case;
  if (slots <= 0) return 0;
  const p = pSlotForTeam(category, team, data);
  if (p === 0) return 0;

  if (slots >= 1) {
    return 1 - Math.pow(1 - p, slots);
  }
  // Poisson approximation — valid for rare events with fractional slots.
  const lambda = slots * p;
  return 1 - Math.exp(-lambda);
}

// Aggregate: probability of pulling at least one numbered parallel of any rarity
// (gold /50, orange /25, red /5, superfractor 1/1). Uses the independence
// approximation 1 − ∏(1 − p_i). Only considers categories actually in the data.
export function probAnyNumberedParallel(team: Team, data: AppData): number {
  const parallelCategories = [
    'gold_refractor_50',
    'orange_refractor_25',
    'red_refractor_5',
    'superfractor_1',
  ];
  let pMiss = 1;
  for (const c of parallelCategories) {
    if (!data.card_categories[c]) continue;
    pMiss *= 1 - probAtLeastOne(c, team, data);
  }
  return 1 - pMiss;
}

// Aggregate: probability of pulling at least one chase card (any card where
// the assigned player is `tier_1_chase`) across all categories on this team.
// Uses independence across categories.
export function probAnyChase(team: Team, data: AppData): number {
  if (team.chase_players.length === 0) return 0;
  const chaseSet = new Set(team.chase_players);

  let pMiss = 1;
  for (const [catName, cat] of Object.entries(data.card_categories)) {
    const eligible = eligiblePlayers(catName, team);
    const chaseEligible = eligible.filter((p) => chaseSet.has(p));
    if (chaseEligible.length === 0) continue;

    const denom = data.checklist_totals[cat.denominator_key];
    if (!denom || denom <= 0) continue;
    const p = chaseEligible.length / denom;
    const slots = cat.slots_per_case;
    if (slots <= 0 || p === 0) continue;

    let pCategoryMiss: number;
    if (slots >= 1) {
      pCategoryMiss = Math.pow(1 - p, slots);
    } else {
      pCategoryMiss = Math.exp(-slots * p);
    }
    pMiss *= pCategoryMiss;
  }
  return 1 - pMiss;
}
