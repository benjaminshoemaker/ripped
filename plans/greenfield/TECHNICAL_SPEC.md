# RIPPED — Technical Specification

**Status:** Draft v3 (updated after codex-consult review of v2)
**Date:** 2026-04-14
**Upstream:** `plans/greenfield/PRODUCT_SPEC.md` (v2)
**Revision notes:** v3 fixes player/category eligibility (schema + math), rewrites the confidence algorithm to exactly match REQ-016's four-condition model, splits validation into probability-fatal vs value-fatal to unblock the REQ-041 fallback mode, corrects verdict threshold boundaries, specifies an exact dark background hex, aligns on Tailwind v4 + Zod + Web Worker simulation, removes the false "offline" claim, and re-budgets the implementation estimate.

---

## 1. Summary

RIPPED is a single-page, mobile-first static web application. The user selects an NFL team, enters a spot price, and receives EV / median / 10–90 percentile range / P($0) / soft-hybrid verdict for that team in a **2025 Topps Chrome Football Pick Your Team (PYT) hobby case break**. All data is static JSON. All math is client-side, run in a Web Worker so the main thread stays responsive and in-flight simulations can be superseded by newer selections. No backend. No database. No authentication. No telemetry that identifies individuals.

The architecture is intentionally trivial because (a) the launch is in <24 hours, (b) DJ maintains data manually and needs to update it without a build pipeline, and (c) the value of RIPPED is in the math + UX, not the infrastructure. Every stack decision below biases toward zero operational surface area.

---

## 2. Auto-decided assumptions (override here if wrong)

