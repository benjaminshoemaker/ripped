import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullData } from '../src/types';

interface BenchmarkRun {
  teamName: string;
  spotPrice: number;
  seed: number;
}

interface BenchmarkTiming extends BenchmarkRun {
  durationMs: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'public', 'data.json'), 'utf-8'),
) as FullData;

const RUN_COUNT = 20;
const P95_THRESHOLD_MS = 500;
const PRICES = [
  75, 95, 110, 125, 140, 155, 175, 195, 215, 235,
  255, 280, 305, 330, 360, 390, 425, 460, 500, 550,
];

const RUNS: BenchmarkRun[] = Object.keys(data.teams)
  .slice(0, RUN_COUNT)
  .map((teamName, index) => ({
    teamName,
    spotPrice: PRICES[index]!,
    seed: 0x5eed_0000 + index,
  }));

test.describe('performance (Task 3.3.C)', () => {
  test.setTimeout(30_000);

  test('p95 under 500ms for 20 worker-client simulation round trips', async ({ page }) => {
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
    await expect(page.locator('[data-testid="spot-price"]')).toBeVisible();

    const timings = await page.evaluate(async (runs): Promise<BenchmarkTiming[]> => {
      type BrowserTeam = Record<string, unknown>;
      type BrowserData = { teams: Record<string, BrowserTeam> };
      type BrowserValidateResult = {
        mode: 'full' | 'probability_only' | 'error';
        data: BrowserData | null;
        errors: unknown[];
      };
      type BrowserSimulateResponse = {
        requestId: number;
        median: number;
        p10: number;
        p90: number;
        pZero: number;
        mcMean: number;
      };
      type BrowserWorkerClient = {
        simulate: (
          team: BrowserTeam,
          spotPrice: number,
          data: BrowserData,
          onResult: (result: BrowserSimulateResponse) => void,
          seed?: number,
        ) => number;
      };
      type BrowserValidateModule = {
        validate: (raw: unknown) => BrowserValidateResult;
      };

      const workerClientPath = '/src/worker-client.ts';
      const validatePath = '/src/validate.ts';
      const [{ simulate }, { validate }] = await Promise.all([
        import(workerClientPath) as Promise<BrowserWorkerClient>,
        import(validatePath) as Promise<BrowserValidateModule>,
      ]);

      const response = await fetch('/data.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to load /data.json: ${response.status}`);
      }

      const validation = validate(await response.json());
      if (validation.mode !== 'full' || !validation.data) {
        throw new Error(
          `Performance test requires full data mode; got ${validation.mode}`,
        );
      }
      const benchmarkData = validation.data;

      const selectCombination = (run: BenchmarkRun): BrowserTeam => {
        const teamButton = Array.from(
          document.querySelectorAll<HTMLButtonElement>('button[data-team]'),
        ).find((button) => button.dataset.team === run.teamName);
        if (!teamButton) {
          throw new Error(`Missing team button for ${run.teamName}`);
        }

        const priceInput = document.querySelector<HTMLInputElement>(
          '[data-testid="spot-price"]',
        );
        if (!priceInput) {
          throw new Error('Missing spot price input');
        }

        teamButton.click();
        priceInput.value = String(run.spotPrice);

        const team = benchmarkData.teams[run.teamName];
        if (!team) {
          throw new Error(`Missing team data for ${run.teamName}`);
        }
        return team;
      };

      const results: BenchmarkTiming[] = [];
      for (const run of runs) {
        const team = selectCombination(run);
        const startedAt = performance.now();

        const durationMs = await new Promise<number>((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            reject(new Error(`Simulation timed out for ${run.teamName}`));
          }, 5_000);

          simulate(
            team,
            run.spotPrice,
            benchmarkData,
            (result) => {
              window.clearTimeout(timeoutId);

              const finiteResult = [
                result.median,
                result.p10,
                result.p90,
                result.pZero,
                result.mcMean,
              ].every(Number.isFinite);
              if (!finiteResult) {
                reject(new Error(`Simulation returned non-finite values for ${run.teamName}`));
                return;
              }

              resolve(performance.now() - startedAt);
            },
            run.seed,
          );
        });

        results.push({ ...run, durationMs });
      }

      return results;
    }, RUNS);

    const sortedDurations = timings
      .map((timing) => timing.durationMs)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(timings.length * 0.95);
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
