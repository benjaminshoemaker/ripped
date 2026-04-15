#!/usr/bin/env node
// Generate a schema-valid synthetic `public/data.json` for Phase 2 development.
// Uses:
//   - Per-team counts from DJ's original `chrome football 2025 break odds.json`
//   - Real player names for sanity-check teams (Giants, Titans, Jaguars, Jets,
//     Raiders, Patriots, Bears, Browns) from the PDF checklist
//   - Placeholder player names ("<Team> Vet N" / "<Team> Rook N") for the rest
//   - Reasonable tier assignments based on chase heuristics
//   - Tier-value estimates that map roughly to 2024 Chrome Football comps
//
// This file is a DEVELOPMENT BRIDGE. DJ replaces it with real data before launch.
// The schema and shape match TECHNICAL_SPEC §5.1 exactly so the swap is trivial.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Source: DJ's existing counts ───────────────────────────────────────────
const djSource = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'chrome football 2025 break odds.json'), 'utf-8'),
);
const teamCounts = djSource.teams;

// ─── Real rosters for sanity-check teams + chase callouts ──────────────────
// Every player must be in exactly the right category lists:
//   base_veterans + rookies (no overlap)
//   base_auto_signers ⊆ base_veterans
//   rookie_auto_signers ⊆ rookies
const realRosters = {
  'New York Giants': {
    base_veterans: ['Malik Nabers', 'Darius Slayton', "Wan'Dale Robinson", 'Tyrone Tracy Jr.', 'Russell Wilson', 'Dexter Lawrence II', 'Tyler Nubin', 'Micah McFadden', 'Theo Johnson', 'Brian Burns'],
    rookies: ['Jaxson Dart', 'Cam Skattebo', 'Abdul Carter'],
    base_auto_signers: ['Malik Nabers', 'Russell Wilson'],
    rookie_auto_signers: ['Jaxson Dart', 'Cam Skattebo', 'Abdul Carter', 'Tyler Nubin'], // 4 per DJ's count
    chase_players: ['Jaxson Dart', 'Malik Nabers'],
  },
  'Tennessee Titans': {
    // Only 4 base veterans in DJ's count — Titans is an edge case (rookie-dominated).
    base_veterans: ['Jeffery Simmons', 'Tony Pollard', 'Calvin Ridley', "T'Vondre Sweat"],
    rookies: ['Cam Ward', 'Gunnar Helm', 'Kalel Mullings', 'Elic Ayomanor', 'Kevin Winston Jr.'],
    base_auto_signers: [], // 0 — real Tennessee edge case per JSON note
    rookie_auto_signers: ['Cam Ward', 'Gunnar Helm', 'Kalel Mullings', 'Elic Ayomanor', 'Kevin Winston Jr.'],
    chase_players: ['Cam Ward'],
  },
  'Jacksonville Jaguars': {
    base_veterans: ['Tim Patrick', 'Brian Thomas Jr.', 'Dyami Brown', 'Brenton Strange', 'Trevor Lawrence', 'Travis Etienne Jr.', 'Maason Smith', 'Travon Walker', 'Jakobi Meyers'],
    rookies: ['Travis Hunter', 'Bhayshul Tuten', 'LeQuint Allen Jr.', 'Seth Henigan'],
    base_auto_signers: ['Brian Thomas Jr.', 'Trevor Lawrence'],
    // Jaguars get an extra rookie_auto because Travis Hunter appears TWICE in the checklist
    rookie_auto_signers: ['Travis Hunter', 'Travis Hunter', 'Bhayshul Tuten', 'LeQuint Allen Jr.', 'Seth Henigan'],
    chase_players: ['Travis Hunter', 'Brian Thomas Jr.'],
  },
  'New York Jets': {
    base_veterans: ['Garrett Wilson', 'Allen Lazard', 'Justin Fields', 'Breece Hall', 'Jeremy Ruckert', 'Braelon Allen', 'Will McDonald IV', 'Khalil Herbert'],
    rookies: ['Brady Cook', 'Donovan Edwards', 'Mason Taylor'],
    base_auto_signers: ['Garrett Wilson', 'Breece Hall'],
    rookie_auto_signers: ['Brady Cook', 'Donovan Edwards', 'Mason Taylor'],
    chase_players: ['Garrett Wilson'],
  },
  'Las Vegas Raiders': {
    base_veterans: ['Tre Tucker', 'Jackson Powers-Johnson', 'Brock Bowers', 'Geno Smith', 'Maxx Crosby', 'Raheem Mostert', 'Kolton Miller', 'Jeremy Chinn'],
    rookies: ['Ashton Jeanty', 'Darien Porter', "Dont'e Thornton Jr.", 'Jack Bech'],
    base_auto_signers: ['Brock Bowers', 'Maxx Crosby', 'Geno Smith'],
    rookie_auto_signers: ['Ashton Jeanty', 'Darien Porter', "Dont'e Thornton Jr.", 'Jack Bech'],
    chase_players: ['Ashton Jeanty', 'Brock Bowers'],
  },
  'New England Patriots': {
    base_veterans: ['Stefon Diggs', 'Mack Hollins', 'Drake Maye', 'Hunter Henry', 'Rhamondre Stevenson', 'Garrett Bradbury', 'Jahlani Tavai', 'Khyiris Tonga', 'Robert Spillane'],
    rookies: ['TreVeyon Henderson', 'Will Campbell'],
    base_auto_signers: ['Drake Maye'],
    rookie_auto_signers: ['TreVeyon Henderson', 'Will Campbell'],
    chase_players: ['Drake Maye', 'TreVeyon Henderson'],
  },
  'Chicago Bears': {
    base_veterans: ['DJ Moore', 'Rome Odunze', 'Joe Thuney', 'Cole Kmet', 'Caleb Williams', "D'Andre Swift", 'Tyson Bagent', 'Roschon Johnson', 'Montez Sweat', 'Jaylon Johnson'],
    rookies: ['Shemar Turner', 'Luther Burden III', 'Colston Loveland', 'Kyle Monangai'],
    base_auto_signers: ['Caleb Williams', 'DJ Moore', 'Rome Odunze', 'Cole Kmet'],
    rookie_auto_signers: ['Luther Burden III', 'Colston Loveland', 'Shemar Turner'],
    chase_players: ['Caleb Williams', 'Rome Odunze'],
  },
  'Cleveland Browns': {
    base_veterans: ['Grant Delpit', 'Cedric Tillman', 'Jerry Jeudy', 'David Njoku', 'Myles Garrett', 'Jerome Ford', 'Denzel Ward', 'Cam Robinson'],
    rookies: ['Mason Graham', 'Dylan Sampson', 'Shedeur Sanders', 'Dillon Gabriel', 'Quinshon Judkins', 'Harold Fannin Jr.', 'Isaiah Bond'],
    base_auto_signers: ['Myles Garrett', 'Jerry Jeudy', 'David Njoku'],
    rookie_auto_signers: ['Mason Graham', 'Dylan Sampson', 'Shedeur Sanders', 'Dillon Gabriel', 'Quinshon Judkins', 'Harold Fannin Jr.', 'Isaiah Bond'],
    chase_players: ['Shedeur Sanders', 'Dillon Gabriel', 'Myles Garrett'],
  },
};

