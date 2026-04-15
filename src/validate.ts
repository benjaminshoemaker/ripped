import { z } from 'zod';
import { CoreDataSchema, FullDataSchema } from './schema';
import type { CoreData, FullData, LaunchMode } from './types';

// Pure function: no DOM, no fetch. Takes parsed JSON, returns the launch mode
// and either the data (typed as CoreData or FullData) or an error array.

export type ValidationResult =
  | { mode: 'full'; data: FullData; errors: [] }
  | { mode: 'probability_only'; data: CoreData; errors: z.ZodIssue[] }
  | { mode: 'error'; data: null; errors: z.ZodIssue[] };

export function validate(raw: unknown): ValidationResult {
  // Try FullDataSchema first. If it passes, we're in 'full' mode.
  const full = FullDataSchema.safeParse(raw);
  if (full.success) {
    return { mode: 'full', data: full.data, errors: [] };
  }

  // Fall back to CoreDataSchema. If core-level fields are valid, we can ship
  // in probability_only mode (REQ-041). The FullDataSchema errors are
  // preserved in the result so the UI can report WHY we degraded.
  const core = CoreDataSchema.safeParse(raw);
  if (core.success) {
    return { mode: 'probability_only', data: core.data, errors: full.error.issues };
  }

  // Core validation also failed — this is a hard error. REQ-028: fail loudly.
  return { mode: 'error', data: null, errors: core.error.issues };
}
