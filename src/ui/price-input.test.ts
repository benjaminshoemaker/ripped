import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPriceInput } from './price-input';
import { getState, subscribe, __resetStateForTests } from '../state';

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
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  restoreDom();
  __resetStateForTests();
});

describe('price input', () => {
  it('debounces rapid input changes into a single spotPrice state update', () => {
    const observed: Array<number | null> = [];
    const unsubscribe = subscribe((state) => {
      observed.push(state.spotPrice);
    });
    const container = new FakeElement('div');
    renderPriceInput(container as unknown as HTMLElement);
    const input = findByTestId(container, 'spot-price');

    for (const [index, value] of ['10', '20', '30', '40', '50'].entries()) {
      dispatchInput(input, value);
      if (index < 4) vi.advanceTimersByTime(50);
    }

    vi.advanceTimersByTime(199);
    expect(getState().spotPrice).toBeNull();
    expect(observed).toEqual([]);

    vi.advanceTimersByTime(1);
    unsubscribe();

    expect(getState().spotPrice).toBe(50);
    expect(observed).toEqual([50]);
  });
});
