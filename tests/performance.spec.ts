import { expect, test } from '@playwright/test';

interface BenchmarkRun {
  teamName: string;
  spotPrice: number;
}

interface BenchmarkTiming extends BenchmarkRun {
  durationMs: number;
}

type PerfWindow = Window & {
  __rippedPerfDone?: Promise<number>;
};

const RUN_COUNT = 20;
const P95_THRESHOLD_MS = 500;
const TEAMS = [
  'New York Giants',
  'Tennessee Titans',
  'Jacksonville Jaguars',
  'Las Vegas Raiders',
];
const PRICES = [75, 140, 215, 330, 500];

const RUNS: BenchmarkRun[] = TEAMS.flatMap((teamName) =>
  PRICES.map((spotPrice) => ({ teamName, spotPrice })),
);

test.describe('performance (Task 3.3.C)', () => {
  test.setTimeout(45_000);

  test('p95 under 500ms for 20 real input-to-result runs', async ({ page }) => {
    expect(RUNS).toHaveLength(RUN_COUNT);

    await page.route('https://static.cloudflareinsights.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
    });
    await page.route('https://cloudflareinsights.com/**', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/');
    await expect(page.locator('[data-testid="team-grid"]')).toBeVisible();
    const priceInput = page.locator('[data-testid="spot-price"]');
    const resultPanel = page.locator('[data-testid="result-panel"]');
    const hero = page.locator('[data-testid="ev-hero"]');
    const heroVsPaid = page.locator('[data-testid="hero-vs-paid"]');

    await expect(priceInput).toBeVisible();

    const timings: BenchmarkTiming[] = [];
    for (const run of RUNS) {
      await priceInput.fill('');
      await expect(resultPanel).toBeHidden();

      const selectedTeamButton = page.locator(`button[data-team="${run.teamName}"]`);
      await selectedTeamButton.click();
      await expect(selectedTeamButton).toHaveAttribute('aria-pressed', 'true');
      await priceInput.scrollIntoViewIfNeeded();
      await expect(priceInput).toBeVisible();

      await page.evaluate(({ teamName, spotPrice }) => {
        const expectedResultLabel = `${teamName} result`;
        const expectedPriceLabel = `your $${spotPrice}`;
        const hasRenderedResult = (): boolean => {
          const resultPanel = document.querySelector<HTMLElement>(
            '[data-testid="result-panel"]',
          );
          const hero = document.querySelector<HTMLElement>(
            '[data-testid="ev-hero"]',
          );
          const heroVsPaid = document.querySelector<HTMLElement>(
            '[data-testid="hero-vs-paid"]',
          );

          return Boolean(
            resultPanel &&
              !resultPanel.hidden &&
              resultPanel.textContent?.includes(expectedResultLabel) &&
              heroVsPaid?.textContent?.includes(expectedPriceLabel) &&
              /\$[\d,]+/u.test(hero?.textContent ?? ''),
          );
        };

        (window as PerfWindow).__rippedPerfDone = new Promise<number>(
          (resolve, reject) => {
            if (hasRenderedResult()) {
              resolve(performance.now());
              return;
            }

            const timeoutId = window.setTimeout(() => {
              observer.disconnect();
              reject(
                new Error(
                  `Timed out waiting for ${expectedResultLabel} ${expectedPriceLabel}`,
                ),
              );
            }, 15_000);

            const observer = new MutationObserver(() => {
              if (!hasRenderedResult()) return;
              window.clearTimeout(timeoutId);
              observer.disconnect();
              resolve(performance.now());
            });

            observer.observe(document.body, {
              attributes: true,
              childList: true,
              subtree: true,
            });
          },
        );
      }, run);

      const startedAt = await page.evaluate(() => performance.now());
      await priceInput.fill(String(run.spotPrice));
      const finishedAt = await page.evaluate(async () => {
        const promise = (window as PerfWindow).__rippedPerfDone;
        if (!promise) throw new Error('Performance observer was not installed');
        return promise;
      });

      await expect(resultPanel).toContainText(`${run.teamName} result`);
      await expect(heroVsPaid).toContainText(`your $${run.spotPrice}`);
      await expect(hero).toBeVisible();

      const durationMs = finishedAt - startedAt;

      const heroText = await hero.innerText();
      if (!/\$[\d,]+/u.test(heroText)) {
        throw new Error(`EV hero did not render a dollar value: ${heroText}`);
      }

      timings.push({ ...run, durationMs });
    }

    const sortedDurations = timings
      .map((timing) => timing.durationMs)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(timings.length * 0.95) - 1;
    const p95 = sortedDurations[p95Index]!;
    const formattedTimings = timings
      .map(
        (timing) =>
          `${timing.teamName} $${timing.spotPrice}: ${timing.durationMs.toFixed(1)}ms`,
      )
      .join('\n');

    expect(
      p95,
      `p95=${p95.toFixed(1)}ms at sorted index ${p95Index}\n${formattedTimings}`,
    ).toBeLessThan(P95_THRESHOLD_MS);
  });
});
