import './styles.css';

// Minimal entry point for Task 1.1.A. Real bootstrap logic arrives in Task 1.2.B.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = 'RIPPED — bootstrapping.';
  app.setAttribute('data-testid', 'page-loaded');
}
