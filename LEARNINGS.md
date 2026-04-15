# Session Learnings

> Persistent knowledge extracted from AI coding sessions.
> Captures decisions, context, action items, and insights that should survive between sessions.
> Add entries with `/capture-session` (full sweep) or `/capture-learning` (single item).

## Decisions

- **[2026-04-15]** Synthetic data bridge. `scripts/generate-synthetic-data.mjs` produces `public/data.json` with real rosters for 8 NFL teams (Giants, Titans, Jaguars, Jets, Raiders, Patriots, Bears, Browns) and placeholder rosters for the other 24. Chosen over blocking on DJ's real data so Phase 2/3 could ship mechanically-correct code while waiting on D-001/D-002. *(source: session decision after reviewing Phase 2 dependency graph)*
- **[2026-04-15]** Task 3.3.B is `NEEDS_REVIEW`, not `BLOCKED` or `FAILED`. Vercel preview URL is auth-protected (HTTP 401 on public fetch) so the public REQ-040 gate items can't run against the live URL. Local verification passes. Treating this as a 30-second launch-day toggle (disable preview protection / bypass token / D-003 domain) rather than a pre-launch failure. *(source: session decision after Codex 3.3.B returned NEEDS_REVIEW)*
- **[2026-04-15]** Desktop two-column layout at `lg:` (≥1024px) with sticky right column holding price input + result panel + disclosure. Applied in commit `fd2271b`. Rationale: single-column 768px layout wasted ~40% of 1280px desktop real estate and forced users to scroll past the full roster to see the result panel. Sticky right column keeps results in view while browsing teams on the left. *(source: UI/UX walkthrough audit)*
- **[2026-04-15]** `scrollIntoView` on result panel gated to `window.innerWidth < 1024`. Mobile still needs it (accessibility test `ev above fold 360x780` depends on it); desktop doesn't because the sticky right column already keeps it visible and unconditional scroll caused jumpy viewport on desktop. *(source: UI/UX polish commit `fd2271b`)*
- **[2026-04-15]** Cloudflare Web Analytics beacon is hostname-gated. Script only attaches on hosts that are not `localhost`, `127.0.0.1`, or `0.0.0.0`. Production behavior unchanged; dev console stays clean. The Task 3.2.B `grep` acceptance checks still pass because the literal strings `cloudflareinsights` and `defer` remain in `index.html`. *(source: UI/UX polish commit `fd2271b`)*
- **[2026-04-15]** Use Codex default model `gpt-5.4`, not `gpt-5.4-codex`. The `-codex` variant fails with `"model is not supported when using Codex with a ChatGPT account"` on Ben's account. Default model respected every spec constraint. *(source: first Codex invocation for UI/UX polish)*

## Action Items

- [ ] **[2026-04-15]** Ben: decide Vercel preview protection handling for 3.3.B — disable protection, add `VERCEL_AUTOMATION_BYPASS_SECRET` header, or wire D-003 custom domain. See `OVERNIGHT_REPORT.md` "Blocker" section for commands.
- [ ] **[2026-04-15]** Ben: replace `REPLACE_WITH_REAL_BEACON_ID` in `index.html` after creating the Cloudflare Analytics site.
- [ ] **[2026-04-15]** Ben: manual sanity check Giants/Titans/Jets EV numbers against X screenshots of PYT breaker pricing (MANUAL:DEFER from Task 3.3.A).
- [ ] **[2026-04-15]** Ben: real mid-tier phone smoke test (iPhone 13 / Pixel 7 class) with real data (MANUAL:DEFER from Task 3.3.C).
- [ ] **[2026-04-15]** Ben: open PR when ready — `gh pr create --base main --head phase-3-launch` (branch pushed to `origin` at commit `685c4b8`).
- [ ] **[2026-04-15]** Ben: decide whether to commit or delete `walkthrough-*.png` screenshots at repo root (currently uncommitted).
- [ ] **[2026-04-15]** DJ: deliver D-001 tier_values_usd dollar table (unblocks full-mode Phase 2). Fallback mode ships without it.
- [ ] **[2026-04-15]** DJ: deliver D-002 player tier assignments for every player in every team's category lists. Blocks any launch.
- [ ] **[2026-04-15]** DJ: verify D-005 odds source — 2025 official Topps or flag 2024 placeholder.
- [ ] **[2026-04-15]** DJ: deliver D-006 comp data (`comp_count`, `comp_window_days`, `last_comp_refresh`, `value_source`) per tier-1 chase player. Blocks high-confidence verdicts per REQ-016.

