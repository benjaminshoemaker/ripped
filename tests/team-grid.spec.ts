import { test, expect } from '@playwright/test';

test.describe('team grid (Task 2.2.B)', () => {
  test('renders 32 teams', async ({ page }) => {
    await page.goto('/');

    const grid = page.locator('[data-testid="team-grid"]');
    await expect(grid).toBeVisible();

    const buttons = grid.locator('button');
    await expect(buttons).toHaveCount(32);

    const buttonDetails = await buttons.evaluateAll((elements) =>
      elements.map((element) => ({
        team: element.getAttribute('data-team'),
        text: element.textContent?.trim() ?? '',
        type: (element as HTMLButtonElement).type,
      })),
    );

    for (const button of buttonDetails) {
      expect(button.team).toBeTruthy();
      expect(button.text).toBe(button.team);
      expect(button.type).toBe('button');
    }
  });

  test('aria pressed on click', async ({ page }) => {
    await page.goto('/');

    const grid = page.locator('[data-testid="team-grid"]');
    await expect(grid).toBeVisible();

    const buttons = grid.locator('button');
    await expect(buttons).toHaveCount(32);

    const first = buttons.nth(0);
    const second = buttons.nth(1);

    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(grid.locator('button[aria-pressed="true"]')).toHaveCount(1);

    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(grid.locator('button[aria-pressed="true"]')).toHaveCount(1);
  });

  test('no horizontal scroll 360', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');

    await expect(page.locator('[data-testid="team-grid"]')).toBeVisible();

    const metrics = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      windowInnerWidth: window.innerWidth,
    }));

    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.windowInnerWidth);
  });

  test('tap target 44px', async ({ page }) => {
    await page.goto('/');

    const grid = page.locator('[data-testid="team-grid"]');
    await expect(grid).toBeVisible();

    const buttons = grid.locator('button');
    await expect(buttons).toHaveCount(32);

    const buttonSizes = await buttons.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
        };
      }),
    );

    for (const size of buttonSizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }
  });
});
