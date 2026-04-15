import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { computeEV } from '../src/math/ev';
import { eligiblePlayers } from '../src/math/eligibility';
import type { FullData, OddsSource } from '../src/types';
import { loadFixture } from './helpers/loadFixture';

const TARGET_BASE_URL = process.env.PROD_URL?.trim() || 'http://localhost:5173';

test.use({ baseURL: TARGET_BASE_URL });

const ODDS_SOURCE_COPY: Record<OddsSource, string> = {
  '2024_placeholder': 'Odds use the 2024 placeholder until the 2025 official pack odds are loaded.',
  '2025_official': 'Odds use the 2025 official pack odds loaded in the data file.',
};

const PLAYER_LIST_KEYS = [
  'base_veterans',
  'rookies',
  'base_auto_signers',
  'rookie_auto_signers',
  'chase_players',
] as const;

async function fetchProductionData(request: APIRequestContext): Promise<FullData> {
  const response = await request.get('/data.json');
  expect(response.status(), `/data.json status at ${TARGET_BASE_URL}`).toBe(200);
  return (await response.json()) as FullData;
}

async function stubAnalytics(page: Page): Promise<void> {
  await page.route('https://static.cloudflareinsights.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    });
  });
  await page.route('https://cloudflareinsights.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

async function openApp(page: Page): Promise<void> {
  await stubAnalytics(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="page-loaded"]')).toBeVisible();
}

function parseUsd(text: string): number {
  const match = text.match(/-?\$[\d,]+(?:\.\d+)?/gu);
  if (!match) return Number.NaN;

  const value = match[match.length - 1]!.replace(/[$,]/gu, '');
  return Number.parseFloat(value);
}

async function selectTeam(page: Page, teamName: string): Promise<void> {
  await page.getByRole('button', { name: teamName, exact: true }).click();

  const detail = page.locator('[data-testid="team-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-team', teamName);
}

test.describe('production launch gate (REQ-040)', () => {
  test('production root and data json return 200', async ({ request, page }) => {
    const root = await request.get('/');
    expect(root.status(), `/ status at ${TARGET_BASE_URL}`).toBe(200);

    const data = await request.get('/data.json');
    expect(data.status(), `/data.json status at ${TARGET_BASE_URL}`).toBe(200);

    await openApp(page);
  });

  test('32 teams production', async ({ request, page }) => {
    const data = await fetchProductionData(request);
    const teamNames = Object.keys(data.teams);
    expect(teamNames).toHaveLength(32);

    await openApp(page);
    const grid = page.locator('[data-testid="team-grid"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator('button')).toHaveCount(32);

    for (const teamName of teamNames) {
      await expect(page.getByRole('button', { name: teamName, exact: true })).toBeVisible();
    }
  });

  test('tier completeness', async ({ request }) => {
    const data = await fetchProductionData(request);
    const tierValues = data.tier_values_usd as Record<string, Record<string, unknown>>;
    const missing: string[] = [];

    for (const [teamName, team] of Object.entries(data.teams)) {
      for (const [player, tier] of Object.entries(team.tiers)) {
        if (!tierValues[tier]) {
          missing.push(`${teamName}/${player} references missing tier ${tier}`);
        }
      }

      for (const category of Object.keys(data.card_categories)) {
        for (const player of eligiblePlayers(category, team)) {
          const tier = team.tiers[player];
          const value = tier ? tierValues[tier]?.[category] : undefined;

          if (typeof value !== 'number' || !Number.isFinite(value)) {
            missing.push(`${teamName}/${player} missing ${tier ?? 'unassigned'} value for ${category}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('tier assignments complete', async ({ request }) => {
    const data = await fetchProductionData(request);
    const missing: string[] = [];

    for (const [teamName, team] of Object.entries(data.teams)) {
      for (const key of PLAYER_LIST_KEYS) {
        for (const player of team[key]) {
          if (!team.tiers[player]) {
            missing.push(`${teamName}/${key}/${player}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('disclaimer matches source', async ({ request, page }) => {
    const data = await fetchProductionData(request);
    await openApp(page);

    const disclaimer = page.locator('[data-testid="disclaimer"]');
    await expect(disclaimer).toContainText(ODDS_SOURCE_COPY[data.odds_source]);
  });

  test('launch disclosures and freshness render', async ({ page }) => {
    await openApp(page);

    const disclaimer = page.locator('[data-testid="disclaimer"]');
    await expect(disclaimer).toContainText('Single-break outcomes are dominated by variance');
    await expect(disclaimer).toContainText('Not financial advice');
    await expect(disclaimer).toContainText('not affiliated');
    await expect(page.locator('[data-testid="freshness"] [data-category]')).toHaveCount(4);
  });

  test('stale-data warning logic works on the stale fixture', async ({ page }) => {
    await stubAnalytics(page);
    await loadFixture(page, 'stale-timestamps.json');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="page-loaded"]')).toBeVisible();
    await expect(page.locator('[data-testid="stale-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="stale-warning"]')).toContainText('Stale data warning');
  });

  test('three team sanity', async ({ request, page }) => {
    const data = await fetchProductionData(request);
    const giants = data.teams['New York Giants']!;
    const titans = data.teams['Tennessee Titans']!;
    const jets = data.teams['New York Jets']!;

    const giantsEV = computeEV(giants, data).ev;
    const titansResult = computeEV(titans, data);
    const jetsEV = computeEV(jets, data).ev;
    const titansBaseAuto = titansResult.allContributors
      .filter((contributor) => contributor.category === 'base_auto')
      .reduce((sum, contributor) => sum + contributor.expectedValue, 0);
    const titansRookieAuto = titansResult.allContributors
      .filter((contributor) => contributor.category === 'rookie_auto')
      .reduce((sum, contributor) => sum + contributor.expectedValue, 0);

    expect(Number.isFinite(giantsEV)).toBe(true);
    expect(giantsEV).toBeGreaterThan(50);
    expect(giantsEV).toBeLessThan(5000);
    expect(Number.isFinite(jetsEV)).toBe(true);
    expect(jetsEV).toBeGreaterThanOrEqual(0);
    expect(jetsEV).toBeLessThan(giantsEV);
    expect(titansBaseAuto).toBe(0);
    expect(titansRookieAuto).toBeGreaterThan(0);

    await openApp(page);
    await page.locator('[data-testid="spot-price"]').fill('100');

    for (const teamName of ['New York Giants', 'Tennessee Titans', 'New York Jets']) {
      await selectTeam(page, teamName);
      const resultPanel = page.locator('[data-testid="result-panel"]');
      await expect(resultPanel).toContainText(`${teamName} result`, { timeout: 15_000 });

      const evText = await page.locator('[data-testid="ev-hero"]').innerText();
      expect(Number.isFinite(parseUsd(evText)), `${teamName} rendered EV: ${evText}`).toBe(true);
    }
  });
});
