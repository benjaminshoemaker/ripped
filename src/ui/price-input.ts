import { setState } from '../state';

const DEBOUNCE_MS = 200;

function parseSpotPrice(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function renderPriceInput(container: HTMLElement): void {
  const section = document.createElement('section');
  section.className = [
    'w-full',
    'max-w-3xl',
    'mx-auto',
    'px-4',
    'pb-8',
    'bg-bg-base',
    'text-text-hi',
  ].join(' ');

  const label = document.createElement('label');
  label.htmlFor = 'spot-price';
  label.className = 'block text-sm font-semibold text-text-hi';
  label.textContent = 'What did you pay?';

  const control = document.createElement('div');
  control.dataset.testid = 'spot-price-container';
  control.className = [
    'mt-2',
    'flex',
    'min-h-[44px]',
    'min-w-[44px]',
    'items-center',
    'gap-2',
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'px-3',
    'py-2',
    'focus-within:ring-2',
    'focus-within:ring-accent',
  ].join(' ');

  const prefix = document.createElement('span');
  prefix.setAttribute('aria-hidden', 'true');
  prefix.className = 'text-base font-semibold text-text-mid';
  prefix.textContent = '$';

  const input = document.createElement('input');
  input.id = 'spot-price';
  input.type = 'number';
  input.setAttribute('inputmode', 'numeric');
  input.min = '0';
  input.dataset.testid = 'spot-price';
  input.placeholder = '0';
  input.className = [
    'min-h-[28px]',
    'min-w-0',
    'flex-1',
    'bg-transparent',
    'text-base',
    'font-semibold',
    'text-text-hi',
    'outline-none',
    'placeholder:text-text-lo',
  ].join(' ');

  let debounceTimer: number | null = null;

  input.addEventListener('input', () => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }

    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;

      const spotPrice = parseSpotPrice(input.value);
      setState({ spotPrice });
    }, DEBOUNCE_MS);
  });

  control.append(prefix, input);
  section.append(label, control);
  container.replaceChildren(section);
}
