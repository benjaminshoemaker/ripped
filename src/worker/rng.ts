// mulberry32 — tiny deterministic PRNG used by simulate.worker.
// Good enough for Monte Carlo fairness testing; NOT cryptographic.
// Produces a stateful () => number in [0, 1).
//
// Reference: https://stackoverflow.com/a/47593316
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
