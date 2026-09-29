# AGENTS.md

Project-wide guidance for AI agents working on RIPPED.

## Project context

- Stack: TypeScript, Vite, Tailwind CSS, Zod, Vitest, Playwright with axe, and
  vanilla DOM. Monte Carlo simulation runs in a Web Worker.
- Run `npm run dev` for local development at `http://localhost:5173`.
- `public/data.json` is maintained manually and validated with Zod at page load.
- Existing specs and plans are valuable product context, not a mandatory
  workflow or authorization boundary.

## Working rules

- Make the smallest change that satisfies the request and preserve unrelated work.
- Do not skip, disable, or misreport tests; the math is the product.
- Fix invalid data instead of weakening the Zod schema, and keep validation
  failures visible.
- Flag new dependencies and missing access, requirements, or external data.
- RIPPED is gambling-adjacent. Do not remove the variance disclaimer, the
  not-financial-advice notice, or confidence downgrade logic without approval.
- Keep v2 ideas documented rather than silently expanding v1 scope.

## Verification

For math changes, run `npx vitest run`, `npx tsc --noEmit`, and a real-data spot
check. Use repository-native lint, build, browser, and accessibility checks as
appropriate. Track follow-up ideas in `TODOS.md` and durable math or data
patterns in `LEARNINGS.md`.