## Context

- **[2026-04-15]** Vercel preview URL for phase-3-launch is `https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app` and it returns HTTP 401 for anonymous fetches because the Vercel project has preview protection enabled. Don't waste time curling it — fix the auth first. *(source: Task 3.3.B Codex output)*
- **[2026-04-15]** `vercel deploy --yes` defaults to production target without the `--prod` flag on Ben's Vercel CLI (observed during Task 3.3.B). Use `vercel deploy --yes --target=preview` for preview-only launch-gate deploys. *(source: Codex output from 3.3.B)*
- **[2026-04-15]** Codex CLI version 0.120.0. Default model in `~/.codex/config.toml` is `gpt-5.4` with `model_reasoning_effort = "xhigh"`. Don't override with `--model gpt-5.4-codex` — not available on Ben's ChatGPT-backed Codex account.
- **[2026-04-15]** Ben's hosts: GitHub `github.com/benjaminshoemaker/ripped` (public), Vercel team `benshoemakerxyz-3472`.
- **[2026-04-15]** `.claude/phase-state.json` is gitignored. State updates live locally; don't try to `git add` it — use `git add -f` if you ever need to.
- **[2026-04-15]** REQ-008 forces the probability table to be visible at all times; it cannot be hidden behind a `<details>` on mobile even though that would shorten the scroll. Future UX audits should skip this idea. *(source: UI/UX audit, checked against `tests/results-detail.spec.ts`)*
- **[2026-04-15]** Codex `exec` can hang silently with 0% CPU if invoked via Bash `run_in_background`. Happened once during Task 3.1.A — process was alive but stalled for 32 minutes. Fix: kill the processes and retry synchronously (foreground Bash call). *(source: Phase 3 execution)*
- **[2026-04-15]** `executionMode` key in `.claude/settings.local.json` currently fails schema validation; persistence via `--codex` toggle is a no-op. Phase-start still works because the mode flag is passed at invocation time.

## Bugs & Issues

- **[2026-04-15]** Cloudflare Web Analytics beacon threw CORS errors on `localhost` dev (`Response to preflight request doesn't pass access control check`). **Status: FIXED** in commit `fd2271b` via inline `location.hostname` gate. *(source: Playwright walkthrough console messages)*
- **[2026-04-15]** Earlier in Phase 1: `ev.test.ts` Titans closed-form check failed because `computeEV`'s top-5 contributor filter dropped rookie_auto contributions before aggregation. **Status: FIXED** by exposing `allContributors` alongside the trimmed top-5 list and updating the test to sum `allContributors`. *(source: Phase 1 math module work)*
- **[2026-04-15]** `vite.config.ts` Vitest config was picking up `tests/fail-loud.spec.ts` (a Playwright spec) because both live under the repo. **Status: FIXED** by setting `test.include: ['src/**/*.test.ts']` and `test.exclude: ['tests/**']` in Vitest config.
- **[2026-04-15]** Typecheck errors on `node:fs` / `node:url` / `node:path` imports. **Status: FIXED** by adding `@types/node` and `"types": ["node", "vite/client"]` to `tsconfig.json`.

## Deferred Investigations

- **[2026-04-15]** Collapse the 14-row hit probability table behind a `<details>` on mobile to shorten the scroll. **Blocked by:** REQ-008 visibility requirement asserted by `tests/results-detail.spec.ts`. Would need a spec change to pursue.
- **[2026-04-15]** Team grid 2-column layout at exact 360px (iPhone SE). Current breakpoint is `min-[390px]:grid-cols-2`. Not worth adjusting pre-launch — most iPhones in the 2022+ era are ≥390px and tap targets at 360px remain ≥44px.
- **[2026-04-15]** Verdict band colour/typography tweak at desktop — the full-width lime pill can feel shouty in the narrower right column but is tied to fixed class strings tested by `tests/result-panel.spec.ts::verdict enum`. Defer until post-launch.
- **[2026-04-15]** Real-device mobile perf test on iPhone 13 / Pixel 7 class hardware. Flagged as `MANUAL:DEFER` in Task 3.3.C. CI synthetic p95 covers obvious regressions but not true mobile.
- **[2026-04-15]** Walkthrough PNG screenshots at repo root (`walkthrough-*.png`) — keep them in a `screenshots/` directory with a README, or add to `.gitignore`. Currently uncommitted.