| Decision | Choice | Why |
|---|---|---|
| Build tool | **Vite 6+** (Node 20.19+ / 22.12+) | Fastest dev loop, single-command deploy, zero-config static output |
| Language | **TypeScript** | Catches math bugs; cheap insurance for a "trust this number" product |
| Framework | None — vanilla TS + DOM | ~5 interactive elements; React/Svelte would be larger than the app |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` + `@import "tailwindcss"` in `src/styles.css` (no `tailwind.config.ts` unless a plugin is needed) | Current 2026 official Vite path |
| Schema validation | **Zod** | Runtime parsing + inferred static types, reduces launch risk for hand-maintained JSON |
| Simulation thread | **Web Worker** for Monte Carlo | Keeps main thread responsive; enables request-ID supersession (in-flight results are discarded, not truly cancelled) — see §6.4 |
| Hosting | **Vercel Hobby** (free) IF RIPPED is treated as personal/non-commercial. Otherwise Netlify or Cloudflare Pages. Commercial operation of RIPPED under a branded domain may require Pro. | Vercel Hobby ToS is explicit about non-commercial use |
| Analytics | **Cloudflare Web Analytics** (free, no event cap, no identifiable user data) OR Vercel Analytics (free Hobby has a 50k-event monthly cap; commercial requires Pro) | Matches REQ-036; Cloudflare is the safer free-tier choice if commercial |
| Data delivery | Single `public/data.json` | DJ commits a new JSON, push to main, Vercel redeploys in ~30 seconds |
| Math approach | Closed-form EV (authoritative mean) + Monte Carlo 10k trials with seeded PRNG for median / p10 / p90 / P($0) | See §6 for the full math |
| State management | Module-level vars + DOM updates | 5 state variables; a library would be silly |
| Charts / viz | None — pure CSS bars and dollar numbers | Smaller than the app itself |
| Repo / CI | Public GitHub repo; Vercel webhook on `main` push; `@axe-core/playwright` for accessibility smoke | Standard, free, fast |
| Tests | Vitest on math + confidence modules | The math is the entire product |
| Linter / formatter | Prettier on save, no ESLint for v1 | Speed |

If Ben prefers Svelte / React / SvelteKit / Astro / SolidJS, none of those change the math module or the JSON shape. This spec does assume the **math runs in a Web Worker** to enable REQ-034's p95 < 500ms target plus cancellation semantics.

---

## 3. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Static site served by Vercel / Netlify / CF Pages CDN  │
│                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ index.html   │  │ /src/main.ts   │  │ /public/     │ │
│  │ - shell      │→ │ - bootstrap    │→ │  data.json   │ │
│  │ - meta tags  │  │ - Zod parse    │  │  (DJ-owned)  │ │
│  │ - hero copy  │  │ - mount UI     │  │              │ │
│  └──────────────┘  └───────┬────────┘  └──────────────┘ │
│                            │                             │
│                            ▼                             │
│         ┌───────────────────────────────────┐           │
│         │  /src/state.ts                     │           │
│         │  - data, team, price, result,      │           │
│         │    confidence, cache, mode,        │           │
│         │    pendingRequestId                 │           │
│         └───────────────┬───────────────────┘           │
│                         │                                │
│         ┌───────────────┴───────────────────┐           │
│         ▼                                    ▼           │
│  ┌────────────────┐              ┌──────────────────┐   │
│  │ Main thread    │              │ Worker thread    │   │
│  │ - UI render    │  postMessage │ - simulate.ts    │   │
│  │ - state sync   │ ◄───────────►│ - 10k trial MC   │   │
│  │ - validation   │  {reqId, ...}│ - seeded PRNG    │   │
│  └────────────────┘              └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Request lifecycle:**

1. Browser loads `index.html` from the CDN.
2. `main.ts` boots: fetches `/data.json`, runs Zod schema parse (REQ-028), determines launch mode (`full` vs `probability_only` vs `error` per REQ-041 / §7), mounts the UI.
3. User taps a team → state updates, team detail panel shows category-specific roster (REQ-004).
4. User types a spot price → 200ms debounced recompute.
5. Main thread calls closed-form `computeEV()` synchronously (microseconds, REQ-010) and posts a message to the Monte Carlo worker with a fresh `requestId`.
6. Worker returns median / p10 / p90 / pZero. The main thread only applies results where `message.requestId === state.pendingRequestId` — any earlier pending result is discarded (this is the "supersede" semantics; it is NOT true cancellation, per codex-consult feedback).
7. UI renders the result panel with confidence-aware styling (REQ-017).
8. Cache the team's distribution in memory so re-tapping the same team is instant.

**NOT offline-capable** — the initial fetch of `/data.json` is required. No service worker in v1.

---

## 4. File / module layout

```
ripped/
├── index.html                    # Page shell, hero copy, meta tags, disclaimer block
├── public/
│   ├── data.json                 # DJ-maintained single source of truth
│   ├── favicon.svg
│   └── og-image.png              # Open Graph image
├── src/
│   ├── main.ts                   # Entry: fetch, Zod parse, mount UI, bind events, spawn worker
│   ├── state.ts                  # Module-level state + subscribers
│   ├── types.ts                  # Types inferred from Zod schemas
│   ├── schema.ts                 # Zod schemas for AppData + validation (REQ-028)
│   ├── worker/
│   │   ├── simulate.worker.ts    # Monte Carlo, runs in Web Worker
│   │   └── rng.ts                # Seeded PRNG (mulberry32 or similar)
│   ├── math/
│   │   ├── eligibility.ts        # eligiblePlayers(category, team) — core fix from codex review
│   │   ├── probability.ts        # P(at least one) per category, binomial + Poisson
│   │   ├── ev.ts                 # Closed-form EV using eligible players only
│   │   ├── confidence.ts         # Four-condition scoring (REQ-016)
│   │   ├── verdict.ts            # Verdict with inclusive boundaries (REQ-015)
│   │   ├── ev.test.ts            # Vitest: eligibility, closed-form, MC quantile bands
│   │   └── confidence.test.ts    # Vitest: 4-condition truth table
│   ├── ui/
│   │   ├── team-grid.ts          # 32-team grid (REQ-003)
│   │   ├── team-detail.ts        # Category-broken-down roster + chase callouts (REQ-004, REQ-005)
│   │   ├── price-input.ts        # Numeric input, 44px tap target (REQ-006)
│   │   ├── result-panel.ts       # Hero EV, range, P($0), verdict (REQ-029, REQ-032)
│   │   ├── methodology.ts        # Expandable "How this is calculated" (REQ-023)
│   │   └── disclaimer.ts         # Variance + legal + per-category freshness (REQ-020-022)
│   └── styles.css                # `@import "tailwindcss";` + design tokens
├── vite.config.ts                # Vite + @tailwindcss/vite + worker config
├── package.json
├── tsconfig.json
└── README.md
```

**Target LOC:** under 1,500. Slightly larger than v2 because of Zod schemas, Web Worker boilerplate, and the eligibility module.

---

## 5. Data model (authoritative schema)

### 5.1 `data.json` schema

This is the single source of truth DJ maintains. REQ-028 demands Zod validation fails loudly on missing fields. v3 **breaks the team roster into explicit category-eligibility lists** (base veterans, rookies, base auto signers, rookie auto signers) so the math can never assign a rookie-auto value to a veteran.

```jsonc
{
  // ─── Timestamps (REQ-025) — independently consumable by the disclaimer
  "checklist_as_of": "2026-04-08T00:00:00Z",
  "odds_as_of":      "2026-04-15T09:00:00Z",
  "values_as_of":    "2026-04-14T00:00:00Z",
  "comps_as_of":     "2026-04-14T00:00:00Z",
  "data_as_of":      "2026-04-14T12:00:00Z",   // build metadata, NOT displayed

  // ─── Source markers (REQ-026)
  "odds_source":   "2025_official",            // "2024_placeholder" | "2025_official"

  // ─── Launch mode flag (REQ-041) — when false, UI falls back to probability-only
  "values_ready":  true,

  // ─── Product (REQ-001, REQ-002)
  "product": {
    "name": "2025 Topps Chrome Football",
    "format": "pyt_hobby_case",
    "benchmark_case_cost_usd": 4200,
    "boxes_per_case": 12,
    "packs_per_box": 20,
    "cards_per_pack": 4,
    "ship_all_cards_assumption": true,         // REQ-001 — drives visible note in UI
    "guaranteed_per_box": {
      "autos": 1,
      "rookies": 20,
      "base_refractors": 6,
      "numbered_parallels": 2
    }
  },

  // ─── Checklist totals (denominators for REQ-008 probabilities)
  "checklist_totals": {
    "base_veterans": 300,
    "rookies": 100,
    "base_auto_signers": 71,
    "rookie_auto_signers": 94
  },

  // ─── Card categories (REQ-008) — each references its denominator key in checklist_totals
  "card_categories": {
    "base":                { "slots_per_case": 720,   "denominator_key": "base_veterans" },
    "base_refractor":      { "slots_per_case": 72,    "denominator_key": "base_veterans" },
    "rookie":              { "slots_per_case": 240,   "denominator_key": "rookies" },
    "rookie_refractor":    { "slots_per_case": 80,    "denominator_key": "rookies" },
    "base_auto":           { "slots_per_case": 0.083, "denominator_key": "base_auto_signers" },
    "rookie_auto":         { "slots_per_case": 0.5,   "denominator_key": "rookie_auto_signers" },
    "gold_refractor_50":   { "slots_per_case": 0.2,   "denominator_key": "base_veterans" },
    "orange_refractor_25": { "slots_per_case": 0.1,   "denominator_key": "base_veterans" },
    "red_refractor_5":     { "slots_per_case": 0.02,  "denominator_key": "base_veterans" },
    "superfractor_1":      { "slots_per_case": 0.012, "denominator_key": "base_veterans" },
    "rpa_gold_50":         { "slots_per_case": 0.145, "denominator_key": "rookie_auto_signers" },
    "rpa_orange_25":       { "slots_per_case": 0.072, "denominator_key": "rookie_auto_signers" }
  },

  // ─── Tier value table (REQ-010) — per tier × per category USD
  "tier_values_usd": {
    "tier_1_chase":  { "base": 8,  "base_refractor": 25, "base_auto": 250, "rookie": 35, "rookie_refractor": 80, "rookie_auto": 600, "gold_refractor_50": 200, "rpa_gold_50": 2400, "superfractor_1": 30000 },
    "tier_2_strong": { "base": 4,  "base_refractor": 12, "base_auto": 80,  "rookie": 12, "rookie_refractor": 28, "rookie_auto": 150, "gold_refractor_50": 80,  "rpa_gold_50": 600,  "superfractor_1": 8000 },
    "tier_3_fair":   { "base": 2,  "base_refractor": 5,  "base_auto": 30,  "rookie": 5,  "rookie_refractor": 10, "rookie_auto": 60,  "gold_refractor_50": 30,  "rpa_gold_50": 250,  "superfractor_1": 3000 },
    "tier_4_cold":   { "base": 1,  "base_refractor": 2,  "base_auto": 12,  "rookie": 2,  "rookie_refractor": 4,  "rookie_auto": 25,  "gold_refractor_50": 12,  "rpa_gold_50": 100,  "superfractor_1": 1500 }
  },

  // ─── Teams — category-explicit eligibility lists (codex fix)
  "teams": {
    "New York Giants": {
      "base_veterans":        ["Malik Nabers", "Darius Slayton", "Wan'Dale Robinson", "Tyrone Tracy Jr.", "Russell Wilson", "Dexter Lawrence II", "Tyler Nubin", "Micah McFadden", "Theo Johnson", "Brian Burns"],
      "rookies":              ["Jaxson Dart", "Cam Skattebo", "Abdul Carter"],
      "base_auto_signers":    ["Malik Nabers", "Russell Wilson"],
      "rookie_auto_signers":  ["Jaxson Dart", "Cam Skattebo", "Abdul Carter"],
      "chase_players":        ["Jaxson Dart", "Malik Nabers"],
      "tiers": {
        "Jaxson Dart":       "tier_1_chase",
        "Malik Nabers":      "tier_1_chase",
        "Russell Wilson":    "tier_2_strong",
        "Cam Skattebo":      "tier_2_strong",
        "Abdul Carter":      "tier_2_strong",
        "Dexter Lawrence II":"tier_3_fair",
        "Darius Slayton":    "tier_3_fair",
        "Wan'Dale Robinson": "tier_3_fair",
        "Tyrone Tracy Jr.":  "tier_3_fair",
        "Tyler Nubin":       "tier_3_fair",
        "Micah McFadden":    "tier_3_fair",
        "Theo Johnson":      "tier_3_fair",
        "Brian Burns":       "tier_3_fair"
      }
    }
    // ... 31 more teams. Note: tiers[] contains tier assignments for every player
    // named in ANY of the category lists above.
  },

  // ─── Confidence inputs per tier-1 player × category (REQ-027, used by REQ-016)
  "confidence_inputs": {
    "Jaxson Dart": {
      "rookie_auto":  { "comp_count": 12, "comp_window_days": 14, "last_comp_refresh": "2026-04-13T18:00:00Z", "value_source": "ebay_sold" },
      "rpa_gold_50":  { "comp_count":  3, "comp_window_days": 30, "last_comp_refresh": "2026-04-10T12:00:00Z", "value_source": "ebay_sold" }
    },
    "Malik Nabers": {
      "base_auto":    { "comp_count":  8, "comp_window_days": 21, "last_comp_refresh": "2026-04-11T12:00:00Z", "value_source": "ebay_sold" }
    }
    // ... for every tier-1 chase player × relevant category
  }
}
```

**Why the v3 shape:**
- Per-team **category-explicit lists** let `eligiblePlayers(category, team)` return exactly the right set — veterans can't accidentally contribute rookie-auto value.
- `tiers[player] → label` is a flat lookup, not embedded per-player metadata. Simpler to validate.
- `ship_all_cards_assumption: true` drives the visible UI note required by REQ-001.
- All four timestamps are independent so stale-data warnings can target the specific category that aged out (REQ-022).
- `values_ready: false` triggers REQ-041 probability-only fallback (see §7).

### 5.2 TypeScript types (inferred from Zod schemas)

```ts
// Zod schemas live in src/schema.ts; inferred types below.
type TierLabel = 'tier_1_chase' | 'tier_2_strong' | 'tier_3_fair' | 'tier_4_cold';
type ConfidenceLabel = 'high' | 'medium' | 'low';
type OddsSource = '2024_placeholder' | '2025_official';
type Verdict = 'STEAL' | 'BELOW_MARKET' | 'NEAR_MARKET' | 'ABOVE_MARKET' | 'RIPPED';
type LaunchMode = 'full' | 'probability_only' | 'error';

