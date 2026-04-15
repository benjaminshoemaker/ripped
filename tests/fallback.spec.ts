import { expect, test, type Page } from '@playwright/test';
import { loadFixture } from './helpers/loadFixture';

const GIANTS = 'New York Giants';

async function submitGiantsFallbackPrice(page: Page): Promise<void> {
  await loadFixture(page, 'core-only-fallback.json');
  await page.goto('/');
  await page.locator(`button[data-team="${GIANTS}"]`).click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();

  await page.locator('[data-testid="spot-price"]').fill('500');
  await expect(page.locator('[data-testid="fallback-banner"]')).toBeVisible();
}

test.describe('probability-only fallback rendering (Task 2.4.A)', () => {
  test('ev hidden fallback visible', async ({ page }) => {
    await submitGiantsFallbackPrice(page);

    await expect(page.locator('[data-testid="ev-hero"]')).toBeHidden();
    await expect(page.locator('[data-testid="fallback-banner"]')).toContainText(
      'Dollar values coming soon — data not ready',
    );
  });

  test('probability rows in fallback', async ({ page }) => {
    await submitGiantsFallbackPrice(page);

    const rows = page.locator('[data-testid="prob-row"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
