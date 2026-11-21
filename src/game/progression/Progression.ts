export interface Rank {
  name: string;
  xp: number;
}

export const RANKS: Rank[] = [
  { name: 'Cadet', xp: 0 },
  { name: 'Policier titulaire', xp: 250 },
  { name: 'Brigadier', xp: 700 },
  { name: 'Sergent', xp: 1400 },
  { name: 'Major', xp: 2400 },
  { name: 'Lieutenant', xp: 3800 },
  { name: 'Capitaine', xp: 5500 },
  { name: 'Commandant', xp: 7500 }
];

export function rankFor(xp: number): { name: string; nextXp: number | null } {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.xp) current = rank;
  }
  const index = RANKS.indexOf(current);
  const next = RANKS[index + 1];
  return { name: current.name, nextXp: next ? next.xp : null };
}

export interface SaveData {
  totalXp: number;
  shifts: number;
  calls: number;
  arrests: number;
  pv: number;
  warnings: number;
  distance: number;
}

const SAVE_KEY = 'patrolops-save-v1';

export function defaultSave(): SaveData {
  return { totalXp: 0, shifts: 0, calls: 0, arrests: 0, pv: 0, warnings: 0, distance: 0 };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
  }
}
