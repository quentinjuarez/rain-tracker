// ── Rain intensity color scale ────────────────────────────────────────────────
// Based on standard meteorological radar conventions:
// light drizzle (sky) → light rain (blue) → moderate (blue) → heavy (cyan) → very heavy (amber) → extreme (red)

export interface RainBand {
  /** Lower bound in mm (inclusive) */
  threshold: number;
  /** Hex color */
  color: string;
  /** Display label (mm) */
  label: string;
  /** Pre-parsed RGB for canvas rendering */
  rgb: [number, number, number];
}

export const RAIN_SCALE: RainBand[] = [
  { threshold: 0.1, color: '#bae6fd', label: '0.1', rgb: [186, 230, 253] }, // sky-200   – drizzle
  { threshold: 0.5, color: '#38bdf8', label: '0.5', rgb: [56, 189, 248] }, // sky-400   – light
  { threshold: 2, color: '#3b82f6', label: '2', rgb: [59, 130, 246] }, // blue-500  – moderate
  { threshold: 5, color: '#3f1bb5', label: '5', rgb: [63, 27, 181] }, // violet-600  – heavy
  { threshold: 10, color: '#fbbf24', label: '10', rgb: [251, 191, 36] }, // amber-400 – very heavy
  { threshold: 20, color: '#ef4444', label: '20+', rgb: [239, 68, 68] }, // red-500   – extreme
];

/** Trace / no-rain sentinel */
export const TRACE_COLOR = 'rgba(148,163,184,0.35)'; // slate-400

/** Returns a hex/rgba color for a given mm value */
export function mmToColor(mm: number): string {
  if (mm < 0.1) return TRACE_COLOR;
  for (let i = RAIN_SCALE.length - 1; i >= 0; i--) {
    if (mm >= (RAIN_SCALE[i]?.threshold ?? 0))
      return RAIN_SCALE[i]?.color ?? TRACE_COLOR;
  }
  return RAIN_SCALE[0]?.color ?? TRACE_COLOR;
}

/** Returns an RGB tuple for canvas radial gradient rendering */
export function mmToRgb(mm: number): [number, number, number] {
  if (mm < 0.1) return [148, 163, 184];
  for (let i = RAIN_SCALE.length - 1; i >= 0; i--) {
    if (mm >= (RAIN_SCALE[i]?.threshold ?? 0))
      return RAIN_SCALE[i]?.rgb ?? [148, 163, 184];
  }
  return RAIN_SCALE[0]?.rgb ?? [148, 163, 184];
}

/**
 * Maps mm to a 0-100 bar-width percentage using a log scale anchored on
 * the RAIN_SCALE thresholds: 0.1mm≈7%, 0.5mm≈18%, 2mm≈33%,
 * 5mm≈53%, 10mm≈72%, 20mm=100%.
 */
export function mmToWidthPct(mm: number): number {
  if (mm <= 0) return 0;
  return Math.min(100, (Math.log(mm + 1) / Math.log(21)) * 100);
}
