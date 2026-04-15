import type {
  ComputedResult,
  Contributor,
  TierLabel,
  Verdict,
} from '../types';
import { renderMethodology } from './methodology';

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
    section.append(heading, list);
    return section;
  }

  for (const contributor of contributors) {
    list.append(renderContributorRow(contributor));
  }

  section.append(heading, list);

  const totalEv = result.ev;
  if (totalEv !== null && Number.isFinite(totalEv) && totalEv > 0) {
    const top5Sum = contributors.reduce(
      (sum, c) => sum + c.expectedValue,
      0,
    );
    const everythingElse = Math.max(0, totalEv - top5Sum);
    const top5Share = top5Sum / totalEv;

    const aggregate = createTextElement(
      'p',
      'mt-3 text-xs font-medium leading-relaxed text-text-lo',
      `Top 5 total: ${formatUsd(top5Sum)} (${formatPercent(top5Share)} of EV) · Everything else: ${formatUsd(everythingElse)}`,
    );
    aggregate.dataset.testid = 'contributors-aggregate';
    section.append(aggregate);
  }

  return section;
}

function renderProbabilitySummary(result: ComputedResult): HTMLElement {
  const section = document.createElement('section');
  section.dataset.testid = 'prob-summary';
  section.className = [
    'mt-4',
    'grid',
    'grid-cols-2',
    'gap-2',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'px-3',
    'py-3',
    'text-xs',
    'font-semibold',
  ].join(' ');

  const entries: Array<{ label: string; value: string }> = [];
  const pBase = result.probabilityTable.base;
  if (typeof pBase === 'number') {
    entries.push({ label: 'Any base hit', value: formatProbability(pBase) });
  }
  const pAnyChase = result.probabilityTable.any_chase_card;
  if (typeof pAnyChase === 'number') {
    entries.push({ label: 'Any chase card', value: formatProbability(pAnyChase) });
  }
  const pNumbered = result.probabilityTable.any_numbered_parallel;
  if (typeof pNumbered === 'number') {
    entries.push({
      label: 'Any numbered parallel',
      value: formatProbability(pNumbered),
    });
  }
  if (result.pZero !== null && Number.isFinite(result.pZero)) {
    entries.push({
      label: 'Chance of effectively $0',
      value: formatProbability(result.pZero),
    });
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2';
    const label = createTextElement(
      'span',
      'text-text-mid',
      entry.label,
    );
    const value = createTextElement(
      'span',
      'text-text-hi',
      entry.value,
    );
    row.append(label, value);
    section.append(row);
  }

  return section;
}

function renderStaleBadge(result: ComputedResult): HTMLElement | null {
  if (!result.staleSignals || result.staleSignals.length === 0) return null;
  const badge = createTextElement(
    'p',
    [
      'mt-3',
      'rounded-lg',
      'border',
      'border-danger',
      'bg-bg-card',
      'px-3',
      'py-2',
      'text-xs',
      'font-semibold',
      'text-text-hi',
    ].join(' '),
    `Stale data — ${result.staleSignals.join(', ')} ${result.staleSignals.length > 1 ? 'are' : 'is'} at least 14 days old. Verdict quality reduced.`,
  );
  badge.dataset.testid = 'result-stale-badge';
  return badge;
}

function renderConfidenceDetails(result: ComputedResult): HTMLElement {
  const details = document.createElement('details');
  details.dataset.testid = 'confidence-details';
  details.className = 'mt-2';

  const summary = document.createElement('summary');
  summary.className = [
    'cursor-pointer',
    'text-xs',
    'font-semibold',
    'text-text-lo',
    'hover:text-text-mid',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-accent',
    'rounded',
    'px-1',
    'py-0.5',
  ].join(' ');
  summary.textContent = `Why is this ${result.confidence} confidence?`;

  const list = document.createElement('ul');
  list.className = [
    'mt-2',
    'space-y-1.5',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'px-3',
    'py-3',
    'text-xs',
    'leading-snug',
  ].join(' ');

  for (const condition of result.confidenceBreakdown.conditions) {
    const item = document.createElement('li');
    item.dataset.testid = 'confidence-condition';
    item.dataset.condition = condition.id;
    item.dataset.passed = condition.passed ? 'true' : 'false';
    item.className = 'flex items-start gap-2';

    const icon = document.createElement('span');
    icon.className = [
      'mt-0.5',
      'inline-flex',
      'h-4',
      'w-4',
      'shrink-0',
      'items-center',
      'justify-center',
      'rounded-full',
      'text-[10px]',
      'font-black',
      condition.passed ? 'bg-accent text-bg-base' : 'bg-danger text-text-hi',
    ].join(' ');
    icon.textContent = condition.passed ? '✓' : '✗';
    icon.setAttribute('aria-hidden', 'true');

    const body = document.createElement('span');
    body.className = 'min-w-0 flex-1';

    const label = document.createElement('span');
    label.className = 'font-semibold text-text-hi';
    label.textContent = condition.label;

    const detail = document.createElement('span');
    detail.className = 'ml-2 font-medium text-text-lo';
    detail.textContent = condition.detail;

    body.append(label, detail);
    item.append(icon, body);
    list.append(item);
  }

  const footnote = document.createElement('p');
  footnote.className = 'mt-3 text-[11px] leading-snug text-text-lo';
  footnote.textContent =
    'High confidence requires all four conditions. Medium = at least 2 of 4 for every chase record. Low = the weakest chase record fails more than half.';

  details.append(summary, list, footnote);
  return details;
}

