# Execution Plan: RIPPED

**Status:** v2 — updated after `/codex-consult` review of v1 (13 issues, 5 suggestions). See `EXECUTION_PLAN.md.bak.*` for v1.

## Overview

| Metric | Value |
|--------|-------|
| Project | RIPPED — sports card break EV calculator |
| Total Phases | 3 |
| Total Steps | 12 |
| Total Tasks | 28 |
| Total acceptance criteria | ~130 |
| Manual criteria | 2 (both `MANUAL:DEFER`, <2% of total) |
| Target launch | Wednesday 2026-04-15 |
| Estimated implementation effort | 16–20 hours of focused coding work, **excluding** data cleanup, DNS propagation, OG asset creation, and manual launch-day validation |

## Source specs

- `plans/greenfield/PRODUCT_SPEC.md` (v2) — 43 REQs, 6 dependencies
- `plans/greenfield/TECHNICAL_SPEC.md` (v3) — Vite + TS + Tailwind v4 + Zod + Web Worker

## Phase Dependency Graph

```
Phase 1: Foundation + Math (11 tasks)
    ├── Step 1.1: Project infrastructure        (2 tasks)
    ├── Step 1.2: Schemas & validation          (2 tasks)
    ├── Step 1.3: Math modules                  (5 tasks — parallelizable)
    └── Step 1.4: Monte Carlo worker            (2 tasks)
            │
            ▼
Phase 2: Data + UI (11 tasks)
    ├── Step 2.0: Playwright test harness       (1 task)   ← NEW in v2
    ├── Step 2.1: Real data ingestion           (2 tasks)  ← blocks on D-001/D-002
    ├── Step 2.2: Core UI components            (5 tasks — incl. Task 2.2.E Product Card, NEW in v2)
    ├── Step 2.3: Results panel & disclosure    (2 tasks)
    └── Step 2.4: Probability-only fallback     (1 task)
            │
            ▼
Phase 3: Launch (6 tasks)
    ├── Step 3.1: Responsive + accessibility    (1 task)
    ├── Step 3.2: Polish + analytics            (2 tasks)
    └── Step 3.3: Launch readiness              (3 tasks — incl. Task 3.3.C Performance, NEW in v2)
```

**Changes from v1 (post codex-consult):**
1. Playwright is installed in Step 2.0, not Step 3.1 (fixes "Phase 2 BROWSER criteria run before Playwright exists")
2. New Task 2.2.E covers REQ-001 / REQ-002 which had no verification in v1
3. New Task 3.3.C tests REQ-034 (p95 < 500ms)
4. Task 1.4.A pZero monotonicity direction corrected (increasing, not decreasing)
5. Task 2.1.B probability assertion rewritten (realistic bounds)
6. Task 2.2.C adds tier-label DOM verification
7. Task 2.3.B adds variance-callout DOM verification (REQ-019)
8. Task 1.2.B adds browser fail-loud test (REQ-028)
9. Task 3.3.B production gate extended to full REQ-040
10. BROWSER criteria now reference concrete Playwright test files instead of pseudo-DSL
11. `confidence_inputs` is warning-level in validation, not value-fatal (matches TECH_SPEC §7)
12. Total task/step counts corrected

---

## Phase 1: Foundation + Math

**Goal:** Stand up the project, define the data contract, implement every math module with full tests. At the end of this phase, the math can be called from tests and produces correct numbers for a fixture.

**Depends On:** None.

### Pre-Phase Setup

- [ ] Node 20.19+ or 22.12+ installed
  - Verify: `node --version`
- [ ] GitHub repo created (public, named `ripped`)
  - Verify: `gh repo view <owner>/ripped --json name`
- [ ] Vercel / Netlify / Cloudflare Pages account ready (see TECHNICAL_SPEC §2 re Vercel Hobby commercial caveat)
  - Verify: `vercel whoami` (or `netlify status`)
- [ ] DJ confirms PYT case break is the right v1 format (D-004)
  - Verify: Confirmation captured in `TODOs.md`

---

### Step 1.1: Project infrastructure

**Depends On:** Pre-phase setup complete.

---

#### Task 1.1.A: Initialize Vite + Tailwind v4 + Zod + Vitest

**Description:**
Bootstrap a Vite + vanilla TypeScript project. Add Tailwind CSS v4 via the official `@tailwindcss/vite` plugin + `@import "tailwindcss"`. Add Zod and Vitest. Push to GitHub and connect to the chosen host so every `main` push deploys a static build.

**Requirement:** REQ-037, REQ-038

**Acceptance Criteria:**
- [x] (BUILD) Project builds cleanly
  - Verify: `npm run build && test -f dist/index.html`
- [x] (CODE) `@tailwindcss/vite` plugin configured
  - Verify: `grep -q "@tailwindcss/vite" vite.config.ts`
- [x] (CODE) `src/styles.css` uses v4 syntax (`@import "tailwindcss"`) and not v3 directives
  - Verify: `grep -q '@import "tailwindcss"' src/styles.css && ! grep -q '@tailwind base' src/styles.css`
- [x] (CODE) Zod + Vitest installed
  - Verify: `node -e "const p=require('./package.json'); process.exit((p.dependencies.zod && p.devDependencies.vitest) ? 0 : 1)"`
- [ ] (CODE) Host webhook configured — `main` push triggers a deploy *(DEFERRED to manual Vercel connect — tracked in TODOs.md)*
  - Verify: Manual check of first push produces a live URL; capture in `README.md`

**Files to Create:**
- `package.json`, `vite.config.ts`, `tsconfig.json`, `src/styles.css`, `src/main.ts`, `index.html`, `README.md`, `.gitignore`

**Dependencies:** None

**Spec Reference:** TECHNICAL_SPEC §2, §4

---

#### Task 1.1.B: Configure Web Worker + strict TypeScript

**Description:**
Enable `strict: true` + `target: "es2020"` in `tsconfig.json`. Use Vite's recommended `new Worker(new URL('./worker/...', import.meta.url), { type: 'module' })` pattern — no custom worker build config. Verify a hello-world worker round-trip, then delete the scaffold in Task 1.4.A.

**Requirement:** REQ-034

**Acceptance Criteria:**
- [x] (CODE) `tsconfig.json` has `"strict": true` and `"target": "es2020"`
  - Verify: `node -e "const t=require('./tsconfig.json'); process.exit((t.compilerOptions.strict && t.compilerOptions.target==='es2020') ? 0 : 1)"`
- [x] (CODE) Worker is instantiated via `new Worker(new URL(...), { type: 'module' })`
  - Verify: `grep -q "new Worker(new URL" src/main.ts || grep -q "new Worker(new URL" src/worker-client.ts`
- [x] (BUILD) Production build succeeds with worker module
  - Verify: `npm run build && grep -q "assetFileNames\|worker" dist/ -r || test -d dist/assets`
- [x] (TEST) Worker round-trip test posts a message and receives a reply
  - Verify: `npx vitest run src/worker/hello.worker.test.ts`

**Files to Create:**
- `src/worker/hello.worker.ts` (scaffold, deleted in Task 1.4.A)
- `src/worker/hello.worker.test.ts`

**Files to Modify:**
- `vite.config.ts`, `tsconfig.json`

**Dependencies:** Task 1.1.A

**Spec Reference:** TECHNICAL_SPEC §3 (worker thread), §6.4

---

### Step 1.2: Data schemas & validation

**Depends On:** Step 1.1

---

#### Task 1.2.A: Zod schemas — CoreData, FullData, warning-level confidence_inputs

**Description:**
Define three levels: `CoreDataSchema` (probability-fatal fields), `FullDataSchema` (extends Core + `tier_values_usd` + `tiers` maps), and optional warning-level validation for `confidence_inputs`. Per TECH_SPEC §7, missing `confidence_inputs` must NOT fail `FullDataSchema`; it degrades confidence to `low` instead. Infer all TypeScript types from the Zod schemas (`z.infer`).

