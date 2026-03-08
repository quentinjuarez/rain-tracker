import { ref, type Ref } from 'vue';

// ── Shared singleton state (module-level = one instance for the whole app) ──

export const FRAME_COUNT = 12; // fallback for timeline (Open-Meteo hourly slots)
const FRAME_INTERVAL_MS = 800;

const devMode: Ref<boolean> = ref(false);
const activeIndex: Ref<number> = ref(0);
const playing: Ref<boolean> = ref(true);
// Actual number of radar frames from RainViewer (updated after fetch)
export const radarFrameCount: Ref<number> = ref(FRAME_COUNT);

let timer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;

function startSharedTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (playing.value) {
      activeIndex.value = (activeIndex.value + 1) % radarFrameCount.value;
    }
  }, FRAME_INTERVAL_MS);
}

function stopSharedTimer() {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useRainSync() {
  consumerCount++;
  startSharedTimer();

  function togglePlay() {
    playing.value = !playing.value;
  }

  function dispose() {
    stopSharedTimer();
  }

  return {
    devMode,
    activeIndex,
    playing,
    radarFrameCount,
    togglePlay,
    dispose,
  };
}
