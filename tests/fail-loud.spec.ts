import { test, expect } from '@playwright/test';
import { loadBrokenData } from './helpers/loadFixture';

test.describe('REQ-028 fail-loud (Task 1.2.B + Task 2.0.A)', () => {
  test('broken /data.json renders full-page error and no team grid', async ({ page }) => {
    await loadBrokenData(page);
    await page.goto('/');

    await expect(page.locator('[data-testid="full-page-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-grid"]')).toHaveCount(0);
  });
});
