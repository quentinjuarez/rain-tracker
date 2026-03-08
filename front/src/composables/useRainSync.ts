import { ref, watch, type Ref } from 'vue';
import { useProfileStore } from '../stores/profile';

const API = 'http://localhost:14001';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RainFrame {
  time: number; // Unix timestamp of this frame (seconds)
  forecastOffset: number; // Seconds offset from snapshot (0, 600, ..., 14400)
}

// ── Constants ─────────────────────────────────────────────────────────────────

// 13 frames: T+0, T+10min, ..., T+2h
const FORECAST_OFFSETS = Array.from({ length: 13 }, (_, i) => i * 600);
const FRAME_INTERVAL_MS = 800;

// ── Singleton state ───────────────────────────────────────────────────────────

const snapshot: Ref<number> = ref(0);
const frames: Ref<RainFrame[]> = ref([]);
const playing: Ref<boolean> = ref(false);
const activeIndex: Ref<number> = ref(0);
const loading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);

let timer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFrames(snap: number): RainFrame[] {
  return FORECAST_OFFSETS.map((offset) => ({
    time: snap + offset,
    forecastOffset: offset,
  }));
}

// ── Animation timer ───────────────────────────────────────────────────────────

function startSharedTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (playing.value && frames.value.length) {
      activeIndex.value = (activeIndex.value + 1) % frames.value.length;
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

// ── Rainbow snapshot fetch ────────────────────────────────────────────────────

async function fetchSnapshot() {
  error.value = null;
  loading.value = true;
  try {
    const res = await fetch(`${API}/rain/rainbow/snapshot`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { snapshot: number };
    snapshot.value = data.snapshot;
    frames.value = buildFrames(data.snapshot);
    if (activeIndex.value >= frames.value.length) activeIndex.value = 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch snapshot';
    console.error('Rainbow snapshot fetch failed', e);
  } finally {
    loading.value = false;
  }
}

// ── Singleton watcher ─────────────────────────────────────────────────────────

let _watcherStarted = false;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _watcherStarted = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    consumerCount = 0;
  });
}

function _ensureWatcher() {
  if (_watcherStarted) return;
  _watcherStarted = true;

  const store = useProfileStore();
  // Snapshot is global (not location-specific), fetch once on first position set
  watch(
    () => store.position,
    (pos) => {
      if (pos) void fetchSnapshot();
    },
    { immediate: true },
  );

  // Re-fetch every 10 min – a new snapshot is published every 10 min
  refreshTimer = setInterval(() => void fetchSnapshot(), 10 * 60 * 1000);
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
    snapshot,
    frames,
    playing,
    activeIndex,
    loading,
    error,
    togglePlay,
    dispose,
  };
}
