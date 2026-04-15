import { z } from 'zod';
import { CoreDataSchema, FullDataSchema } from './schema';
import type { CoreData, FullData, LaunchMode } from './types';

// Pure function: no DOM, no fetch. Takes parsed JSON, returns the launch mode
// and either the data (typed as CoreData or FullData) or an error array.

export type ValidationResult =
  | { mode: 'full'; data: FullData; errors: [] }
  | { mode: 'probability_only'; data: CoreData; errors: z.ZodIssue[] }
  | { mode: 'error'; data: null; errors: z.ZodIssue[] };

const valuesNotReadyIssue: z.ZodIssue = {
  code: z.ZodIssueCode.custom,
  path: ['values_ready'],
  message: 'values_ready is false — probability_only mode required',
};

function hasValuesReadyFalse(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'values_ready' in raw && raw.values_ready === false;
}

export function validate(raw: unknown): ValidationResult {
  // Try FullDataSchema first. If it passes, we're in 'full' mode.
  const full = FullDataSchema.safeParse(raw);
  if (full.success) {
    if (full.data.values_ready === false) {
      const core = CoreDataSchema.safeParse(raw);
      if (core.success) {
        return { mode: 'probability_only', data: core.data, errors: [valuesNotReadyIssue] };
      }

      return { mode: 'error', data: null, errors: core.error.issues };
    }

    return { mode: 'full', data: full.data, errors: [] };
  }

  // Fall back to CoreDataSchema. If core-level fields are valid, we can ship
  // in probability_only mode (REQ-041). The FullDataSchema errors are
  // preserved in the result so the UI can report WHY we degraded.
  const core = CoreDataSchema.safeParse(raw);
  if (core.success) {
    const errors = hasValuesReadyFalse(raw)
      ? [valuesNotReadyIssue, ...full.error.issues]
      : full.error.issues;
    return { mode: 'probability_only', data: core.data, errors };
  }

  // Core validation also failed — this is a hard error. REQ-028: fail loudly.
  return { mode: 'error', data: null, errors: core.error.issues };
}
