# RIPPED — Product Specification

**Status:** Draft v2 (updated after cross-model review)
**Date:** 2026-04-14
**Target launch:** Wednesday 2026-04-15
**Source documents:** `initial_dev_brief.md`, `dj_initial_conversation.md`, `INITIAL_FINDINGS.md`, `chrome football 2025 break odds.json`, `2025_Chrome_Football_Checklist_040826.pdf`
**Revision notes:** v2 replaces v1's "random team" framing with "Pick Your Team (PYT)" to match the actual user flow; replaces "auto-swap" with manual JSON deploy; adds explicit probability formulas, confidence definition, measurable UX criteria, stronger variance disclosure, launch gate, and ship-all-cards assumption. See `PRODUCT_SPEC.md.bak.*` for v1.

---

## 1. Summary

RIPPED is a single-page, mobile-first web tool that calculates the expected value of a **team spot in a 2025 Topps Chrome Football Pick Your Team (PYT) hobby case break** and compares it against what the buyer paid. Output is an EV number, a median outcome, a 10th–90th percentile range, the probability of $0 (no meaningful hit), and a soft-hybrid verdict that escalates to "You Got Ripped!" only when (a) the gap is wide and (b) comp confidence is formally high (defined in §5.4). No login. No backend. Static JSON maintained manually by DJ. Hosted on Vercel/Netlify free tier. The product launches with either the already-published 2025 Topps odds or a clearly disclaimed 2024 placeholder, depending on what DJ delivers Tuesday.

**Format note:** v1 of this spec said "random team case break." Cross-model review flagged that the tool's flow — select a team, enter a team-specific price, compare — is semantically Pick Your Team, not random team. The X screenshot DJ provided (per-team prices ranging $40–$2,100 across 6 breakers) is PYT data. v2 aligns the framing. Random-team mode is deferred to post-MVP.

---

## 2. Problem

