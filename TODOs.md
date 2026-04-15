# RIPPED — Project TODOs

Follow-up items and outstanding decisions tracked across the project.

## Pre-launch dependencies (from PRODUCT_SPEC §8)

- [x] **D-004** — Format confirmed: Pick Your Team (PYT) hobby case break. Ben reframed from "random team" to PYT during PRODUCT_SPEC v2 rewrite after cross-model review flagged the inconsistency (the tool's user flow — pick a team, enter a team-specific price — is semantically PYT, and the X screenshot DJ provided shows per-team PYT pricing). DJ implicitly accepted by letting v2 proceed through codex-consult + spec-verification without objection. Confirmed for Phase 1 execution.
- [ ] **D-001** — Dollar value table per card type per player tier (`tier_values_usd`). Blocks Phase 2 full-mode launch. REQ-041 fallback (probability-only mode) available if not delivered.
- [ ] **D-002** — Player tier assignments for every player referenced in any team's category lists. Blocks Phase 2 any launch (probability-only or full).
- [ ] **D-003** — Final domain name. Blocks Phase 3 public launch only.
- [ ] **D-005** — `odds_source` verified — 2025 official odds from Topps OR 2024 placeholder explicitly flagged.
- [ ] **D-006** — `comp_count`, `comp_window_days`, `last_comp_refresh`, `value_source` populated per tier-1 chase player. Blocks high-confidence verdicts (REQ-016).

## Phase 1 setup blockers (external services)

- [ ] **GitHub repo** — Create `benjaminshoemaker/ripped` as a public repo. Needed for Task 1.1.A acceptance criterion "Host webhook configured — `main` push triggers a deploy."
  - Command: `gh repo create ripped --public --source . --remote origin --push`
  - Or create manually via https://github.com/new and set the remote.
- [ ] **Hosting auth** — Vercel CLI is installed but not authenticated. Options:
  - `vercel login` (interactive — requires user action)
  - OR switch to **Netlify** (`netlify login`) / **Cloudflare Pages** (dashboard connect)
  - Given TECH_SPEC §2 note re Vercel Hobby being personal/non-commercial, **Cloudflare Pages is the safer free-tier choice if RIPPED is commercial**.

## Post-launch follow-ups

- [ ] Watch r/sportscards + X for feedback on launch week
- [ ] Freshness audit every 3 days (all 4 data timestamps)
- [ ] If launched in fallback mode: track DJ's progress toward full value table
- [ ] v2 candidates (from PRODUCT_SPEC §7): random team mode, repack calculator, breaker watchlist, share-result URLs
