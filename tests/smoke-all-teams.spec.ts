import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullData } from '../src/types';
import { loadFixture } from './helpers/loadFixture';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'public', 'data.json'), 'utf-8'),
) as FullData;
const TEAM_NAMES = Object.keys(data.teams);
const TITANS = 'Tennessee Titans';
const GIANTS = 'New York Giants';

function isBenignConsoleError(text: string, url: string): boolean {
  const combined = `${text} ${url}`.toLowerCase();
  return (
    combined.includes('favicon') ||
    combined.includes('[vite]') ||
    combined.includes('vite') ||
    combined.includes('hmr')
  );
}

async function captureConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

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

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const location = message.location();
    const text = message.text();
    if (isBenignConsoleError(text, location.url)) return;

    errors.push(location.url ? `${text} (${location.url})` : text);
  });

  return errors;
}

function parseUsd(text: string): number {
  const match = text.match(/-?\$[\d,]+(?:\.\d+)?/gu);
  if (!match) return Number.NaN;

  const value = match[match.length - 1]!.replace(/[$,]/gu, '');
  return Number.parseFloat(value);
}

async function expectNoConsoleErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([]);
}

async function selectTeam(page: Page, teamName: string): Promise<void> {
  await page.getByRole('button', { name: teamName, exact: true }).click();

  const detail = page.locator('[data-testid="team-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-team', teamName);
  await expect(page.locator('[data-testid="full-page-error"]')).toHaveCount(0);
}

async function enterSpotPrice(page: Page, price: string): Promise<void> {
  await page.locator('[data-testid="spot-price"]').fill(price);
}

async function expectTeamResult(page: Page, teamName: string): Promise<void> {
  const resultPanel = page.locator('[data-testid="result-panel"]');
  await expect(resultPanel).toBeVisible();
  await expect(resultPanel).toContainText(`${teamName} result`, { timeout: 15_000 });
}

async function visiblePlayers(page: Page, sectionTestId: string): Promise<string[]> {
  const section = page.locator(`[data-testid="${sectionTestId}"]`);
  if ((await section.count()) === 0) return [];

  return section.locator('[data-player]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-player'))
      .filter((player): player is string => player !== null),
  );
}

test.describe('full smoke test (Task 3.3.A)', () => {
  test.setTimeout(60_000);

  test('all 32 selectable', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await page.goto('/');

    const grid = page.locator('[data-testid="team-grid"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator('button')).toHaveCount(32);
    expect(TEAM_NAMES).toHaveLength(32);

    for (const teamName of TEAM_NAMES) {
      await selectTeam(page, teamName);
      await expect(
        page.getByRole('button', { name: teamName, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
    }

    await expectNoConsoleErrors(consoleErrors);
  });

  test('ev finite per team', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await page.goto('/');
    expect(TEAM_NAMES).toHaveLength(32);

    for (const [index, teamName] of TEAM_NAMES.entries()) {
      await selectTeam(page, teamName);
      if (index === 0) {
        await enterSpotPrice(page, '100');
      }
      await expectTeamResult(page, teamName);

      const fallbackBanner = page.locator('[data-testid="fallback-banner"]');
      if (await fallbackBanner.isVisible()) {
        await expect(page.locator('[data-testid="ev-hero"]')).toBeHidden();
        continue;
      }

      const evText = await page.locator('[data-testid="ev-hero"]').innerText();
      const ev = parseUsd(evText);
      expect(Number.isFinite(ev), `${teamName} rendered EV: ${evText}`).toBe(true);
    }

    await expectNoConsoleErrors(consoleErrors);
  });

  test('tennessee rookie dominated', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await page.goto('/');
    await selectTeam(page, TITANS);
    await enterSpotPrice(page, '100');
    await expectTeamResult(page, TITANS);

    const baseAutoSigners = await visiblePlayers(page, 'roster-base-auto-signers');
    const rookieAutoSigners = await visiblePlayers(page, 'roster-rookie-auto-signers');
    expect(baseAutoSigners).toHaveLength(0);
    expect(rookieAutoSigners.length).toBeGreaterThan(0);

    const contributorRows = await page
      .locator('[data-testid="contributor-row"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          player: element.getAttribute('data-player') ?? '',
          text: element.textContent ?? '',
        })),
      );
    expect(contributorRows.length).toBeGreaterThan(0);

    const baseAutoContribution = contributorRows
      .filter((row) => baseAutoSigners.includes(row.player))
      .reduce((sum, row) => sum + parseUsd(row.text), 0);
    const rookieAutoContribution = contributorRows
      .filter((row) => rookieAutoSigners.includes(row.player))
      .reduce((sum, row) => sum + parseUsd(row.text), 0);

    expect(baseAutoContribution).toBe(0);
    expect(rookieAutoContribution).toBeGreaterThan(baseAutoContribution);
    await expectNoConsoleErrors(consoleErrors);
  });

  test('stale warning', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await loadFixture(page, 'stale-timestamps.json');
    await page.goto('/');

    await expect(page.locator('[data-testid="stale-warning"]')).toBeVisible();
    await expectNoConsoleErrors(consoleErrors);
  });

  test('fallback banner', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await loadFixture(page, 'core-only-fallback.json');
    await page.goto('/');
    await selectTeam(page, GIANTS);
    await enterSpotPrice(page, '100');

    await expect(page.locator('[data-testid="fallback-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="ev-hero"]')).toBeHidden();
    await expectNoConsoleErrors(consoleErrors);
  });

  test('broken fixture error', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await loadFixture(page, 'broken.json');
    await page.goto('/');

    await expect(page.locator('[data-testid="full-page-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-grid"]')).toHaveCount(0);
    await expectNoConsoleErrors(consoleErrors);
  });
});
