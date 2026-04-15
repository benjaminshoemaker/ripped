# Launch Gate (REQ-040)

Task: 3.3.B - Deploy + production launch gate  
Date: 2026-04-15  
Deployment URL: https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app  
Deployment status: READY on Vercel target `preview`, but BLOCKED for unauthenticated public gate checks  
Gate fallback URL: http://localhost:5173  
Overall status: NEEDS_REVIEW

## Deployment Notes

- `vercel deploy --yes` completed, but Vercel reported that first deployment as target `production` even though `--prod` was not used. The returned deployment URL was `https://ripped-r0eol251g-benshoemakerxyz-3472s-projects.vercel.app`.
- `vercel deploy --yes --target=preview` was run immediately after to force a preview-only deployment. `vercel inspect` reports target `preview`, status `Ready`, id `dpl_Eb344Zz7DP2Gc7KQrk8b5UBUSCoL`.
- Public HTTP checks against the preview URL return `401` with Vercel SSO/protection, including both `/` and `/data.json`.
- Because the preview is protected, the REQ-040 gate could not be completed against the deployed URL without a Vercel protection bypass token or disabling preview protection.
- The same gate was run against localhost fallback and passed across desktop and mobile Playwright projects.

## Network Gate

| Check | Deployed URL Result | Local Fallback Result |
| --- | --- | --- |
| `/` returns HTTP 200 | FAIL - `curl -sfI` returned HTTP 401 | PASS - Playwright smoke loaded `/` |
| `/data.json` returns HTTP 200 | FAIL - `curl -sfI` returned HTTP 401 | PASS - Playwright smoke loaded `/data.json` |

## REQ-040 Checklist

| REQ-040 item | Deployed URL Result | Local Fallback Result |
| --- | --- | --- |
| 32 NFL teams present on `/data.json` | FAIL - blocked by HTTP 401 | PASS - 32 teams in `public/data.json` and 32 team buttons render |
| Every tier referenced in tier assignments exists in `tier_values_usd` | FAIL - blocked by HTTP 401 | PASS - no missing referenced tiers or used tier/category value cells |
| Every player named in category lists has a tier assignment | FAIL - blocked by HTTP 401 | PASS - no missing tier assignments across base, rookie, auto, and chase lists |
| Giants / Titans / Jets produce finite, plausible EVs | FAIL - blocked by HTTP 401 | PASS - Giants `$435.09`, Titans `$504.04`, Jets `$280.24`; all finite and plausible |
| Disclaimer copy matches the production `odds_source` | FAIL - blocked by HTTP 401 | PASS - `odds_source` is `2024_placeholder`, matching visible placeholder odds copy |
| Variance disclaimer, legal disclaimer, freshness panel all render | FAIL - blocked by HTTP 401 | PASS - variance copy, not-financial-advice legal copy, and 4 freshness rows render |
| Stale-data warning logic works on the stale fixture | FAIL - blocked by HTTP 401 before app load | PASS - stale fixture renders `Stale data warning` |

## Verification Commands

| Command | Result |
| --- | --- |
| `vercel deploy --yes` | PASS with caveat - created a target `production` deployment without `--prod` |
| `vercel deploy --yes --target=preview` | PASS - returned preview URL above |
| `vercel inspect ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app` | PASS - target `preview`, status `Ready` |
| `curl -sfI https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app/` | FAIL - HTTP 401 |
| `curl -sfI https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app/data.json` | FAIL - HTTP 401 |
| `PROD_URL=https://ripped-6zzhroc6s-benshoemakerxyz-3472s-projects.vercel.app npx playwright test tests/production-smoke.spec.ts` | FAIL - 16/16 failed because preview redirects to Vercel login / HTTP 401 |
| `npx playwright test tests/production-smoke.spec.ts` | PASS - 16/16 passed against localhost fallback |

## Follow-Up Required

- Keep D-003 open: no custom domain was configured.
- For a true deployed-url launch gate, disable Vercel preview protection or provide the Vercel protection bypass token/header for Playwright and curl.
