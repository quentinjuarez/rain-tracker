<template>
  <div
    class="flex flex-col gap-2 px-3 py-2.5 rounded-2xl backdrop-blur border border-white/10 w-48"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="text-[10px] uppercase tracking-widest text-white/40 font-semibold"
          >Pluie 12h</span
        >
        <button
          v-if="devMode"
          class="text-[9px] px-1 py-0.5 rounded font-mono transition"
          :class="
            devMode
              ? 'bg-amber-400/30 text-amber-300'
              : 'bg-white/10 text-white/30 hover:text-white/60'
          "
          @click="
            devMode = !devMode;
            fetchHours();
          "
        >
          DEV
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          class="w-4 h-4 flex items-center justify-center text-white/40 hover:text-white/80 transition"
          @click="togglePlay"
          :title="playing ? 'Pause' : 'Play'"
        >
          <svg
            v-if="!playing"
            fill="currentColor"
            viewBox="0 0 16 16"
            class="w-3 h-3"
          >
            <path d="M3 2.5v11L13 8z" />
          </svg>
          <svg v-else fill="currentColor" viewBox="0 0 16 16" class="w-3 h-3">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        </button>
        <span class="text-[10px] text-white/30 font-mono">{{
          lastUpdated
        }}</span>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !hours.length" class="flex flex-col gap-1">
      <div
        v-for="i in 6"
        :key="i"
        class="h-5 rounded-lg bg-white/10 animate-pulse"
      />
    </div>

    <!-- Hourly rows -->
    <div v-else class="flex flex-col gap-0.5">
      <div
        v-for="(h, i) in hours"
        :key="h.time"
        class="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors duration-300"
        :class="i === activeIndex ? 'bg-white/8' : ''"
      >
        <!-- Time + active dot -->
        <div class="flex items-center gap-1 w-9 shrink-0">
          <span
            class="inline-block w-1 h-1 rounded-full shrink-0 transition-all duration-300"
            :class="
              i === activeIndex ? 'bg-blue-400 scale-125' : 'bg-transparent'
            "
          />
          <span
            class="text-[11px] font-mono transition-colors duration-300"
            :class="i === activeIndex ? 'text-white' : 'text-white/50'"
            >{{ h.label }}</span
          >
        </div>

        <!-- Precipitation bar (mm, log-scaled) -->
        <div class="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{
              width: `${mmToWidthPct(h.precipitation)}%`,
              backgroundColor: h.color,
            }"
          />
        </div>

        <!-- mm value + probability -->
        <div class="flex flex-col items-end w-9 shrink-0">
          <span
            class="text-[10px] font-mono leading-none transition-colors duration-300"
            :style="{
              color: h.precipitation > 0 ? h.color : 'rgba(255,255,255,0.2)',
            }"
          >
            {{ h.precipitation > 0 ? h.precipitation.toFixed(1) + 'mm' : '—' }}
          </span>
          <span class="text-[9px] font-mono leading-none text-white/25">
            {{ h.probability }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Rain scale legend -->
    <div class="flex flex-col gap-1 pt-1 border-t border-white/8">
      <div class="flex h-1.5 rounded-full overflow-hidden">
        <div
          v-for="band in rainScale"
          :key="band.threshold"
          class="flex-1"
          :style="{ background: band.color }"
        />
      </div>
      <div class="flex justify-between px-0.5">
        <span
          v-for="band in rainScale"
          :key="band.threshold"
          class="text-[8px] font-mono text-white/30"
          >{{ band.label }}</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useProfileStore } from '../stores/profile';
import { useRainSync } from '../composables/useRainSync';
import { mmToColor, mmToWidthPct, RAIN_SCALE } from '../utils/rainScale';
import { buildMockHourEntries } from '../utils/mockWeather';

// alias so Vue template analyzer and Pylance both see it used
const rainScale = RAIN_SCALE;

const store = useProfileStore();
const { devMode, activeIndex, playing, togglePlay, dispose } = useRainSync();

interface HourEntry {
  time: number;
  label: string;
  probability: number;
  precipitation: number;
  color: string;
}

const hours = ref<HourEntry[]>([]);
const loading = ref(false);
const lastUpdated = ref('');

let fetchTimer: ReturnType<typeof setInterval> | null = null;

// ── Fetch ────────────────────────────────────────────────────────────

async function fetchHours() {
  if (devMode.value) {
    hours.value = buildMockHourEntries();
    if (activeIndex.value >= hours.value.length) activeIndex.value = 0;
    lastUpdated.value = 'DEV';
    return;
  }

  const pos = store.position;
  if (!pos) return;

  loading.value = true;
  try {
    const res = await fetch(
      `http://localhost:14001/weather?lat=${pos.lat}&lon=${pos.lon}`,
    );
    const data = await res.json();

    const nowMs = Date.now();
    const times: string[] = data.hourly?.time ?? [];
    const prec: number[] = data.hourly?.precipitation ?? [];
    const prob: number[] = data.hourly?.precipitation_probability ?? [];

    let firstIdx = times.findIndex((ts) => new Date(ts).getTime() >= nowMs);
    if (firstIdx < 0) firstIdx = 0;

    const entries: HourEntry[] = [];
    for (let i = firstIdx; i < Math.min(firstIdx + 12, times.length); i++) {
      const timeStr = times[i];
      if (!timeStr) break;
      const mm = prec[i] ?? 0;
      const p = prob[i] ?? 0;
      entries.push({
        time: new Date(timeStr).getTime(),
        label: new Date(timeStr).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        probability: p,
        precipitation: mm,
        color: mmToColor(mm),
      });
    }

    // Keep activeIndex in bounds after refresh
    if (activeIndex.value >= entries.length) activeIndex.value = 0;
    hours.value = entries;
    lastUpdated.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    console.error('RainTimeline fetch failed', e);
  } finally {
    loading.value = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────

onMounted(() => {
  fetchHours();
  fetchTimer = setInterval(fetchHours, 60_000);
});

onBeforeUnmount(() => {
  dispose();
  if (fetchTimer) clearInterval(fetchTimer);
});
</script>
