import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPriceInput } from './price-input';
import { getState, setState, __resetStateForTests } from '../state';
import type { FullData, Team } from '../types';
import * as workerClient from '../worker-client';

vi.mock('../worker-client', () => ({
  simulate: vi.fn(() => 1),
}));

type Listener = (event: Event) => void;

class FakeElement {
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  children: FakeElement[] = [];
  className = '';
  hidden = false;
  htmlFor = '';
  id = '';
  min = '';
  placeholder = '';
  textContent = '';
  type = '';
  value = '';

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children = [...nodes];
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const callback: Listener =
      typeof listener === 'function'
        ? (event) => listener.call(this as unknown as EventTarget, event)
        : (event) => listener.handleEvent(event);

    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }

    return true;
  }
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

const testTeam: Team = {
  base_veterans: ['Test Veteran'],
  rookies: [],
  base_auto_signers: [],
  rookie_auto_signers: [],
  chase_players: [],
  tiers: {
    'Test Veteran': 'tier_3_fair',
  },
};

const testData: FullData = {
  checklist_as_of: '2026-04-08T00:00:00Z',
  odds_as_of: '2026-04-15T09:00:00Z',
  values_as_of: '2026-04-14T00:00:00Z',
  comps_as_of: '2026-04-14T00:00:00Z',
  odds_source: '2025_official',
  values_ready: true,
  product: {
    name: 'Test Product',
    format: 'pyt_hobby_case',
    benchmark_case_cost_usd: 4200,
    boxes_per_case: 12,
    packs_per_box: 20,
    cards_per_pack: 4,
    ship_all_cards_assumption: true,
    guaranteed_per_box: {
      autos: 1,
      rookies: 20,
      base_refractors: 6,
      numbered_parallels: 2,
    },
  },
  checklist_totals: {
    base_veterans: 1,
    rookies: 1,
    base_auto_signers: 1,
    rookie_auto_signers: 1,
  },
  card_categories: {
    base: {
      slots_per_case: 1,
      denominator_key: 'base_veterans',
    },
  },
  teams: {
    Test: testTeam,
  },
  tier_values_usd: {
    tier_1_chase: { base: 10 },
    tier_2_strong: { base: 5 },
    tier_3_fair: { base: 1 },
    tier_4_cold: { base: 0 },
  },
};

function installFakeDom(): void {
  const fakeWindow = {
    setTimeout(handler: () => void, timeout: number): number {
      return globalThis.setTimeout(handler, timeout) as unknown as number;
    },
    clearTimeout(handle: number): void {
      globalThis.clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    },
  };

  (globalThis as unknown as { document: Document }).document =
    new FakeDocument() as unknown as Document;
  (globalThis as unknown as { window: Window & typeof globalThis }).window =
    fakeWindow as unknown as Window & typeof globalThis;
}

function restoreDom(): void {
  if (originalDocument === undefined) {
    delete (globalThis as unknown as { document?: Document }).document;
  } else {
    (globalThis as unknown as { document: Document }).document = originalDocument;
  }

  if (originalWindow === undefined) {
    delete (globalThis as unknown as { window?: Window & typeof globalThis }).window;
  } else {
    (globalThis as unknown as { window: Window & typeof globalThis }).window =
      originalWindow;
  }
}

function findByTestId(root: FakeElement, testId: string): FakeElement {
  if (root.dataset.testid === testId) return root;

  for (const child of root.children) {
    const found = findByTestIdOrNull(child, testId);
    if (found) return found;
  }

  throw new Error(`Missing element with data-testid="${testId}"`);
}

function findByTestIdOrNull(root: FakeElement, testId: string): FakeElement | null {
  if (root.dataset.testid === testId) return root;

  for (const child of root.children) {
    const found = findByTestIdOrNull(child, testId);
    if (found) return found;
  }

  return null;
}

function dispatchInput(input: FakeElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

beforeEach(() => {
  __resetStateForTests();
  vi.useFakeTimers();
  installFakeDom();
  vi.mocked(workerClient.simulate).mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  restoreDom();
  __resetStateForTests();
});

describe('price input', () => {
  it('debounces rapid input changes into a single simulate call', () => {
    setState({ selectedTeam: 'Test', data: testData });

    const container = new FakeElement('div');
    renderPriceInput(container as unknown as HTMLElement);
    const input = findByTestId(container, 'spot-price');

    for (const [index, value] of ['10', '20', '30', '40', '50'].entries()) {
      dispatchInput(input, value);
      if (index < 4) vi.advanceTimersByTime(50);
    }

    vi.advanceTimersByTime(199);
    expect(workerClient.simulate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(workerClient.simulate).toHaveBeenCalledTimes(1);
    expect(workerClient.simulate).toHaveBeenCalledWith(
      testTeam,
      50,
      testData,
      expect.any(Function),
    );
    expect(getState().spotPrice).toBe(50);
  });
});
