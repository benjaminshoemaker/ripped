# Post-Launch Checklist (REQ-043)

Task: 3.3.B - Deploy + production launch gate  
Date: 2026-04-15  
Deployment URL: https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app  
Deployment target: Vercel preview  
Checklist status: NEEDS_REVIEW

The preview deployment is ready, but public access is blocked by Vercel protection (`401` on `/` and `/data.json`). The checklist below records both the deployed-url result and the localhost fallback result.

| REQ-043 item | Deployed URL Result | Local Fallback Result |
| --- | --- | --- |
| All 32 teams present | FAIL - preview `/data.json` blocked by HTTP 401 | PASS - 32 teams present and rendered |
| No missing tier assignments for tier-1 players | FAIL - preview `/data.json` blocked by HTTP 401 | PASS - smoke test verifies no missing tier assignments for any referenced player |
| `odds_source` matches visible disclaimer | FAIL - preview app blocked by Vercel login | PASS - `2024_placeholder` renders the placeholder odds disclaimer |
| Stale-data warning logic works for synthetic stale category | FAIL - preview app blocked by Vercel login before fixture can render | PASS - stale fixture renders the stale warning |
| Three known-team sanity cases produce plausible numbers | FAIL - preview `/data.json` blocked by HTTP 401 | PASS - Giants `$435.09`, Titans `$504.04`, Jets `$280.24`; all finite |

## Post-Launch Actions

- D-003 remains pending because no custom domain is configured.
- The current preview cannot be used as a public launch-gate URL until Vercel preview protection is bypassed or disabled.
- Once the public deployment URL is accessible, rerun: `PROD_URL=<public-url> npx playwright test tests/production-smoke.spec.ts`.
