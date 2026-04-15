import type { Team } from '../types';

// Maps each card category to the list of eligible players on a given team.
// Both closed-form EV and the Monte Carlo simulation call this function so
// they always draw from the same eligibility set. Codex-flagged v2 fix:
// without this, EV could assign rookie_auto value to non-auto-signing vets.

export function eligiblePlayers(category: string, team: Team): string[] {
  switch (category) {
    case 'base':
    case 'base_refractor':
      return team.base_veterans;
    case 'rookie':
    case 'rookie_refractor':
      return team.rookies;
    case 'base_auto':
      return team.base_auto_signers;
    case 'rookie_auto':
      return team.rookie_auto_signers;
    // Numbered parallels span veterans + rookies (both can appear as parallels)
    case 'gold_refractor_50':
    case 'orange_refractor_25':
    case 'red_refractor_5':
    case 'superfractor_1':
      return [...team.base_veterans, ...team.rookies];
    // RPA variants are auto patches — rookie auto signers only
    case 'rpa_gold_50':
    case 'rpa_orange_25':
      return team.rookie_auto_signers;
    default:
      throw new Error(`Unknown category for eligibility: ${category}`);
  }
}
