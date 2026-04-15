import './styles.css';
import { setState } from './state';
import { renderTeamGrid } from './ui/team-grid';
import { validate } from './validate';

const ERROR_MESSAGE = 'Data unavailable. Try again in a minute, or DM @djhandle.';

function renderFullPageError(container: HTMLElement): void {
  const error = document.createElement('div');
  error.dataset.testid = 'full-page-error';
  error.textContent = ERROR_MESSAGE;
  error.className = [
    'min-h-screen',
    'px-4',
    'py-10',
    'text-center',
    'text-text-hi',
    'bg-bg-base',
  ].join(' ');

  container.replaceChildren(error);
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  app.setAttribute('data-testid', 'page-loaded');

  try {
    const response = await fetch('/data.json');
    if (!response.ok) {
      renderFullPageError(app);
      return;
    }

    const raw = await response.json();
    const result = validate(raw);

    if (result.mode === 'error') {
      renderFullPageError(app);
      return;
    }

    setState({ data: result.data, mode: result.mode });
    renderTeamGrid(app, result.data);
  } catch {
    renderFullPageError(app);
  }
}

void bootstrap();
