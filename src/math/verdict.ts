import type { ConfidenceLabel, Verdict } from '../types';

// REQ-015 + REQ-017 with INCLUSIVE boundaries (codex-flagged v2 fix).
//
// gapPct = (ev - spotPrice) / spotPrice
//   negative → user paid more than EV (overpaid)
//   positive → EV exceeds what user paid (deal)
//
// Hard verdicts only fire when confidence === 'high' AND |gapPct| ≥ 0.25.
// Soft verdicts use ≥ 0.10 inclusive boundaries.
// Below 0.10 in either direction → NEAR_MARKET.
export function computeVerdict(
  ev: number,
  spotPrice: number,
  confidence: ConfidenceLabel,
): { verdict: Verdict; isHard: boolean } {
  if (spotPrice <= 0 || !Number.isFinite(ev) || !Number.isFinite(spotPrice)) {
    // No valid comparison — default to neutral soft label.
    return { verdict: 'NEAR_MARKET', isHard: false };
  }

  const gapPct = (ev - spotPrice) / spotPrice;

  // Hard verdict: high confidence + wide gap
  if (confidence === 'high' && gapPct <= -0.25) {
    return { verdict: 'RIPPED', isHard: true };
  }
  if (confidence === 'high' && gapPct >= 0.25) {
    return { verdict: 'STEAL', isHard: true };
  }

  // Soft verdict tiers (inclusive at ±0.10)
  if (gapPct <= -0.10) {
    return { verdict: 'ABOVE_MARKET', isHard: false };
  }
  if (gapPct >= 0.10) {
    return { verdict: 'BELOW_MARKET', isHard: false };
  }
  return { verdict: 'NEAR_MARKET', isHard: false };
}
