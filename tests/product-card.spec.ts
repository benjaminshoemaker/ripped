import { expect, test, type Page } from '@playwright/test';
import type { FullData } from '../src/types';

async function openProductCard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-testid="product-card"]')).toBeVisible();
}

async function loadData(page: Page): Promise<FullData> {
  return page.evaluate(async () => {
    const response = await fetch('/data.json');
    if (!response.ok) throw new Error('Failed to load /data.json');
    return (await response.json()) as FullData;
  });
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

test.describe('product card (Task 2.2.E)', () => {
  test('hero tagline contains slot machine', async ({ page }) => {
    await openProductCard(page);

    await expect(page.locator('[data-testid="hero-tagline"]')).toContainText(
      'slot machine',
    );
  });

  test('product name label contains product and format', async ({ page }) => {
    await openProductCard(page);

    const data = await loadData(page);
    const label = page.locator('[data-testid="product-name-label"]');

    await expect(label).toContainText(data.product.name);
    await expect(label).toContainText('Pick Your Team');
  });

  test('benchmark label contains Benchmark', async ({ page }) => {
    await openProductCard(page);

    await expect(page.locator('[data-testid="benchmark-case-cost"]')).toContainText(
      'Benchmark',
    );
  });

  test('ship all cards note is visible and contains assumes', async ({ page }) => {
    await openProductCard(page);

    const note = page.locator('[data-testid="ship-all-cards-note"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('assumes');
  });

  test('benchmark cost from data', async ({ page }) => {
    await openProductCard(page);

    const data = await loadData(page);
    await expect(page.locator('[data-testid="benchmark-case-cost"]')).toContainText(
      formatUsd(data.product.benchmark_case_cost_usd),
    );
  });
});
