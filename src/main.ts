import './styles.css';
import { computeConfidence } from './math/confidence';
import { computeEV } from './math/ev';
import {
  probAnyChase,
  probAnyNumberedParallel,
  probAtLeastOne,
} from './math/probability';
import { computeVerdict } from './math/verdict';
import { getState, setState, subscribe } from './state';
import type { ComputedResult, CoreData, FullData, Team } from './types';
import { renderDisclaimer } from './ui/disclaimer';
import { renderPriceInput } from './ui/price-input';
import { renderProductCard } from './ui/product-card';
import { clearResultPanel, renderResultPanel } from './ui/result-panel';
import { renderTeamDetail } from './ui/team-detail';
import { renderTeamGrid } from './ui/team-grid';
import { validate } from './validate';
import { simulate } from './worker-client';
import type { SimulateResponse } from './worker/simulate.worker';

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

function isFullData(data: CoreData | FullData | null): data is FullData {
  return data !== null && 'tier_values_usd' in data;
}

function buildProbabilityTable(team: Team, data: FullData | CoreData): Record<string, number> {
  const probabilityTable: Record<string, number> = {};

  for (const category of Object.keys(data.card_categories)) {
    probabilityTable[category] = probAtLeastOne(category, team, data);
  }

  probabilityTable.any_numbered_parallel = probAnyNumberedParallel(team, data);
  probabilityTable.any_chase_card = probAnyChase(team, data);

  return probabilityTable;
}

function mountApp(container: HTMLElement, data: FullData | CoreData): void {
  const productCardHost = document.createElement('div');
  const gridHost = document.createElement('div');
  const detailContainer = createTeamDetailContainer();
  const priceInputContainer = document.createElement('div');
  const resultPanel = document.createElement('section');
  resultPanel.dataset.testid = 'result-panel';
  resultPanel.hidden = true;
  const disclaimerHost = document.createElement('div');

  renderProductCard(productCardHost, data);
  renderTeamGrid(gridHost, data);
  renderPriceInput(priceInputContainer);
  renderDisclaimer(disclaimerHost, data);
  container.replaceChildren(
    ...Array.from(productCardHost.childNodes),
    ...Array.from(gridHost.childNodes),
    detailContainer,
    priceInputContainer,
    resultPanel,
    disclaimerHost,
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
      state.selectedTeam && state.spotPrice && state.spotPrice > 0 && state.result,
    );
    resultPanel.hidden = !shouldShow;
  };

  let lastSimulationKey: string | null = null;
  let queuedSimulationKey: string | null = null;

  const clearResults = (state: ReturnType<typeof getState>): void => {
    lastSimulationKey = null;
    queuedSimulationKey = null;
    clearResultPanel(resultPanel);
    resultPanel.hidden = true;

    if (state.result !== null) {
      setState({ result: null });
    }
  };

  const renderSimulationResult = (
    teamName: string,
    spotPrice: number,
    fullData: FullData,
    response: SimulateResponse,
  ): void => {
    const latest = getState();
    if (
      latest.selectedTeam !== teamName ||
      latest.spotPrice !== spotPrice ||
      latest.data !== fullData
    ) {
      return;
    }

    const team = fullData.teams[teamName];
    if (!team) return;

    const { ev, contributors } = computeEV(team, fullData);
    const confidence = computeConfidence(fullData, teamName);
    const verdictResult = computeVerdict(ev, spotPrice, confidence);
    const gap = ev - spotPrice;

    const computedResult: ComputedResult = {
      team: teamName,
      spotPrice,
      mode: latest.mode,
      ev,
      median: response.median,
      p10: response.p10,
      p90: response.p90,
      pZero: response.pZero,
      gap,
      gapPct: gap / spotPrice,
      verdict: verdictResult.verdict,
      verdictIsHard: verdictResult.isHard,
      confidence,
      contributors,
      probabilityTable: buildProbabilityTable(team, fullData),
    };

    renderResultPanel(resultPanel, computedResult);
    resultPanel.hidden = false;
    resultPanel.scrollIntoView({ block: 'start' });
    setState({ result: computedResult });
  };

  const requestResultComputation = (state: ReturnType<typeof getState>): void => {
    const { selectedTeam, spotPrice } = state;
    if (!selectedTeam || spotPrice === null || spotPrice <= 0) {
      clearResults(state);
      return;
    }

    if (!isFullData(state.data)) {
      clearResults(state);
      return;
    }

    const fullData = state.data;
    const team = fullData.teams[selectedTeam];
    if (!team) {
      clearResults(state);
      return;
    }

    const simulationKey = `${selectedTeam}:${spotPrice}`;
    if (
      simulationKey === lastSimulationKey ||
      simulationKey === queuedSimulationKey
    ) {
      return;
    }

    queuedSimulationKey = simulationKey;
    queueMicrotask(() => {
      if (queuedSimulationKey !== simulationKey) return;

      const latest = getState();
      if (
        latest.selectedTeam !== selectedTeam ||
        latest.spotPrice !== spotPrice ||
        latest.data !== fullData ||
        !isFullData(latest.data)
      ) {
        return;
      }

      queuedSimulationKey = null;
      lastSimulationKey = simulationKey;
      simulate(team, spotPrice, fullData, (response) => {
        renderSimulationResult(selectedTeam, spotPrice, fullData, response);
      });
    });
  };

  renderSelectedTeam(getState().selectedTeam);
  updateResultPanelVisibility(getState());

  subscribe((state) => {
    if (state.selectedTeam === lastSelectedTeam) return;
    renderSelectedTeam(state.selectedTeam);
  });

  subscribe(requestResultComputation);
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