**Requirement:** REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-041

**Acceptance Criteria:**
- [x] (CODE) `CoreDataSchema` and `FullDataSchema` exported from `src/schema.ts`
  - Verify: `grep -q "export const CoreDataSchema" src/schema.ts && grep -q "export const FullDataSchema" src/schema.ts`
- [x] (CODE) `confidence_inputs` is `.optional()` in `FullDataSchema`
  - Verify: `grep -A 3 "confidence_inputs" src/schema.ts | grep -q "optional"`
- [x] (CODE) Types inferred via `z.infer` (no hand-written duplicate types)
  - Verify: `grep -q "z.infer" src/types.ts`
- [x] (TEST) Valid full fixture parses against `FullDataSchema`
  - Verify: `npx vitest run src/schema.test.ts -t "valid fixture"`
- [x] (TEST) Fixture missing `tier_values_usd` fails `FullDataSchema` but passes `CoreDataSchema`
  - Verify: `npx vitest run src/schema.test.ts -t "core only"`
- [x] (TEST) Fixture missing `confidence_inputs` entirely passes `FullDataSchema` (warning-level, not fatal)
  - Verify: `npx vitest run src/schema.test.ts -t "no confidence inputs"`
- [x] (TEST) Fixture missing a team fails both schemas
  - Verify: `npx vitest run src/schema.test.ts -t "missing team"`

**Files to Create:**
- `src/schema.ts`, `src/types.ts`, `src/schema.test.ts`
- `src/fixtures/valid-full.json`, `src/fixtures/core-only.json`, `src/fixtures/no-confidence-inputs.json`, `src/fixtures/broken.json`

**Dependencies:** Task 1.1.A

**Spec Reference:** TECHNICAL_SPEC §5.1, §5.2, §7

---

#### Task 1.2.B: Validation entry point + mode determination + fail-loud bootstrap

**Description:**
Write `src/validate.ts` exporting `validate(rawJson): { mode, data, errors }`. Tries `FullDataSchema.safeParse` → falls back to `CoreDataSchema.safeParse` → otherwise returns `{ mode: 'error', errors }`. `main.ts` consumes this and either mounts the UI or renders a full-page error element `<div data-testid="full-page-error">...</div>`. The full-page error is the REQ-028 fail-loud behavior.

**Requirement:** REQ-028, REQ-041

**Acceptance Criteria:**
- [x] (TEST) Valid full fixture → `mode = 'full'`
  - Verify: `npx vitest run src/validate.test.ts -t "full mode"`
- [x] (TEST) Core-only fixture → `mode = 'probability_only'`
  - Verify: `npx vitest run src/validate.test.ts -t "probability_only mode"`
- [x] (TEST) Broken fixture → `mode = 'error'` with non-empty `errors` array
  - Verify: `npx vitest run src/validate.test.ts -t "error mode"`
- [x] (CODE) `validate()` is pure — no `document.*` or `fetch(...)` references
  - Verify: `! grep -qE "document\.|fetch\(" src/validate.ts`
- [x] (TEST) **Browser smoke**: when `/data.json` returns a malformed payload, the page renders `[data-testid="full-page-error"]` and NO `[data-testid="team-grid"]`
  - Verify: `npx playwright test tests/fail-loud.spec.ts`

**Files to Create:**
- `src/validate.ts`, `src/validate.test.ts`
- `tests/fail-loud.spec.ts` (initial scaffold; runs after Task 2.0.A provides Playwright harness)

**Dependencies:** Task 1.2.A

**Spec Reference:** TECHNICAL_SPEC §7

---

### Step 1.3: Math modules

**Depends On:** Step 1.2

All five tasks in this step can run in parallel (pure functions, shared types only).

---

#### Task 1.3.A: Eligibility module

**Description:**
Create `src/math/eligibility.ts` exporting `eligiblePlayers(category, team)`. Implements the category-to-list mapping from TECH_SPEC §6.1. Codex-flagged fix from v2 review: closed-form EV and Monte Carlo MUST call this same function so they never diverge.

**Requirement:** REQ-004, REQ-010, REQ-018

**Acceptance Criteria:**
- [x] (CODE) `eligiblePlayers` exported
  - Verify: `grep -q "export function eligiblePlayers" src/math/eligibility.ts`
- [x] (TEST) Returns `base_veterans` for `base` category
  - Verify: `npx vitest run src/math/eligibility.test.ts -t "base veterans"`
- [x] (TEST) Returns `rookie_auto_signers` for `rookie_auto`
  - Verify: `npx vitest run src/math/eligibility.test.ts -t "rookie autos"`
- [x] (TEST) Returns combined `base_veterans + rookies` for `gold_refractor_50`
  - Verify: `npx vitest run src/math/eligibility.test.ts -t "numbered parallel combines"`
- [x] (TEST) Returns empty array when a team has 0 entries for a category (e.g., Tennessee `base_auto_signers`)
  - Verify: `npx vitest run src/math/eligibility.test.ts -t "zero eligible"`

**Files to Create:**
- `src/math/eligibility.ts`, `src/math/eligibility.test.ts`

**Dependencies:** Task 1.2.A

**Spec Reference:** TECHNICAL_SPEC §6.1

---

#### Task 1.3.B: Probability module — per-category + aggregates (REQ-008 full)

**Description:**
Create `src/math/probability.ts` exporting `probAtLeastOne(category, team, data)` for individual categories AND aggregate helpers: `probAnyNumberedParallel(team, data)` (combines gold/orange/red/superfractor via independence approximation `1 - Π(1 - p_i)`) and `probAnyChase(team, data)` (sum over all tier-1 players across all categories). Uses binomial complement for integer slots, Poisson approximation for fractional. Codex-flagged: v1 only had per-category, missing aggregate outputs required by REQ-008.

**Requirement:** REQ-008, REQ-009

**Acceptance Criteria:**
- [x] (CODE) `probAtLeastOne`, `probAnyNumberedParallel`, `probAnyChase` all exported
  - Verify: `grep -qE "export function (probAtLeastOne|probAnyNumberedParallel|probAnyChase)" src/math/probability.ts`
- [x] (TEST) Binomial branch: `base` category with 10/300 players × 720 slots matches `1 - (1-10/300)^720` within 1e-9
  - Verify: `npx vitest run src/math/probability.test.ts -t "binomial base"`
- [x] (TEST) Poisson branch: `superfractor_1` with 0.012 slots × 1/300 matches `1 - exp(-0.012/300)` within 1e-9
  - Verify: `npx vitest run src/math/probability.test.ts -t "poisson superfractor"`
- [x] (TEST) `probAnyNumberedParallel` is monotonic non-decreasing in team size
  - Verify: `npx vitest run src/math/probability.test.ts -t "parallel monotonic"`
- [x] (TEST) `probAnyChase` returns 0 for a team with zero tier-1 players
  - Verify: `npx vitest run src/math/probability.test.ts -t "no chase zero prob"`
- [x] (TEST) All probabilities stay in [0, 1] for every category × team from fixture
  - Verify: `npx vitest run src/math/probability.test.ts -t "probability bounds"`

**Files to Create:**
- `src/math/probability.ts`, `src/math/probability.test.ts`

**Dependencies:** Task 1.3.A

**Spec Reference:** TECHNICAL_SPEC §6.2, PRODUCT_SPEC REQ-008

---

#### Task 1.3.C: Closed-form EV module

**Description:**
Create `src/math/ev.ts` exporting `computeEV(team, data)` returning `{ ev, contributors }`. Iterates card categories × eligible players; sums `expectedCount × tier_value`. Returns top-5 contributors ranked by per-player-per-category EV share, each tagged with their chase status for the variance callout (REQ-019).

**Requirement:** REQ-010, REQ-018, REQ-019

**Acceptance Criteria:**
- [x] (CODE) `computeEV` exported with shape `{ ev, contributors }`
  - Verify: `grep -q "export function computeEV" src/math/ev.ts`
