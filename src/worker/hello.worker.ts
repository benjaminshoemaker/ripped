// Scaffold message-echo worker for Task 1.1.B. Deleted in Task 1.4.A when
// `simulate.worker.ts` lands.

self.addEventListener('message', (e: MessageEvent) => {
  // Echo whatever came in, confirming the round-trip works.
  self.postMessage({ echo: e.data });
});

export {};
