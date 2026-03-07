<template>
  <div
    class="flex flex-col gap-2 px-3 py-2.5 rounded-2xl backdrop-blur border border-white/10 w-48"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span
        class="text-[10px] uppercase tracking-widest text-white/40 font-semibold"
        >Pluie 12h</span
      >
      <span class="text-[10px] text-white/30 font-mono">{{ lastUpdated }}</span>
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
    <div v-else class="flex flex-col gap-1">
      <div
        v-for="h in hours"
        :key="h.time"
        class="flex items-center gap-2"
        :class="h.isNow ? 'opacity-100' : 'opacity-60'"
      >
        <!-- Time -->
        <span class="text-[11px] font-mono text-white/60 w-9 shrink-0">{{
          h.label
        }}</span>

        <!-- Bar -->
        <div class="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: `${h.probability}%`, backgroundColor: h.color }"
          />
        </div>

        <!-- mm value -->
        <span
          class="text-[10px] font-mono w-9 text-right shrink-0"
          :style="{
            color: h.precipitation > 0 ? h.color : 'rgba(255,255,255,0.25)',
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

const store = useProfileStore();

interface HourEntry {
  time: number;
  label: string;
  probability: number;
  precipitation: number;
  color: string;
  isNow: boolean;
}

const hours = ref<HourEntry[]>([]);
const loading = ref(false);
const lastUpdated = ref('');

function precipColor(mm: number, prob: number): string {
  if (mm < 0.1 && prob < 20) return 'rgba(148,163,184,0.6)'; // slate trace
  if (mm < 0.5) return '#93c5fd'; // blue-300
  if (mm < 1.5) return '#60a5fa'; // blue-400
  if (mm < 4) return '#3b82f6'; // blue-500
  if (mm < 8) return '#06b6d4'; // cyan-500
  if (mm < 15) return '#eab308'; // yellow-500
  return '#f97316'; // orange-500
}

async function fetchHours() {
  const pos = store.position;
  if (!pos) return;

  loading.value = true;
  try {
    const res = await fetch(
      `http://localhost:14001/weather?lat=${pos.lat}&lon=${pos.lon}`,
    );
    const data = await res.json();

    const nowMs = Date.now();
    const nowH = new Date(nowMs);
    nowH.setMinutes(0, 0, 0);
    const nowHMs = nowH.getTime();

    const entries: HourEntry[] = [];
    const times: string[] = data.hourly?.time ?? [];
    const prec: number[] = data.hourly?.precipitation ?? [];
    const prob: number[] = data.hourly?.precipitation_probability ?? [];

    for (const [i, timeStr] of times.entries()) {
      const t = new Date(timeStr).getTime();
      if (t < nowHMs || t > nowMs + 12 * 3_600_000) continue;
      const mm = prec[i] ?? 0;
      const p = prob[i] ?? 0;
      entries.push({
        time: t,
        label: new Date(t).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        probability: p,
        precipitation: mm,
        color: precipColor(mm, p),
        isNow: t === nowHMs,
      });
    }

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

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchHours();
  timer = setInterval(fetchHours, 60_000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>
