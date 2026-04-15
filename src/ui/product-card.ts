import type { CoreData, FullData, Product } from '../types';

const FORMAT_LABELS: Record<Product['format'], string> = {
  pyt_hobby_case: 'Pick Your Team Hobby Case Break',
};

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function renderProductCard(container: HTMLElement, data: FullData | CoreData): void {
  const { product } = data;

  const section = document.createElement('section');
  section.dataset.testid = 'product-card';
  section.className = [
    'w-full',
    'bg-bg-base',
    'px-4',
    'pb-6',
    'pt-8',
    'text-text-hi',
  ].join(' ');

  const wrapper = document.createElement('div');
  wrapper.className = 'mx-auto w-full max-w-3xl';

  const logo = document.createElement('p');
  logo.className = 'text-sm font-bold uppercase tracking-normal text-accent';
  logo.textContent = 'RIPPED';

  const tagline = document.createElement('h1');
  tagline.dataset.testid = 'hero-tagline';
  tagline.className = [
    'mt-3',
    'max-w-2xl',
    'text-3xl',
    'font-bold',
    'leading-tight',
    'text-text-hi',
    'sm:text-4xl',
  ].join(' ');
  tagline.textContent =
    "You're about to play a slot machine. Here's what it's actually paying out.";

  const card = document.createElement('article');
  card.className = [
    'mt-6',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'p-4',
    'sm:p-5',
  ].join(' ');

  const productLabel = document.createElement('h2');
  productLabel.dataset.testid = 'product-name-label';
  productLabel.className = 'text-lg font-semibold leading-snug text-text-hi';
  productLabel.textContent = `${product.name} - ${FORMAT_LABELS[product.format]}`;

  const facts = document.createElement('div');
  facts.className = [
    'mt-4',
    'grid',
    'grid-cols-1',
    'gap-3',
    'border-t',
    'border-bg-elev',
    'pt-4',
    'text-sm',
    'text-text-mid',
    'sm:grid-cols-3',
  ].join(' ');

  const benchmark = document.createElement('p');
  benchmark.dataset.testid = 'benchmark-case-cost';
  benchmark.className = 'font-medium';
  benchmark.textContent = `Benchmark case cost: ${formatUsd(product.benchmark_case_cost_usd)}`;

  const boxes = document.createElement('p');
  boxes.className = 'font-medium';
  boxes.textContent = `${product.boxes_per_case} boxes per case`;

  const teams = document.createElement('p');
  teams.className = 'font-medium';
  teams.textContent = `${Object.keys(data.teams).length} NFL teams`;

  facts.append(benchmark, boxes, teams);
  card.append(productLabel, facts);

  if (product.ship_all_cards_assumption) {
    const note = document.createElement('p');
    note.dataset.testid = 'ship-all-cards-note';
    note.className = [
      'mt-4',
      'border-l-4',
      'border-accent',
      'pl-3',
      'text-sm',
      'font-medium',
      'text-text-mid',
    ].join(' ');
    note.textContent =
      'This estimate assumes every card pulled for your team is shipped to you. Ask your breaker to confirm.';
    card.append(note);
  }

  wrapper.append(logo, tagline, card);
  section.append(wrapper);
  container.replaceChildren(section);
}
