import type {
  ConfidenceInput,
  ConfidenceLabel,
  CoreData,
  FullData,
} from '../types';

type AppData = CoreData | FullData;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ts) / DAY_MS;
}

// The four conditions from PRODUCT_SPEC REQ-016. Each receives one
// (player × category) input record plus the full AppData and returns a boolean.
// Exported for tests so the truth table can be exercised directly.
export const CONFIDENCE_CONDITIONS: Array<
  (pc: ConfidenceInput, data: AppData) => boolean
> = [
  (pc) => pc.comp_count >= 3,
  (pc) => pc.comp_window_days <= 30,
  (_pc, data) => data.odds_source === '2025_official',
  (_pc, data) => daysSince(data.values_as_of) <= 14,
];

// REQ-016 with min-aggregation across chase player × category records.
// - high:   ALL four conditions pass for EVERY chase record (min = 4)
// - medium: ≥2 of 4 pass for EVERY chase record (min ≥ 2)
// - low:    otherwise (no inputs, no chase players, or weakest record < 2)
export function computeConfidence(data: AppData, teamName: string): ConfidenceLabel {
  const team = data.teams[teamName];
  if (!team || team.chase_players.length === 0) return 'low';

  // confidence_inputs is only present on FullData. In probability_only mode
  // there's no value table and therefore no confidence to compute — always low.
  const confidenceInputs =
    'tier_values_usd' in data ? (data as FullData).confidence_inputs : undefined;
  if (!confidenceInputs) return 'low';

  const scores: number[] = [];
  for (const player of team.chase_players) {
    const playerInputs = confidenceInputs[player];
    if (!playerInputs) {
      scores.push(0);
      continue;
    }
    for (const pc of Object.values(playerInputs)) {
      const passed = CONFIDENCE_CONDITIONS.filter((cond) => cond(pc, data)).length;
      scores.push(passed);
    }
  }

  if (scores.length === 0) return 'low';

  const minScore = Math.min(...scores);
  if (minScore === 4) return 'high';
  if (minScore >= 2) return 'medium';
  return 'low';
}
