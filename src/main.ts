import './styles.css';
import { computeConfidence, computeConfidenceBreakdown } from './math/confidence';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

function computeStaleSignals(data: CoreData | FullData): string[] {
  const now = Date.now();
  const entries: Array<[string, string]> = [
    ['Checklist', data.checklist_as_of],
    ['Odds', data.odds_as_of],
    ['Values', data.values_as_of],
    ['Comps', data.comps_as_of],
  ];
  const stale: string[] = [];
  for (const [label, timestamp] of entries) {
    const parsed = new Date(timestamp).getTime();
    if (!Number.isFinite(parsed)) continue;
    const days = Math.max(0, Math.floor((now - parsed) / DAY_MS));
    if (days >= STALE_DAYS) stale.push(label);
  }
  return stale;
}

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
  // Survives className overwrites in renderTeamDetail; leaves 1rem of breathing
  // room above the roster heading when scrollIntoView lands.
  section.style.scrollMarginTop = '1rem';

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

function createProbabilityOnlyResult(
  teamName: string,
  spotPrice: number,
  team: Team,
  data: CoreData | FullData,
): ComputedResult {
  return {
    team: teamName,
    spotPrice,
    mode: 'probability_only',
    ev: null,
    median: null,
    p10: null,
    p90: null,
    pZero: null,
    gap: null,
    gapPct: null,
    verdict: null,
    verdictIsHard: false,
    confidence: 'low',
    confidenceBreakdown: computeConfidenceBreakdown(data, teamName),
    contributors: [],
    probabilityTable: buildProbabilityTable(team, data),
    staleSignals: computeStaleSignals(data),
  };
}

