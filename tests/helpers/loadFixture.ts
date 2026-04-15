import { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', '..', 'src', 'fixtures');

// Routes /data.json to a synthetic fixture file under src/fixtures/.
// Use this in any test that needs to control the data the page receives —
// fail-loud tests, fallback-mode tests, stale-warning tests, etc.
//
// Example:
//   await loadFixture(page, 'broken.json');
//   await page.goto('/');
//   expect(page.locator('[data-testid="full-page-error"]')).toBeVisible();
export async function loadFixture(page: Page, fixtureName: string): Promise<void> {
  const fixturePath = resolve(FIXTURES_DIR, fixtureName);
  const body = readFileSync(fixturePath, 'utf-8');

  await page.route('**/data.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });
}

// Routes /data.json to a malformed payload to exercise the REQ-028 fail-loud path.
export async function loadBrokenData(page: Page): Promise<void> {
  await page.route('**/data.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"this": "is not the schema you are looking for"}',
    });
  });
}
