import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

const tierLabelSchema = z.enum([
  'tier_1_chase',
  'tier_2_strong',
  'tier_3_fair',
  'tier_4_cold',
]);

const oddsSourceSchema = z.enum(['2024_placeholder', '2025_official']);

const timestampSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be a valid ISO 8601 timestamp');

// ─── Product + categories ──────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1),
  format: z.literal('pyt_hobby_case'),
  benchmark_case_cost_usd: z.number().positive(),
  boxes_per_case: z.number().int().positive(),
  packs_per_box: z.number().int().positive(),
  cards_per_pack: z.number().int().positive(),
  ship_all_cards_assumption: z.boolean(),
  guaranteed_per_box: z.object({
    autos: z.number().int().nonnegative(),
    rookies: z.number().int().nonnegative(),
    base_refractors: z.number().int().nonnegative(),
    numbered_parallels: z.number().int().nonnegative(),
  }),
});

const checklistTotalsSchema = z.object({
  base_veterans: z.number().int().positive(),
  rookies: z.number().int().positive(),
  base_auto_signers: z.number().int().positive(),
  rookie_auto_signers: z.number().int().positive(),
});

const cardCategorySchema = z.object({
  slots_per_case: z.number().nonnegative(),
  denominator_key: z.enum([
    'base_veterans',
    'rookies',
    'base_auto_signers',
    'rookie_auto_signers',
  ]),
});

// ─── Teams ─────────────────────────────────────────────────────────────────

const teamSchema = z.object({
  base_veterans: z.array(z.string()),
  rookies: z.array(z.string()),
  base_auto_signers: z.array(z.string()),
  rookie_auto_signers: z.array(z.string()),
  chase_players: z.array(z.string()),
  tiers: z.record(z.string(), tierLabelSchema),
});

// ─── Tier values ───────────────────────────────────────────────────────────

const tierValueRowSchema = z.record(z.string(), z.number().nonnegative());

const tierValuesSchema = z.object({
  tier_1_chase: tierValueRowSchema,
  tier_2_strong: tierValueRowSchema,
  tier_3_fair: tierValueRowSchema,
  tier_4_cold: tierValueRowSchema,
});

// ─── Confidence inputs (warning-level, optional in FullDataSchema) ─────────

const confidenceInputSchema = z.object({
  comp_count: z.number().int().nonnegative(),
  comp_window_days: z.number().int().positive(),
  last_comp_refresh: timestampSchema,
  value_source: z.string().min(1),
});

const confidenceInputsSchema = z.record(
  z.string(), // player name
  z.record(z.string(), confidenceInputSchema), // category -> inputs
);

// ─── CoreDataSchema ────────────────────────────────────────────────────────
// Probability-fatal fields only. Must pass in BOTH `full` and `probability_only`
// launch modes. When FullDataSchema fails, validate.ts falls back here so the
// app can ship in probability-only mode (REQ-041).

export const CoreDataSchema = z.object({
  checklist_as_of: timestampSchema,
  odds_as_of: timestampSchema,
  values_as_of: timestampSchema,
  comps_as_of: timestampSchema,
  data_as_of: timestampSchema.optional(),

  odds_source: oddsSourceSchema,
  values_ready: z.boolean(),

  product: productSchema,
  checklist_totals: checklistTotalsSchema,
  card_categories: z.record(z.string(), cardCategorySchema).refine(
    (cats) => Object.keys(cats).length > 0,
    'at least one card category required',
  ),
  teams: z.record(z.string(), teamSchema).refine(
    (teams) => Object.keys(teams).length > 0,
    'at least one team required',
  ),
});

// ─── FullDataSchema ────────────────────────────────────────────────────────
// Extends Core with tier values and OPTIONAL confidence inputs. Missing
// `confidence_inputs` is WARNING-LEVEL per TECH_SPEC §7: the app still runs
// in `full` mode, but `computeConfidence` will return 'low' for affected teams.

export const FullDataSchema = CoreDataSchema.extend({
  tier_values_usd: tierValuesSchema,
  confidence_inputs: confidenceInputsSchema.optional(),
});

// ─── Internal schema re-exports (for src/types.ts to consume) ──────────────

export const internalSchemas = {
  tierLabelSchema,
  oddsSourceSchema,
  timestampSchema,
  productSchema,
  checklistTotalsSchema,
  cardCategorySchema,
  teamSchema,
  tierValueRowSchema,
  tierValuesSchema,
  confidenceInputSchema,
  confidenceInputsSchema,
};
