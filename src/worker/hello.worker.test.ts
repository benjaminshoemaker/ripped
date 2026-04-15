import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest runs in Node, not a browser. Spawning a real Web Worker here would
// require happy-dom + a polyfill and still wouldn't exercise Vite's worker
// bundler. Instead we verify the worker source is structured correctly so
// the browser runtime will round-trip messages correctly. The actual
// browser-runtime round-trip is exercised by the Vite dev server + Playwright
// smoke tests in Phase 2 (Task 2.0.A).

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, 'hello.worker.ts');
const workerSource = existsSync(workerPath) ? readFileSync(workerPath, 'utf-8') : '';

describe('hello.worker scaffold', () => {
  it('worker file exists at src/worker/hello.worker.ts', () => {
    expect(existsSync(workerPath)).toBe(true);
  });

  it('worker registers a message event listener', () => {
    expect(workerSource).toMatch(/self\.addEventListener\(\s*['"]message['"]/);
  });

  it('worker posts a message back (echo round-trip)', () => {
    expect(workerSource).toMatch(/self\.postMessage\(/);
  });

  it('worker echoes the incoming data', () => {
    // The echo contract is { echo: <data> } — asserted here so a future change
    // is caught by the test rather than discovered at runtime.
    expect(workerSource).toMatch(/echo:\s*e\.data/);
  });
});
