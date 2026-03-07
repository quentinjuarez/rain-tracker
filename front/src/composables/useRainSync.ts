import { ref, type Ref } from 'vue';

// ── Shared singleton state (module-level = one instance for the whole app) ──

export const FRAME_COUNT = 12;
const FRAME_INTERVAL_MS = 800;

const devMode: Ref<boolean> = ref(false);
const activeIndex: Ref<number> = ref(0);
const playing: Ref<boolean> = ref(true);

let timer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;

function startSharedTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (playing.value) {
      activeIndex.value = (activeIndex.value + 1) % FRAME_COUNT;
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

  return { devMode, activeIndex, playing, togglePlay, dispose };
}