function renderLowConfidenceWarning(): HTMLElement {
  const warning = document.createElement('div');
  warning.dataset.testid = 'low-confidence-warning';
  warning.setAttribute('role', 'status');
  warning.className = [
    'mt-3',
    'rounded-lg',
    'border-2',
    'border-danger',
    'bg-bg-card',
    'px-4',
    'py-3',
  ].join(' ');

  const heading = createTextElement(
    'p',
    'text-xs font-black uppercase tracking-wide text-danger',
    'Low confidence',
  );
  const body = createTextElement(
    'p',
    'mt-1 text-sm font-semibold leading-snug text-text-hi',
    "We don't have enough recent comp data to stand behind this verdict. Verify pricing manually before buying.",
  );

  warning.append(heading, body);
  return warning;
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
  ].join(' ');

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

  const isLowConfidence = result.confidence === 'low';

  // 1. Low-confidence warning strip (only when confidence is low — replaces
  //    the old whole-panel opacity-60 mute which hid the very warnings users
  //    need to read per codex-consult and codex-review feedback).
  const lowConfidenceWarning = isLowConfidence ? renderLowConfidenceWarning() : null;

  // 2. Verdict band. On low confidence we de-saturate just the celebratory
  //    styling, keeping numbers and warnings at full contrast.
  const verdict = result.verdict ?? 'NEAR_MARKET';
  const verdictBand = document.createElement('div');
  verdictBand.dataset.testid = 'verdict-band';
  verdictBand.dataset.verdict = verdict;
  verdictBand.dataset.muted = isLowConfidence ? 'true' : 'false';
  verdictBand.className = [
    'mt-3',
    'rounded-lg',
    'px-4',
    'py-3',
    'text-sm',
    'font-black',
    'uppercase',
    'tracking-normal',
    'lg:text-base',
    'lg:px-5',
    'lg:py-4',
    VERDICT_CLASSES[verdict],
    isLowConfidence ? 'saturate-50 opacity-80' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const verdictText = document.createElement('span');
  verdictText.textContent = VERDICT_LABELS[verdict];

  const confidenceText = document.createElement('span');
  confidenceText.dataset.testid = 'confidence-label';
  confidenceText.className = 'ml-2 font-semibold normal-case';
  confidenceText.textContent = `(${result.confidence} confidence${result.verdictIsHard ? ', hard verdict' : ''})`;

  verdictBand.append(verdictText, confidenceText);

  // 3. Compact "not financial advice / variance" strip under the verdict band.
  const verdictDisclaimer = createTextElement(
    'p',
    'mt-2 text-xs font-medium leading-snug text-text-lo',
    'Not financial advice. Single-break outcomes are dominated by variance.',
  );
  verdictDisclaimer.dataset.testid = 'verdict-disclaimer';

  // 4. Stale-data badge (only if any data source is ≥14 days old).
  const staleBadge = renderStaleBadge(result);

  // 5. Hero: EV figure, unchanged primary visual.
  const hero = createTextElement(
    'p',
    [
      'mt-4',
      'text-5xl',
      'font-black',
      'leading-none',
      'text-text-hi',
      'sm:text-6xl',
    ].join(' '),
    formatUsd(result.ev),
  );
  hero.dataset.testid = 'ev-hero';

  // 6. "vs your $X · Gap ±$Y / ±Z%" — combines paid + gap directly with the
  //    hero so a 5-second buyer sees the comparison in one glance. Replaces
  //    the old small-print gap-detail below the verdict.
  const heroVsPaid = createTextElement(
    'p',
    'mt-2 text-lg font-semibold leading-snug text-text-mid sm:text-xl',
    `vs your ${formatUsd(result.spotPrice)} · Gap ${formatSignedUsd(result.gap)} / ${formatSignedPercent(result.gapPct)}`,
  );
  heroVsPaid.dataset.testid = 'hero-vs-paid';

  // 7. Subhero — median + 80% range. Smaller than hero-vs-paid so the 1.5x
  //    hero:subhero test still passes.
  const subhero = createTextElement(
    'p',
    'mt-2 text-sm font-semibold leading-snug text-text-mid sm:text-base',
    `Median: ${formatUsd(result.median)} · 80% of cases: ${formatUsd(result.p10)}-${formatUsd(result.p90)}`,
  );
  subhero.dataset.testid = 'subhero';

  // 8. P($0) box — retained from original layout (REQ-013).
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

  // 9. Compact probability summary strip — surfaces the four numbers that
  //    matter for a 5-second decision instead of burying them in the 14-row
  //    detail table below.
  const probSummary = renderProbabilitySummary(result);

  // Assemble in the order above.
  wrapper.append(label);
  if (lowConfidenceWarning) wrapper.append(lowConfidenceWarning);
  wrapper.append(verdictBand, verdictDisclaimer, renderConfidenceDetails(result));
  if (staleBadge) wrapper.append(staleBadge);
  wrapper.append(
    hero,
    heroVsPaid,
    subhero,
    pZero,
    probSummary,
    renderVarianceCallout(result),
    renderProbabilityTable(result),
    renderContributors(result),
  );
  renderMethodology(wrapper);
  container.replaceChildren(wrapper);
}
