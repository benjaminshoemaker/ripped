import './styles.css';

// Task 1.1.B contract: satisfy `grep -q "new Worker(new URL"` by wiring the
// scaffold worker here. Task 1.4.B replaces this with a proper worker-client.
if (typeof Worker !== 'undefined') {
  const helloWorker = new Worker(
    new URL('./worker/hello.worker.ts', import.meta.url),
    { type: 'module' },
  );
  helloWorker.addEventListener('message', (e) => {
    // eslint-disable-next-line no-console
    console.log('[ripped] hello worker echo:', e.data);
  });
  helloWorker.postMessage('hello from main thread');
}

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'RIPPED — bootstrapping.';
  app.setAttribute('data-testid', 'page-loaded');
}