// ─── Placeholder roster generator for teams we don't have real names for ───
function teamShortName(teamName) {
  return teamName.split(' ').map((w) => w[0]).join('').toUpperCase();
}

function generatePlaceholderRoster(teamName, counts) {
  const short = teamShortName(teamName);
  const base_veterans = [];
  const rookies = [];
  const base_auto_signers = [];
  const rookie_auto_signers = [];

  for (let i = 1; i <= counts.base; i++) base_veterans.push(`${short} Vet ${i}`);
  for (let i = 1; i <= counts.rookies; i++) rookies.push(`${short} Rookie ${i}`);

  // First N of each list become auto signers
  for (let i = 0; i < counts.base_autos; i++) base_auto_signers.push(base_veterans[i]);
  for (let i = 0; i < counts.rookie_autos; i++) {
    rookie_auto_signers.push(rookies[i % rookies.length]);
  }

  const chase_players = [];
  if (rookies.length > 0) chase_players.push(rookies[0]);
  if (base_veterans.length > 0) chase_players.push(base_veterans[0]);

  return { base_veterans, rookies, base_auto_signers, rookie_auto_signers, chase_players };
}

// ─── Tier assignment ───────────────────────────────────────────────────────
// Chase players → tier_1_chase
// Other rookie auto signers → tier_2_strong
// Other base auto signers → tier_2_strong
// Non-auto veterans → tier_3_fair
// Non-auto rookies → tier_3_fair
function assignTiers(roster) {
  const tiers = {};
  const chaseSet = new Set(roster.chase_players);
  const baseAutoSet = new Set(roster.base_auto_signers);
  const rookieAutoSet = new Set(roster.rookie_auto_signers);

  for (const p of roster.base_veterans) {
    if (chaseSet.has(p)) tiers[p] = 'tier_1_chase';
    else if (baseAutoSet.has(p)) tiers[p] = 'tier_2_strong';
    else tiers[p] = 'tier_3_fair';
  }
  for (const p of roster.rookies) {
    if (chaseSet.has(p)) tiers[p] = 'tier_1_chase';
    else if (rookieAutoSet.has(p)) tiers[p] = 'tier_2_strong';
    else tiers[p] = 'tier_3_fair';
  }
  return tiers;
}

