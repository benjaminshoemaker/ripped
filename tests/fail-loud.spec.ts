import { test, expect } from '@playwright/test';
import { loadBrokenData } from './helpers/loadFixture';

test.describe('REQ-028 fail-loud (Task 1.2.B + Task 2.0.A)', () => {
  // SKIP: this test exercises the full bootstrap path which is wired up in
  // Task 2.2.A (state module + main.ts fetch). Until then, main.ts just sets
  // a static `data-testid="page-loaded"` marker without fetching /data.json,
  // so the broken-fixture path can't render a full-page error yet.
  //
  // When Task 2.2.A lands, replace .skip() with .describe() and the test
  // should run green: broken /data.json → [data-testid="full-page-error"]
  // visible AND no team grid.
  test.skip('broken /data.json renders full-page error and no team grid', async ({ page }) => {
    await loadBrokenData(page);
    await page.goto('/');

    await expect(page.locator('[data-testid="full-page-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-grid"]')).toHaveCount(0);
  });
});
