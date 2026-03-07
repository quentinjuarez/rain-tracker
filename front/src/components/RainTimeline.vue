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
          v-if="isDev"
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

        <!-- Probability bar -->
        <div class="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: `${h.probability}%`, backgroundColor: h.color }"
          />
        </div>

        <!-- mm value -->
        <span
          class="text-[10px] font-mono w-9 text-right shrink-0 transition-colors duration-300"
          :style="{
            color: h.precipitation > 0 ? h.color : 'rgba(255,255,255,0.2)',
          }"
        >
          {{ h.precipitation > 0 ? h.precipitation.toFixed(1) + 'mm' : '—' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useProfileStore } from '../stores/profile';
import { useRainSync } from '../composables/useRainSync';

const store = useProfileStore();
const isDev = import.meta.env.DEV; // compile-time, controls DEV button visibility
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

// ── Colors ───────────────────────────────────────────────────────────

function precipColor(mm: number, prob: number): string {
  if (mm < 0.1 && prob < 20) return 'rgba(148,163,184,0.5)';
  if (mm < 0.5) return '#93c5fd';
  if (mm < 1.5) return '#60a5fa';
  if (mm < 4) return '#3b82f6';
  if (mm < 8) return '#06b6d4';
  if (mm < 15) return '#eab308';
  return '#f97316';
}

// ── Mock data ────────────────────────────────────────────────────────

function mockHours(): HourEntry[] {
  // Simulates a rain event arriving in 2h, peaking, then fading
  const pattern = [0, 0, 0.2, 0.8, 2.4, 5.1, 8.3, 4.7, 2.1, 0.6, 0.1, 0];
  const probPattern = [5, 10, 25, 50, 75, 90, 95, 85, 65, 40, 15, 5];
  const nowMs = Date.now();
  // Round to next hour
  const base = new Date(nowMs);
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);
  return pattern.map((mm, i) => {
    const t = base.getTime() + i * 3_600_000;
    const p = probPattern[i] ?? 0;
    return {
      time: t,
      label: new Date(t).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      probability: p,
      precipitation: mm,
      color: precipColor(mm, p),
    };
  });
}

// ── Fetch ────────────────────────────────────────────────────────────

async function fetchHours() {
  if (devMode.value) {
    hours.value = mockHours();
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
        color: precipColor(mm, p),
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
