import {
  probAnyChase,
  probAnyNumberedParallel,
  probAtLeastOne,
} from '../math/probability';
import { getState } from '../state';
import type {
  ComputedResult,
  Contributor,
  CoreData,
  FullData,
  Team,
  TierLabel,
  Verdict,
} from '../types';
import { renderMethodology } from './methodology';

type AppData = CoreData | FullData;

const VERDICT_LABELS: Record<Verdict, string> = {
  STEAL: 'Steal',
  BELOW_MARKET: 'Below Market',
  NEAR_MARKET: 'Near Market',
  ABOVE_MARKET: 'Above Market',
  RIPPED: 'You Got Ripped!',
};

const VERDICT_CLASSES: Record<Verdict, string> = {
  STEAL: 'bg-green-500 text-bg-base',
  BELOW_MARKET: 'bg-lime-500 text-bg-base',
  NEAR_MARKET: 'bg-yellow-500 text-bg-base',
  ABOVE_MARKET: 'bg-orange-500 text-bg-base',
  RIPPED: 'bg-red-600 text-text-hi',
};

const TIER_LABELS: Record<TierLabel, string> = {
  tier_1_chase: 'Tier 1 Chase',
  tier_2_strong: 'Tier 2 Strong',
  tier_3_fair: 'Tier 3 Fair',
  tier_4_cold: 'Tier 4 Cold',
};

const CATEGORY_LABELS: Record<string, string> = {
  base: 'Any base veteran',
  rookie: 'Any rookie',
  base_refractor: 'Any base refractor',
  rookie_refractor: 'Any rookie refractor',
  base_auto: 'Any base auto',
  rookie_auto: 'Any rookie auto',
  gold_refractor_50: 'Any gold refractor /50',
  orange_refractor_25: 'Any orange refractor /25',
  red_refractor_5: 'Any red refractor /5',
  superfractor_1: 'Any superfractor 1/1',
  rpa_gold_50: 'Any RPA gold /50',
  rpa_orange_25: 'Any RPA orange /25',
  any_numbered_parallel: 'Any numbered parallel',
  any_chase_card: 'Any chase card',
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return currency.format(value);
}

function formatSignedUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (value === 0) return '$0';
  const sign = value > 0 ? '+' : '-';
  return `${sign}${currency.format(Math.abs(value))}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${percent.format(value * 100)}%`;
}

function formatProbability(value: number): string {
  if (!Number.isFinite(value)) return 'N/A';
  const percentage = value * 100;
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: percentage > 0 && percentage < 1 ? 1 : 0,
  });
  return `${formatter.format(percentage)}%`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '-';
  return `${sign}${percent.format(Math.abs(value) * 100)}%`;
}

function formatCategoryLabel(category: string): string {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  return `Any ${category.split('_').join(' ')}`;
}

function buildProbabilityTable(team: Team, data: AppData): Record<string, number> {
  const probabilityTable: Record<string, number> = {};

  for (const category of Object.keys(data.card_categories)) {
    probabilityTable[category] = probAtLeastOne(category, team, data);
  }

  probabilityTable.any_numbered_parallel = probAnyNumberedParallel(team, data);
  probabilityTable.any_chase_card = probAnyChase(team, data);

  return probabilityTable;
}

function createProbabilityOnlyResult(
  teamName: string,
  spotPrice: number,
  team: Team,
  data: AppData,
): ComputedResult {
  return {
    team: teamName,
    spotPrice,
    mode: 'probability_only',
    ev: null,
    median: null,
    p10: null,
    p90: null,
    pZero: null,
    gap: null,
    gapPct: null,
    verdict: null,
    verdictIsHard: false,
    confidence: 'low',
    contributors: [],
    probabilityTable: buildProbabilityTable(team, data),
  };
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderProbabilityTable(result: ComputedResult): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mt-6';

  const heading = createTextElement(
    'h2',
    'text-lg font-semibold text-text-hi',
    'Hit probabilities',
  );

  const table = document.createElement('table');
  table.dataset.testid = 'probability-table';
  table.className = [
    'mt-3',
    'w-full',
    'border-collapse',
    'overflow-hidden',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'text-sm',
  ].join(' ');

  const body = document.createElement('tbody');

  for (const [category, probability] of Object.entries(result.probabilityTable)) {
    const row = document.createElement('tr');
    row.dataset.testid = 'prob-row';
    row.dataset.category = category;
    row.className = 'border-t border-bg-elev first:border-t-0';

    const label = document.createElement('th');
    label.scope = 'row';
    label.className = 'px-3 py-3 text-left font-medium text-text-mid';
    label.textContent = formatCategoryLabel(category);

    const value = document.createElement('td');
    value.className = 'px-3 py-3 text-right font-bold text-text-hi';
    value.textContent = formatProbability(probability);

    row.append(label, value);
    body.append(row);
  }

  table.append(body);
  section.append(heading, table);
  return section;
}

