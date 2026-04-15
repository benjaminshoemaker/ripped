export function renderMethodology(container: HTMLElement): void {
  const details = document.createElement('details');
  details.dataset.testid = 'methodology';
  details.className = [
    'mt-6',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'p-4',
    'text-sm',
    'text-text-mid',
  ].join(' ');

  const summary = document.createElement('summary');
  summary.className = [
    'cursor-pointer',
    'font-semibold',
    'text-text-hi',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-accent',
  ].join(' ');
  summary.textContent = 'How this is calculated';

  const list = document.createElement('ul');
  list.className = 'mt-3 list-disc space-y-2 pl-5 leading-relaxed';

  const items = [
    'Probabilities use the published checklist, category odds, and the selected team roster.',
    'EV sums each eligible player category by expected count and current tier value.',
    'Median, range, and chance of effectively nothing come from the same case-break simulation.',
    'Confidence depends on recent comps, official odds, and value freshness.',
  ];

  for (const text of items) {
    const item = document.createElement('li');
    item.textContent = text;
    list.append(item);
  }

  details.append(summary, list);
  container.append(details);
}