interface Team {
  base_veterans: string[];
  rookies: string[];
  base_auto_signers: string[];
  rookie_auto_signers: string[];
  chase_players: string[];
  tiers: Record<string, TierLabel>;
}

interface ComputedResult {
  team: string;
  spotPrice: number;
  mode: LaunchMode;
  ev: number | null;           // null in probability_only mode
  median: number | null;
  p10: number | null;
  p90: number | null;
  pZero: number | null;        // REQ-014
  gap: number | null;
  gapPct: number | null;
  verdict: Verdict | null;
  verdictIsHard: boolean;      // REQ-015
  confidence: ConfidenceLabel; // REQ-016
  contributors: Array<{ player: string; tier: TierLabel; category: string; expectedValue: number }>;
  probabilityTable: Record<string, number>;
}
```

---

## 6. Math

### 6.1 Eligibility (new — this was the missing piece)

```ts
// src/math/eligibility.ts
const CATEGORY_ELIGIBILITY: Record<string, (t: Team) => string[]> = {
  base:                t => t.base_veterans,
  base_refractor:      t => t.base_veterans,
  rookie:              t => t.rookies,
  rookie_refractor:    t => t.rookies,
  base_auto:           t => t.base_auto_signers,
  rookie_auto:         t => t.rookie_auto_signers,
  gold_refractor_50:   t => [...t.base_veterans, ...t.rookies],    // numbered parallels cover both
  orange_refractor_25: t => [...t.base_veterans, ...t.rookies],
  red_refractor_5:     t => [...t.base_veterans, ...t.rookies],
  superfractor_1:      t => [...t.base_veterans, ...t.rookies],
  rpa_gold_50:         t => t.rookie_auto_signers,
  rpa_orange_25:       t => t.rookie_auto_signers,
};