- [x] (TEST) Giants (chase-heavy) EV > Jets (cold) EV
  - Verify: `npx vitest run src/math/ev.test.ts -t "giants > jets"`
- [x] (TEST) Titans with 0 base_auto_signers: base_auto contribution is exactly 0
  - Verify: `npx vitest run src/math/ev.test.ts -t "titans zero base autos"`
- [x] (TEST) `contributors` array has at most 5 entries sorted descending
  - Verify: `npx vitest run src/math/ev.test.ts -t "top 5 sorted"`
- [x] (TEST) Every contributor's `category` is a category where that player is in `eligiblePlayers`
  - Verify: `npx vitest run src/math/ev.test.ts -t "contributor eligibility"`
- [x] (TEST) Contributors include an `isChase` flag for tier-1 players
  - Verify: `npx vitest run src/math/ev.test.ts -t "chase flag present"`

**Files to Create:**
- `src/math/ev.ts`, `src/math/ev.test.ts`

**Dependencies:** Task 1.3.A, Task 1.3.B

**Spec Reference:** TECHNICAL_SPEC §6.3, PRODUCT_SPEC REQ-019

---

#### Task 1.3.D: Confidence module (REQ-016 four-condition literal)

**Description:**
Create `src/math/confidence.ts` implementing the four-condition scoring from TECH_SPEC §6.5: (1) `comp_count >= 3`, (2) `comp_window_days <= 30`, (3) `odds_source === '2025_official'`, (4) `daysSince(values_as_of) <= 14`. Aggregates across chase player × category records using MIN. Missing `confidence_inputs` entirely → `'low'`.

**Requirement:** REQ-016

**Acceptance Criteria:**
- [x] (CODE) `computeConfidence` exported with explicit 4-condition array
  - Verify: `grep -q "export function computeConfidence" src/math/confidence.ts && grep -q "CONFIDENCE_CONDITIONS" src/math/confidence.ts`
- [x] (TEST) All 4 conditions pass → `'high'`
  - Verify: `npx vitest run src/math/confidence.test.ts -t "all four pass"`
- [x] (TEST) 2 of 4 conditions pass → `'medium'`
  - Verify: `npx vitest run src/math/confidence.test.ts -t "two of four"`
- [x] (TEST) 1 of 4 conditions passes → `'low'`
  - Verify: `npx vitest run src/math/confidence.test.ts -t "one of four"`
- [x] (TEST) Min aggregation: a multi-chase team with one weak record drops to lower label
  - Verify: `npx vitest run src/math/confidence.test.ts -t "min aggregation"`
- [x] (TEST) Missing `confidence_inputs` entirely → `'low'`
  - Verify: `npx vitest run src/math/confidence.test.ts -t "no inputs"`

**Files to Create:**
- `src/math/confidence.ts`, `src/math/confidence.test.ts`

**Dependencies:** Task 1.2.A

**Spec Reference:** TECHNICAL_SPEC §6.5, PRODUCT_SPEC REQ-016

---

#### Task 1.3.E: Verdict module (inclusive boundaries, REQ-015)

**Description:**
Create `src/math/verdict.ts` exporting `computeVerdict(ev, spotPrice, confidence)`. Uses **inclusive** boundaries `>= 0.25` / `<= -0.25` for hard verdicts (confidence must be `'high'`), `>= 0.10` / `<= -0.10` for soft. Codex-flagged: v2 had strict `> 0.25`.

**Requirement:** REQ-015, REQ-017

**Acceptance Criteria:**
- [x] (CODE) `computeVerdict` exported
  - Verify: `grep -q "export function computeVerdict" src/math/verdict.ts`
- [x] (TEST) Exactly -25% gap + high confidence → `RIPPED` with `isHard = true` (inclusive)
  - Verify: `npx vitest run src/math/verdict.test.ts -t "ripped at exactly -25"`
- [x] (TEST) Exactly +25% gap + high confidence → `STEAL` with `isHard = true` (inclusive)
  - Verify: `npx vitest run src/math/verdict.test.ts -t "steal at exactly 25"`
- [x] (TEST) -25% gap + medium confidence → `ABOVE_MARKET`, `isHard = false`
  - Verify: `npx vitest run src/math/verdict.test.ts -t "above market medium"`
- [x] (TEST) 0% gap → `NEAR_MARKET`
  - Verify: `npx vitest run src/math/verdict.test.ts -t "near market zero"`
- [x] (TEST) ±10% boundary inclusive
  - Verify: `npx vitest run src/math/verdict.test.ts -t "soft boundaries inclusive"`

**Files to Create:**
- `src/math/verdict.ts`, `src/math/verdict.test.ts`

**Dependencies:** Task 1.2.A

**Spec Reference:** TECHNICAL_SPEC §6.6, PRODUCT_SPEC REQ-015

---

### Step 1.4: Monte Carlo worker

**Depends On:** Step 1.3

---

#### Task 1.4.A: Monte Carlo worker + seeded PRNG + rng tests (codex-flagged fixes)

**Description:**
Create `src/worker/simulate.worker.ts` + `src/worker/rng.ts` + `src/worker/simulate.worker.test.ts` + `src/worker/rng.test.ts`. 10,000-trial MC with mulberry32 PRNG, deterministic for a fixed seed. Returns `{ requestId, median, p10, p90, pZero, mcMean }`. **Codex-flagged fix:** v1's `pZero` monotonicity assertion was backwards — P($0) is defined as `fraction of trials where teamValue < 0.10 × spotPrice`, so raising `spotPrice` raises the threshold and P($0) should INCREASE (or stay equal), not decrease.

**Requirement:** REQ-011, REQ-012, REQ-014, REQ-034

**Acceptance Criteria:**
- [x] (CODE) `simulate.worker.ts`, `rng.ts`, `simulate.worker.test.ts`, `rng.test.ts` all exist
  - Verify: `for f in src/worker/simulate.worker.ts src/worker/rng.ts src/worker/simulate.worker.test.ts src/worker/rng.test.ts; do test -f "$f" || exit 1; done`
- [x] (TEST) `rng.ts`: same seed → identical sequence of 100 draws
  - Verify: `npx vitest run src/worker/rng.test.ts -t "deterministic"`
- [x] (TEST) Same seed → identical `median`, `p10`, `p90`, `pZero` across 2 runs
  - Verify: `npx vitest run src/worker/simulate.worker.test.ts -t "deterministic with seed"`
- [x] (TEST) `p10 <= median <= p90` always
  - Verify: `npx vitest run src/worker/simulate.worker.test.ts -t "quantile ordering"`
- [x] (TEST) **pZero monotonic non-decreasing** in spotPrice (corrected direction): `pZero(team, data, $50) <= pZero(team, data, $500) <= pZero(team, data, $5000)`
  - Verify: `npx vitest run src/worker/simulate.worker.test.ts -t "pZero monotonic non-decreasing"`
- [x] (TEST) MC mean for Jets (cold, low-variance) is within 25% of closed-form EV
  - Verify: `npx vitest run src/worker/simulate.worker.test.ts -t "mc vs closed-form jets"`
- [x] (TEST) Quantile index uses `Math.floor((n-1) * q)` (sanity-check: `q(0)` = smallest, `q(1)` = largest)
  - Verify: `npx vitest run src/worker/simulate.worker.test.ts -t "quantile indexing"`

**Files to Create:**
- `src/worker/simulate.worker.ts`, `src/worker/rng.ts`
- `src/worker/simulate.worker.test.ts`, `src/worker/rng.test.ts`

**Files to Modify:**
- Delete `src/worker/hello.worker.ts` and `src/worker/hello.worker.test.ts` (scaffold from Task 1.1.B)

**Dependencies:** Task 1.3.A, Task 1.3.C

**Spec Reference:** TECHNICAL_SPEC §6.4

---

