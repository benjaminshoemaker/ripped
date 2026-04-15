import type { CoreData, FullData, Team, TierLabel } from '../types';

type RosterKey =
  | 'base_veterans'
  | 'rookies'
  | 'base_auto_signers'
  | 'rookie_auto_signers';

interface RosterSectionConfig {
  key: RosterKey;
  label: string;
  testId: string;
}

const ROSTER_SECTIONS: RosterSectionConfig[] = [
  {
    key: 'base_veterans',
    label: 'Base Veterans',
    testId: 'roster-base-veterans',
  },
  {
    key: 'rookies',
    label: 'Rookies',
    testId: 'roster-rookies',
  },
  {
    key: 'base_auto_signers',
    label: 'Base Auto Signers',
    testId: 'roster-base-auto-signers',
  },
  {
    key: 'rookie_auto_signers',
    label: 'Rookie Auto Signers',
    testId: 'roster-rookie-auto-signers',
  },
];

const TIER_LABELS: Record<TierLabel, string> = {
  tier_1_chase: 'Tier 1 Chase',
  tier_2_strong: 'Tier 2 Strong',
  tier_3_fair: 'Tier 3 Fair',
  tier_4_cold: 'Tier 4 Cold',
};

function findTeamName(team: Team, data: FullData | CoreData): string | null {
  for (const [teamName, candidate] of Object.entries(data.teams)) {
    if (candidate === team) return teamName;
  }

  return null;
}

function renderPlayerRow(player: string, team: Team): HTMLLIElement {
  const tier = team.tiers[player]!;

  const isChase = tier === 'tier_1_chase' || team.chase_players.includes(player);

  const row = document.createElement('li');
  row.dataset.player = player;
  row.dataset.tier = tier;
  if (isChase) row.dataset.chase = 'true';
  row.className = [
    'flex',
    'min-h-[44px]',
    'items-start',
    'justify-between',
    'gap-3',
    'border-t',
    'border-bg-elev',
    'py-3',
    'text-sm',
    'first:border-t-0',
    isChase ? 'border-l-4 border-l-accent pl-3' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const name = document.createElement('span');
  name.className = 'min-w-0 flex-1 break-words font-medium text-text-hi';
  name.textContent = player;

  const badges = document.createElement('span');
  badges.className = 'flex shrink-0 flex-col items-end gap-1 text-right';

  const tierBadge = document.createElement('span');
  tierBadge.className = [
    'rounded-md',
    'border',
    'border-bg-elev',
    'bg-bg-base',
    'px-2',
    'py-1',
    'text-xs',
    'font-semibold',
    'text-text-mid',
  ].join(' ');
  tierBadge.textContent = TIER_LABELS[tier];

  badges.append(tierBadge);

  if (isChase) {
    const chaseBadge = document.createElement('span');
    chaseBadge.className = [
      'rounded-md',
      'bg-accent',
      'px-2',
      'py-1',
      'text-xs',
      'font-semibold',
      'text-bg-base',
    ].join(' ');
    chaseBadge.textContent = 'Chase';
    badges.append(chaseBadge);
  }

  row.append(name, badges);
  return row;
}

function renderRosterSection(config: RosterSectionConfig, team: Team): HTMLElement {
  const players = team[config.key];

  const section = document.createElement('section');
  section.dataset.testid = config.testId;
  section.className = [
    'rounded-lg',
    'border',
    'border-bg-elev',
    'bg-bg-card',
    'p-4',
  ].join(' ');

  const heading = document.createElement('h3');
  heading.className = 'text-base font-semibold text-text-hi';
  heading.textContent = `${config.label} (${players.length})`;

  const list = document.createElement('ul');
  list.className = 'mt-3';

  for (const player of players) {
    list.append(renderPlayerRow(player, team));
  }

  section.append(heading, list);
  return section;
}

export function renderTeamDetail(
  container: HTMLElement,
  team: Team,
  data: FullData | CoreData,
): void {
  const teamName = findTeamName(team, data);
  if (teamName) container.dataset.team = teamName;
  container.hidden = false;
  container.className = [
    'w-full',
    'max-w-3xl',
    'mx-auto',
    'px-4',
    'pb-8',
    'bg-bg-base',
    'text-text-hi',
  ].join(' ');

  const heading = document.createElement('h2');
  heading.className = 'text-xl font-semibold text-text-hi';
  heading.textContent = teamName ? `${teamName} roster` : 'Team roster';

  const note = document.createElement('p');
  note.className = 'mt-2 text-sm text-text-mid';
  note.textContent = 'Chase players are marked in green.';

  const sections = document.createElement('div');
  sections.className = 'mt-4 grid grid-cols-1 gap-4 md:grid-cols-2';

  for (const config of ROSTER_SECTIONS) {
    if (team[config.key].length === 0) continue;
    sections.append(renderRosterSection(config, team));
  }

  container.replaceChildren(heading, note, sections);
}