export function eligiblePlayers(category: string, team: Team): string[] {
  return CATEGORY_ELIGIBILITY[category](team);
}
```

Both the closed-form EV and the Monte Carlo player-picker call `eligiblePlayers(c, T)`. They cannot diverge.

### 6.2 Probability of at-least-one (REQ-008)

```ts
// src/math/probability.ts
function pSlotForTeam(category: string, team: Team, data: AppData): number {
  const eligible = eligiblePlayers(category, team).length;
  const denomKey = data.card_categories[category].denominator_key;
  const denom = data.checklist_totals[denomKey];
  return eligible / denom;
}

export function probAtLeastOne(category: string, team: Team, data: AppData): number {
  const p = pSlotForTeam(category, team, data);
  const slots = data.card_categories[category].slots_per_case;

  if (slots >= 1) {
    // Binomial complement: P(>=1) = 1 - (1 - p)^slots
    return 1 - Math.pow(1 - p, slots);
  } else {
    // Fractional / rare — Poisson approximation: lambda = slots × p
    // Valid when slots × p is small (which it is for superfractors, etc.)
    const lambda = slots * p;
    return 1 - Math.exp(-lambda);
  }
}
```

### 6.3 Expected value (closed-form — REQ-010)

For each category `c` and each eligible player `p` on team `T`:

```
expectedCount(c, p) = slots_per_case(c) × (1 / eligiblePlayers(c, "all teams").length_total)
expectedValue(c, p) = expectedCount(c, p) × tier_values_usd[tiers[p]][c]
```

For v1 we **approximate** the denominator as `checklist_totals[denominator_key]` (e.g., 71 base auto signers), which matches how DJ's JSON is organized. Both the closed-form EV and the Monte Carlo picker use this same denominator, so they stay consistent.

Team EV:
```
teamEV(T) = Σ over all c, all p in eligiblePlayers(c, T): expectedValue(c, p)
```

**Closed-form EV is the authoritative mean.** The Monte Carlo simulation is used only for median, percentiles, and P($0) — not as a cross-check on EV beyond order-of-magnitude sanity.

### 6.4 Monte Carlo simulation (REQ-011, REQ-012, REQ-014)

Runs in a Web Worker so it doesn't block the main thread. Uses a seeded PRNG (`mulberry32`) so tests are deterministic.

```ts
// src/worker/simulate.worker.ts (conceptual)
function simulateBreak(team: Team, data: AppData, spotPrice: number, seed: number, trials = 10000) {
  const rng = mulberry32(seed);
  const outcomes: number[] = [];

  for (let trial = 0; trial < trials; trial++) {
    let teamValue = 0;
    for (const [category, cat] of Object.entries(data.card_categories)) {
      const eligible = eligiblePlayers(category, team);
      if (eligible.length === 0) continue;
      const p = eligible.length / data.checklist_totals[cat.denominator_key];
      const slots = cat.slots_per_case;

      // Integer slots → binomial-ish: iterate whole slots
      const wholeSlots = Math.floor(slots);
      for (let s = 0; s < wholeSlots; s++) {
        if (rng() < p) {
          const player = eligible[Math.floor(rng() * eligible.length)];
          teamValue += data.tier_values_usd[team.tiers[player]][category] ?? 0;
        }
      }
      // Fractional remainder
      const remainder = slots - wholeSlots;
      if (remainder > 0 && rng() < remainder * p) {
        const player = eligible[Math.floor(rng() * eligible.length)];
        teamValue += data.tier_values_usd[team.tiers[player]][category] ?? 0;
      }
    }
    outcomes.push(teamValue);
  }

  outcomes.sort((a, b) => a - b);
  const q = (x: number) => outcomes[Math.floor((outcomes.length - 1) * x)];
  const pZero = outcomes.filter(v => v < 0.10 * spotPrice).length / outcomes.length;

  return { median: q(0.5), p10: q(0.1), p90: q(0.9), pZero, mcMean: outcomes.reduce((a, b) => a + b) / outcomes.length };
}
```

**Test strategy (REQ-011/012/014):**
- Closed-form EV is the tested mean (deterministic, no MC).
- MC quantiles are tested with **loose confidence bands**, not fixed tolerances, because superfractor-class outcomes are heavy-tailed:
  - `median` within ±15% of closed-form median (computed analytically when possible) for teams without an RPA-eligible chase player
  - `p10` > 0 for every team (baseline cards always pull)
  - `p90` >= closed-form EV / 2 for chase-heavy teams
  - `pZero` monotonic decreasing in spot price (higher paid → lower bar → smaller pZero)
- All MC tests use a fixed seed so results are reproducible across runs.

**Performance:** ~100–250ms on mid-tier 2023 phones. Satisfies REQ-034 (p95 < 500ms). Cached per team.

**Supersession (not cancellation):** Main thread posts `{ requestId, team, data, spotPrice, seed }` to the worker. The worker replies with `{ requestId, result }`. Main thread only applies a result if `message.requestId === state.pendingRequestId`. An older in-flight run still consumes CPU but is never shown — this is the honest statement of the behavior (codex flagged v2's "cancellation" claim as incorrect).

### 6.5 Confidence (REQ-016 — rewritten to match the product spec exactly)

PRODUCT_SPEC REQ-016 defines confidence as a **four-condition** model aggregated across the team's chase players. v3 implements that literally:

```ts
// src/math/confidence.ts
const CONFIDENCE_CONDITIONS = [
  (pc: PlayerCategoryInputs) => pc.comp_count >= 3,
  (pc: PlayerCategoryInputs) => pc.comp_window_days <= 30,
  (_pc: PlayerCategoryInputs, data: AppData) => data.odds_source === '2025_official',
  (_pc: PlayerCategoryInputs, data: AppData) => daysSince(data.values_as_of) <= 14,
];

