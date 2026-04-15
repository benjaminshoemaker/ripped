# RIPPED

**Did you overpay for that team spot?**

An EV calculator for sports-card break team spots. Punch in a team and the price
a breaker is charging you; RIPPED returns the expected value of the cards you'll
get, the 80% outcome range, the probability you get effectively nothing, and a
verdict (Below Market / Near Market / Above Market) with a confidence level.

The v1 product targets the **2025 Topps Chrome Football — Pick Your Team Hobby
Case Break** format. 32 NFL teams. Single page, mobile-first, no login, no
backend. Data is a single static `public/data.json` maintained by DJ.

## Quick start

```bash
git clone https://github.com/benjaminshoemaker/ripped.git
cd ripped
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npx playwright test  # browser tests (Playwright + axe-core)
npm run build        # production bundle
```

Node ≥20.19 required.

## Status

Pre-launch. All 28 execution-plan tasks are code-complete on the
`phase-3-launch` branch. 96 Vitest + 106 Playwright tests passing. One external
blocker remains on Task 3.3.B (Vercel preview URL auth) and DJ still owes the
real data table. See `OVERNIGHT_REPORT.md` for the morning-of checklist and
`TODOs.md` for the pre-launch dependency list.

## Disclaimer

RIPPED is gambling-adjacent. Estimates only. Not financial advice. Not
affiliated with Topps, the NFL, Whatnot, Fanatics Live, or any breaker.

Single-break outcomes are dominated by variance — your spot can return $0 or
several times the EV. The app shows the variance explicitly; don't buy spots
you can't afford to lose.

## Repo layout

| Path | What's in it |
|---|---|
| `src/` | App source: math modules, UI components, Monte Carlo worker, validation |
| `public/data.json` | Static data file (currently synthetic bridge data from `scripts/generate-synthetic-data.mjs`) |
| `tests/` | Playwright specs (browser + axe-core + performance + production smoke) |
| `plans/greenfield/PRODUCT_SPEC.md` | 43 requirements, user flows, out-of-scope list |
| `plans/greenfield/TECHNICAL_SPEC.md` | Architecture, schema, math, tokens |
| `plans/greenfield/EXECUTION_PLAN.md` | 28 tasks across 3 phases with acceptance criteria |
| `AGENTS.md` | Workflow rules for AI agents working in this repo |
| `LEARNINGS.md` | Decisions, gotchas, and context captured from prior sessions |
| `TODOs.md` | External blockers (data, hosting, domain) |
| `launch-gate.md` | REQ-040 launch checklist |
| `post-launch-checklist.md` | REQ-043 post-launch watch items |

## Tech

TypeScript, Vite 6, Tailwind CSS v4 (`@theme` tokens), Zod (runtime data
validation per REQ-028), Vitest (unit), Playwright + `@axe-core/playwright`
(browser + a11y), vanilla DOM (no framework). Monte Carlo simulation runs in a
Web Worker with a seeded PRNG.

## License

Unreleased — no license file yet. Ask before reuse.
