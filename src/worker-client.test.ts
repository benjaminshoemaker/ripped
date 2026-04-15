import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { simulate, __resetWorkerForTests } from './worker-client';
import { getState, setState, __resetStateForTests } from './state';
import type { FullData, Team } from './types';
import type { SimulateResponse } from './worker/simulate.worker';

// ─── Fixture ───────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const validFull = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures', 'valid-full.json'), 'utf-8'),
) as FullData;
const giants = validFull.teams['New York Giants']!;

// ─── MockWorker ────────────────────────────────────────────────────────────
// Installed as globalThis.Worker so worker-client's getWorker() picks it up.
// Supports manual dispatch so tests can simulate "two rapid postMessages".

type Handler = (e: MessageEvent<SimulateResponse>) => void;

class MockWorker {
  static lastInstance: MockWorker | null = null;

  handlers: Handler[] = [];
  postedRequests: Array<{ requestId: number }> = [];

  constructor(_url: string | URL, _opts?: unknown) {
    MockWorker.lastInstance = this;
  }

  addEventListener(type: string, l: Handler): void {
    if (type === 'message') this.handlers.push(l);
  }

  removeEventListener(type: string, l: Handler): void {
    if (type === 'message') {
      this.handlers = this.handlers.filter((h) => h !== l);
    }
  }

  listenerCount(): number {
    return this.handlers.length;
  }

  postMessage(data: { requestId: number }): void {
    this.postedRequests.push(data);
  }

  terminate(): void {
    this.handlers = [];
  }

  // Test helper: dispatch a synthetic worker-reply message.
  dispatch(data: SimulateResponse): void {
    for (const h of this.handlers) {
      h({ data } as MessageEvent<SimulateResponse>);
    }
  }
}

// ─── Test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetStateForTests();
  __resetWorkerForTests();
  (globalThis as unknown as { Worker: unknown }).Worker = MockWorker;
});

afterEach(() => {
  __resetWorkerForTests();
  delete (globalThis as unknown as { Worker?: unknown }).Worker;
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('worker-client.simulate()', () => {
  it('issues a new requestId on each call (monotonic)', () => {
    const r1 = simulate(giants, 100, validFull, () => {});
    const r2 = simulate(giants, 200, validFull, () => {});
    expect(r2).toBeGreaterThan(r1);
  });

  it('posts a SimulateRequest to the worker with the correct requestId', () => {
    const r = simulate(giants, 500, validFull, () => {});
    const posted = MockWorker.lastInstance!.postedRequests;
    expect(posted.length).toBe(1);
    expect(posted[0]!.requestId).toBe(r);
  });

  it('supersession: only the latest-requestId callback fires when both requests return', () => {
    const received: number[] = [];
    simulate(giants, 100, validFull, (res) => received.push(res.requestId));
    simulate(giants, 200, validFull, (res) => received.push(res.requestId));

    // Both requestIds are 1 and 2. The worker now dispatches them in order.
    const mock = MockWorker.lastInstance!;
    mock.dispatch({ requestId: 1, median: 0, p10: 0, p90: 0, pZero: 0, mcMean: 0 });
    mock.dispatch({ requestId: 2, median: 0, p10: 0, p90: 0, pZero: 0, mcMean: 0 });

    // Only requestId 2 (the current pendingRequestId) should fire.
    expect(received).toEqual([2]);
  });

  it('supersession: out-of-order worker replies still pick the latest', () => {
    const received: number[] = [];
    simulate(giants, 100, validFull, (res) => received.push(res.requestId));
    simulate(giants, 200, validFull, (res) => received.push(res.requestId));

    const mock = MockWorker.lastInstance!;
    // Dispatch request 2 first, then stale request 1
    mock.dispatch({ requestId: 2, median: 0, p10: 0, p90: 0, pZero: 0, mcMean: 0 });
    mock.dispatch({ requestId: 1, median: 0, p10: 0, p90: 0, pZero: 0, mcMean: 0 });

    expect(received).toEqual([2]);
  });

  it('stale request: simulate is called, then state advances, then worker replies → no callback', () => {
    const received: number[] = [];
    simulate(giants, 100, validFull, (res) => received.push(res.requestId));

    // Something else bumps pendingRequestId before the worker replies
    setState({ pendingRequestId: 999 });
    const mock = MockWorker.lastInstance!;
    mock.dispatch({ requestId: 1, median: 0, p10: 0, p90: 0, pZero: 0, mcMean: 0 });

    expect(received).toEqual([]);
  });

  it('removes listeners for superseded requests after their worker replies', () => {
    const received: number[] = [];
    const requestIds: number[] = [];

    for (let i = 0; i < 10; i++) {
      requestIds.push(
        simulate(giants, 100 + i, validFull, (res) => {
          received.push(res.requestId);
        }),
      );
    }

    const mock = MockWorker.lastInstance!;
    expect(mock.listenerCount()).toBe(10);

    for (const requestId of requestIds) {
      mock.dispatch({
        requestId,
        median: 0,
        p10: 0,
        p90: 0,
        pZero: 0,
        mcMean: 0,
      });
    }

    expect(received).toEqual([requestIds[requestIds.length - 1]]);
    expect(mock.listenerCount()).toBe(0);
  });
});

describe('worker-client no-worker fallback', () => {
  beforeEach(() => {
    // Disable the mock to force the synchronous fallback path.
    __resetWorkerForTests();
    delete (globalThis as unknown as { Worker?: unknown }).Worker;
  });

  it('falls back to synchronous simulation when Worker is undefined', () => {
    expect(typeof Worker).toBe('undefined');

    const received: SimulateResponse[] = [];
    simulate(giants, 500, validFull, (r) => received.push(r), 42);
    expect(received.length).toBe(1);
    expect(received[0]!.requestId).toBe(getState().pendingRequestId);
    expect(Number.isFinite(received[0]!.median)).toBe(true);
  });
});
