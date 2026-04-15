import { test, expect, type Page } from '@playwright/test';
import type { FullData, Team, TierLabel } from '../src/types';

const GIANTS_TEAM = 'New York Giants';

const TIER_LABELS: Record<TierLabel, string> = {
  tier_1_chase: 'Tier 1 Chase',
  tier_2_strong: 'Tier 2 Strong',
  tier_3_fair: 'Tier 3 Fair',
  tier_4_cold: 'Tier 4 Cold',
};

async function selectGiants(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('button[data-team="New York Giants"]').click();
  await expect(page.locator('[data-testid="team-detail"]')).toBeVisible();
}

async function loadData(page: Page): Promise<FullData> {
  return page.evaluate(async () => {
    const response = await fetch('/data.json');
    if (!response.ok) throw new Error('Failed to load /data.json');
    return (await response.json()) as FullData;
  });
}

function expectedSectionLabels(team: Team): Array<{ label: string; testId: string }> {
  return [
    {
      label: `Base Veterans (${team.base_veterans.length})`,
      testId: 'roster-base-veterans',
    },
    {
      label: `Rookies (${team.rookies.length})`,
      testId: 'roster-rookies',
    },
    {
      label: `Base Auto Signers (${team.base_auto_signers.length})`,
      testId: 'roster-base-auto-signers',
    },
    {
      label: `Rookie Auto Signers (${team.rookie_auto_signers.length})`,
      testId: 'roster-rookie-auto-signers',
    },
  ];
}

test.describe('team detail panel (Task 2.2.C)', () => {
  test('four roster sections render after team selection', async ({ page }) => {
    await selectGiants(page);

    const data = await loadData(page);
    const team = data.teams[GIANTS_TEAM];

    await expect(page.locator('[data-testid="team-detail"] [data-testid^="roster-"]')).toHaveCount(4);

    for (const sectionInfo of expectedSectionLabels(team)) {
      const section = page.locator(`[data-testid="${sectionInfo.testId}"]`);
      await expect(section).toBeVisible();
      await expect(section.locator('h3')).toHaveText(sectionInfo.label);
    }
  });

  test('chase marker', async ({ page }) => {
    await selectGiants(page);

    const chaseRows = page.locator('[data-testid="team-detail"] [data-chase="true"]');
    await expect(chaseRows.first()).toBeVisible();
    expect(await chaseRows.count()).toBeGreaterThan(0);
  });

  test('tier labels rendered for every player row', async ({ page }) => {
    await selectGiants(page);

    const data = await loadData(page);
    const expectedTiers = data.teams[GIANTS_TEAM].tiers;
    const rows = page.locator('[data-testid="team-detail"] [data-player]');

    const rowDetails = await rows.evaluateAll((elements) =>
      elements.map((element) => ({
        player: element.getAttribute('data-player'),
        tier: element.getAttribute('data-tier'),
        text: element.textContent ?? '',
      })),
    );

    expect(rowDetails.length).toBeGreaterThan(0);

    for (const row of rowDetails) {
      if (row.player === null) throw new Error('Player row is missing data-player');

      const expectedTier = expectedTiers[row.player];
      expect(row.tier).toBe(expectedTier);
      expect(row.text).toContain(row.player);
      expect(row.text).toContain(TIER_LABELS[expectedTier]);
    }
  });

  test('jaxson dart tier 1', async ({ page }) => {
    await selectGiants(page);

    const dart = page.locator('[data-player="Jaxson Dart"]').first();
    await expect(dart).toHaveAttribute('data-tier', 'tier_1_chase');
    await expect(dart).toHaveAttribute('data-chase', 'true');
  });
});
