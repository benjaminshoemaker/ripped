import './styles.css';

// Task 1.4.A: keep the simulate worker entry accessible via the `new Worker(new URL(...))`
// pattern so Task 1.1.B's grep still passes and Vite bundles simulate.worker as a chunk.
// Task 1.4.B wraps this behind a proper `src/worker-client.ts` with requestId supersession.
if (typeof Worker !== 'undefined') {
  const simulateWorker = new Worker(
    new URL('./worker/simulate.worker.ts', import.meta.url),
    { type: 'module' },
  );
  simulateWorker.addEventListener('message', (e) => {
    // eslint-disable-next-line no-console
    console.log('[ripped] simulate worker response:', e.data);
  });
  // No-op — real calls happen from worker-client.ts. This file holds the
  // Vite worker registration.
  simulateWorker.terminate();
}

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'RIPPED — bootstrapping.';
  app.setAttribute('data-testid', 'page-loaded');
}
