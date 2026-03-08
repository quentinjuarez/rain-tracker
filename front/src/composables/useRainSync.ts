import { ref, watch, type Ref } from 'vue';
import { useProfileStore } from '../stores/profile';
import { buildMockMapFrames, type MockMapFrame } from '../utils/mockWeather';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RadarFrame {
  time: number; // Unix seconds
  path: string; // RainViewer tile path
}

// ── Singleton state ───────────────────────────────────────────────────────────

const FRAME_INTERVAL_MS = 800;

const devMode: Ref<boolean> = ref(false);
const playing: Ref<boolean> = ref(true);
const activeIndex: Ref<number> = ref(0);
const loading: Ref<boolean> = ref(false);

// Full radar frames (path + timestamp) from RainViewer
const radarFrames: Ref<RadarFrame[]> = ref([]);
// DEV mock map frames – used by RainMap to draw canvas cells
const mockMapFrames: Ref<MockMapFrame[]> = ref([]);

let timer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;

// ── Animation timer ───────────────────────────────────────────────────────────

function startSharedTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (playing.value && radarFrames.value.length) {
      activeIndex.value = (activeIndex.value + 1) % radarFrames.value.length;
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
      (f: RadarFrame) => ({ time: f.time, path: f.path }),
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

// ── Singleton position watcher (started once) ─────────────────────────────────

let _watcherStarted = false;
function _ensureWatcher() {
  if (_watcherStarted) return;
  _watcherStarted = true;

  const store = useProfileStore();
  watch(
    () => store.position,
    (pos) => {
      if (pos) void fetchRadarFrames();
    },
    { immediate: true },
  );
  watch(devMode, () => void fetchRadarFrames());

  // Re-fetch every 5 min so the data stays current (RainViewer publishes a new frame every ~10 min)
  refreshTimer = setInterval(() => void fetchRadarFrames(), 5 * 60 * 1000);
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
    devMode,
    playing,
    activeIndex,
    loading,
    radarFrames,
    mockMapFrames,
    togglePlay,
    dispose,
  };
}
