import { z } from 'zod';
import { CoreDataSchema, FullDataSchema, internalSchemas } from './schema';

// All app types are inferred from the Zod schemas — no hand-written duplicates.

export type CoreData = z.infer<typeof CoreDataSchema>;
export type FullData = z.infer<typeof FullDataSchema>;

export type TierLabel = z.infer<typeof internalSchemas.tierLabelSchema>;
export type OddsSource = z.infer<typeof internalSchemas.oddsSourceSchema>;
export type Product = z.infer<typeof internalSchemas.productSchema>;
export type ChecklistTotals = z.infer<typeof internalSchemas.checklistTotalsSchema>;
export type CardCategory = z.infer<typeof internalSchemas.cardCategorySchema>;
export type Team = z.infer<typeof internalSchemas.teamSchema>;
export type TierValueRow = z.infer<typeof internalSchemas.tierValueRowSchema>;
export type TierValues = z.infer<typeof internalSchemas.tierValuesSchema>;
export type ConfidenceInput = z.infer<typeof internalSchemas.confidenceInputSchema>;
export type ConfidenceInputs = z.infer<typeof internalSchemas.confidenceInputsSchema>;

// ─── Computed result types (not from schema — these are produced by the
// math modules, not the data file). Defined here to live alongside the
// schema-inferred types for single-source convenience.

export type ConfidenceLabel = 'high' | 'medium' | 'low';
export type Verdict = 'STEAL' | 'BELOW_MARKET' | 'NEAR_MARKET' | 'ABOVE_MARKET' | 'RIPPED';
export type LaunchMode = 'full' | 'probability_only' | 'error';

export interface Contributor {
  player: string;
  tier: TierLabel;
  category: string;
  expectedValue: number;
  isChase: boolean;
}

export interface ComputedResult {
  team: string;
  spotPrice: number;
  mode: LaunchMode;
  ev: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  pZero: number | null;
  gap: number | null;
  gapPct: number | null;
  verdict: Verdict | null;
  verdictIsHard: boolean;
  confidence: ConfidenceLabel;
  contributors: Contributor[];
  probabilityTable: Record<string, number>;
}