// ─── Build teams object ────────────────────────────────────────────────────
const teams = {};
for (const [teamName, counts] of Object.entries(teamCounts)) {
  const roster = realRosters[teamName] ?? generatePlaceholderRoster(teamName, counts);
  teams[teamName] = {
    base_veterans: roster.base_veterans,
    rookies: roster.rookies,
    base_auto_signers: roster.base_auto_signers,
    rookie_auto_signers: roster.rookie_auto_signers,
    chase_players: roster.chase_players,
    tiers: assignTiers(roster),
  };
}

// ─── Tier values (placeholder estimates from 2024 Chrome Football comps) ──
// These are ballpark figures — DJ replaces with real comps before launch.
// Shape: per tier × per card category, USD.
const tier_values_usd = {
  tier_1_chase: {
    base: 8,
    base_refractor: 25,
    base_auto: 250,
    rookie: 45,
    rookie_refractor: 110,
    rookie_auto: 650,
    gold_refractor_50: 250,
    orange_refractor_25: 500,
    red_refractor_5: 2500,
    superfractor_1: 30000,
    rpa_gold_50: 2500,
    rpa_orange_25: 5000,
  },
  tier_2_strong: {
    base: 4,
    base_refractor: 12,
    base_auto: 85,
    rookie: 15,
    rookie_refractor: 35,
    rookie_auto: 180,
    gold_refractor_50: 90,
    orange_refractor_25: 180,
    red_refractor_5: 900,
    superfractor_1: 8000,
    rpa_gold_50: 700,
    rpa_orange_25: 1400,
  },
  tier_3_fair: {
    base: 2,
    base_refractor: 5,
    base_auto: 32,
    rookie: 6,
    rookie_refractor: 12,
    rookie_auto: 70,
    gold_refractor_50: 35,
    orange_refractor_25: 70,
    red_refractor_5: 350,
    superfractor_1: 3000,
    rpa_gold_50: 280,
    rpa_orange_25: 560,
  },
  tier_4_cold: {
    base: 1,
    base_refractor: 2,
    base_auto: 12,
    rookie: 2,
    rookie_refractor: 4,
    rookie_auto: 25,
    gold_refractor_50: 12,
    orange_refractor_25: 25,
    red_refractor_5: 125,
    superfractor_1: 1500,
    rpa_gold_50: 100,
    rpa_orange_25: 200,
  },
};

