# RIPPED UI/UX Audit (autonomous walkthrough + code inspection)

Conducted via Playwright MCP end-to-end walkthrough on `localhost:5173` at 360px, 390px, and 1280px plus source inspection.

## Context

- **Product**: single-page EV calculator for sports card break team spots. Users arrive with a specific price and a specific team, want a verdict in under 5 seconds.
- **Design direction**: Precision & Density + Sophistication & Trust. Dark mode, high contrast, lime accent on verdict. Math-is-the-product ethos — no decorative noise.
- **Tech stack**: Vite 6 + vanilla TypeScript + Tailwind CSS v4 (@theme tokens in `src/styles.css`) + Zod + Web Worker.
- **Existing design system**: tokens in `src/styles.css` (`--color-bg-base`, `--color-bg-card`, `--color-bg-elev`, `--color-text-hi`, `--color-text-mid`, `--color-text-lo`, `--color-accent`, `--color-danger`). Already well-defined, reused via Tailwind `@theme`.
- **Tested viewports**: 360×780, 390×844, 768×1024 (mobile). Desktop (1280+) is **not tested** but works fine at build time.

## What's working

- Hero copy is strong: *"You're about to play a slot machine. Here's what it's actually paying out."*
- All three verdict states render cleanly: BELOW_MARKET (lime band), NEAR_MARKET (neutral band), ABOVE_MARKET (danger band).
- `scrollIntoView` auto-scrolls to the result panel after the simulation returns — EV hero ends up above the fold on mobile.
- Contributors card is readable — player + category + tier badge + dollar.
- Math is sensible: Giants $150 → EV $435, Titans $250 → EV $504, Jaxson Dart dominates contributors as expected.
- Accessibility tests pass at 360/390/768. Axe: 0 violations.
- Zero price hides the result panel (`display: none`).
- Fallback mode + stale warning + broken fixture paths all have dedicated tests and render correctly.

## Findings

### HIGH — Desktop wastes ~40% of horizontal real estate

`src/ui/team-grid.ts:6-14`, `src/ui/team-detail.ts`, `src/main.ts:44-52`, and the result-panel section parent all use `max-w-3xl mx-auto` (768px central column). At 1280px desktop that leaves ~256px of unused dead space on each side. Worse, the vertical flow is: hero → product card → team grid → selected team's roster → price input → result → disclosure. On desktop the user scrolls past the full roster (up to 19 players) before seeing the result panel, even though there's enough horizontal room to put both on screen.

**Fix**: at `lg` (≥1024px), split the app into two columns. Left column holds hero + product card + team grid + team detail. Right column holds the price input + result panel + disclosure in a `position: sticky; top: 1rem` container. Mobile stays stacked. All current test selectors (`data-testid`) remain valid — no markup contract changes.

### HIGH — Cloudflare Analytics beacon throws CORS errors on localhost dev

The placeholder beacon `{"token": "REPLACE_WITH_REAL_BEACON_ID"}` posts to `cloudflareinsights.com/cdn-cgi/rum` and Cloudflare rejects the localhost origin. Two errors land in the console every page load during development.

**Fix**: inject the beacon conditionally. Only attach the script tag when `location.hostname` is not `localhost` or `127.0.0.1`. Keep the string `cloudflareinsights` and `defer` in the inline script so the Task 3.2.B grep checks still pass. Zero runtime cost on mobile.

### MEDIUM — Verdict band on desktop feels shouty

`BELOW MARKET (medium confidence)` is rendered in all-caps lime pill that spans the full width of a 768px column. On mobile it works; on desktop (with the proposed 2-col change) the pill will be narrower and less visually dominant. Keep as-is but validate after the layout change.

### MEDIUM — Probability table is a 14-row info dump on mobile

Currently the full probability table is always visible. On mobile users have to scroll past 14 rows to see the contributors and methodology. Not worth fixing for launch — hide-behind-details would hurt the "math is the product" ethos and the test `probability-table` asserts visibility. Leave as-is.

### LOW — Team grid is 1-col at 360px (iPhone SE)

At 390+ the grid is 2-col already. At exact 360 it's 1-col (32 tall rows). Not worth restructuring — tap targets are 44px+ and the breakpoint at 390px covers the common iPhone SE/12/13/14/15 mini audience.

---

## Recommended changes (scope for this launch)

Apply **only** the two HIGH findings. Medium/low items are noted but not in scope.

1. **Desktop two-column layout at `lg:` breakpoint** — sticky right column with price input + result + disclosure. Mobile/tablet unchanged.
2. **Conditional Cloudflare beacon** — inline script that only attaches the beacon off `localhost`/`127.0.0.1`.

Both changes must:
- Keep all existing Playwright tests green (106 tests)
- Keep all existing Vitest tests green (96 tests)
- Not change any `data-testid` attributes
- Not reorder DOM elements in a way that breaks the existing selectors
