import { ref, watch, type Ref } from 'vue';
import { useProfileStore } from '../stores/profile';
import { buildMockMapFrames, type MockMapFrame } from '../utils/mockWeather';
import type { RainProvider, RainBar } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RadarFrame {
  time: number; // Unix seconds
  path: string; // RainViewer tile path
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API = 'http://localhost:14001';
const FRAME_INTERVAL_MS = 800;

// ── Singleton state ───────────────────────────────────────────────────────────

const provider: Ref<RainProvider> = ref('rainbow');
const devMode: Ref<boolean> = ref(false);
const playing: Ref<boolean> = ref(true);
const activeIndex: Ref<number> = ref(0);
const loading: Ref<boolean> = ref(false);

// Full radar frames (path + timestamp) from RainViewer
const radarFrames: Ref<RadarFrame[]> = ref([]);
// DEV mock map frames – used by RainMap to draw canvas cells
const mockMapFrames: Ref<MockMapFrame[]> = ref([]);
// Timezone of the selected location (e.g. "Europe/Paris") – from Open-Meteo
const locationTimezone: Ref<string> = ref(
  Intl.DateTimeFormat().resolvedOptions().timeZone,
);

// Rainbow Weather nowcast bars (minute-by-minute, 4 h)
const rainbowBars: Ref<RainBar[]> = ref([]);
const rainbowError: Ref<string | null> = ref(null);

// OpenWeatherMap 5-day / 3-hour forecast bars
const owmBars: Ref<RainBar[]> = ref([]);
const owmError: Ref<string | null> = ref(null);

let timer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeFrameCount() {
  if (provider.value === 'rainbow') return rainbowBars.value.length;
  if (provider.value === 'owm') return owmBars.value.length;
  return radarFrames.value.length;
}

// ── Animation timer ───────────────────────────────────────────────────────────

function startSharedTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (playing.value) {
      const total = activeFrameCount();
      if (total) activeIndex.value = (activeIndex.value + 1) % total;
    }
  }, FRAME_INTERVAL_MS);
}

function stopSharedTimer() {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
  if (consumerCount === 0 && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ── Timezone fetch (Open-Meteo via backend) ──────────────────────────────────

async function fetchLocationTimezone(lat: number, lon: number) {
  try {
    const res = await fetch(`${API}/weather?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (data.timezone) locationTimezone.value = data.timezone;
  } catch {
    // keep whatever was already set
  }
}

// ── RainViewer fetch ──────────────────────────────────────────────────────────

async function fetchRadarFrames() {
  if (devMode.value) {
    mockMapFrames.value = buildMockMapFrames();
    radarFrames.value = mockMapFrames.value.map((f) => ({
      time: f.time,
      path: '',
    }));
    if (activeIndex.value >= radarFrames.value.length) activeIndex.value = 0;
    return;
  }
  loading.value = true;
  try {
    const res = await fetch(
      'https://api.rainviewer.com/public/weather-maps.json',
    );
    const data = await res.json();
    const past: RadarFrame[] = (data.radar?.past ?? []).map(
      (f: RadarFrame) => ({
        time: f.time,
        path: f.path,
      }),
    );
    const nowcast: RadarFrame[] = (data.radar?.nowcast ?? []).map(
      (f: RadarFrame) => ({ time: f.time, path: f.path }),
    );
    radarFrames.value = [...past, ...nowcast];
    if (activeIndex.value >= radarFrames.value.length) activeIndex.value = 0;
  } catch (e) {
    console.error('RainViewer fetch failed', e);
  } finally {
    loading.value = false;
  }
}

// ── Rainbow Weather nowcast fetch ─────────────────────────────────────────────

async function fetchRainbow(lat: number, lon: number) {
  rainbowError.value = null;
  loading.value = true;
  try {
    const res = await fetch(`${API}/rain/rainbow?lat=${lat}&lon=${lon}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      forecast?: {
        timestampBegin: number;
        precipRate: number;
        precipType: string;
      }[];
    };
    rainbowBars.value = (data.forecast ?? []).map(
      (item): RainBar => ({
        time: item.timestampBegin,
        value: item.precipRate,
        type: item.precipType,
      }),
    );
    if (activeIndex.value >= rainbowBars.value.length) activeIndex.value = 0;
  } catch (e) {
    rainbowError.value =
      e instanceof Error ? e.message : 'Failed to fetch Rainbow data';
    console.error('Rainbow fetch failed', e);
  } finally {
    loading.value = false;
  }
}

// ── OpenWeatherMap forecast fetch ─────────────────────────────────────────────

async function fetchOwm(lat: number, lon: number) {
  owmError.value = null;
  loading.value = true;
  try {
    const res = await fetch(`${API}/rain/owm?lat=${lat}&lon=${lon}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      list?: { dt: number; rain?: { '3h'?: number } }[];
    };
    owmBars.value = (data.list ?? []).map(
      (item): RainBar => ({
        time: item.dt,
        value: item.rain?.['3h'] ?? 0,
      }),
    );
    if (activeIndex.value >= owmBars.value.length) activeIndex.value = 0;
  } catch (e) {
    owmError.value =
      e instanceof Error ? e.message : 'Failed to fetch OWM data';
    console.error('OWM fetch failed', e);
  } finally {
    loading.value = false;
  }
}

// ── Fetch all providers in parallel ──────────────────────────────────────────

async function fetchAll(lat: number, lon: number) {
  await Promise.all([
    fetchRadarFrames(),
    fetchRainbow(lat, lon),
    fetchOwm(lat, lon),
  ]);
}

// ── Singleton position watcher (started once) ─────────────────────────────────

let _watcherStarted = false;
function _ensureWatcher() {
  if (_watcherStarted) return;
  _watcherStarted = true;

  const store = useProfileStore();
  watch(
    () => store.position,
    (pos) => {
      if (pos) {
        activeIndex.value = 0;
        void fetchAll(pos.lat, pos.lon);
        void fetchLocationTimezone(pos.lat, pos.lon);
      }
    },
    { immediate: true },
  );
  watch(devMode, () => void fetchRadarFrames());

  // Reset frame index when switching providers
  watch(provider, () => {
    activeIndex.value = 0;
    playing.value = true;
  });

  // Re-fetch every 10 min (matches backend 10-min cache for Rainbow & OWM)
  refreshTimer = setInterval(
    () => {
      const pos = useProfileStore().position;
      if (pos) void fetchAll(pos.lat, pos.lon);
    },
    10 * 60 * 1000,
  );
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useRainSync() {
  consumerCount++;
  startSharedTimer();
  _ensureWatcher();

  function togglePlay() {
    playing.value = !playing.value;
  }

  function dispose() {
    stopSharedTimer();
  }

  return {
    provider,
    devMode,
    playing,
    activeIndex,
    loading,
    radarFrames,
    mockMapFrames,
    locationTimezone,
    rainbowBars,
    rainbowError,
    owmBars,
    owmError,
    togglePlay,
    dispose,
  };
}