export function computeConfidence(data: AppData, teamName: string): ConfidenceLabel {
  const team = data.teams[teamName];
  if (!team || team.chase_players.length === 0) return 'low';

  // For each chase player × category with inputs, score against the 4 conditions.
  const scores: number[] = [];
  for (const player of team.chase_players) {
    const playerInputs = data.confidence_inputs?.[player];
    if (!playerInputs) { scores.push(0); continue; }
    for (const pc of Object.values(playerInputs)) {
      const passed = CONFIDENCE_CONDITIONS.filter(cond => cond(pc, data)).length;
      scores.push(passed);   // 0..4
    }
  }
  if (scores.length === 0) return 'low';

  // REQ-016: high when ALL 4 conditions hold; medium when at least 2 of 4 hold; else low.
  // Aggregate across all player/category records: team-level confidence is the MIN score.
  // (If any relevant chase record fails, we do not celebrate.)
  const minScore = Math.min(...scores);
  if (minScore === 4) return 'high';
  if (minScore >= 2)  return 'medium';
  return 'low';
}
```

The **aggregation rule** (min across chase records) is explicitly documented here because REQ-016 was silent on how to combine multiple chase players. The min rule is the most conservative interpretation: any single weak data point for a chase player drops the team to the lower label. This matches REQ-017's guidance that celebratory styling should be suppressed under low confidence.

### 6.6 Verdict (REQ-015, REQ-017 — inclusive boundaries)

```ts
// src/math/verdict.ts
export function computeVerdict(ev: number, spotPrice: number, confidence: ConfidenceLabel): {
  verdict: Verdict;
  isHard: boolean;
} {
  const gapPct = (ev - spotPrice) / spotPrice;

  // Hard verdict ONLY when gap is wide AND confidence is high (inclusive boundaries per REQ-015)
  if (confidence === 'high' && gapPct <= -0.25) return { verdict: 'RIPPED', isHard: true };
  if (confidence === 'high' && gapPct >=  0.25) return { verdict: 'STEAL',  isHard: true };

  // Soft verdicts (inclusive at the ±0.10 boundaries too, for consistency)
  if (gapPct <= -0.10) return { verdict: 'ABOVE_MARKET', isHard: false };
  if (gapPct >=  0.10) return { verdict: 'BELOW_MARKET', isHard: false };
  return { verdict: 'NEAR_MARKET', isHard: false };
}
```

When `confidence === 'low'`, the UI layer renders any `STEAL` / `BELOW_MARKET` with muted styling and the label `"Below Market (low confidence)"` (REQ-017).

### 6.7 Color mapping (REQ-017)

| Verdict + confidence | Color | Tailwind v4 class |
|---|---|---|
| `STEAL` (hard, high confidence) | bright green | `bg-green-500` |
| `BELOW_MARKET` (any confidence) | muted green-yellow | `bg-lime-500` |
| `NEAR_MARKET` | yellow | `bg-yellow-500` |
| `ABOVE_MARKET` | orange | `bg-orange-500` |
| `RIPPED` (hard, high confidence) | red | `bg-red-600` |
| Any verdict at low confidence | same color + `opacity-60` | muted styling per REQ-017 |

### 6.8 Design tokens

REQ-029 requires an exact dark-background hex for CI contrast testing. v3 locks in:

- `--bg-base:   #0b0d12` (near-black with a slight blue cast)
- `--bg-card:   #151821`
- `--bg-elev:   #1c2130`
- `--text-hi:   #f8fafc` (foreground 15.8:1 on `--bg-base` — passes WCAG AAA)
- `--text-mid:  #cbd5e1` (9.2:1 — passes AA large text and AA normal text)
- `--text-lo:   #94a3b8` (4.6:1 — passes AA normal text)
- `--accent:    #22c55e` (green for STEAL)
- `--danger:    #dc2626` (red for RIPPED)