#### Task 1.4.B: Main-thread worker client with requestId supersession + fallback

**Description:**
Write `src/worker-client.ts` exporting `simulate(team, spotPrice, data, onResult)`. Issues a new `requestId` (monotonically increasing) on every call. Posts to worker; only applies replies where `message.requestId === state.pendingRequestId`. Older replies are discarded silently (this is supersession, not cancellation — TECH_SPEC §6.4). Falls back to synchronous main-thread simulation if `typeof Worker === 'undefined'`.

**Requirement:** REQ-034

**Acceptance Criteria:**
- [x] (CODE) `simulate()` exported, uses `state.nextRequestId()` on each call
  - Verify: `grep -q "export function simulate" src/worker-client.ts && grep -q "nextRequestId" src/worker-client.ts`
- [x] (TEST) Rapid calls: only the latest-requestId callback fires
  - Verify: `npx vitest run src/worker-client.test.ts -t "supersession"`
- [x] (TEST) `typeof Worker === 'undefined'` path: falls back to synchronous and still returns a result
  - Verify: `npx vitest run src/worker-client.test.ts -t "no-worker fallback"`

**Files to Create:**
- `src/worker-client.ts`, `src/worker-client.test.ts`

**Files to Modify:**
- `src/state.ts` — add `pendingRequestId: number` and `nextRequestId()` helper

**Dependencies:** Task 1.4.A

**Spec Reference:** TECHNICAL_SPEC §3 (Request lifecycle), §6.4

---

### Phase 1 Checkpoint

**Automated Checks:**
- [ ] (TEST) All Vitest tests pass: `npx vitest run` exits 0
- [ ] (TYPE) `npx tsc --noEmit` exits 0
- [ ] (BUILD) `npm run build` exits 0
- [ ] (CODE) No `any` types leaked into math exports: `grep -rn ": any" src/math | grep -v ".test.ts" && exit 1 || exit 0`
- [ ] (CODE) Every non-test `.ts` in `src/math/` and `src/worker/` (except `.d.ts` and type-only files) has a matching `.test.ts`
  - Verify: `for f in src/math/*.ts src/worker/*.ts; do [[ "$f" == *test.ts ]] && continue; base="${f%.ts}"; test -f "${base}.test.ts" || { echo "missing test: ${base}.test.ts"; exit 1; }; done`

**Regression Verification:**
- [ ] Phase 1 math tests remain green when run from a fresh clone

---

## Phase 2: Data + UI

**Goal:** Install the Playwright test harness, ingest real data, build all UI components wired to Phase 1 math. At the end of this phase, the tool is fully functional on localhost against real data.

**Depends On:** Phase 1 complete.

### Pre-Phase Setup

- [ ] DJ delivers `data.json` with D-001 (`tier_values_usd`), D-002 (`tiers` for every referenced player), D-005 (`odds_source`). D-006 (`confidence_inputs` for tier-1 chase players) is warning-level, not blocking.
  - Verify: `test -f public/data.json && jq -e '.tier_values_usd and (.teams["New York Giants"].tiers | length > 0)' public/data.json`
- [ ] If D-001 is not ready, the project ships in `probability_only` mode (REQ-041). Set `values_ready: false` in the JSON.
  - Verify: `jq -r '.values_ready' public/data.json`

---

### Step 2.0: Playwright test harness (NEW in v2)

**Depends On:** Phase 1 checkpoint.

---

#### Task 2.0.A: Install Playwright + axe-core + define fixture-loading helper

**Description:**
Install `@playwright/test` and `@axe-core/playwright` as dev dependencies. Create `playwright.config.ts` with `webServer: { command: 'npm run dev', url: 'http://localhost:5173' }` and `baseURL`. Create a fixture-loading helper `tests/helpers/loadFixture.ts` that uses `page.route('/data.json', ...)` to serve a fixture file for a test (used by fail-loud, fallback, stale-warning, etc.). Codex-flagged: v1 had browser criteria in Phase 2 but installed Playwright in Phase 3.

**Requirement:** None (infrastructure for REQ-028, REQ-030, REQ-033, REQ-040, REQ-041)

**Acceptance Criteria:**
- [x] (CODE) `@playwright/test` and `@axe-core/playwright` in `devDependencies`
  - Verify: `node -e "const p=require('./package.json'); process.exit((p.devDependencies['@playwright/test'] && p.devDependencies['@axe-core/playwright']) ? 0 : 1)"`
- [x] (CODE) `playwright.config.ts` has `webServer` with `command: 'npm run dev'` and a `baseURL`
  - Verify: `grep -q "webServer" playwright.config.ts && grep -q "baseURL" playwright.config.ts`
- [x] (CODE) `tests/helpers/loadFixture.ts` exports `loadFixture(page, fixtureName)` that `page.route`s `/data.json` to a file under `src/fixtures/`
  - Verify: `grep -q "page.route" tests/helpers/loadFixture.ts && grep -q "export.*loadFixture" tests/helpers/loadFixture.ts`
- [x] (TEST) A smoke test `tests/smoke.spec.ts` loads `/` with the valid-full fixture and asserts a `data-testid="page-loaded"` marker renders
  - Verify: `npx playwright test tests/smoke.spec.ts`
- [x] (TEST) The previously-scaffolded `tests/fail-loud.spec.ts` from Task 1.2.B now runs green (broken fixture → full-page error)
  - Verify: `npx playwright test tests/fail-loud.spec.ts`

**Files to Create:**
- `playwright.config.ts`
- `tests/helpers/loadFixture.ts`
- `tests/smoke.spec.ts`
- `tests/fail-loud.spec.ts` (completes the Task 1.2.B scaffold)

**Files to Modify:**
- `package.json` (add dev deps + `test:e2e` script)
- `index.html` (add `data-testid="page-loaded"` on body or root container)

**Dependencies:** Phase 1 checkpoint

**Spec Reference:** TECHNICAL_SPEC §8 accessibility, §7 fail-loud

---

### Step 2.1: Real data ingestion

**Depends On:** Step 2.0

---

#### Task 2.1.A: Iterate Zod parse against real `data.json` until clean

**Description:**
Drop DJ's `data.json` into `/public/data.json`. Run `FullDataSchema.safeParse` (or `CoreDataSchema` if `values_ready: false`) and iterate until it passes. Do NOT loosen the schema; fix the data. Verify comprehensively that every category list AND every tier reference is consistent. Codex-flagged: v1 only checked `base_veterans` and `chase_players`.

**Requirement:** REQ-024, REQ-041

**Acceptance Criteria:**
- [x] (CODE) `public/data.json` is syntactically valid JSON
  - Verify: `jq empty public/data.json`
- [x] (TEST) Full data path: `FullDataSchema.safeParse(data).success === true`, OR core-only path: `CoreDataSchema.safeParse(data).success === true && data.values_ready === false`
  - Verify: `npx vitest run src/validate.real-data.test.ts -t "real data parses"`
- [x] (CODE) All 32 NFL teams present
  - Verify: `jq '.teams | keys | length == 32' public/data.json`
- [x] (CODE) Every team has non-empty `base_veterans`, `rookies`, `base_auto_signers`, `rookie_auto_signers` (array may be empty but key must exist), `chase_players`, `tiers`
  - Verify: `jq -e '[.teams[] | (has("base_veterans") and has("rookies") and has("base_auto_signers") and has("rookie_auto_signers") and has("chase_players") and has("tiers"))] | all' public/data.json`
- [x] (CODE) Every player name referenced in any team category list has a `tiers[player]` entry
  - Verify: `npx vitest run src/validate.real-data.test.ts -t "every player has tier"`
- [x] (CODE) Every tier referenced is one of the 4 enum values
  - Verify: `jq -e '[.teams[].tiers | to_entries[].value] | all(. == "tier_1_chase" or . == "tier_2_strong" or . == "tier_3_fair" or . == "tier_4_cold")' public/data.json`

