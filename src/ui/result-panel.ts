import type { ComputedResult, Verdict } from '../types';

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

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '-';
  return `${sign}${percent.format(Math.abs(value) * 100)}%`;
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

export function clearResultPanel(container: HTMLElement): void {
  container.replaceChildren();
  container.hidden = true;
  delete container.dataset.confidence;
  container.className = '';
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
    result.confidence === 'low' ? 'opacity-60' : '',
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

  wrapper.append(label, hero, subhero, pZero, verdictBand, gap);
  container.replaceChildren(wrapper);
}
