import type {
  ComputedResult,
  CoreData,
  FullData,
  LaunchMode,
} from './types';
import type { SimulateResponse } from './worker/simulate.worker';

// Module-level state. Built in Task 1.4.B with just the pieces worker-client
// needs; Task 2.2.A extends with selectedTeam, spotPrice, result, cache, etc.

export interface State {
  data: FullData | CoreData | null;
  mode: LaunchMode;
  selectedTeam: string | null;
  spotPrice: number | null;
  result: ComputedResult | null;
  cache: Map<string, SimulateResponse>;
  pendingRequestId: number;
}

const state: State = {
  data: null,
  mode: 'full',
  selectedTeam: null,
  spotPrice: null,
  result: null,
  cache: new Map(),
  pendingRequestId: 0,
};

type Subscriber = (s: Readonly<State>) => void;
const subscribers: Subscriber[] = [];

export function getState(): Readonly<State> {
  return state;
}

export function setState(patch: Partial<State>): void {
  Object.assign(state, patch);
  for (const fn of subscribers) fn(state);
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.push(fn);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

// Monotonically-increasing request IDs for worker-client supersession.
// Every call to simulate() bumps this, and only the latest request's result
// is applied to state. See src/worker-client.ts.
export function nextRequestId(): number {
  state.pendingRequestId += 1;
  return state.pendingRequestId;
}

// Test-only reset — clears all state and subscribers.
export function __resetStateForTests(): void {
  state.data = null;
  state.mode = 'full';
  state.selectedTeam = null;
  state.spotPrice = null;
  state.result = null;
  state.cache.clear();
  state.pendingRequestId = 0;
  subscribers.length = 0;
}