// ─── Card categories — slots_per_case values ──────────────────────────────
// Based on hobby format: 12 boxes × 20 packs × 4 cards = 960 cards per case
// Rookies: 20/box × 12 boxes = 240 slots
// Base veterans: remaining slots after rookies, refractors, parallels, autos
// Refractors: 6/box × 12 = 72
// Rookie refractors: ~7/box × 12 = 84
// Autos: 1/box × 12 = 12 hobby autos per case (split base/rookie via pool size)
// Numbered parallels: 2/box × 12 = 24, split across rarity tiers
const card_categories = {
  base: { slots_per_case: 720, denominator_key: 'base_veterans' },
  base_refractor: { slots_per_case: 72, denominator_key: 'base_veterans' },
  rookie: { slots_per_case: 240, denominator_key: 'rookies' },
  rookie_refractor: { slots_per_case: 80, denominator_key: 'rookies' },
  base_auto: { slots_per_case: 0.083, denominator_key: 'base_auto_signers' },
  rookie_auto: { slots_per_case: 0.5, denominator_key: 'rookie_auto_signers' },
  gold_refractor_50: { slots_per_case: 0.2, denominator_key: 'base_veterans' },
  orange_refractor_25: { slots_per_case: 0.1, denominator_key: 'base_veterans' },
  red_refractor_5: { slots_per_case: 0.02, denominator_key: 'base_veterans' },
  superfractor_1: { slots_per_case: 0.012, denominator_key: 'base_veterans' },
  rpa_gold_50: { slots_per_case: 0.145, denominator_key: 'rookie_auto_signers' },
  rpa_orange_25: { slots_per_case: 0.072, denominator_key: 'rookie_auto_signers' },
};

// ─── Confidence inputs — populated for tier-1 chase players in real-roster teams ──
// Synthetic values calibrated so the real-roster teams hit `medium` confidence,
// not `high` (since odds_source is 2024_placeholder → condition 3 fails).
const confidence_inputs = {};
const nowIso = new Date().toISOString();
for (const teamName of Object.keys(realRosters)) {
  for (const chase of realRosters[teamName].chase_players) {
    if (!confidence_inputs[chase]) {
      confidence_inputs[chase] = {
        rookie_auto: {
          comp_count: 8,
          comp_window_days: 21,
          last_comp_refresh: nowIso,
          value_source: 'ebay_sold_synthetic',
        },
      };
    }
  }
}

// ─── Final data object ────────────────────────────────────────────────────
const data = {
  checklist_as_of: '2026-04-08T00:00:00Z',
  odds_as_of: '2026-04-14T12:00:00Z',
  values_as_of: nowIso,
  comps_as_of: nowIso,
  data_as_of: nowIso,

  odds_source: '2024_placeholder',
  values_ready: true,

  product: {
    name: '2025 Topps Chrome Football',
    format: 'pyt_hobby_case',
    benchmark_case_cost_usd: 4200,
    boxes_per_case: 12,
    packs_per_box: 20,
    cards_per_pack: 4,
    ship_all_cards_assumption: true,
    guaranteed_per_box: {
      autos: 1,
      rookies: 20,
      base_refractors: 6,
      numbered_parallels: 2,
    },
  },

  checklist_totals: {
    base_veterans: djSource.checklist_totals.base_veterans,
    rookies: djSource.checklist_totals.rookies,
    base_auto_signers: djSource.checklist_totals.base_auto_signers,
    rookie_auto_signers: djSource.checklist_totals.rookie_auto_signers,
  },

  card_categories,
  tier_values_usd,
  teams,
  confidence_inputs,
};

// ─── Write ────────────────────────────────────────────────────────────────
const outPath = path.join(ROOT, 'public', 'data.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');

const teamCount = Object.keys(data.teams).length;
const realCount = Object.keys(realRosters).length;
console.log(`✓ Wrote ${outPath}`);
console.log(`  - ${teamCount} teams (${realCount} with real rosters, ${teamCount - realCount} synthetic)`);
console.log(`  - odds_source: ${data.odds_source}`);
console.log(`  - values_ready: ${data.values_ready}`);
console.log(`  - confidence_inputs: ${Object.keys(confidence_inputs).length} tier-1 players`);
