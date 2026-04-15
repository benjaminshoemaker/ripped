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

// Per-condition pass/fail breakdown for the UI "why is this medium confidence?"
// reveal. Conditions 3 and 4 depend on global data so they're reported with a
// single status. Conditions 1 and 2 are per chase-player × category; we report
// the weakest chase record for each (same failure mode computeConfidence cares
// about via its min-aggregation).
export interface ConfidenceConditionStatus {
  id: 'odds_source' | 'values_freshness' | 'comp_count' | 'comp_window';
  label: string;
  passed: boolean;
  detail: string;
}

export interface ConfidenceBreakdown {
  label: ConfidenceLabel;
  conditions: ConfidenceConditionStatus[];
}

export function computeConfidenceBreakdown(
  data: AppData,
  teamName: string,
): ConfidenceBreakdown {
  const label = computeConfidence(data, teamName);

  const team = data.teams[teamName];
  const confidenceInputs =
    'tier_values_usd' in data ? (data as FullData).confidence_inputs : undefined;

  // Global conditions (teams-agnostic).
  const oddsPassed = data.odds_source === '2025_official';
  const valuesDays = daysSince(data.values_as_of);
  const valuesPassed = Number.isFinite(valuesDays) && valuesDays <= 14;
  const valuesDetail = Number.isFinite(valuesDays)
    ? `${Math.max(0, Math.floor(valuesDays))} days old (need ≤ 14)`
    : 'timestamp unreadable';

  // Per-chase-record conditions. Walk every chase_player × category record
  // and track the worst (most-failing) result per condition.
  let anyChaseRecordSeen = false;
  let compCountWorst: ConfidenceInput | null = null;
  let compCountWorstPassed = true;
  let compWindowWorst: ConfidenceInput | null = null;
  let compWindowWorstPassed = true;

  if (team && team.chase_players.length > 0 && confidenceInputs) {
    for (const player of team.chase_players) {
      const playerInputs = confidenceInputs[player];
      if (!playerInputs) {
        // Missing record: treat both per-record conditions as failed at zero.
        anyChaseRecordSeen = true;
        compCountWorstPassed = false;
        compWindowWorstPassed = false;
        continue;
      }
      for (const pc of Object.values(playerInputs)) {
        anyChaseRecordSeen = true;

        const countOk = pc.comp_count >= 3;
        if (!countOk && compCountWorstPassed) {
          compCountWorst = pc;
          compCountWorstPassed = false;
        } else if (countOk && compCountWorstPassed && compCountWorst === null) {
          compCountWorst = pc;
        }

        const windowOk = pc.comp_window_days <= 30;
        if (!windowOk && compWindowWorstPassed) {
          compWindowWorst = pc;
          compWindowWorstPassed = false;
        } else if (windowOk && compWindowWorstPassed && compWindowWorst === null) {
          compWindowWorst = pc;
        }
      }
    }
  }

  const compCountPassed = anyChaseRecordSeen && compCountWorstPassed;
  const compCountDetail = !anyChaseRecordSeen
    ? 'no comp data for this team'
    : compCountWorst
      ? `${compCountWorst.comp_count} sales (need ≥ 3)`
      : 'no chase records found';

  const compWindowPassed = anyChaseRecordSeen && compWindowWorstPassed;
  const compWindowDetail = !anyChaseRecordSeen
    ? 'no comp data for this team'
    : compWindowWorst
      ? `${compWindowWorst.comp_window_days}-day window (need ≤ 30)`
      : 'no chase records found';

  return {
    label,
    conditions: [
      {
        id: 'comp_count',
        label: 'Chase-player comp volume',
        passed: compCountPassed,
        detail: compCountDetail,
      },
      {
        id: 'comp_window',
        label: 'Chase-player comp freshness',
        passed: compWindowPassed,
        detail: compWindowDetail,
      },
      {
        id: 'odds_source',
        label: 'Pack odds source',
        passed: oddsPassed,
        detail: oddsPassed
          ? '2025 official odds loaded'
          : '2024 placeholder (2025 not yet loaded)',
      },
      {
        id: 'values_freshness',
        label: 'Values freshness',
        passed: valuesPassed,
        detail: valuesDetail,
      },
    ],
  };
}
