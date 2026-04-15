import { eligiblePlayers } from '../math/eligibility';
import { mulberry32 } from './rng';
import type { FullData, Team } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  requestId: number;
  team: Team;
  data: FullData;
  spotPrice: number;
  seed: number;
  trials?: number;
}

export interface SimulateResponse {
  requestId: number;
  median: number;
  p10: number;
  p90: number;
  pZero: number;
  mcMean: number;
}

function tierValueFor(req: SimulateRequest, player: string, category: string): number {
  const tier = req.team.tiers[player];
  if (!tier) {
    throw new Error(`missing tiers[${player}]`);
  }

  const value = req.data.tier_values_usd[tier]?.[category];
  if (value === undefined) {
    throw new Error(`missing tier_values_usd[${tier}][${category}]`);
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid tier_values_usd[${tier}][${category}]`);
  }

  return value;
}

// ─── Pure simulation function (exported for tests + reused in worker handler) ─

export function simulateBreak(req: SimulateRequest): SimulateResponse {
  const trials = req.trials ?? 10000;
  const rng = mulberry32(req.seed);
  const outcomes: number[] = new Array(trials);

  for (let trial = 0; trial < trials; trial++) {
    let teamValue = 0;

    for (const [category, cat] of Object.entries(req.data.card_categories)) {
      const eligible = eligiblePlayers(category, req.team);
      if (eligible.length === 0) continue;

      const denom = req.data.checklist_totals[cat.denominator_key];
      if (!denom || denom <= 0) {
        throw new Error(`missing checklist_totals[${cat.denominator_key}] for ${category}`);
      }

      const pSlot = eligible.length / denom;
      const slots = cat.slots_per_case;
      if (slots <= 0) continue;

      // Integer slots — each either lands on our team or doesn't
      const wholeSlots = Math.floor(slots);
      for (let s = 0; s < wholeSlots; s++) {
        if (rng() < pSlot) {
          const playerIdx = Math.floor(rng() * eligible.length);
          const player = eligible[playerIdx]!;
          teamValue += tierValueFor(req, player, category);
        }
      }

      // Fractional remainder (rare categories like superfractors use slots_per_case < 1)
      const remainder = slots - wholeSlots;
      if (remainder > 0 && rng() < remainder * pSlot) {
        const playerIdx = Math.floor(rng() * eligible.length);
        const player = eligible[playerIdx]!;
        teamValue += tierValueFor(req, player, category);
      }
    }

    outcomes[trial] = teamValue;
  }

  outcomes.sort((a, b) => a - b);
  const quantile = (q: number): number =>
    outcomes[Math.floor((outcomes.length - 1) * q)]!;

  // P($0) = fraction of trials where the team returned less than 10% of spotPrice.
  // Note: as spotPrice rises, the threshold rises, so pZero is monotonic NON-DECREASING
  // in spotPrice (the codex-flagged v2 fix — v1 had the direction backwards).
  const zeroThreshold = 0.10 * req.spotPrice;
  let pZeroCount = 0;
  for (const v of outcomes) if (v < zeroThreshold) pZeroCount++;
  const pZero = pZeroCount / outcomes.length;

  const mcMean = outcomes.reduce((acc, v) => acc + v, 0) / outcomes.length;

  return {
    requestId: req.requestId,
    median: quantile(0.5),
    p10: quantile(0.1),
    p90: quantile(0.9),
    pZero,
    mcMean,
  };
}

// ─── Worker message handler (only runs when loaded as a Web Worker) ─────────

if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.addEventListener('message', (e: MessageEvent<SimulateRequest>) => {
    const result = simulateBreak(e.data);
    (self as unknown as Worker).postMessage(result);
  });
}

export {};
