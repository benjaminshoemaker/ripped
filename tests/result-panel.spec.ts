import { expect, test, type Page } from '@playwright/test';
import { loadFixture } from './helpers/loadFixture';

const GIANTS = 'New York Giants';
const VALID_VERDICTS = [
  'STEAL',
  'BELOW_MARKET',
  'NEAR_MARKET',
  'ABOVE_MARKET',
  'RIPPED',
];

async function submitGiantsPrice(page: Page, price: string = '500'): Promise<void> {
  await page.goto('/');
  await page.locator(`button[data-team="${GIANTS}"]`).click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();

  await page.locator('[data-testid="spot-price"]').fill(price);
  await expect(page.locator('[data-testid="ev-hero"]')).toBeVisible();
}

test.describe('result panel (Task 2.3.A)', () => {
  test('ev hero 1.5x subhero', async ({ page }) => {
    await submitGiantsPrice(page);

    const sizes = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('[data-testid="ev-hero"]');
      const subhero = document.querySelector<HTMLElement>('[data-testid="subhero"]');
      if (!hero || !subhero) throw new Error('Missing result typography nodes');

      return {
        hero: Number.parseFloat(getComputedStyle(hero).fontSize),
        subhero: Number.parseFloat(getComputedStyle(subhero).fontSize),
      };
    });

    expect(sizes.hero).toBeGreaterThanOrEqual(sizes.subhero * 1.5);
  });

  test('p zero text', async ({ page }) => {
    await submitGiantsPrice(page);

    await expect(page.locator('[data-testid="p-zero"]')).toContainText(
      'effectively nothing',
    );
  });

  test('verdict enum', async ({ page }) => {
    await submitGiantsPrice(page);

    const verdict = await page
      .locator('[data-testid="verdict-band"]')
      .getAttribute('data-verdict');

    expect(VALID_VERDICTS).toContain(verdict);
  });

  test('low confidence muted', async ({ page }) => {
    await loadFixture(page, 'no-confidence-inputs.json');
    await submitGiantsPrice(page);

    const resultPanel = page.locator('[data-testid="result-panel"]');
    await expect(resultPanel).toHaveAttribute('data-confidence', 'low');
    await expect(resultPanel).toHaveClass(/(?:^|\s)opacity-60(?:\s|$)/);
  });

  test('ev above fold 360x780', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await submitGiantsPrice(page);

    const heroBottom = await page
      .locator('[data-testid="ev-hero"]')
      .evaluate((element) => element.getBoundingClientRect().bottom);

    expect(heroBottom).toBeLessThanOrEqual(780);
  });
});