Live card break buyers on Whatnot, Fanatics Live, eBay Live, and Loupe pay per-team spot prices ranging from roughly $40 to $2,100+ with no objective, buyer-facing way to compare what they paid against expected value. Breakers control both pricing and live stream framing; buyers decide in seconds. *Breaks and Takes* (substack) has reported Whatnot break spot prices **averaging ~40% above comparable breakcomp benchmarks** based on a tracked sample — this is a reported figure, not a universally verified market-wide average. As of March 2026, Whatnot is the subject of private arbitration filings (Paul Lesko / Lesko Law, 30 plaintiffs) **alleging** that randomized box breaks and repack breaks operate as illegal lotteries under California law; Whatnot denies the characterization. Last month a buyer literally posted on r/sportscards asking *"Was it a fair deal?"* and got 40 strangers manually arguing comps (https://www.reddit.com/r/sportscards/comments/1rrhbqi/whatnot_purchase_overpay/). **We found no mainstream buyer-facing EV checker targeted at live break spot pricing.** RIPPED fills that gap.

---

## 3. Target user

**Primary user:** A mid-budget sports card buyer (skewing 25–45, male, $50–$500 typical spot range) watching a live PYT hobby case break on Whatnot or Fanatics Live, deciding in 60–90 seconds whether to claim a team spot. Phone in hand. Has heard horror stories about being ripped off. Won't take time to cross-check 130point or eBay sold listings mid-stream. Not technical, won't read a methodology page.

**Secondary (post-MVP):** Hobby influencers and the more ethical breakers themselves, who can use the tool to validate their own pricing or call out competitors.

---

## 4. Core user experience

Single page, mobile-first, dark theme. No account. No save state.

**Core user stories (Given / When / Then):**

- **US-001 — Happy path:** *Given* I am watching a PYT hobby case break and see a Giants spot priced at $480, *when* I open RIPPED, tap Giants, and enter 480, *then* I see EV, median, range, P($0), a color-coded verdict, and the gap between $480 and EV, in under 5 seconds.
- **US-002 — High-confidence verdict:** *Given* I entered a team spot $100+ above EV, *when* the data has high confidence (see §5.4), *then* the verdict says "You Got Ripped!" in red.
- **US-003 — Low-confidence verdict:** *Given* the same gap but low confidence, *when* I see the result, *then* the verdict is softer ("Above Market") and a confidence indicator is visible.
- **US-004 — Stale data warning:** *Given* the data in the file is more than 14 days old for any category, *when* I view a result, *then* a stale-data warning is prominent near the EV number.
- **US-005 — Reset:** *Given* I've seen a result, *when* I want to check another team, *then* a single tap clears the spot price and takes me back to team selection with my previous team unselected.

Page flow (top to bottom):

1. **Land.** Hero copy frames the tool in plain language: *"You're about to play a slot machine. Here's what it's actually paying out."* Single CTA: "Check a spot."
2. **Product card.** Locked to "2025 Topps Chrome Football — Pick Your Team Hobby Case Break" for v1. Show benchmark case cost, 12 boxes, 32 NFL teams.
3. **Team grid.** 32 NFL teams as tappable cards. Active state on selection.
4. **Team detail panel.** Roster preview: base count, rookie count, auto signer list, chase players called out.
5. **Spot price input.** Numeric input. User types what they paid (or are about to pay).
6. **Results panel.** Hero EV number; subhero median + 10–90 range; P($0); color-coded verdict band (with confidence indicator); gap explicit ($paid vs $EV); probability table per card category; top-5 contributor players; inline "How this is calculated" expandable block.
7. **Disclaimer block (always visible at bottom).** Variance disclaimer + "not financial advice" + "not affiliated with Topps, NFL, Whatnot, Fanatics Live, or any breaker" + per-category freshness timestamps.
8. **Footer.** Credits.

No login, no account, no save state, no email gate, no individual-level analytics.

---

## 5. MVP feature requirements

### 5.1 Product context

- **REQ-001:** The tool covers exactly one product/format combination at launch: **2025 Topps Chrome Football, single hobby case (12 boxes), Pick Your Team (PYT) format (32 NFL teams).** Ship-all-cards assumption applies: every card pulled for the user's selected team is assumed to be sent to them. A visible assumption note makes this explicit.
- **REQ-002:** The tool displays a **benchmark case cost** (field: `benchmark_case_cost_usd`, loaded from JSON) and accepts the per-team spot price the user enters. The label reads "Benchmark case cost" — not "the" case cost — to avoid implying a universal market price.

### 5.2 Team selection

- **REQ-003:** Display all 32 NFL teams as tappable options. Layout works on a 360px viewport without horizontal scroll.
- **REQ-004:** When a team is selected, show the team's player roster from the official 2025 Topps Chrome Football checklist, broken down into: base veterans, rookies, base auto signers, rookie auto signers. Each player shown with their tier assignment.
- **REQ-005:** Highlight the team's chase player(s) — defined as any player assigned `tier_1_chase` in the data — with a visual callout (e.g. Cam Ward for Titans, Jaxson Dart for Giants, Travis Hunter for Jaguars, Ashton Jeanty for Raiders, TreVeyon Henderson for Patriots).

### 5.3 Spot price input

- **REQ-006:** Numeric input field for *"What did you pay?"*. Accepts USD dollar amounts. No currency conversion. Minimum tap target: 44×44 CSS pixels.
- **REQ-007:** Spot price is required (>0) before the results panel displays anything.

### 5.4 Probability output

- **REQ-008:** For the selected team, calculate and display the **probability of pulling at least one card** from each category below. Each probability is computed as `1 - (1 - p)^n` where `p` is the per-slot probability that a slot for this category lands on the selected team, and `n` is the number of slots in a hobby case (12 boxes) for that category. The per-slot probability for each category is defined in §5.9 (Data contract).
  - Any **base veteran** card for this team (slots: `12 × packs_per_box × (base_slots_per_pack − rookie_slots_per_pack − refractor_slots_per_pack − parallel_slots_per_pack)`; `p` = `team.base_count / 300`)
  - Any **rookie** card for this team (slots: 12 × 20 = 240 rookie card slots per case; `p` = `team.rookie_count / 100`)
  - Any **base refractor** for this team (slots per case = `12 × 6`; `p` = `team.base_count / 300`)
  - Any **base auto** for this team (slots per case = 12 × odds of hitting a base auto; `p` = `team.base_auto_signers / 71`)
  - Any **rookie auto** for this team (slots per case = 12 × odds of hitting a rookie auto; `p` = `team.rookie_auto_signers / 94`)
  - Any **numbered parallel** for this team (gold /50, orange /25, red /5, superfractor 1/1 — computed per parallel, then combined via inclusion–exclusion or the simpler `1 − Π(1 − p_i)` approximation)
  - Any **chase card** for this team (any card where the assigned player is `tier_1_chase`)
- **REQ-009:** Probabilities are computed entirely from the static JSON DJ maintains. The JSON contains per-team checklist counts, category odds, and player tier assignments. Source of odds (2024 placeholder vs 2025 official) is explicit in the file and displayed in the UI.

### 5.5 Value output

- **REQ-010:** Calculate and display **expected value** for the selected team spot, in USD. EV is the sum over card categories and players on the team of `expected_count(category, player) × tier_value(player_tier, category)`, where `tier_value` comes from the JSON's `tier_values_usd` table.
- **REQ-011:** Calculate and display **median outcome** — the 50th percentile of a Monte Carlo simulation (10,000 trials) of a single-case break filtered to the selected team.
- **REQ-012:** Calculate and display the **10th–90th percentile range** from the same Monte Carlo simulation, framed as *"80% of cases return between $X and $Y."*
- **REQ-013:** Display the gap explicitly: spot price the user paid vs. the calculated EV, with both dollar delta and percentage delta.
- **REQ-014:** Calculate and display **P($0 or near-zero return)** — the fraction of Monte Carlo trials where the simulated team outcome is less than 10% of the spot price the user paid. Framed as *"Chance you get effectively nothing: X%."*

### 5.6 Verdict

- **REQ-015:** Display a verdict using a soft-hybrid logic:
  - **Hard verdict** (`You Got Ripped!` / `Steal!`) ONLY when both: (a) `|gap / spot_price| >= 0.25` AND (b) confidence is `high`.
  - **Soft verdict** (`Above Market` / `Near Market` / `Below Market`) in all other cases.
- **REQ-016:** **Confidence** is a formal, machine-verifiable label derived from the data file. Confidence is `high` when all of the following hold for the selected team:
  - `comp_count >= 3` (at least 3 recent sold comps for the team's tier-1 player in the relevant card category)
  - `comp_window_days <= 30` (most recent comps within 30 days)
  - `odds_source == "2025_official"` (not the 2024 placeholder)
  - `values_as_of` is within the last 14 days
  
  Confidence is `medium` when at least two of the four conditions hold. Otherwise `low`. The UI always shows the confidence label alongside the verdict.
- **REQ-017:** Color-coded verdict mapping: green = `STEAL` / `BELOW_MARKET`, yellow = `NEAR_MARKET`, orange = `ABOVE_MARKET`, red = `RIPPED`. When confidence is `low`, celebratory styling (e.g. `STEAL`) is suppressed and replaced with a muted "Below Market (low confidence)" label.

### 5.7 Player tier breakdown

- **REQ-018:** Show which players on the selected team contribute most to the EV, as a ranked top-5 list with each player's tier and their per-player expected value contribution.
- **REQ-019:** Note any players whose hit would dramatically swing the outcome (e.g. *"Travis Hunter RPA is the chase — most of the upside, most of the variance."*).

### 5.8 Disclosure (variance + legal + freshness)

- **REQ-020:** Permanent visible variance disclaimer near the EV number: *"Single-break outcomes are dominated by variance. Your spot can return $0 or several times the EV. See 'Chance you get effectively nothing' above."*
- **REQ-021:** Permanent visible legal disclaimer in the disclosure block at the bottom: *"Not financial advice. RIPPED is not affiliated with Topps, the NFL, Whatnot, Fanatics Live, or any breaker. Estimates only."*
- **REQ-022:** Permanent visible data-freshness disclosure that shows each data category's age independently: checklist, odds, values, and comps (see §5.9 for timestamp fields). When any category is more than 14 days old, a stale-data warning is prominent near the EV number.
- **REQ-023:** An expandable *"How this is calculated"* inline block links the EV output to the formulas, data sources, and confidence explanation. No separate methodology page; this is in-page.

### 5.9 Data contract (product-level — technical schema is in TECHNICAL_SPEC.md)

- **REQ-024:** All data loads from a single static JSON file that DJ maintains manually. The file contains product metadata, 32 team entries, card-category odds, tier value table, and per-player tier assignments. The technical spec defines the exact schema.
- **REQ-025:** The JSON must include these separate top-level timestamps, each independently consumable by the disclaimer block: `checklist_as_of`, `odds_as_of`, `values_as_of`, `comps_as_of`. An optional `data_as_of` build timestamp is for debugging only and NOT displayed.
- **REQ-026:** The JSON must include an explicit `odds_source` string with values `"2024_placeholder"` or `"2025_official"`. The user-facing disclaimer text is conditional on this string.
- **REQ-027:** The JSON must include confidence inputs per tier-1 player and category: `comp_count`, `comp_window_days`, `last_comp_refresh`, `value_source`. REQ-016 reads from these fields.
- **REQ-028:** Missing data fails loudly: a JSON that lacks required fields for a team, player, or category shows a full-page error — never a silently-wrong EV.

### 5.10 Aesthetic & UX (measurable)

- **REQ-029:** Dark background (hex specified in TECHNICAL_SPEC). The EV dollar number is the single largest visual element on the page (font-size ≥ 1.5× the next-largest text).
- **REQ-030:** Mobile-first responsive design with verified support at 360px, 390px, and 768px viewports. No horizontal scroll on any of these widths.
- **REQ-031:** All tappable elements have a minimum 44×44 CSS pixel tap target.
- **REQ-032:** EV result is visible above the fold on a 360×780 viewport after the user submits a price.
- **REQ-033:** All text meets WCAG 2.1 AA contrast ratios (verifiable via Lighthouse or Axe).
- **REQ-034:** EV + variance calculation completes in under 500ms p95 on a mid-tier 2023 mobile device (iPhone 13 / Pixel 7 class) from the moment the user submits a price.
- **REQ-035:** No login, no account, no email gate, no paywall, no interstitial.
- **REQ-036:** No analytics that identify individual users. Aggregate page-view analytics (Plausible, Vercel Analytics, Cloudflare Analytics) are acceptable.

### 5.11 Hosting & deploy

- **REQ-037:** Hosted on Vercel or Netlify free tier.
- **REQ-038:** No server-side compute. No backend. No live API calls. No scraping at request time.
- **REQ-039:** Domain TBD — DJ to provide before launch.

### 5.12 Launch posture

- **REQ-040:** **Launch gate.** Before public launch, all of the following must be green:
  - Every one of the 32 NFL teams has `base_count`, `rookie_count`, `base_auto_signers`, `rookie_auto_signers`, and at least one tier assignment.
  - `tier_values_usd` is non-empty for every (tier × card category) cell used by the math.
  - `odds_source` is set and the UI renders the matching disclaimer copy.
  - Three known-team sanity checks pass (Giants, Titans, Jets — one premium, one premium-rookie-only, one cold).
  - Variance disclaimer, legal disclaimer, and freshness timestamps all render.
- **REQ-041:** **Fallback launch mode.** If the value table (D-001) is incomplete at launch time, the tool can ship in **probability-only mode**: show probability outputs, hide dollar EV / median / range / P($0), and prominently display *"Dollar values coming soon — data not ready."* This is a degraded but honest launch path.
- **REQ-042:** **Manual deploy only.** When 2025 odds are verified loaded, DJ commits a new `data.json`, Ben pushes to main, Vercel redeploys in ~30 seconds. No auto-swap, no background task, no cron.
- **REQ-043:** **Post-launch validation checklist** (executed immediately after each deploy): all 32 teams present, no missing tier assignments for tier-1 players, `odds_source` matches the visible disclaimer, stale-data warning logic works for a synthetic stale category, 3 known-team sanity cases produce plausible numbers.

---

## 6. Data model (product-level summary)

The authoritative JSON schema lives in TECHNICAL_SPEC.md §5. At the product level, the file contains:

- Product metadata (benchmark case cost, box count, format = `"pyt_hobby_case"`, packs/cards/slots)
- 32 team entries (base count, rookie count, auto signer counts, player list with tier assignments, chase flag)
- Card category odds (2024 placeholder or 2025 official)
- Tier value table (dollar value per tier per card category; low / median / high)
- Confidence inputs per tier-1 player (comp_count, comp_window_days, last_comp_refresh, value_source)
- Four independent timestamps: `checklist_as_of`, `odds_as_of`, `values_as_of`, `comps_as_of`
- `odds_source` enum

---

## 7. Out of scope (post-MVP)

These are explicitly NOT in v1:

- Other products (Bowman Chrome, Panini Donruss, Optic, Prizm, etc.)
- Other formats: random team case break, hit draft, divisional, mixer, single-box, jumbo box
- Hits-only break mode (where base cards are NOT shipped to buyers)
- Other sports (basketball, baseball, hockey, soccer, MMA)
- Repack EV calculator (highest-validated v2 target — see INITIAL_FINDINGS.md)
- Curated breaker watchlist (Trusted / Watch / Avoid — strong v2 target)
- Cross-platform price comparison (BREAKCOMP-style)
- Real-time comps scraping (130point, eBay Marketplace Insights)
- User accounts, saved spots, history, share-result links
- Affiliate or referral revenue
- Native mobile app
- Separate methodology page (replaced by in-page REQ-023 block)
- Multi-team or multi-spot batch input
- Non-USD currency support

---

## 8. Critical dependencies on DJ

The MVP cannot ship without these. The launch gate (REQ-040) makes failure explicit.

- **D-001:** Dollar value table per card type per player tier (`tier_values_usd`). **Blocks:** normal launch. **Fallback:** REQ-041 probability-only mode.
- **D-002:** Player tier assignments for all 32 teams' players (base veterans + rookies + auto signers). **Blocks:** normal launch.
- **D-003:** Final domain name. **Blocks:** public launch only.
- **D-004:** Confirmed break format (v2 aligns on PYT per cross-model review; DJ confirms).
- **D-005:** `odds_source` verified — either 2025 official odds pulled from Topps' published PDF or 2024 placeholder explicitly flagged. **Blocks:** nothing — both states are handled.
- **D-006:** `comps_as_of`, `comp_count`, `comp_window_days`, and `value_source` fields populated for at least every tier-1 chase player. **Blocks:** high-confidence verdicts (REQ-016).

---

## 9. Open questions (not blocking v1)

- **Q-001:** Should we include a "share my result" URL (`?team=Bills&paid=480`)? Drives virality but adds scope. Recommendation: defer to v2.
- **Q-002:** Should the page name the breaker the user bought from, or stay platform-neutral? Recommendation: platform-neutral for v1 to avoid legal/press risk.
- **Q-003:** If the 2025 odds PDF (already live per cross-model research) is verified before Tuesday EOD, we launch with 2025 directly — no placeholder needed. Who verifies the file and when?

---

## 10. Requirements Index

| ID      | Requirement                                                         | Section         |
|---------|---------------------------------------------------------------------|-----------------|
| REQ-001 | PYT hobby case break, 2025 Chrome Football, ship-all-cards          | Product context |
| REQ-002 | Benchmark case cost + spot price input                              | Product context |
| REQ-003 | 32 tappable NFL teams, 360px viewport safe                          | Team selection  |
| REQ-004 | Roster breakdown from official checklist with tier labels           | Team selection  |
| REQ-005 | Tier-1 chase player visual callout                                  | Team selection  |
| REQ-006 | Numeric spot-price input, 44px tap target                           | Spot price input|
| REQ-007 | Price required before results                                       | Spot price input|
| REQ-008 | Probability of ≥1 hit per category with explicit formulas           | Probability     |
| REQ-009 | Probabilities from JSON only                                        | Probability     |
| REQ-010 | EV in USD from closed-form tier × category math                     | Value output    |
| REQ-011 | Median outcome from 10k-trial Monte Carlo                           | Value output    |
| REQ-012 | 10–90 percentile range from the same MC                             | Value output    |
| REQ-013 | Explicit dollar + percent gap (paid vs EV)                          | Value output    |
| REQ-014 | P($0 or near-zero) as first-class output                            | Value output    |
| REQ-015 | Soft-hybrid verdict (hard only at |gap|≥25% AND high confidence)    | Verdict         |
| REQ-016 | Formal confidence definition with 4 data-driven criteria            | Verdict         |
| REQ-017 | Color mapping; mute celebratory styling under low confidence        | Verdict         |
| REQ-018 | Top-5 contributor players ranked by EV share                        | Tier breakdown  |
| REQ-019 | Chase-player variance callout                                        | Tier breakdown  |
| REQ-020 | Variance disclaimer near EV                                         | Disclosure      |
| REQ-021 | "Not financial advice / not affiliated" legal disclaimer            | Disclosure      |
| REQ-022 | Per-category freshness disclosures + stale-data warning at 14 days  | Disclosure      |
| REQ-023 | In-page "How this is calculated" expandable block                   | Disclosure      |
| REQ-024 | Static JSON data source                                             | Data contract   |
| REQ-025 | Four independent data-category timestamps                           | Data contract   |
| REQ-026 | Explicit `odds_source` with `"2024_placeholder"` or `"2025_official"`| Data contract  |
| REQ-027 | Confidence input fields per tier-1 player/category                  | Data contract   |
| REQ-028 | Missing data fails loudly, never silently wrong                     | Data contract   |
| REQ-029 | EV is the largest element (≥1.5× next-largest)                      | Aesthetic       |
| REQ-030 | Verified responsive at 360 / 390 / 768 px                           | Aesthetic       |
| REQ-031 | 44×44 CSS pixel minimum tap targets                                 | Aesthetic       |
| REQ-032 | EV above the fold at 360×780 after submit                           | Aesthetic       |
| REQ-033 | WCAG 2.1 AA contrast                                                | Aesthetic       |
| REQ-034 | Calculation p95 < 500ms on mid-tier 2023 phone                      | Aesthetic       |
| REQ-035 | No login / account / paywall / email gate                           | Aesthetic       |
| REQ-036 | Aggregate analytics only                                            | Aesthetic       |
| REQ-037 | Vercel/Netlify free tier                                            | Hosting         |
| REQ-038 | No backend / no server compute / no scraping                        | Hosting         |
| REQ-039 | Domain TBD                                                          | Hosting         |
| REQ-040 | Launch gate: 32 teams, tier values, odds_source, sanity checks      | Launch posture  |
| REQ-041 | Probability-only fallback launch mode                               | Launch posture  |
| REQ-042 | Manual deploy only (no auto-swap)                                   | Launch posture  |
| REQ-043 | Post-launch validation checklist                                    | Launch posture  |

| Dep ID  | Dependency                                                        | Blocks                     |
|---------|-------------------------------------------------------------------|----------------------------|
| D-001   | Tier × category dollar value table                                | Normal launch (not fallback)|
| D-002   | Player tier assignments                                           | Normal launch               |
| D-003   | Final domain name                                                 | Public launch               |
| D-004   | Verbal confirmation of PYT format choice                          | Build start                 |
| D-005   | `odds_source` verified                                            | Disclaimer text             |
| D-006   | Confidence input fields for tier-1 players                        | High-confidence verdicts    |

---

*Generated via `/product-spec` skill on 2026-04-14, updated v2 after `/codex-consult` cross-model review on 2026-04-14. All REQ changes traced in the revision notes at the top.*
