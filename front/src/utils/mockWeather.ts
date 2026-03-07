import { mmToColor } from './rainScale';

// ── Map mock – radar cell simulation ─────────────────────────────────────────

export interface MockCell {
  dlat: number;
  dlon: number;
  radius: number;
  mm: number;
}

export interface MockMapFrame {
  time: number;
  cells: MockCell[];
}

/** Wind drift per 10-min frame: ~30 km/h NE */
export const MOCK_DRIFT_LAT = 0.008;
export const MOCK_DRIFT_LON = 0.01;

const BASE_CELLS: MockCell[] = [
  { dlat: -0.04, dlon: -0.03, radius: 5500, mm: 6.2 },
  { dlat: 0.0, dlon: 0.04, radius: 3800, mm: 2.8 },
  { dlat: -0.02, dlon: 0.01, radius: 2800, mm: 1.1 },
  { dlat: 0.03, dlon: -0.01, radius: 4200, mm: 4.5 },
];

/**
 * Builds 12 radar frames (6 past + 6 future, every 10 min) with cells
 * drifting NE. Positions are relative offsets (dlat/dlon) from a user-
 * supplied origin so the frames stay portable.
 */
export function buildMockMapFrames(): MockMapFrame[] {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 12 }, (_, i) => {
    const offset = i - 6; // -6 … +5
    return {
      time: now + offset * 600,
      cells: BASE_CELLS.map(({ dlat, dlon, radius, mm }) => ({
        dlat: dlat + offset * MOCK_DRIFT_LAT,
        dlon: dlon + offset * MOCK_DRIFT_LON,
        radius,
        mm: mm * Math.max(0.3, 1 - Math.abs(offset) * 0.06),
      })),
    };
  });
}

// ── Timeline mock – 12-hour hourly forecast ───────────────────────────────────

export interface MockHourEntry {
  time: number;
  label: string;
  probability: number;
  precipitation: number;
  color: string;
}

/** Simulates a rain event arriving in ~2h, peaking, then fading */
const PRECIP_PATTERN = [0, 0, 0.2, 0.8, 2.4, 5.1, 8.3, 4.7, 2.1, 0.6, 0.1, 0];
const PROB_PATTERN = [5, 10, 25, 50, 75, 90, 95, 85, 65, 40, 15, 5];

/**
 * Returns 12 hourly entries starting from the next whole hour.
 */
export function buildMockHourEntries(): MockHourEntry[] {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);

  return PRECIP_PATTERN.map((mm, i) => {
    const t = base.getTime() + i * 3_600_000;
    const prob = PROB_PATTERN[i] ?? 0;
    return {
      time: t,
      label: new Date(t).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      probability: prob,
      precipitation: mm,
      color: mmToColor(mm),
    };
  });
}
