import { expect, test, type Page } from '@playwright/test';

async function selectGiants(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('button[data-team="New York Giants"]').click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();
}

test.describe('price input (Task 2.2.D)', () => {
  test('input attributes', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('[data-testid="spot-price"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('min', '0');
    await expect(page.locator('[data-testid="spot-price-container"]')).toContainText('$');
  });

  test('tap target 44px', async ({ page }) => {
    await page.goto('/');

    const size = await page.locator('[data-testid="spot-price-container"]').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
      };
    });

    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  });

  test('results hidden on zero', async ({ page }) => {
    await selectGiants(page);

    const resultPanel = page.locator('[data-testid="result-panel"]');
    const input = page.locator('[data-testid="spot-price"]');

    await expect(resultPanel).toHaveAttribute('hidden', '');

    await input.fill('0');
    await expect(resultPanel).toHaveAttribute('hidden', '');

    await input.fill('100');
    await expect(resultPanel).not.toHaveAttribute('hidden', '');

    await input.fill('');
    await expect(resultPanel).toHaveAttribute('hidden', '');
  });
});