All pairs verified against the WCAG 2.1 contrast formula using a conventional hex → relative luminance calculator; rechecked in CI via `@axe-core/playwright`.

---

## 7. Validation & fallback modes (REQ-028, REQ-041 — split)

v2's validation was "one strict pass, fail loudly on anything missing" which **blocked** the REQ-041 probability-only fallback. v3 splits validation into three buckets:

| Severity | Fields required | Purpose |
|---|---|---|
| `probabilityFatal` | teams (all 32 present), `base_veterans`/`rookies`/`base_auto_signers`/`rookie_auto_signers` lists per team, `card_categories`, `checklist_totals`, all 4 timestamps, `odds_source` | Must pass in BOTH launch modes |
| `valueFatal` | `tier_values_usd` filled for every (tier × category) cell used by the math, `tiers[]` map for every referenced player | Must pass in `full` mode only. Missing → `probability_only` mode |
| `warnings` | `confidence_inputs` present for every tier-1 chase player, comps within 30 days, etc. | Non-blocking; degrades confidence to `medium`/`low` but still ships |

`src/schema.ts` uses **two Zod schemas**: `CoreDataSchema` (probabilityFatal) and `FullDataSchema` (extends CoreDataSchema with valueFatal). `main.ts` tries `FullDataSchema.safeParse` first; on failure, falls back to `CoreDataSchema.safeParse` and sets `mode = 'probability_only'`. If *that* fails, `mode = 'error'` and a full-page error renders (REQ-028).

UI behavior per mode:

| `mode` | What's shown |
|---|---|
| `full` | Everything in §8 below |
| `probability_only` | Team grid + roster + probability table + prominent *"Dollar values coming soon — data not ready"* banner. EV / median / range / P($0) / verdict are hidden. |
| `error` | Full-page error: *"Data unavailable. DM @[DJ handle]"* |

---

## 8. UI structure

Single page, vertical scroll. Dark background `#0b0d12` from §6.8.

1. **Header band** — Logo + tagline: *"You're about to play a slot machine. Here's what it's actually paying out."*
2. **Product card** — "2025 Topps Chrome Football — Pick Your Team Hobby Case Break", benchmark case cost, **visible ship-all-cards assumption note** (REQ-001): *"This estimate assumes every card pulled for your team is shipped to you. Ask your breaker to confirm."*
3. **Team grid** — 32 NFL teams, tappable, active state. 360px-safe single column; 390px 2-column; 768px+ 3-column.
4. **Team detail panel** — Roster **broken down by category** (REQ-004): Base Veterans (N), Rookies (N), Base Auto Signers (N), Rookie Auto Signers (N), with chase players flagged.
5. **Spot price input** — Numeric, `$` prefix, 44×44 CSS pixel tap target (REQ-006, REQ-031).
6. **Results panel** (only when `spotPrice > 0` — per REQ-007) —
   - **Hero EV number** — largest on page, ≥1.5× next-largest (REQ-029)
   - **Subhero:** "Median: $X · 80% of cases: $Y–$Z"
   - **P($0) band:** *"Chance you get effectively nothing: X%"* (REQ-014)
   - **Verdict band:** color-coded, confidence-aware (REQ-015, REQ-017)
   - **Gap detail:** "You paid $480, EV is $310. Gap: +$170 / +55%"
   - **Probability table:** row per card category (REQ-008)
   - **Contributors:** top 5 players by EV share (REQ-018)
   - **Methodology expand:** "How this is calculated" (REQ-023)
7. **Disclaimer block** (always visible at bottom) —
   - Variance disclaimer (REQ-020)
   - Legal disclaimer (REQ-021)
   - Per-category freshness panel (REQ-022) with stale warning at 14+ days
8. **Footer** — Credits.

**Responsive breakpoints (REQ-030):** 360 / 390 / 768 px. Verified in `@axe-core/playwright` viewport tests.

**Accessibility (REQ-033):** WCAG 2.1 AA contrast via `@axe-core/playwright` in CI, plus local Lighthouse smoke. Focus states visible. Form inputs labeled. Color is not the only indicator — verdict also uses text and an icon.

