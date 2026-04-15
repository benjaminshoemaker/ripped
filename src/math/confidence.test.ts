import { describe, it, expect } from 'vitest';
import { computeConfidence, CONFIDENCE_CONDITIONS } from './confidence';
import type { FullData } from '../types';

// Build a synthetic FullData fixture we can mutate cell-by-cell for the truth table.
// `values_as_of` is set to now so condition #4 is always "pass" unless a test
// overrides it.
function buildData(overrides: {
  oddsSource?: '2024_placeholder' | '2025_official';
  valuesAsOf?: string;
  compCount?: number;
  compWindowDays?: number;
  includeConfidenceInputs?: boolean;
  chasePlayers?: string[];
  multipleChaseRecords?: boolean;
}): FullData {
  const nowIso = new Date().toISOString();
  const {
    oddsSource = '2025_official',
    valuesAsOf = nowIso,
    compCount = 12,
    compWindowDays = 14,
    includeConfidenceInputs = true,
    chasePlayers = ['Jaxson Dart'],
    multipleChaseRecords = false,
  } = overrides;

  const data: FullData = {
    checklist_as_of: nowIso,
    odds_as_of: nowIso,
    values_as_of: valuesAsOf,
    comps_as_of: nowIso,
    odds_source: oddsSource,
    values_ready: true,
    product: {
      name: 'test',
      format: 'pyt_hobby_case',
      benchmark_case_cost_usd: 4200,
      boxes_per_case: 12,
      packs_per_box: 20,
      cards_per_pack: 4,
      ship_all_cards_assumption: true,
      guaranteed_per_box: { autos: 1, rookies: 20, base_refractors: 6, numbered_parallels: 2 },
    },
    checklist_totals: {
      base_veterans: 300,
      rookies: 100,
      base_auto_signers: 71,
      rookie_auto_signers: 94,
    },
    card_categories: { base: { slots_per_case: 720, denominator_key: 'base_veterans' } },
    tier_values_usd: {
      tier_1_chase: { base: 8 },
      tier_2_strong: { base: 4 },
      tier_3_fair: { base: 2 },
      tier_4_cold: { base: 1 },
    },
    teams: {
      'Test Team': {
        base_veterans: ['Vet'],
        rookies: chasePlayers,
        base_auto_signers: [],
        rookie_auto_signers: chasePlayers,
        chase_players: chasePlayers,
        tiers: Object.fromEntries([
          ['Vet', 'tier_3_fair'],
          ...chasePlayers.map((p) => [p, 'tier_1_chase']),
        ]),
      },
    },
  };

  if (includeConfidenceInputs) {
    data.confidence_inputs = {};
    for (const player of chasePlayers) {
      data.confidence_inputs[player] = {
        rookie_auto: {
          comp_count: compCount,
          comp_window_days: compWindowDays,
          last_comp_refresh: nowIso,
          value_source: 'ebay_sold',
        },
      };
      if (multipleChaseRecords) {
        data.confidence_inputs[player]!.base_auto = {
          comp_count: 1, // Intentionally fails condition #1 → this record scores ≤ 3
          comp_window_days: compWindowDays,
          last_comp_refresh: nowIso,
          value_source: 'ebay_sold',
        };
      }
    }
  }

  return data;
}

describe('computeConfidence — four-condition truth table', () => {
  it('all four pass → high', () => {
    const data = buildData({});
    expect(computeConfidence(data, 'Test Team')).toBe('high');
  });

  it('two of four pass → medium', () => {
    // Fail conditions 1 and 2 by setting comp_count low and window wide
    const data = buildData({ compCount: 1, compWindowDays: 60 });
    // Still pass: 2025_official (condition 3), values_as_of recent (condition 4)
    expect(computeConfidence(data, 'Test Team')).toBe('medium');
  });

  it('one of four passes → low', () => {
    // Fail 1, 2, 3; keep only condition 4 (values recent)
    const data = buildData({
      compCount: 1,
      compWindowDays: 60,
      oddsSource: '2024_placeholder',
    });
    expect(computeConfidence(data, 'Test Team')).toBe('low');
  });

  it('zero pass → low', () => {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data = buildData({
      compCount: 1,
      compWindowDays: 60,
      oddsSource: '2024_placeholder',
      valuesAsOf: oldDate,
    });
    expect(computeConfidence(data, 'Test Team')).toBe('low');
  });

  it('min aggregation: a single weak chase record drops team confidence', () => {
    // Multiple chase records where one has comp_count=1 → min = whatever that record scores
    // All other conditions pass, so weak record scores 3 (pass on 2,3,4; fail on 1) → medium
    const data = buildData({ multipleChaseRecords: true });
    expect(computeConfidence(data, 'Test Team')).toBe('medium');
  });

  it('missing confidence_inputs entirely → low', () => {
    const data = buildData({ includeConfidenceInputs: false });
    expect(computeConfidence(data, 'Test Team')).toBe('low');
  });

  it('team has no chase_players → low', () => {
    const data = buildData({ chasePlayers: [] });
    expect(computeConfidence(data, 'Test Team')).toBe('low');
  });

  it('team does not exist → low', () => {
    const data = buildData({});
    expect(computeConfidence(data, 'Nonexistent Team')).toBe('low');
  });

  it('exports CONFIDENCE_CONDITIONS array with exactly 4 conditions', () => {
    expect(CONFIDENCE_CONDITIONS.length).toBe(4);
  });
});
