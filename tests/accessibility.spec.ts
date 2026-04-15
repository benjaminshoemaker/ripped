import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

const GIANTS = 'New York Giants';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const VIEWPORTS = [
  { label: '360px', width: 360, height: 780 },
  { label: '390px', width: 390, height: 844 },
  { label: '768px', width: 768, height: 1024 },
] as const;

interface ScrollMetrics {
  bodyScrollWidth: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  overflowingElements: string[];
  windowInnerWidth: number;
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-testid="page-loaded"]')).toBeVisible();
  await expect(page.locator('[data-testid="team-grid"]')).toBeVisible();
}

async function showGiantsResult(page: Page): Promise<void> {
  await page.locator(`button[data-team="${GIANTS}"]`).click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();

  await page.locator('[data-testid="spot-price"]').fill('500');
  await expect(page.locator('[data-testid="ev-hero"]')).toBeVisible();
}

function formatViolations(violations: AxeResults['violations']): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .join(', ');

      return `${violation.id}: ${violation.help} (${violation.impact ?? 'unknown'}) ${targets}`;
    })
    .join('\n');
}

async function expectAxeClean(page: Page, context: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

  expect(
    result.violations,
    `${context} axe violations:\n${formatViolations(result.violations)}`,
  ).toEqual([]);
}

async function collectScrollMetrics(page: Page): Promise<ScrollMetrics> {
  return page.evaluate((): ScrollMetrics => {
    const documentElement = document.documentElement;
    const viewportWidth = documentElement.clientWidth;

    const overflowingElements = Array.from(
      document.querySelectorAll<HTMLElement>('body *'),
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const testId = element.dataset.testid
          ? `[data-testid="${element.dataset.testid}"]`
          : '';
        const className = element.className
          .split(/\s+/u)
          .filter(Boolean)
          .slice(0, 4)
          .join('.');

        return `${element.tagName.toLowerCase()}${testId}${className ? `.${className}` : ''} left=${Math.round(rect.left)} right=${Math.round(rect.right)}`;
      });

    return {
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      overflowingElements,
      windowInnerWidth: window.innerWidth,
    };
  });
}

async function expectNoHorizontalScroll(page: Page, context: string): Promise<void> {
  const metrics = await collectScrollMetrics(page);
  const details = `${context} scroll metrics: ${JSON.stringify(metrics, null, 2)}`;

  expect(metrics.documentScrollWidth, details).toBeLessThanOrEqual(
    metrics.documentClientWidth,
  );
  expect(metrics.bodyScrollWidth, details).toBeLessThanOrEqual(metrics.windowInnerWidth);
  expect(metrics.overflowingElements, details).toEqual([]);
}

test.describe('accessibility (Task 3.1.A)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} axe clean`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await openApp(page);
      await expectAxeClean(page, `${viewport.label} initial`);

      await showGiantsResult(page);
      await expectAxeClean(page, `${viewport.label} result`);
    });
  }

  test('no horizontal scroll at 360px, 390px, and 768px', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await openApp(page);
      await expectNoHorizontalScroll(page, `${viewport.label} initial`);

      await showGiantsResult(page);
      await expectNoHorizontalScroll(page, `${viewport.label} result`);
    }
  });

  test('ev above fold 360x780', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await openApp(page);
    await showGiantsResult(page);

    const heroBottom = await page
      .locator('[data-testid="ev-hero"]')
      .evaluate((element) => element.getBoundingClientRect().bottom);

    expect(heroBottom).toBeLessThanOrEqual(780);
  });
});