**Above-fold (REQ-032):** On a 360×780 viewport, after submit, the EV hero + subhero + verdict band are all above the fold. Results-panel scroll begins below the verdict.

---

## 9. State management

```ts
type State = {
  data: AppData | null;
  mode: LaunchMode;
  selectedTeam: string | null;
  spotPrice: number | null;
  result: ComputedResult | null;
  cache: Map<string, MonteCarloResult>;     // team name → distribution
  pendingRequestId: number;                  // for worker supersession
};

const state: State = { data: null, mode: 'full', selectedTeam: null, spotPrice: null, result: null, cache: new Map(), pendingRequestId: 0 };
const subscribers: Array<(s: State) => void> = [];

export function setState(patch: Partial<State>) {
  Object.assign(state, patch);
  subscribers.forEach(fn => fn(state));
}
export function subscribe(fn: (s: State) => void) { subscribers.push(fn); }
export function getState() { return state; }

export function nextRequestId(): number {
  return ++state.pendingRequestId;
}
```

---

## 10. Implementation sequence

**Estimated total: 16–20 hours best case (codex flagged v2's 12–14 hour estimate as optimistic).** The budget excludes data cleanup iterations and live debugging on real devices.

1. **Project skeleton** (~45 min) — `npm create vite@latest`, install Tailwind v4 (`npm i tailwindcss @tailwindcss/vite`), add `@import "tailwindcss"` to `src/styles.css`, install Zod, set up `vite.config.ts` with worker support, push to GitHub, connect to Vercel/Netlify, verify "Hello RIPPED" deploy.
2. **Zod schemas + types** (~60 min) — `src/schema.ts`: `CoreDataSchema`, `FullDataSchema`. Infer types. Test parse against a hand-written fixture.
3. **Validation module** (~45 min) — `src/main.ts` logic to parse → determine mode → initialize state.
4. **Eligibility module** (~30 min) — `src/math/eligibility.ts` — the fix.
5. **Math: probability** (~45 min) — `src/math/probability.ts` with binomial + Poisson branches.
6. **Math: closed-form EV** (~45 min) — `src/math/ev.ts` using eligible players.
7. **Monte Carlo worker** (~90 min) — `src/worker/simulate.worker.ts` + `rng.ts`. Supersession via requestId.
8. **Math: confidence** (~45 min) — `src/math/confidence.ts` with four-condition scoring and min aggregation.
9. **Math: verdict** (~20 min) — `src/math/verdict.ts` with inclusive boundaries.
10. **Math tests** (~75 min) — `ev.test.ts`, `confidence.test.ts`. Cover: Giants (chase-heavy), Titans (rookie-auto-only), Jets (cold), confidence truth table, verdict thresholds including boundaries, MC quantile bands with seeded RNG.
11. **Real data ingest** (~variable, ~60–120 min) — Drop DJ's `data.json` into `/public/`. Cycle through Zod errors until it parses. Spot-check 3 teams.
12. **UI: team grid** (~60 min) — 360px-safe tappable grid.
13. **UI: team detail with category breakdown** (~45 min) — REQ-004 roster categories.
14. **UI: price input** (~20 min).
15. **UI: results panel** (~150 min) — The big one. Hero EV, range, P($0), verdict, gap, probability table, contributors. Confidence-aware mute styling.
16. **UI: methodology block** (~30 min) — REQ-023.
17. **UI: disclaimer block** (~30 min) — Variance, legal, per-category freshness.
18. **UI: probability-only fallback path** (~30 min) — Mode-dependent rendering (REQ-041).
19. **Responsive pass** (~90 min) — 360 / 390 / 768 px checks; Axe contrast pass; Lighthouse smoke.
20. **Hero copy + meta tags** (~20 min) — `index.html`, OG image.
21. **Cloudflare Web Analytics** (~15 min) — script tag, verify page-view tracking.
22. **Full smoke test** (~45 min) — All 32 teams, edge cases, stale-data rendering.
23. **Domain wiring** (~30 min) — Custom domain, DNS.
24. **Pre-launch checklist** (~30 min) — Match REQ-040 / REQ-043.

**Critical path:** Step 11 (real data ingest) gates step 15 onward. Steps 1–10 and 12–14 can run before data.

---

## 11. Edge cases

| Case | Behavior |
|---|---|
| User enters spot price ≤ $0 | Results panel stays hidden (REQ-007). No EV shown. Team detail panel still visible. |
| User enters > $100,000 | Cap input at $100,000, show helper text. |
| Team has 0 base autos (Tennessee) | Math unaffected — eligibility returns empty list for `base_auto`, contribution is 0. |
| Player missing from `tiers` map | `FullDataSchema` validation fails → fallback to `probability_only` mode (REQ-041). |
| `data.json` missing or malformed | `mode = 'error'`, full-page error (REQ-028). No silent fallback. |
| Any timestamp > 14 days old | Prominent stale-data warning (REQ-022). |
| `values_ready === false` | `mode = 'probability_only'` (REQ-041). |
| `odds_source === '2024_placeholder'` | Disclaimer text switches accordingly. |
| Tier-1 chase player missing `confidence_inputs` | `computeConfidence` scores 0 for that record → min-aggregation pulls team to `low`. |
| User re-taps a team mid-simulation | New `requestId` issued; older worker reply discarded silently. Superseded, not cancelled. |
| Mobile Safari old version | Vite transpiles; target `es2020`; avoid top-level await. |
| Web Worker unsupported | Fallback path: run MC synchronously on main thread and note in console. Degrades perf but still works. |

---

## 12. Open technical questions

- **TQ-001:** Team logos — skip for v1, use team names + color block.
- **TQ-002:** Share-result URL (`?team=Bills&paid=480`) — defer to v2.
- **TQ-003:** Vitest overkill? Keep it — the math is the entire product.
- **TQ-004:** Monte Carlo live vs. precomputed? Live in-worker — lets DJ update data without a rebuild.
- **TQ-005:** Who updates and pushes `data.json`? Ben pushes, DJ provides the file.
- **TQ-006:** Commercial-use of Vercel Hobby — is RIPPED "personal/non-commercial"? If DJ intends monetization, use Netlify or plan for Vercel Pro.
- **TQ-007:** Should the methodology block link out to a longer "how is this calculated" page in v2? Probably yes, but not for v1.

---

## 13. PRODUCT_SPEC v2 requirement traceability (all 43 REQs)

| REQ | Addressed in |
|---|---|
| REQ-001 (PYT, ship-all-cards visible note) | §5.1 `ship_all_cards_assumption`, §8 product card visible note |
| REQ-002 (benchmark cost + price input) | §5.1 `benchmark_case_cost_usd`, §8 |
| REQ-003 (32 teams, 360px safe) | §8, §5.1 teams |
| REQ-004 (roster category breakdown with tiers) | §5.1 category lists, §8 team detail panel |
| REQ-005 (chase callout) | §5.1 `chase_players`, §8 |
| REQ-006 (44px tap target price input) | §8 |
| REQ-007 (price required >0) | §11 edge case: panel hidden when ≤0 |
| REQ-008 (probability formulas) | §6.2 explicit with binomial + Poisson |
| REQ-009 (probabilities from JSON) | §6.2 + §5.1 |
| REQ-010 (closed-form EV using eligible players) | §6.3 |
| REQ-011 (median from MC) | §6.4 |
| REQ-012 (p10–p90 from MC) | §6.4 |
| REQ-013 (gap display) | §8 |
| REQ-014 (P($0) first-class) | §6.4 `pZero`, §8 |
| REQ-015 (soft-hybrid verdict, inclusive boundaries) | §6.6 |
| REQ-016 (4-condition confidence w/ min aggregation) | §6.5 |
| REQ-017 (mute low-confidence styling) | §6.7, §8 |
| REQ-018 (top-5 contributors) | §6.3 + §8 |
| REQ-019 (variance-driving callout) | §8 contributors with chase flag |
| REQ-020 (variance disclaimer) | §8 disclaimer |
| REQ-021 (not financial advice) | §8 disclaimer |
| REQ-022 (per-category freshness + 14-day warning) | §8 + §5.1 timestamps |
| REQ-023 (in-page methodology) | §8 methodology block |
| REQ-024 (static JSON) | §3, §5.1 |
| REQ-025 (four independent timestamps) | §5.1 |
| REQ-026 (odds_source enum) | §5.1, §7 validation |
| REQ-027 (confidence inputs per tier-1 × category) | §5.1 `confidence_inputs` |
| REQ-028 (fail loudly on missing) | §7 validation |
| REQ-029 (EV is largest, ≥1.5×, exact dark bg hex) | §6.8 `#0b0d12`, §8 |
| REQ-030 (360/390/768 responsive) | §8 + Axe smoke |
| REQ-031 (44px tap targets) | §8 |
| REQ-032 (EV above fold at 360×780) | §8 |
| REQ-033 (WCAG AA verified) | §6.8 tokens, §8 Axe pipeline |
| REQ-034 (p95 < 500ms) | §6.4 MC in worker |
| REQ-035 (no login) | §3 (no auth) |
| REQ-036 (aggregate analytics only) | §2 Cloudflare Web Analytics |
| REQ-037 (Vercel/Netlify free tier) | §2 w/ commercial caveat |
| REQ-038 (no backend) | §3 |
| REQ-039 (domain TBD) | §10 step 23, dep D-003 |
| REQ-040 (launch gate) | §7 + §10 step 24 |
| REQ-041 (probability-only fallback) | §7 split validation + §10 step 18 |
| REQ-042 (manual deploy) | §10 step 23 |
| REQ-043 (post-launch checklist) | §10 step 24 |

| Dep | Required for |
|---|---|
| D-001 (value table) | `mode = 'full'` launch |
| D-002 (tier assignments) | Any launch (probabilityFatal) |
| D-003 (domain) | Public launch |
| D-004 (PYT confirmation) | Build start |
| D-005 (odds_source) | Disclaimer copy |
| D-006 (confidence inputs) | High-confidence verdicts |

---

## 14. Deliberately not included

- OpenAPI / API contracts — no API
- Database schema — no database
- Auth / RBAC — no auth
- Service worker / offline mode — not in v1 (removed from v2 false claim)
- True cancellation of in-flight simulations — only supersession
- i18n (USD-only, English-only)
- Error-tracking (Sentry etc.) — v2 candidate
- Per-user telemetry beyond aggregate page views

---

*Generated via `/technical-spec` skill, updated v3 after `/codex-consult --upstream PRODUCT_SPEC.md` cross-model review. v3 resolves all 9 codex-flagged issues plus 5 suggestions. See revision notes at top.*
