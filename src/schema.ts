import { z } from 'zod';
import { eligiblePlayers } from './math/eligibility';

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
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be a valid ISO 8601 timestamp')
  .refine((s) => Date.parse(s) <= Date.now() + 60_000, 'timestamp is in the future');

// ─── Product + categories ──────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1),
  format: z.literal('pyt_hobby_case'),
  benchmark_case_cost_usd: z.number().positive(),
  boxes_per_case: z.number().int().positive(),
  packs_per_box: z.number().int().positive(),
  cards_per_pack: z.number().int().positive(),
  // PYT breaks always ship every card pulled for the buyer's team.
  ship_all_cards_assumption: z.literal(true),
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
  base_plus_rookies: z.number().int().positive().optional(),
  base_auto_signers: z.number().int().positive(),
  rookie_auto_signers: z.number().int().positive(),
});

const cardCategoryKeySchema = z.enum([
  'base',
  'base_refractor',
  'rookie',
  'rookie_refractor',
  'base_auto',
  'rookie_auto',
  'gold_refractor_50',
  'orange_refractor_25',
  'red_refractor_5',
  'superfractor_1',
  'rpa_gold_50',
  'rpa_orange_25',
]);

const cardCategorySchema = z.object({
  slots_per_case: z.number().nonnegative(),
  denominator_key: z.enum([
    'base_veterans',
    'rookies',
    'base_plus_rookies',
    'base_auto_signers',
    'rookie_auto_signers',
  ]),
});

const cardCategoriesSchema = z.record(
  cardCategoryKeySchema,
  cardCategorySchema,
) as z.ZodType<Record<string, z.infer<typeof cardCategorySchema>>>;

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

const tierValueRowSchema = z.record(z.string(), z.number().finite().nonnegative());

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

// ─── Full-mode invariant checks ───────────────────────────────────────────

const rosterKeys = [
  'base_veterans',
  'rookies',
  'base_auto_signers',
  'rookie_auto_signers',
  'chase_players',
] as const;

function playerRoleForCategory(category: string): string {
  switch (category) {
    case 'base':
    case 'base_refractor':
      return 'base_veteran';
    case 'rookie':
    case 'rookie_refractor':
      return 'rookie';
    case 'base_auto':
      return 'base_auto_signer';
    case 'rookie_auto':
      return 'rookie_auto_signer';
    case 'gold_refractor_50':
    case 'orange_refractor_25':
    case 'red_refractor_5':
    case 'superfractor_1':
      return 'base_or_rookie_parallel_eligible_player';
    case 'rpa_gold_50':
    case 'rpa_orange_25':
      return 'rookie_auto_signer';
    default:
      return 'eligible_player';
  }
}

function missingTierValueMessage(tier: string, category: string): string {
  return `missing tier_values_usd[${tier}][${category}] — required because at least one team has a ${tier} ${playerRoleForCategory(category)}`;
}

type CoreCompletenessData = {
  checklist_totals: z.infer<typeof checklistTotalsSchema>;
  card_categories: Record<string, z.infer<typeof cardCategorySchema>>;
  teams: Record<string, z.infer<typeof teamSchema>>;
};

type FullCompletenessData = CoreCompletenessData & {
  tier_values_usd: z.infer<typeof tierValuesSchema>;
};

// Core-level invariants — enforced in BOTH launch modes (full and
// probability_only). Missing data here is REQ-028 fail-loud regardless of
// whether DJ has delivered the dollar-value table yet.
function addCoreCompletenessIssues(
  data: CoreCompletenessData,
  ctx: z.RefinementCtx,
): void {
  // 1. Every card_categories[*].denominator_key must resolve to a positive
  //    finite number in checklist_totals. `base_plus_rookies` is optional in
  //    the base schema (for teams/products that don't need it), so the actual
  //    "is this field present?" check lives here, cross-field.
  for (const [category, cat] of Object.entries(data.card_categories)) {
    const denom = (data.checklist_totals as Record<string, number | undefined>)[cat.denominator_key];
    if (typeof denom !== 'number' || !Number.isFinite(denom) || denom <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_totals', cat.denominator_key],
        message: `missing checklist_totals[${cat.denominator_key}] — required because card_categories[${category}] references it as its denominator_key`,
      });
    }
  }

  // 2. Every player listed in a team's five roster fields must have a
  //    tiers[player] entry. Missing tiers were previously only caught in
  //    full mode, which meant the probability_only fallback silently
  //    rendered `undefined` tier labels in team-detail.ts (REQ-028 bypass).
  const reportedMissingPlayers = new Set<string>();
  for (const [teamName, team] of Object.entries(data.teams)) {
    for (const rosterKey of rosterKeys) {
      for (const player of team[rosterKey]) {
        if (team.tiers[player] !== undefined) continue;

        const key = `${teamName}\0${player}`;
        if (reportedMissingPlayers.has(key)) continue;
        reportedMissingPlayers.add(key);

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['teams', teamName, 'tiers', player],
          message: `missing tiers[${player}] — required because ${teamName} lists the player in ${rosterKey}`,
        });
      }
    }
  }
}

