# AGENTS.md

Scoped execution guidance for the initial RIPPED greenfield build.

Base project rules live in `../../AGENTS.md`.

## Scope

- Run greenfield execution commands from this directory: `plans/greenfield/`
- This file applies to the initial launch tracked by `EXECUTION_PLAN.md`
- Post-launch feature work belongs in `features/<name>/`

## Required Context

Before starting a task, read:

1. `../../AGENTS.md` — project-wide rules
2. `PRODUCT_SPEC.md` — 43 REQs, what the product does
3. `TECHNICAL_SPEC.md` — architecture, math, schema, tokens
4. `EXECUTION_PLAN.md` — task-by-task breakdown with acceptance criteria
5. `../../INITIAL_FINDINGS.md` — market + demand evidence for positioning copy
6. `../../LEARNINGS.md` (if it exists)

## Task Loop

1. Start a fresh session for each new task.
2. Read the task definition + acceptance criteria from `EXECUTION_PLAN.md`.
3. Confirm prior task dependencies are complete (use the dependency graph in `EXECUTION_PLAN.md`).
4. Add or update tests for the acceptance criteria before/with the implementation.
5. Implement the minimum change needed to satisfy the task.
6. Verify every acceptance criterion using the `Verify:` command listed.
7. Update completed checkboxes in `EXECUTION_PLAN.md`.
8. Commit using `task({id}): {description} [REQ-XXX]`.

## Verification Specifics

- **TEST criteria:** `npx vitest run <file>` and check the named test passes
- **CODE criteria:** grep / file existence / type check as specified
- **BROWSER:* criteria:** run Playwright specs against the dev server (`npm run dev` in another terminal)
- **Every non-MANUAL criterion MUST have its `Verify:` command run green before the box is checked**

## The Math is the Product

Every acceptance criterion in Phase 1 ties to a math module. Do not skip tests. If the math is wrong, the tool is worse than nothing — it confidently displays fake numbers to buyers making real purchase decisions. Treat math bugs as launch-blocking.

Specifically:
- **Eligibility is the foundation** — every math module depends on `eligiblePlayers(category, team)` returning the right list. Veterans cannot accidentally contribute rookie-auto value.
- **Closed-form EV is authoritative** — the Monte Carlo mean is noisy on heavy-tailed distributions. Test against closed-form with loose bands; do not assert 1% tolerance.
- **Confidence has four conditions** — verbatim from REQ-016. Do not paraphrase or "simplify" it.
- **Verdict boundaries are inclusive** — `>=0.25` and `<=-0.25`, not strict `>`. Test boundaries with equality.

## When To Stop And Ask

Stop and ask the human if:

- DJ has not delivered the required dependency data (D-001, D-002, D-005, D-006 per the task's pre-phase setup)
- A required environment variable or secret is missing
- Requirements in `PRODUCT_SPEC.md` conflict or are ambiguous
- Verification keeps failing after 2 attempts and the cause is not clear
- The task appears to require architectural changes outside the current scope
- Real data is needed to proceed but `public/data.json` is missing or validation-failing

## Blocker Report

```
BLOCKED: Task {id}
Issue: {what is wrong}
Tried: {what you attempted}
Need: {what would unblock}
Type: user-action | dependency | external-service | unclear-requirements
```

## Fallback Mode Reminder

REQ-041 lets RIPPED launch in **probability-only mode** if DJ's value table (D-001) is incomplete. When working on data-dependent tasks and real data lacks `tier_values_usd`, do NOT block the build — flip `values_ready: false` in `public/data.json` and let the fallback path render. Ship the probability-only experience on time; full mode follows when DJ catches up.
