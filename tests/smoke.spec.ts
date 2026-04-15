import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('page loads and renders [data-testid="page-loaded"] marker', async ({ page }) => {
    await page.goto('/');
    const loaded = page.locator('[data-testid="page-loaded"]');
    await expect(loaded).toBeVisible();
  });

  test('no console errors on initial page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    // Use domcontentloaded — `networkidle` never fires in dev because Vite HMR
    // holds a persistent websocket and we spawn a Web Worker.
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="page-loaded"]')).toBeVisible();
    // Filter out known benign errors (favicon 404, HMR connection messages, etc.)
    const significant = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource') &&
        !e.includes('vite') &&
        !e.includes('hmr'),
    );
    expect(significant).toEqual([]);
  });
});