**Files to Create:**
- `public/data.json` (from DJ)
- `src/validate.real-data.test.ts`

**Dependencies:** Phase 1 checkpoint, D-001/D-002 from DJ

**Spec Reference:** TECHNICAL_SPEC §5.1, PRODUCT_SPEC D-001/D-002

---

#### Task 2.1.B: Sanity-check math against real data (Giants / Titans / Jets)

**Description:**
Run `computeEV` and `probAtLeastOne` against real data for Giants (chase-heavy), Titans (rookie-auto-only), Jets (cold). Snapshot the numbers in `src/math/real-data.test.ts` with realistic bounds. **Codex-flagged fix:** v1 asserted `probAtLeastOne('rookie_auto', Giants) > 0.9`, but with `slots_per_case = 0.5` and ~4 rookie-auto signers out of 94, actual probability is ~2%. Corrected assertions below.

**Requirement:** REQ-008, REQ-010, REQ-040

**Acceptance Criteria:**
- [x] (TEST) Giants `computeEV` is between $50 and $5,000 (broad sanity range — narrowed after real-data inspection)
  - Verify: `npx vitest run src/math/real-data.test.ts -t "giants plausible ev"`
- [x] (TEST) Jets EV is less than Giants EV
  - Verify: `npx vitest run src/math/real-data.test.ts -t "jets lt giants"`
- [x] (TEST) Titans: rookie auto contribution > base auto contribution (Titans have 0 base_auto_signers in the JSON)
  - Verify: `npx vitest run src/math/real-data.test.ts -t "titans rookie auto dominated"`
- [x] (TEST) `probAtLeastOne('rookie', Giants, data) > 0.95` (rookies have many slots per case → very likely to hit at least one rookie for a team with >=1 rookie)
  - Verify: `npx vitest run src/math/real-data.test.ts -t "giants rookie likely"`
- [x] (TEST) `probAtLeastOne('rookie_auto', Giants, data)` is between 0 and 0.5 (realistic range given ~0.5 slots per case × ~4/94 denominator)
  - Verify: `npx vitest run src/math/real-data.test.ts -t "giants rookie auto realistic"`

**Files to Create:**
- `src/math/real-data.test.ts`

**Dependencies:** Task 2.1.A

**Spec Reference:** TECHNICAL_SPEC §6, PRODUCT_SPEC REQ-040

---

### Step 2.2: Core UI components

**Depends On:** Step 2.1

---

#### Task 2.2.A: State module + subscribers + requestId

**Description:**
Create `src/state.ts` with the full `State` type including `pendingRequestId`. Exports `getState`, `setState`, `subscribe`, `nextRequestId`.

**Requirement:** None (infrastructure)

**Acceptance Criteria:**
- [x] (CODE) All four functions exported *(satisfied by Task 1.4.B — state.ts created with full TECH_SPEC §9 shape)*
  - Verify: `grep -qE "export function (setState|subscribe|getState|nextRequestId)" src/state.ts`
- [x] (TEST) `setState({ selectedTeam: 'X' })` triggers all subscribers
  - Verify: `npx vitest run src/state.test.ts -t "subscribers fire"`
- [x] (TEST) `nextRequestId` returns monotonically increasing integers
  - Verify: `npx vitest run src/state.test.ts -t "request id monotonic"`

**Files to Create:**
- `src/state.ts`, `src/state.test.ts`

**Dependencies:** Task 1.2.A

**Spec Reference:** TECHNICAL_SPEC §9

---

#### Task 2.2.B: Team grid (REQ-003, REQ-030, REQ-031)

**Description:**
Render 32 NFL teams as tappable cards in a Tailwind grid. Single column on 360px, two columns on 390px, three on 768px. Active state via `aria-pressed`. Every tappable element ≥ 44×44 CSS pixels.

**Requirement:** REQ-003, REQ-030, REQ-031

**Acceptance Criteria:**
- [x] (CODE) `renderTeamGrid(container, data)` exported
  - Verify: `grep -q "export function renderTeamGrid" src/ui/team-grid.ts`
- [x] (BROWSER:DOM) On load with valid fixture, 32 team buttons render in `[data-testid="team-grid"]`
  - Verify: `npx playwright test tests/team-grid.spec.ts -g "renders 32 teams"`
- [x] (BROWSER:DOM) Tapping a team adds `aria-pressed="true"` to that team only
  - Verify: `npx playwright test tests/team-grid.spec.ts -g "aria pressed on click"`
- [x] (BROWSER:VISUAL) No horizontal scroll at 360px viewport
  - Verify: `npx playwright test tests/team-grid.spec.ts -g "no horizontal scroll 360"`
- [x] (BROWSER:DOM) Every team button has clientHeight >= 44 and clientWidth >= 44
  - Verify: `npx playwright test tests/team-grid.spec.ts -g "tap target 44px"`

**Files to Create:**
- `src/ui/team-grid.ts`, `tests/team-grid.spec.ts`

**Files to Modify:**
- `src/main.ts` (mount team grid)

**Dependencies:** Task 2.0.A, Task 2.2.A

**Spec Reference:** TECHNICAL_SPEC §8 item 3

---

#### Task 2.2.C: Team detail panel (category breakdown + tier labels, REQ-004)

**Description:**
When a team is selected, render a detail panel showing the roster broken into Base Veterans / Rookies / Base Auto Signers / Rookie Auto Signers with counts AND **tier labels per player**. Codex-flagged: v1 verified sections and counts but not tier labels. REQ-004 requires each player to show tier.

**Requirement:** REQ-004, REQ-005

**Acceptance Criteria:**
- [x] (CODE) `renderTeamDetail(container, team, data)` exported
  - Verify: `grep -q "export function renderTeamDetail" src/ui/team-detail.ts`
- [x] (BROWSER:DOM) Panel has 4 labeled sections with `data-testid` starting with `roster-`
  - Verify: `npx playwright test tests/team-detail.spec.ts -g "four roster sections"`
- [x] (BROWSER:DOM) Chase players have `data-chase="true"` marker
  - Verify: `npx playwright test tests/team-detail.spec.ts -g "chase marker"`
- [x] (BROWSER:DOM) **Every rendered player row has a `data-tier` attribute matching `data.teams[team].tiers[player]`**
  - Verify: `npx playwright test tests/team-detail.spec.ts -g "tier labels rendered"`
- [x] (BROWSER:DOM) Specific: Giants detail panel renders Jaxson Dart with `data-tier="tier_1_chase"`
  - Verify: `npx playwright test tests/team-detail.spec.ts -g "jaxson dart tier 1"`

**Files to Create:**
- `src/ui/team-detail.ts`, `tests/team-detail.spec.ts`

**Dependencies:** Task 2.0.A, Task 2.2.B

**Spec Reference:** TECHNICAL_SPEC §8 item 4, PRODUCT_SPEC REQ-004

---

#### Task 2.2.D: Spot price input with debounce

**Description:**
Render a numeric input with `$` prefix and 44×44 minimum tap area. Debounce changes at 200ms, call `worker-client.simulate` on each debounced change when both team and price > 0. Hide results panel when `spotPrice <= 0` (REQ-007).

**Requirement:** REQ-006, REQ-007, REQ-031

**Acceptance Criteria:**
- [x] (CODE) `renderPriceInput(container)` exported
  - Verify: `grep -q "export function renderPriceInput" src/ui/price-input.ts`
- [x] (BROWSER:DOM) Input has `type="number"`, `inputmode="numeric"`, `min="0"`
  - Verify: `npx playwright test tests/price-input.spec.ts -g "input attributes"`
- [x] (BROWSER:DOM) Input wrapper `clientHeight >= 44` and `clientWidth >= 44`
  - Verify: `npx playwright test tests/price-input.spec.ts -g "tap target 44px"`
- [x] (TEST) Debounce: rapid input changes → single call to simulate (mocked worker client)
  - Verify: `npx vitest run src/ui/price-input.test.ts -t "debounces"`