function renderFallbackBanner(): HTMLElement {
  const banner = createTextElement(
    'p',
    [
      'mt-4',
      'rounded-lg',
      'border-2',
      'border-accent',
      'bg-bg-card',
      'px-4',
      'py-4',
      'text-base',
      'font-black',
      'leading-snug',
      'text-text-hi',
    ].join(' '),
    'Dollar values coming soon — data not ready',
  );
  banner.dataset.testid = 'fallback-banner';
  banner.setAttribute('role', 'status');
  return banner;
}

function renderContributorRow(contributor: Contributor): HTMLElement {
  const row = document.createElement('div');
  row.dataset.testid = 'contributor-row';
  row.dataset.player = contributor.player;
  row.dataset.tier = contributor.tier;
  row.dataset.category = contributor.category;
  row.className = [
    'flex',
    'min-h-[44px]',
    'items-center',
    'justify-between',
    'gap-3',
    'border-t',
    'border-bg-elev',
    'py-3',
    'first:border-t-0',
  ].join(' ');

  const player = document.createElement('div');
  player.className = 'min-w-0 flex-1';

  const name = createTextElement(
    'p',
    'break-words text-sm font-semibold text-text-hi',
    contributor.player,
  );

  const category = createTextElement(
    'p',
    'mt-1 text-xs font-medium text-text-lo',
    formatCategoryLabel(contributor.category),
  );

  player.append(name, category);

  const meta = document.createElement('div');
  meta.className = 'flex shrink-0 flex-col items-end gap-1 text-right';

  const tier = createTextElement(
    'span',
    [
      'rounded-md',
      'border',
      'border-bg-elev',
      'bg-bg-base',
      'px-2',
      'py-1',
      'text-xs',
      'font-semibold',
      'text-text-mid',
    ].join(' '),
    TIER_LABELS[contributor.tier],
  );

  const expectedValue = createTextElement(
    'span',
    'text-sm font-bold text-text-hi',
    formatUsd(contributor.expectedValue),
  );

  meta.append(tier, expectedValue);
  row.append(player, meta);
  return row;
}

function renderContributors(result: ComputedResult): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mt-6';

  const heading = createTextElement(
    'h2',
    'text-lg font-semibold text-text-hi',
    'Top EV contributors',
  );

  const list = document.createElement('div');
  list.className = [
    'mt-3',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'px-4',
  ].join(' ');

  const contributors = result.contributors.slice(0, 5);
  if (contributors.length === 0) {
    const empty = createTextElement(
      'p',
      'py-4 text-sm font-medium text-text-mid',
      'No dollar contributors available for this team.',
    );
    list.append(empty);
  } else {
    for (const contributor of contributors) {
      list.append(renderContributorRow(contributor));
    }
  }

  section.append(heading, list);
  return section;
}

function renderVarianceCallout(result: ComputedResult): HTMLElement {
  const callout = createTextElement(
    'p',
    [
      'mt-4',
      'rounded-lg',
      'border',
      'border-accent',
      'bg-bg-card',
      'px-4',
      'py-3',
      'text-sm',
      'font-semibold',
      'leading-relaxed',
      'text-text-hi',
    ].join(' '),
    '',
  );
  callout.dataset.testid = 'variance-callout';

  const chaseContributor = result.contributors.find(
    (contributor) => contributor.isChase && contributor.tier === 'tier_1_chase',
  );

  if (chaseContributor) {
    const category = formatCategoryLabel(chaseContributor.category)
      .replace(/^Any\s+/u, '')
      .toLowerCase();
    callout.textContent = `${chaseContributor.player} ${category} is the chase - most upside, most variance.`;
  } else {
    callout.textContent =
      'No tier-1 chase contributor is driving this team result, but single-break variance still dominates the outcome.';
  }

  return callout;
}

