import { describe, it, expect, beforeEach } from 'vitest';
import {
  getState,
  setState,
  subscribe,
  nextRequestId,
  __resetStateForTests,
} from './state';

beforeEach(() => {
  __resetStateForTests();
});

describe('state', () => {
  it('setState patches state', () => {
    setState({ selectedTeam: 'Giants' });
    expect(getState().selectedTeam).toBe('Giants');
  });

  it('subscribers fire on setState', () => {
    const calls: string[] = [];
    subscribe((s) => calls.push(s.selectedTeam ?? 'null'));
    setState({ selectedTeam: 'Giants' });
    setState({ selectedTeam: 'Jets' });
    expect(calls).toEqual(['Giants', 'Jets']);
  });

  it('subscribe returns an unsubscribe function', () => {
    const calls: number[] = [];
    const unsub = subscribe(() => calls.push(1));
    setState({ spotPrice: 100 });
    unsub();
    setState({ spotPrice: 200 });
    expect(calls.length).toBe(1);
  });

  it('nextRequestId returns monotonically increasing integers', () => {
    const a = nextRequestId();
    const b = nextRequestId();
    const c = nextRequestId();
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
  });

  it('nextRequestId updates state.pendingRequestId', () => {
    nextRequestId();
    nextRequestId();
    expect(getState().pendingRequestId).toBe(2);
  });

  it('state is a Readonly view from getState (patches go through setState)', () => {
    setState({ spotPrice: 500 });
    expect(getState().spotPrice).toBe(500);
  });
});
