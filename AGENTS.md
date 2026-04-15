# AGENTS.md

Workflow guidelines for AI agents working in the RIPPED project.

## Instruction Hierarchy

- This file is the project-wide baseline.
- Greenfield execution guidance lives in `plans/greenfield/AGENTS.md`.
- When working in a scoped directory, follow this file first, then the local `AGENTS.md` or `CLAUDE.md` in that directory.

## Project Context

**Tech Stack:** TypeScript (Node 20.19+), Vite 6+, Tailwind CSS v4 (`@tailwindcss/vite` + `@import "tailwindcss"`), Zod (runtime schema validation), Vitest (unit), Playwright + `@axe-core/playwright` (accessibility smoke), vanilla DOM (no framework). Monte Carlo simulation runs in a Web Worker.

**Dev Server:** `npm run dev` → `http://localhost:5173` (wait ~2s for startup)

**Data source:** `public/data.json` maintained by hand by DJ (product owner). Zod validates at page load per REQ-028. Updates ship via git push → Vercel redeploy (~30s). No auto-refresh.

## Core Workflow

1. Load the nearest scoped instructions for the area you are editing.
2. Read the relevant spec sections (`PRODUCT_SPEC.md`, `TECHNICAL_SPEC.md`) before changing code.
3. Check existing patterns before implementing a new one.
4. Make the smallest change that satisfies the active task.
5. Add or update tests when behavior changes.
6. Run configured verification before reporting completion.
7. Update execution-plan checkboxes when scoped work requires it.
8. Commit using the project task format after verification passes.

## Guardrails

- Do not invent requirements that are not in PRODUCT_SPEC.md or the active execution plan.
- Do not skip, disable, or misreport failing tests. The math is the entire product.
- Do not rewrite or revert unrelated user changes.
- Do not introduce new dependencies without flagging the impact in the commit.
- Do not loosen the Zod schema to accept broken data — fix the data instead.
- Do not silently swallow validation errors. REQ-028 requires fail-loud.
- If access, secrets, requirements, or external data are missing, stop and ask.
- RIPPED is gambling-adjacent. Do not remove the variance disclaimer, the "not financial advice" notice, or the confidence downgrade logic without explicit approval.

## Verification

- Use `.claude/verification-config.json` when present.
- If scoped instructions define additional verification steps, follow them.
- If verification metadata is missing from a task, add it before proceeding.
- Math changes trigger: `npx vitest run` + `npx tsc --noEmit` + spot-check against real data.

## Git Conventions

- Work on phase branches for execution-plan work (`phase-1-foundation`, `phase-2-ui`, `phase-3-launch`).
- One commit per completed task after verification passes.
- Commit format: `task({id}): {description} [REQ-XXX]` — e.g. `task(1.3.C): closed-form EV using eligible players [REQ-010]`
- Omit the bracketed suffix if no single REQ applies.
- Use `/create-pr` instead of ad-hoc PR formatting when available.

## Follow-Up Items

- Track out-of-scope ideas in `TODOS.md` rather than silently dropping them.
- Capture durable patterns (math gotchas, data conventions) in `LEARNINGS.md`.
- Out-of-scope items from PRODUCT_SPEC §7 (random-team mode, PYT price variation, repack calculator, breaker watchlist) are explicitly v2 targets — do not sneak them into v1.

## Completion Report

When finishing a task, report:
- what changed
- files touched
- verification status (test/typecheck/build/browser)
- commit hash