- [x] (BROWSER:DOM) Result panel hidden when spot price is empty or 0
  - Verify: `npx playwright test tests/price-input.spec.ts -g "results hidden on zero"`

**Files to Create:**
- `src/ui/price-input.ts`, `src/ui/price-input.test.ts`, `tests/price-input.spec.ts`

**Dependencies:** Task 2.0.A, Task 2.2.A, Task 1.4.B

**Spec Reference:** TECHNICAL_SPEC §8 item 5

---

#### Task 2.2.E: Product card / header — hero copy, benchmark cost, ship-all-cards note (NEW in v2)

**Description:**
Renders the header band + product card at the top of the page. Includes: hero tagline ("You're about to play a slot machine. Here's what it's actually paying out."), product name + format label ("2025 Topps Chrome Football — Pick Your Team Hobby Case Break"), benchmark case cost label (loaded from `data.product.benchmark_case_cost_usd`), and the visible **ship-all-cards assumption note** from REQ-001 ("This estimate assumes every card pulled for your team is shipped to you. Ask your breaker to confirm."). Codex-flagged: v1 had no task that verified REQ-001 or REQ-002.

**Requirement:** REQ-001, REQ-002

**Acceptance Criteria:**
- [x] (CODE) `renderProductCard(container, data)` exported from `src/ui/product-card.ts`
  - Verify: `grep -q "export function renderProductCard" src/ui/product-card.ts`
- [x] (BROWSER:DOM) Hero tagline contains "slot machine"
  - Verify: `npx playwright test tests/product-card.spec.ts -g "hero tagline"`
- [x] (BROWSER:DOM) Product name label contains "2025 Topps Chrome Football" and "Pick Your Team"
  - Verify: `npx playwright test tests/product-card.spec.ts -g "product name label"`
- [x] (BROWSER:DOM) **Benchmark case cost** label element exists and contains the word "Benchmark" (not "the" cost)
  - Verify: `npx playwright test tests/product-card.spec.ts -g "benchmark label"`
- [x] (BROWSER:DOM) `[data-testid="ship-all-cards-note"]` is visible and contains the word "assumes"
  - Verify: `npx playwright test tests/product-card.spec.ts -g "ship all cards note"`
- [x] (BROWSER:DOM) Dollar amount rendered matches `data.product.benchmark_case_cost_usd`
  - Verify: `npx playwright test tests/product-card.spec.ts -g "benchmark cost from data"`

**Files to Create:**
- `src/ui/product-card.ts`, `tests/product-card.spec.ts`

**Files to Modify:**
- `src/main.ts` (mount product card above team grid)

**Dependencies:** Task 2.0.A, Task 2.2.A

**Spec Reference:** TECHNICAL_SPEC §8 items 1–2, PRODUCT_SPEC REQ-001, REQ-002

---

### Step 2.3: Results panel & disclosure

**Depends On:** Step 2.2

---

#### Task 2.3.A: Results panel (hero EV, subhero range, P($0), verdict, gap, confidence muting)

**Description:**
Render hero EV number at the largest size on the page (font-size ≥ 1.5× next-largest per REQ-029). Subhero with median + 10–90 range. P($0) band. Color-coded verdict band applying `computeVerdict`. Gap detail. Confidence-aware muting: `data-confidence="low"` applies `opacity-60`.

**Requirement:** REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-017, REQ-029, REQ-032

**Acceptance Criteria:**
- [x] (CODE) `renderResultPanel(container, result)` exported
  - Verify: `grep -q "export function renderResultPanel" src/ui/result-panel.ts`
- [x] (BROWSER:DOM) `[data-testid="ev-hero"]` computed font-size ≥ 1.5× `[data-testid="subhero"]`
  - Verify: `npx playwright test tests/result-panel.spec.ts -g "ev hero 1.5x subhero"`
- [x] (BROWSER:DOM) `[data-testid="p-zero"]` contains "effectively nothing"
  - Verify: `npx playwright test tests/result-panel.spec.ts -g "p zero text"`
- [x] (BROWSER:DOM) Verdict band `data-verdict` attribute matches one of STEAL/BELOW_MARKET/NEAR_MARKET/ABOVE_MARKET/RIPPED
  - Verify: `npx playwright test tests/result-panel.spec.ts -g "verdict enum"`
- [x] (BROWSER:DOM) With a low-confidence fixture, result panel has `data-confidence="low"` and `opacity-60` class
  - Verify: `npx playwright test tests/result-panel.spec.ts -g "low confidence muted"`
- [x] (BROWSER:VISUAL) EV hero bottom ≤ 780 at 360×780 viewport after submit (above fold, REQ-032)
  - Verify: `npx playwright test tests/result-panel.spec.ts -g "ev above fold 360x780"`

**Files to Create:**
- `src/ui/result-panel.ts`, `tests/result-panel.spec.ts`

**Dependencies:** Task 2.2.D, Task 1.3.C, Task 1.3.D, Task 1.3.E, Task 1.4.B

**Spec Reference:** TECHNICAL_SPEC §8 item 6, §6.6, §6.7

---

#### Task 2.3.B: Probability table + contributors + variance callout + methodology + disclaimer

**Description:**
Complete the rest of the results panel. Probability table with one row per category + **aggregate rows for "any numbered parallel" and "any chase card"** (codex-flagged REQ-008 gap). Top-5 contributors. **Variance callout** (`data-testid="variance-callout"`) for the top tier-1 chase contributor explaining "most upside / most variance" (codex-flagged REQ-019 gap). Methodology `<details>` block. Always-visible disclaimer with variance disclaimer, "not financial advice" text, and 4 per-category freshness timestamps with stale warning at 14+ days.

**Requirement:** REQ-008, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023

**Acceptance Criteria:**
- [x] (BROWSER:DOM) Probability table has one row per `card_categories` entry PLUS rows for `any_numbered_parallel` and `any_chase_card`
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "probability rows include aggregates"`
- [x] (BROWSER:DOM) Contributors section renders ≤ 5 rows
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "max 5 contributors"`
- [x] (BROWSER:DOM) `[data-testid="variance-callout"]` exists and includes the top chase contributor's player name
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "variance callout present"`
- [x] (BROWSER:DOM) Methodology is a `<details>` starting closed
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "methodology closed details"`
- [x] (BROWSER:DOM) Disclaimer contains "variance" AND "Not financial advice" AND "not affiliated"
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "disclaimer text"`
- [x] (BROWSER:DOM) Freshness panel has 4 elements with `data-category` attributes (checklist / odds / values / comps)
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "four freshness timestamps"`
- [x] (BROWSER:DOM) Stale fixture (timestamp 15+ days old) triggers `[data-testid="stale-warning"]`
  - Verify: `npx playwright test tests/results-detail.spec.ts -g "stale warning renders"`

**Files to Create:**
- `src/ui/methodology.ts`, `src/ui/disclaimer.ts`
- `tests/results-detail.spec.ts`
- `src/fixtures/stale-timestamps.json`

**Files to Modify:**
- `src/ui/result-panel.ts` (mount probability table + contributors + callout)
- `index.html` (disclaimer block below results)

**Dependencies:** Task 2.3.A

**Spec Reference:** TECHNICAL_SPEC §8 items 6–7, PRODUCT_SPEC REQ-008, REQ-019

---

### Step 2.4: Probability-only fallback mode

**Depends On:** Step 2.3

---

#### Task 2.4.A: Probability-only fallback rendering (REQ-041)

**Description:**
When `state.mode === 'probability_only'`, hide EV hero / subhero / P($0) / verdict / gap / contributors; render team grid + roster + probability table + a prominent fallback banner. Other UI elements (product card, disclaimer block) remain.

**Requirement:** REQ-041

**Acceptance Criteria:**
- [ ] (CODE) Result panel branches on `state.mode === 'probability_only'`
  - Verify: `grep -q "probability_only" src/ui/result-panel.ts`
