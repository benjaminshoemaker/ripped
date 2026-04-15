import { setState } from '../state';
import type { CoreData, FullData } from '../types';

export function renderTeamGrid(container: HTMLElement, data: FullData | CoreData): void {
  const section = document.createElement('section');
  section.className = [
    'w-full',
    'max-w-3xl',
    'mx-auto',
    'px-4',
    'py-6',
    'bg-bg-base',
    'text-text-hi',
  ].join(' ');

  const heading = document.createElement('h1');
  heading.className = 'mb-4 text-xl font-semibold text-text-hi';
  heading.textContent = 'Pick your team';

  const grid = document.createElement('div');
  grid.dataset.testid = 'team-grid';
  grid.className = [
    'grid',
    'w-full',
    'grid-cols-1',
    'gap-3',
    'min-[480px]:grid-cols-2',
    'md:grid-cols-3',
    'lg:grid-cols-2',
  ].join(' ');

  const buttons: HTMLButtonElement[] = [];

  for (const teamName of Object.keys(data.teams)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.team = teamName;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = teamName;
    button.className = [
      'min-h-[44px]',
      'min-w-[44px]',
      'w-full',
      'rounded-lg',
      'border',
      'border-bg-elev',
      'border-b-4',
      'border-b-transparent',
      'bg-bg-card',
      'px-4',
      'py-3',
      'text-left',
      'text-sm',
      'font-semibold',
      'text-text-hi',
      'break-words',
      'transition-colors',
      'duration-150',
      'hover:bg-bg-elev',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-accent',
      'aria-pressed:bg-accent',
      'aria-pressed:border-b-accent',
      'aria-pressed:text-bg-base',
    ].join(' ');

    button.addEventListener('click', () => {
      for (const teamButton of buttons) {
        teamButton.setAttribute('aria-pressed', 'false');
      }
      button.setAttribute('aria-pressed', 'true');
      setState({ selectedTeam: teamName });
    });

    buttons.push(button);
    grid.append(button);
  }

  section.append(heading, grid);
  container.replaceChildren(section);
}
