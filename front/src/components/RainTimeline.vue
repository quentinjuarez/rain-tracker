<template>
  <div
    class="flex flex-col gap-2 px-3 py-2.5 rounded-2xl backdrop-blur border border-white/10 w-48"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="text-[10px] uppercase tracking-widest text-white/40 font-semibold"
        >
          Radar
        </span>
        <button
          v-if="provider === 'rainviewer'"
          class="text-[9px] px-1 py-0.5 rounded font-mono transition"
          :class="
            devMode
              ? 'bg-amber-400/30 text-amber-300'
              : 'bg-white/10 text-white/30 hover:text-white/60'
          "
          @click="devMode = !devMode"
        >
          DEV
        </button>
      </div>
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
    </div>

    <!-- Provider selector -->
    <div class="flex gap-1">
      <button
        v-for="p in PROVIDERS"
        :key="p.key"
        class="flex-1 text-[9px] px-1 py-0.5 rounded font-mono transition"
        :class="
          provider === p.key
            ? 'bg-blue-500/30 text-blue-300 border border-blue-400/30'
            : 'bg-white/8 text-white/30 hover:text-white/60 border border-transparent'
        "
        @click="provider = p.key"
      >
        {{ p.label }}
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="currentError"
      class="text-[10px] text-red-400/80 bg-red-500/10 rounded px-1.5 py-1 leading-tight"
    >
      {{ currentError }}
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading && !currentBars.length && !radarFrames.length"
      class="flex flex-col gap-1"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-4 rounded bg-white/10 animate-pulse"
      />
    </div>

    <!-- ── RainViewer: animated frame list ── -->
    <div v-else-if="provider === 'rainviewer'" class="flex flex-col gap-0.5">
      <div
        v-for="(f, i) in radarFrames"
        :key="f.time"
        class="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors duration-300"
        :class="i === activeIndex ? 'bg-white/8' : ''"
      >
        <span
          class="inline-block w-1 h-1 rounded-full shrink-0 transition-all duration-300"
          :class="i === activeIndex ? 'bg-blue-400 scale-125' : 'bg-white/20'"
        />
        <span
          class="text-[11px] font-mono transition-colors duration-300"
          :class="i === activeIndex ? 'text-white' : 'text-white/40'"
        >
          {{
            new Date(f.time * 1000).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: locationTimezone,
            })
          }}
        </span>
      </div>
    </div>

    <!-- ── OWM / Rainbow: bar chart ── -->
    <div
      v-else
      ref="chartEl"
      class="flex flex-col gap-px overflow-y-auto max-h-52 scrollbar-hide"
    >
      <div
        v-for="(bar, i) in currentBars"
        :key="bar.time"
        class="flex items-center gap-1.5 rounded px-1 py-px transition-colors duration-200"
        :class="i === activeIndex ? 'bg-white/8' : ''"
        :data-index="i"
      >
        <!-- Time label -->
        <span
          class="text-[10px] font-mono shrink-0 w-9 transition-colors duration-200"
          :class="i === activeIndex ? 'text-white' : 'text-white/35'"
        >
          {{
            new Date(bar.time * 1000).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: locationTimezone,
            })
          }}
        </span>
        <!-- Bar -->
        <div class="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="barColor(bar)"
            :style="{ width: barWidth(bar) + '%' }"
          />
        </div>
        <!-- Value -->
        <span
          class="text-[9px] shrink-0 w-6 text-right font-mono transition-colors duration-200"
          :class="i === activeIndex ? 'text-white/70' : 'text-white/25'"
        >
          {{ bar.value > 0 ? bar.value.toFixed(1) : '' }}
        </span>
      </div>
    </div>

    <!-- Unit hint -->
    <div
      v-if="provider !== 'rainviewer'"
      class="text-[9px] text-white/20 text-right"
    >
      {{ provider === 'rainbow' ? 'mm/h · 1 min' : 'mm · 3 h' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { useRainSync } from '../composables/useRainSync';
import type { RainBar, RainProvider } from '../types';

const {
  provider,
  devMode,
  activeIndex,
  radarFrames,
  locationTimezone,
  loading,
  playing,
  rainbowBars,
  rainbowError,
  owmBars,
  owmError,
  togglePlay,
  dispose,
} = useRainSync();

onBeforeUnmount(() => dispose());

// ── Provider config ──────────────────────────────────────────────────

const PROVIDERS: { key: RainProvider; label: string }[] = [
  { key: 'rainviewer', label: 'RV' },
  { key: 'owm', label: 'OWM' },
  { key: 'rainbow', label: 'RB' },
];

// ── Computed helpers ─────────────────────────────────────────────────

const currentBars = computed<RainBar[]>(() => {
  if (provider.value === 'rainbow') return rainbowBars.value;
  if (provider.value === 'owm') return owmBars.value;
  return [];
});

const currentError = computed<string | null>(() => {
  if (provider.value === 'rainbow') return rainbowError.value;
  if (provider.value === 'owm') return owmError.value;
  return null;
});

// Max value for normalising bar widths (mm/h for Rainbow, mm for OWM)
const maxValue = computed(() => {
  const bars = currentBars.value;
  if (!bars.length) return 1;
  const m = Math.max(...bars.map((b) => b.value));
  return m > 0 ? m : 1;
});

function barWidth(bar: RainBar): number {
  return Math.min(100, (bar.value / maxValue.value) * 100);
}

function barColor(bar: RainBar): string {
  if (bar.value === 0) return 'bg-white/10';
  if (bar.type === 'snow') return 'bg-slate-300';
  if (bar.type === 'sleet') return 'bg-cyan-300';
  // Rain intensity: light → blue-300, heavy → blue-600
  const pct = bar.value / maxValue.value;
  if (pct < 0.25) return 'bg-blue-300/60';
  if (pct < 0.6) return 'bg-blue-400';
  return 'bg-blue-500';
}

// ── Auto-scroll to active bar ────────────────────────────────────────

const chartEl = ref<HTMLElement | null>(null);

watch(activeIndex, async (i) => {
  if (provider.value === 'rainviewer' || !chartEl.value) return;
  await nextTick();
  const row = chartEl.value.querySelector<HTMLElement>(`[data-index="${i}"]`);
  row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
</script>