function mountApp(container: HTMLElement, data: FullData | CoreData): void {
  const layout = document.createElement('div');
  layout.className = [
    'lg:mx-auto',
    'lg:grid',
    'lg:max-w-6xl',
    'lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]',
    'lg:gap-8',
    'lg:px-6',
  ].join(' ');

  const leftCol = document.createElement('div');
  leftCol.dataset.testid = 'layout-left';
  leftCol.className = 'lg:min-w-0';

  const rightCol = document.createElement('div');
  rightCol.dataset.testid = 'layout-right';
  rightCol.className = [
    'lg:sticky',
    'lg:top-6',
    'lg:self-start',
    'lg:max-h-[calc(100vh-3rem)]',
    'lg:overflow-y-auto',
  ].join(' ');

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
  leftCol.replaceChildren(
    ...Array.from(productCardHost.childNodes),
    ...Array.from(gridHost.childNodes),
    detailContainer,
  );
  rightCol.replaceChildren(
    priceInputContainer,
    resultPanel,
    disclaimerHost,
  );
  layout.replaceChildren(leftCol, rightCol);
  container.replaceChildren(layout);

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

    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches ?? false;
    requestAnimationFrame(() => {
      detailContainer.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const updateResultPanelVisibility = (state: ReturnType<typeof getState>): void => {
    const shouldShow = Boolean(
      state.selectedTeam && state.spotPrice && state.spotPrice > 0 && state.result,
    );
    resultPanel.hidden = !shouldShow;
  };

  let lastSimulationKey: string | null = null;
  let queuedSimulationKey: string | null = null;
  let lastRenderedResult: ComputedResult | null = null;
  let lastScrolledResult: ComputedResult | null = null;
  let hasAnimatedHero = false;
  let activeHeroAnimation: number | null = null;

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
    const confidenceBreakdown = computeConfidenceBreakdown(fullData, teamName);
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
      confidenceBreakdown,
      contributors,
      probabilityTable: buildProbabilityTable(team, fullData),
      staleSignals: computeStaleSignals(fullData),
    };

    setState({ result: computedResult });
  };

  const renderResultState = (state: ReturnType<typeof getState>): void => {
    if (state.result === lastRenderedResult) return;
    lastRenderedResult = state.result;

    if (state.result === null) {
      clearResultPanel(resultPanel);
      return;
    }

    renderResultPanel(resultPanel, state.result);
    maybeAnimateHero(state.result);
  };

  // Slot-machine reveal on the first time a result appears in this session.
  // Subsequent price edits update the EV instantly. Respects prefers-reduced-motion.
  // Flag is set up-front so a mid-animation re-render (user changes teams
  // before the first animation finishes) falls through to the instant path.
  const maybeAnimateHero = (result: ComputedResult): void => {
    if (activeHeroAnimation !== null) {
      window.clearInterval(activeHeroAnimation);
      activeHeroAnimation = null;
    }

    const target = result.ev;
    if (target === null || !Number.isFinite(target)) return;
    if (hasAnimatedHero) return;

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    hasAnimatedHero = true;
    if (reduceMotion) return;

    const hero = resultPanel.querySelector<HTMLElement>('[data-testid="ev-hero"]');
    if (!hero) return;

    const finalText = hero.textContent ?? '';
    const order = Math.max(10, Math.floor(target));
    const totalMs = 600;
    const tickMs = 50;
    const ticks = Math.floor(totalMs / tickMs);
    let tick = 0;
    hero.dataset.animating = 'true';

    activeHeroAnimation = window.setInterval(() => {
      tick += 1;
      if (tick >= ticks) {
        if (activeHeroAnimation !== null) {
          window.clearInterval(activeHeroAnimation);
          activeHeroAnimation = null;
        }
        hero.textContent = finalText;
        delete hero.dataset.animating;
        return;
      }
      // Bias the random range toward the target as we approach the end.
      const progress = tick / ticks;
      const jitter = Math.floor(order * (1 - progress) + (Math.random() * order));
      hero.textContent = `$${jitter}`;
    }, tickMs);
  };

  const scrollResultIntoView = (state: ReturnType<typeof getState>): void => {
    if (state.result === null) {
      lastScrolledResult = null;
      return;
    }

    if (state.result === lastScrolledResult) return;
    lastScrolledResult = state.result;

    if (!resultPanel.hidden && window.innerWidth < 1024) {
      resultPanel.scrollIntoView({ block: 'start' });
    }
  };

  const requestResultComputation = (state: ReturnType<typeof getState>): void => {
    const { selectedTeam, spotPrice } = state;
    if (!selectedTeam || spotPrice === null || spotPrice <= 0) {
      clearResults(state);
      return;
    }

    const appData = state.data;
    if (appData === null) {
      clearResults(state);
      return;
    }

    const simulationKey = `${state.mode}:${selectedTeam}:${spotPrice}`;
    const team = appData.teams[selectedTeam];
    if (!team) {
      clearResults(state);
      return;
    }

    if (state.mode === 'probability_only') {
      if (simulationKey === lastSimulationKey) return;

      queuedSimulationKey = null;
      lastSimulationKey = simulationKey;
      setState({
        result: createProbabilityOnlyResult(
          selectedTeam,
          spotPrice,
          team,
          appData,
        ),
      });
      return;
    }

    if (state.mode !== 'full' || !isFullData(appData)) {
      clearResults(state);
      return;
    }

    const fullData = appData;
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
        latest.mode !== 'full' ||
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
  renderResultState(getState());
  updateResultPanelVisibility(getState());

  subscribe((state) => {
    if (state.selectedTeam === lastSelectedTeam) return;
    renderSelectedTeam(state.selectedTeam);
  });

  subscribe(requestResultComputation);
  subscribe(renderResultState);
  subscribe(updateResultPanelVisibility);
  subscribe(scrollResultIntoView);
  subscribe(syncUrlHash);
}

// ─── URL hash <-> state sync (deep-link team + price) ────────────────────
// Format: #/<TeamName>/<price>  (team name is URI-encoded)
// Example: #/New%20York%20Giants/480
// Read at bootstrap, written via history.replaceState on state changes so the
// back button doesn't fill with intermediate prices.

let lastWrittenHash = '';

function parseHashLink(
  hash: string,
  data: FullData | CoreData,
): { team: string; price: number } | null {
  if (!hash.startsWith('#/')) return null;
  const rest = hash.slice(2);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const rawTeam = rest.slice(0, slash);
  const rawPrice = rest.slice(slash + 1);
  let team: string;
  try {
    team = decodeURIComponent(rawTeam);
  } catch {
    return null;
  }
  if (!(team in data.teams)) return null;
  const price = Number.parseFloat(rawPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { team, price };
}

function syncUrlHash(state: ReturnType<typeof getState>): void {
  const { selectedTeam, spotPrice } = state;
  const nextHash =
    selectedTeam && spotPrice && spotPrice > 0
      ? `#/${encodeURIComponent(selectedTeam)}/${spotPrice}`
      : '';

  if (nextHash === lastWrittenHash) return;
  lastWrittenHash = nextHash;

  // Use replaceState so price keystrokes don't flood the history stack.
  const targetUrl =
    window.location.pathname + window.location.search + (nextHash || '');
  try {
    window.history.replaceState(null, '', targetUrl);
  } catch {
    // Ignore — non-browser test environments.
  }
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

    // Deep-link hydration: if the user landed with #/<Team>/<price>, apply
    // it after mountApp has subscribed its render hooks so the result panel
    // populates on page load.
    const hashLink = parseHashLink(window.location.hash, result.data);
    if (hashLink) {
      lastWrittenHash = window.location.hash; // don't rewrite to itself
      setState({
        selectedTeam: hashLink.team,
        spotPrice: hashLink.price,
      });
      // Also press the matching team button so aria-pressed state syncs.
      const button = document.querySelector<HTMLButtonElement>(
        `button[data-team="${CSS.escape(hashLink.team)}"]`,
      );
      if (button) {
        for (const b of document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="team-grid"] button[data-team]',
        )) {
          b.setAttribute('aria-pressed', 'false');
        }
        button.setAttribute('aria-pressed', 'true');
      }
      // Populate the input control visibly.
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="spot-price"]',
      );
      if (input) input.value = String(hashLink.price);
    }
  } catch {
    renderFullPageError(app);
  }
}

void bootstrap();