- [ ] (BROWSER:DOM) With `values_ready: false` fixture, `[data-testid="ev-hero"]` is hidden AND `[data-testid="fallback-banner"]` is visible
  - Verify: `npx playwright test tests/fallback.spec.ts -g "ev hidden fallback visible"`
- [ ] (BROWSER:DOM) Probability rows still render in fallback mode
  - Verify: `npx playwright test tests/fallback.spec.ts -g "probability rows in fallback"`

**Files to Create:**
- `tests/fallback.spec.ts`
- `src/fixtures/core-only-fallback.json`

**Files to Modify:**
- `src/ui/result-panel.ts`, `index.html`

**Dependencies:** Task 2.3.A, Task 2.3.B

**Spec Reference:** TECHNICAL_SPEC §7, PRODUCT_SPEC REQ-041

---

### Phase 2 Checkpoint

**Automated Checks:**
- [ ] (TEST) All Vitest tests pass: `npx vitest run` exits 0
- [ ] (TEST) All Playwright tests pass: `npx playwright test` exits 0
- [ ] (TYPE) `npx tsc --noEmit` exits 0
- [ ] (BUILD) `npm run build` exits 0
- [ ] (BROWSER:CONSOLE) No console errors on initial page load, team selection, or price submit (verified via `tests/smoke.spec.ts` reading `page.on('console')`)
  - Verify: `npx playwright test tests/smoke.spec.ts -g "no console errors"`

**Regression Verification:**
- [ ] Phase 1 math tests remain green
- [ ] No `any` types added to UI modules

---

## Phase 3: Launch

**Goal:** Responsive + accessibility pass, polish, analytics, performance test, real domain, launch gate.

**Depends On:** Phase 2 complete. Real data available.

### Pre-Phase Setup

- [ ] D-003 (final domain name) delivered
  - Verify: captured in `TODOs.md`
- [ ] Cloudflare Web Analytics site configured (or Vercel Analytics, pending commercial caveat)
  - Verify: Script snippet in hand

---

### Step 3.1: Responsive + accessibility

**Depends On:** Phase 2 checkpoint.

---

#### Task 3.1.A: 360 / 390 / 768 px viewports + Axe WCAG AA

**Description:**
Run `@axe-core/playwright` against the dev server at three viewports. Fix any contrast failures using tokens from TECH_SPEC §6.8. Verify no horizontal scroll. Verify EV hero is above fold at 360×780 after submit.

**Requirement:** REQ-030, REQ-032, REQ-033

**Acceptance Criteria:**
- [ ] (BROWSER:ACCESSIBILITY) 0 axe violations at 360px
  - Verify: `npx playwright test tests/accessibility.spec.ts -g "360px axe clean"`
- [ ] (BROWSER:ACCESSIBILITY) 0 axe violations at 390px
  - Verify: `npx playwright test tests/accessibility.spec.ts -g "390px axe clean"`
- [ ] (BROWSER:ACCESSIBILITY) 0 axe violations at 768px
  - Verify: `npx playwright test tests/accessibility.spec.ts -g "768px axe clean"`
- [ ] (BROWSER:VISUAL) No horizontal scroll at any of the three viewports
  - Verify: `npx playwright test tests/accessibility.spec.ts -g "no horizontal scroll"`
- [ ] (BROWSER:VISUAL) EV hero visible above the fold at 360×780 post-submit
  - Verify: `npx playwright test tests/accessibility.spec.ts -g "above fold 360x780"`

**Files to Create:**
- `tests/accessibility.spec.ts`

**Dependencies:** Phase 2 checkpoint

**Spec Reference:** TECHNICAL_SPEC §8 accessibility, §6.8 tokens, PRODUCT_SPEC REQ-029 through REQ-033

---

### Step 3.2: Polish + analytics

**Depends On:** Step 3.1

---

#### Task 3.2.A: Hero copy, meta tags, OG image, favicon

**Description:**
Final `index.html` meta: `<title>`, `<meta name="description">`, Open Graph, Twitter card, favicon, `og-image.png` (1200×630). Title: *"RIPPED — Did you overpay for that team spot?"*.

**Requirement:** None (polish)

**Acceptance Criteria:**
- [ ] (CODE) `<title>` contains "RIPPED" and `<meta name="description">` populated
  - Verify: `grep -q "<title>RIPPED" index.html && grep -q 'name="description"' index.html`
- [ ] (CODE) `og:image`, `og:title`, `og:description`, `twitter:card` all present
  - Verify: `grep -q "og:image" index.html && grep -q "og:title" index.html && grep -q "og:description" index.html && grep -q "twitter:card" index.html`
- [ ] (CODE) `favicon.svg` and `og-image.png` exist in `public/`
  - Verify: `test -f public/favicon.svg && test -f public/og-image.png`

**Files to Modify:** `index.html`

**Files to Create:** `public/favicon.svg`, `public/og-image.png`

**Dependencies:** Phase 2 checkpoint

**Spec Reference:** PRODUCT_SPEC §1

---

#### Task 3.2.B: Cloudflare Web Analytics (recommended) OR Vercel Analytics

**Description:**
Drop the chosen analytics snippet into `index.html`. Cloudflare Web Analytics is recommended because it has no event cap and no identifiable user data. Vercel Analytics free tier has a 50k monthly event cap + Hobby commercial-use restriction — use only if explicitly non-commercial.

**Requirement:** REQ-036

**Acceptance Criteria:**
- [ ] (CODE) Analytics snippet added to `index.html`
  - Verify: `grep -qE "(cloudflareinsights|vercel-analytics)" index.html`
- [ ] (CODE) Snippet is loaded with `defer` or equivalent to avoid blocking render
  - Verify: `grep -qE 'defer|async' index.html`

**Files to Modify:** `index.html`

**Dependencies:** Task 3.2.A

**Spec Reference:** TECHNICAL_SPEC §2, PRODUCT_SPEC REQ-036

---

### Step 3.3: Launch readiness

**Depends On:** Step 3.2

---

#### Task 3.3.A: Full smoke test — all 32 teams + edge cases + stale + fallback

**Description:**
Scripted Playwright smoke across all 32 teams + synthetic edge-case fixtures. Verify: every team selectable, EV finite (or null in fallback), confidence label renders, stale warning renders for stale fixture, fallback banner renders for `values_ready: false`, Tennessee produces rookie-dominated EV, price ≤ $0 hides results panel, full-page error renders for broken fixture, Giants/Titans/Jets manual sanity check.

**Requirement:** REQ-040, REQ-043

**Acceptance Criteria:**
- [ ] (BROWSER:DOM) Script taps every team in sequence, no console errors
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "all 32 selectable"`
- [ ] (BROWSER:DOM) Every team's EV value parses as a finite number (or null in fallback mode)
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "ev finite per team"`
- [ ] (BROWSER:DOM) Tennessee: rookie-auto contribution dominates base-auto in contributors
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "tennessee rookie dominated"`
- [ ] (BROWSER:DOM) Stale fixture triggers stale warning
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "stale warning"`
- [ ] (BROWSER:DOM) Fallback fixture triggers fallback banner
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "fallback banner"`
- [ ] (BROWSER:DOM) Broken fixture triggers full-page error
  - Verify: `npx playwright test tests/smoke-all-teams.spec.ts -g "broken fixture error"`
- [ ] (MANUAL:DEFER) Visual sanity check Giants / Titans / Jets EV numbers against the X screenshot's breaker pricing
  - Reason: Requires human judgment on whether numbers "look right" given public break prices — no automated comp source available for v1

**Files to Create:**
- `tests/smoke-all-teams.spec.ts`

**Dependencies:** Task 3.2.B, Task 2.3.B, Task 2.4.A, Task 1.2.B (fail-loud)

**Spec Reference:** TECHNICAL_SPEC §11, PRODUCT_SPEC REQ-040

---

#### Task 3.3.B: Domain wiring + full REQ-040 launch gate on production

**Description:**
Configure the production domain. Once DNS resolves, run the **complete** REQ-040 launch gate against the live URL: 32 teams present; every tier cell used by the math populated; no missing tier assignments for referenced players; Giants/Titans/Jets produce plausible numbers; disclaimer copy matches production `odds_source`; stale-data logic works on a synthetic fixture; variance + legal + freshness disclaimers all render. Capture results in `launch-gate.md` and `post-launch-checklist.md`.

**Requirement:** REQ-039, REQ-040, REQ-042, REQ-043

**Acceptance Criteria:**
- [ ] (BROWSER:NETWORK) Production `/` and `/data.json` return HTTP 200
  - Verify: `curl -sfI https://<domain>/ && curl -sfI https://<domain>/data.json`
