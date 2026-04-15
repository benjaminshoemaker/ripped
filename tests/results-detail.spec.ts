import { expect, test, type Page } from '@playwright/test';
import type { FullData } from '../src/types';
import { loadFixture } from './helpers/loadFixture';

const GIANTS = 'New York Giants';

async function submitGiantsPrice(page: Page, price: string = '500'): Promise<void> {
  await page.goto('/');
  await page.locator(`button[data-team="${GIANTS}"]`).click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();

  await page.locator('[data-testid="spot-price"]').fill(price);
  await expect(page.locator('[data-testid="ev-hero"]')).toBeVisible();
}

async function loadData(page: Page): Promise<FullData> {
  return page.evaluate(async () => {
    const response = await fetch('/data.json');
    if (!response.ok) throw new Error('Failed to load /data.json');
    return (await response.json()) as FullData;
  });
}

test.describe('results detail panel (Task 2.3.B)', () => {
  test('probability rows include aggregates', async ({ page }) => {
    await submitGiantsPrice(page);

    const data = await loadData(page);
    const rows = page.locator('[data-testid="prob-row"]');

    await expect(rows).toHaveCount(Object.keys(data.card_categories).length + 2);
    await expect(
      page.locator('[data-testid="prob-row"][data-category="any_numbered_parallel"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="prob-row"][data-category="any_chase_card"]'),
    ).toBeVisible();
  });

  test('max 5 contributors', async ({ page }) => {
    await submitGiantsPrice(page);

    const contributorCount = await page.locator('[data-testid="contributor-row"]').count();

    expect(contributorCount).toBeGreaterThan(0);
    expect(contributorCount).toBeLessThanOrEqual(5);
  });

  test('variance callout present', async ({ page }) => {
    await submitGiantsPrice(page);

    const callout = page.locator('[data-testid="variance-callout"]');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText('Jaxson Dart');
  });

  test('methodology closed details', async ({ page }) => {
    await submitGiantsPrice(page);

    const methodology = page.locator('[data-testid="methodology"]');
    await expect(methodology).toBeVisible();

    const tagName = await methodology.evaluate((element) => element.tagName.toLowerCase());
    expect(tagName).toBe('details');
    expect(await methodology.getAttribute('open')).toBeNull();
  });

  test('disclaimer text', async ({ page }) => {
    await page.goto('/');

    const disclaimer = page.locator('[data-testid="disclaimer"]');
    await expect(disclaimer).toContainText('variance');
    await expect(disclaimer).toContainText('Not financial advice');
    await expect(disclaimer).toContainText('not affiliated');
  });

  test('four freshness timestamps', async ({ page }) => {
    await page.goto('/');

    const categories = await page
      .locator('[data-testid="freshness"] [data-category]')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute('data-category'))
          .filter((category): category is string => category !== null)
          .sort(),
      );

    expect(categories).toEqual(['checklist', 'comps', 'odds', 'values']);
  });

  test('stale warning renders', async ({ page }) => {
    await loadFixture(page, 'stale-timestamps.json');
    await page.goto('/');

    await expect(page.locator('[data-testid="stale-warning"]')).toBeVisible();
  });
});