export function clearResultPanel(container: HTMLElement): void {
  container.replaceChildren();
  container.hidden = true;
  delete container.dataset.confidence;
  container.className = '';

  // Core-only data cannot run the dollar simulation, so the app reaches this
  // clear path. The degraded result still belongs to the result panel.
  const { data, mode, selectedTeam, spotPrice } = getState();
  if (
    mode !== 'probability_only' ||
    data === null ||
    selectedTeam === null ||
    spotPrice === null ||
    spotPrice <= 0
  ) {
    return;
  }

  const teamName = selectedTeam;
  const paidPrice = spotPrice;

  queueMicrotask(() => {
    const latest = getState();
    if (
      latest.mode !== 'probability_only' ||
      latest.data === null ||
      latest.selectedTeam !== teamName ||
      latest.spotPrice !== paidPrice
    ) {
      return;
    }

    const team = latest.data.teams[teamName];
    if (!team) return;

    renderResultPanel(
      container,
      createProbabilityOnlyResult(teamName, paidPrice, team, latest.data),
    );
    container.hidden = false;
  });
}

export function renderResultPanel(
  container: HTMLElement,
  result: ComputedResult,
): void {
  container.dataset.confidence = result.confidence;
  container.className = [
    'w-full',
    'max-w-3xl',
    'mx-auto',
    'px-4',
    'pb-8',
    'bg-bg-base',
    'text-text-hi',
    result.mode === 'full' && result.confidence === 'low' ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const wrapper = document.createElement('div');
  wrapper.className = [
    'border-t',
    'border-bg-elev',
    'pt-4',
  ].join(' ');

  const label = createTextElement(
    'p',
    'text-sm font-bold uppercase tracking-normal text-accent',
    `${result.team} result`,
  );

  if (result.mode === 'probability_only') {
    wrapper.append(label, renderFallbackBanner(), renderProbabilityTable(result));
    renderMethodology(wrapper);
    container.replaceChildren(wrapper);
    return;
  }

  const hero = createTextElement(
    'p',
    [
      'mt-2',
      'text-5xl',
      'font-black',
      'leading-none',
      'text-text-hi',
      'sm:text-6xl',
    ].join(' '),
    formatUsd(result.ev),
  );
  hero.dataset.testid = 'ev-hero';

  const subhero = createTextElement(
    'p',
    'mt-3 text-base font-semibold leading-snug text-text-mid sm:text-lg',
    `Median: ${formatUsd(result.median)} | 80% of cases: ${formatUsd(result.p10)}-${formatUsd(result.p90)}`,
  );
  subhero.dataset.testid = 'subhero';

  const pZero = createTextElement(
    'p',
    [
      'mt-4',
      'rounded-lg',
      'border',
      'border-bg-elev',
      'bg-bg-card',
      'px-4',
      'py-3',
      'text-sm',
      'font-semibold',
      'text-text-hi',
    ].join(' '),
    `Chance you get effectively nothing: ${formatPercent(result.pZero)}`,
  );
  pZero.dataset.testid = 'p-zero';

  const verdict = result.verdict ?? 'NEAR_MARKET';
  const verdictBand = document.createElement('div');
  verdictBand.dataset.testid = 'verdict-band';
  verdictBand.dataset.verdict = verdict;
  verdictBand.className = [
    'mt-3',
    'rounded-lg',
    'px-4',
    'py-3',
    'text-sm',
    'font-black',
    'uppercase',
    'tracking-normal',
    VERDICT_CLASSES[verdict],
  ].join(' ');

  const verdictText = document.createElement('span');
  verdictText.textContent = VERDICT_LABELS[verdict];

  const confidenceText = document.createElement('span');
  confidenceText.dataset.testid = 'confidence-label';
  confidenceText.className = 'ml-2 font-semibold normal-case';
  confidenceText.textContent = `(${result.confidence} confidence${result.verdictIsHard ? ', hard verdict' : ''})`;

  verdictBand.append(verdictText, confidenceText);

  const gap = createTextElement(
    'p',
    'mt-3 text-sm font-medium leading-relaxed text-text-mid',
    `You paid ${formatUsd(result.spotPrice)}, EV is ${formatUsd(result.ev)}. Gap: ${formatSignedUsd(result.gap)} / ${formatSignedPercent(result.gapPct)}`,
  );
  gap.dataset.testid = 'gap-detail';

  wrapper.append(
    label,
    hero,
    subhero,
    pZero,
    verdictBand,
    gap,
    renderVarianceCallout(result),
    renderProbabilityTable(result),
    renderContributors(result),
  );
  renderMethodology(wrapper);
  container.replaceChildren(wrapper);
}