- [ ] (BROWSER:DOM) Production: all 32 teams present in team grid
  - Verify: `npx playwright test tests/production-smoke.spec.ts -g "32 teams production"`
- [ ] (CODE) Production `/data.json`: every tier referenced by any team's `tiers` map exists in `tier_values_usd`
  - Verify: `npx playwright test tests/production-smoke.spec.ts -g "tier completeness"`
- [ ] (CODE) Production `/data.json`: every player name in any team's category lists has a `tiers[player]` entry
  - Verify: `npx playwright test tests/production-smoke.spec.ts -g "tier assignments complete"`
- [ ] (BROWSER:DOM) Production: disclaimer copy matches `odds_source` from production JSON
  - Verify: `npx playwright test tests/production-smoke.spec.ts -g "disclaimer matches source"`
- [ ] (BROWSER:DOM) Production: Giants/Titans/Jets each produce a finite EV in the range observed during Task 2.1.B
  - Verify: `npx playwright test tests/production-smoke.spec.ts -g "three team sanity"`
- [ ] (CODE) `launch-gate.md` exists with every REQ-040 checklist item verified
  - Verify: `test -f launch-gate.md && grep -c "REQ-040" launch-gate.md`
- [ ] (CODE) `post-launch-checklist.md` exists as the REQ-043 record
  - Verify: `test -f post-launch-checklist.md`

**Files to Create:**
- `launch-gate.md`, `post-launch-checklist.md`, `tests/production-smoke.spec.ts`

**Dependencies:** Task 3.3.A, D-003

**Spec Reference:** PRODUCT_SPEC §5.12 (REQ-040 through REQ-043)

---

#### Task 3.3.C: Performance test — p95 calculation time (NEW in v2, REQ-034)

**Description:**
Add `tests/performance.spec.ts` that repeatedly submits a price + team combination (20 runs with different teams + prices), records submit-to-result latency via `performance.now()`, and asserts p95 < 500ms. True mid-tier-device verification is flagged as MANUAL:DEFER since CI hardware differs from real phones, but the synthetic p95 gate catches obvious regressions.

**Requirement:** REQ-034

**Acceptance Criteria:**
- [ ] (CODE) `tests/performance.spec.ts` exists
  - Verify: `test -f tests/performance.spec.ts`
- [ ] (BROWSER:PERFORMANCE) 20-run p95 latency < 500ms in CI (Playwright-driven)
  - Verify: `npx playwright test tests/performance.spec.ts -g "p95 under 500"`
- [ ] (CODE) Test uses `performance.now()` bracketing around the worker-client simulate call
  - Verify: `grep -q "performance.now" tests/performance.spec.ts`
- [ ] (MANUAL:DEFER) Mid-tier 2023 phone smoke test (iPhone 13 / Pixel 7 class) with real data
  - Reason: Real-device perf measurement requires physical hardware + Lighthouse mobile emulation; CI synthetic timing catches obvious regressions but not true mobile perf

**Files to Create:**
- `tests/performance.spec.ts`

**Dependencies:** Task 3.3.A

**Spec Reference:** TECHNICAL_SPEC §6.4, PRODUCT_SPEC REQ-034

---

### Phase 3 Checkpoint

**Automated Checks:**
- [ ] (TEST) All Vitest + Playwright tests pass
- [ ] (TYPE) `npx tsc --noEmit` passes
- [ ] (BUILD) `npm run build` succeeds
- [ ] (BROWSER:ACCESSIBILITY) Axe reports 0 violations at 360 / 390 / 768
- [ ] (BROWSER:PERFORMANCE) p95 < 500ms in synthetic CI
- [ ] (BROWSER:NETWORK) Production `/` serves 200 OK
- [ ] (BROWSER:DOM) Full REQ-040 launch gate items verified on production
- [ ] (BROWSER:CONSOLE) No console errors on production

**Regression Verification:**
- [ ] All Phase 1 + Phase 2 tests remain green
- [ ] Probability-only fallback still renders correctly against fixture

---

## Post-Launch Watch

Not a phase — items to track after launch:

- Stale data: freshness audit every 3 days (all four timestamps)
- Console errors: Cloudflare/Vercel analytics dashboard daily for the first week
- User feedback: watch r/sportscards mentions
- D-001 follow-up: if launched in fallback mode, track progress toward full mode

---

## Requirements Coverage Summary

All 43 REQs from `plans/greenfield/PRODUCT_SPEC.md` v2 have at least one verifying task.

| REQ | Task(s) |
|---|---|
| REQ-001 | **2.2.E** (NEW — ship-all-cards note verified) |
| REQ-002 | **2.2.E** (NEW — benchmark case cost label verified) |
| REQ-003 | 2.2.B |
| REQ-004 | 2.2.C (with tier label verification — updated in v2) |
| REQ-005 | 2.2.C |
| REQ-006 | 2.2.D |
| REQ-007 | 2.2.D |
| REQ-008 | 1.3.B (aggregate probs added in v2), 2.3.B |
| REQ-009 | 1.3.B |
| REQ-010 | 1.3.C, 2.3.A |
| REQ-011 | 1.4.A, 2.3.A |
| REQ-012 | 1.4.A, 2.3.A |
| REQ-013 | 2.3.A |
| REQ-014 | 1.4.A (pZero monotonicity corrected in v2), 2.3.A |
| REQ-015 | 1.3.E, 2.3.A |
| REQ-016 | 1.3.D |
| REQ-017 | 1.3.E, 2.3.A |
| REQ-018 | 1.3.C, 2.3.B |
| REQ-019 | **2.3.B** (variance callout added in v2) |
| REQ-020 | 2.3.B |
| REQ-021 | 2.3.B |
| REQ-022 | 2.3.B |
| REQ-023 | 2.3.B |
| REQ-024 | 1.2.A, 2.1.A |
| REQ-025 | 1.2.A |
| REQ-026 | 1.2.A |
| REQ-027 | 1.2.A (now warning-level per v2) |
| REQ-028 | 1.2.A, 1.2.B (browser fail-loud test added in v2 via Task 2.0.A) |
| REQ-029 | 2.3.A |
| REQ-030 | 2.2.B, 3.1.A |
| REQ-031 | 2.2.B, 2.2.D |
| REQ-032 | 2.3.A, 3.1.A |
| REQ-033 | 3.1.A |
| REQ-034 | 1.1.B, 1.4.A, **3.3.C** (new performance test in v2) |
| REQ-035 | 1.1.A (no auth in stack) |
| REQ-036 | 3.2.B |
| REQ-037 | 1.1.A |
| REQ-038 | 1.1.A |
| REQ-039 | 3.3.B |
| REQ-040 | 2.1.B, 3.3.B (extended to full list in v2) |
| REQ-041 | 1.2.A, 1.2.B, 2.4.A |
| REQ-042 | 3.3.B |
| REQ-043 | 3.3.A, 3.3.B |

---

*Generated via `/generate-plan`, updated v2 after `/codex-consult` cross-model review caught 13 issues + 5 suggestions. See revision notes at the top for the full change list.*
