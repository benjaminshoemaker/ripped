import './styles.css';
import { getState, setState, subscribe } from './state';
import type { CoreData, FullData } from './types';
import { renderPriceInput } from './ui/price-input';
import { renderTeamDetail } from './ui/team-detail';
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

function createTeamDetailContainer(): HTMLElement {
  const section = document.createElement('section');
  section.dataset.testid = 'team-detail';
  section.hidden = true;
  section.className = [
    'w-full',
    'max-w-3xl',
    'mx-auto',
    'px-4',
    'pb-8',
    'bg-bg-base',
    'text-text-hi',
  ].join(' ');

  return section;
}

function clearTeamDetail(container: HTMLElement): void {
  container.hidden = true;
  delete container.dataset.team;
  container.replaceChildren();
}

function mountApp(container: HTMLElement, data: FullData | CoreData): void {
  const gridHost = document.createElement('div');
  const detailContainer = createTeamDetailContainer();
  const priceInputContainer = document.createElement('div');
  const resultPanel = document.createElement('section');
  resultPanel.dataset.testid = 'result-panel';
  resultPanel.hidden = true;

  renderTeamGrid(gridHost, data);
  renderPriceInput(priceInputContainer);
  container.replaceChildren(
    ...Array.from(gridHost.childNodes),
    detailContainer,
    priceInputContainer,
    resultPanel,
  );

  let lastSelectedTeam: string | null = null;

  const renderSelectedTeam = (selectedTeam: string | null): void => {
    lastSelectedTeam = selectedTeam;

    if (selectedTeam === null) {
      clearTeamDetail(detailContainer);
      return;
    }

    const team = data.teams[selectedTeam];
    if (!team) {
      clearTeamDetail(detailContainer);
      return;
    }

    renderTeamDetail(detailContainer, team, data);
  };

  const updateResultPanelVisibility = (state: ReturnType<typeof getState>): void => {
    const shouldShow = Boolean(
      state.selectedTeam && state.spotPrice && state.spotPrice > 0,
    );
    resultPanel.hidden = !shouldShow;
  };

  renderSelectedTeam(getState().selectedTeam);
  updateResultPanelVisibility(getState());

  subscribe((state) => {
    if (state.selectedTeam === lastSelectedTeam) return;
    renderSelectedTeam(state.selectedTeam);
  });

  subscribe(updateResultPanelVisibility);
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
    mountApp(app, result.data);
  } catch {
    renderFullPageError(app);
  }
}

void bootstrap();
