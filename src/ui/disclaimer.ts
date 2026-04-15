import type { CoreData, FullData, OddsSource } from '../types';

type AppData = CoreData | FullData;
type FreshnessCategory = 'checklist' | 'odds' | 'values' | 'comps';

interface FreshnessItem {
  category: FreshnessCategory;
  label: string;
  timestamp: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

const ODDS_SOURCE_COPY: Record<OddsSource, string> = {
  '2024_placeholder': 'Odds use the 2024 placeholder until the 2025 official pack odds are loaded.',
  '2025_official': 'Odds use the 2025 official pack odds loaded in the data file.',
};

function ageInDays(timestamp: string, now: Date = new Date()): number {
  const parsed = new Date(timestamp);
  const diff = now.getTime() - parsed.getTime();
  if (!Number.isFinite(diff)) return 0;
  return Math.max(0, Math.floor(diff / DAY_MS));
}

function formatAge(days: number): string {
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

function renderParagraph(text: string): HTMLParagraphElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'text-sm leading-relaxed text-text-mid';
  paragraph.textContent = text;
  return paragraph;
}

export function renderDisclaimer(container: HTMLElement, data: AppData): void {
  const section = document.createElement('section');
  section.dataset.testid = 'disclaimer';
  section.className = [
    'w-full',
    'bg-bg-base',
    'px-4',
    'pb-10',
    'text-text-hi',
  ].join(' ');

  const wrapper = document.createElement('div');
  wrapper.className = [
    'mx-auto',
    'w-full',
    'max-w-3xl',
    'border-t',
    'border-bg-elev',
    'pt-5',
  ].join(' ');

  const heading = document.createElement('h2');
  heading.className = 'text-base font-semibold text-text-hi';
  heading.textContent = 'Disclosure';

  const copy = document.createElement('div');
  copy.className = 'mt-3 space-y-3';
  copy.append(
    renderParagraph(
      "Single-break outcomes are dominated by variance. Your spot can return $0 or several times the EV. See 'Chance you get effectively nothing' above.",
    ),
    renderParagraph(
      'Not financial advice. RIPPED is not affiliated with Topps, the NFL, Whatnot, Fanatics Live, or any breaker. Estimates only.',
    ),
    renderParagraph(ODDS_SOURCE_COPY[data.odds_source]),
  );

  const freshnessItems: FreshnessItem[] = [
    { category: 'checklist', label: 'Checklist', timestamp: data.checklist_as_of },
    { category: 'odds', label: 'Odds', timestamp: data.odds_as_of },
    { category: 'values', label: 'Values', timestamp: data.values_as_of },
    { category: 'comps', label: 'Comps', timestamp: data.comps_as_of },
  ];

  const staleItems: string[] = [];
  const freshness = document.createElement('div');
  freshness.dataset.testid = 'freshness';
  freshness.className = [
    'mt-4',
    'grid',
    'grid-cols-1',
    'gap-2',
    'text-sm',
    'text-text-mid',
    'sm:grid-cols-2',
  ].join(' ');

  for (const item of freshnessItems) {
    const days = ageInDays(item.timestamp);
    if (days >= STALE_DAYS) staleItems.push(item.label);

    const row = document.createElement('p');
    row.dataset.category = item.category;
    row.className = [
      'rounded-lg',
      'border',
      'border-bg-elev',
      'bg-bg-card',
      'px-3',
      'py-2',
      'font-medium',
    ].join(' ');
    row.textContent = `${item.label}: ${formatAge(days)}`;
    freshness.append(row);
  }

  const staleWarning = document.createElement('p');
  staleWarning.dataset.testid = 'stale-warning';
  staleWarning.hidden = staleItems.length === 0;
  staleWarning.className = [
    'mt-4',
    'rounded-lg',
    'border',
    'border-danger',
    'bg-bg-card',
    'px-4',
    'py-3',
    'text-sm',
    'font-semibold',
    'text-text-hi',
  ].join(' ');
  staleWarning.textContent =
    staleItems.length > 0
      ? `Stale data warning: ${staleItems.join(', ')} data is at least ${STALE_DAYS} days old.`
      : '';

  wrapper.append(heading, copy, freshness, staleWarning);
  section.append(wrapper);
  container.replaceChildren(section);
}