// Full-mode only invariants — enforced when dollar values are expected.
// Each (tier, category) cell that any team will actually use must be present.
function addFullDataCompletenessIssues(
  data: FullCompletenessData,
  ctx: z.RefinementCtx,
): void {
  const reportedMissingValues = new Set<string>();

  for (const team of Object.values(data.teams)) {
    for (const category of Object.keys(data.card_categories)) {
      const eligible = eligiblePlayers(category, team);
      for (const player of eligible) {
        const tier = team.tiers[player];
        if (!tier) continue;

        const tierValue = data.tier_values_usd[tier][category];
        if (typeof tierValue === 'number' && Number.isFinite(tierValue) && tierValue >= 0) {
          continue;
        }

        const key = `${tier}\0${category}`;
        if (reportedMissingValues.has(key)) continue;
        reportedMissingValues.add(key);

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tier_values_usd', tier, category],
          message: missingTierValueMessage(tier, category),
        });
      }
    }
  }
}

// ─── CoreDataSchema ────────────────────────────────────────────────────────
// Probability-fatal fields only. Must pass in BOTH `full` and `probability_only`
// launch modes. When FullDataSchema fails, validate.ts falls back here so the
// app can ship in probability-only mode (REQ-041).
//
// Defined in two layers so FullDataSchema can still `.extend()` the shape:
// - CoreDataObjectSchema is the plain ZodObject (extendable)
// - CoreDataSchema wraps it in superRefine so runtime parses get the
//   cross-field completeness checks.

const CoreDataObjectSchema = z.object({
  checklist_as_of: timestampSchema,
  odds_as_of: timestampSchema,
  values_as_of: timestampSchema,
  comps_as_of: timestampSchema,
  data_as_of: timestampSchema.optional(),

  odds_source: oddsSourceSchema,
  values_ready: z.boolean(),

  product: productSchema,
  checklist_totals: checklistTotalsSchema,
  card_categories: cardCategoriesSchema.refine(
    (cats) => Object.keys(cats).length > 0,
    'at least one card category required',
  ),
  teams: z.record(z.string(), teamSchema).refine(
    (teams) => Object.keys(teams).length === 32,
    'RIPPED requires exactly 32 NFL team entries',
  ),
});

export const CoreDataSchema = CoreDataObjectSchema.superRefine(addCoreCompletenessIssues);

// ─── FullDataSchema ────────────────────────────────────────────────────────
// Extends Core with tier values and OPTIONAL confidence inputs. Missing
// `confidence_inputs` is WARNING-LEVEL per TECH_SPEC §7: the app still runs
// in `full` mode, but `computeConfidence` will return 'low' for affected teams.
// Runs both Core and Full completeness refinements so any Core-level gap
// (missing denominator key, missing roster tier) is reported even in full mode.

export const FullDataSchema = CoreDataObjectSchema.extend({
  tier_values_usd: tierValuesSchema,
  confidence_inputs: confidenceInputsSchema.optional(),
}).superRefine((data, ctx) => {
  addCoreCompletenessIssues(data, ctx);
  addFullDataCompletenessIssues(data, ctx);
});

// ─── Internal schema re-exports (for src/types.ts to consume) ──────────────

export const internalSchemas = {
  tierLabelSchema,
  oddsSourceSchema,
  timestampSchema,
  productSchema,
  checklistTotalsSchema,
  cardCategoryKeySchema,
  cardCategorySchema,
  teamSchema,
  tierValueRowSchema,
  tierValuesSchema,
  confidenceInputSchema,
  confidenceInputsSchema,
};
