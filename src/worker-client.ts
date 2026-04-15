import { getState, nextRequestId } from './state';
import type { FullData, Team } from './types';
import type { SimulateRequest, SimulateResponse } from './worker/simulate.worker';
import { simulateBreak } from './worker/simulate.worker';

// Lazily-created singleton Worker. In Node test environments `Worker` is
// undefined, so getWorker() returns null and simulate() falls back to
// synchronous main-thread execution.
let _worker: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!_worker) {
    _worker = new Worker(
      new URL('./worker/simulate.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return _worker;
}

// Core API. Each call bumps state.pendingRequestId and only the result whose
// requestId matches the current pendingRequestId is delivered to onResult.
// Older in-flight results are discarded silently (supersession, not true
// cancellation — the worker keeps running but nothing visible changes).
export function simulate(
  team: Team,
  spotPrice: number,
  data: FullData,
  onResult: (result: SimulateResponse) => void,
  seed: number = Math.floor(Math.random() * 0xffffffff),
): number {
  const requestId = nextRequestId();
  const req: SimulateRequest = { requestId, team, data, spotPrice, seed };
  const worker = getWorker();

  if (!worker) {
    // No-worker fallback: run synchronously on the main thread.
    const result = simulateBreak(req);
    if (getState().pendingRequestId === requestId) {
      onResult(result);
    }
    return requestId;
  }

  const handler = (e: MessageEvent<SimulateResponse>): void => {
    if (e.data.requestId !== requestId) return; // different request's echo
    worker.removeEventListener('message', handler);
    if (getState().pendingRequestId !== requestId) return; // superseded
    onResult(e.data);
  };
  worker.addEventListener('message', handler);
  worker.postMessage(req);
  return requestId;
}

// Test-only: reset the lazy worker singleton so tests can install a mock.
export function __resetWorkerForTests(): void {
  if (_worker) {
    try {
      _worker.terminate();
    } catch {
      /* ignore */
    }
  }
  _worker = null;
}
