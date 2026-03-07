<template>
  <div class="relative w-full h-full">
    <!-- Leaflet map container -->
    <div ref="mapEl" class="absolute inset-0" />

    <!-- Rain overlay controls -->
    <div
      v-if="frames.length"
      class="absolute bottom-28 left-1/2 -translate-x-1/2 z-1000 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900/80 backdrop-blur-sm border border-white/10 min-w-72 max-w-sm w-full"
    >
      <!-- Header row -->
      <div
        class="flex items-center justify-between w-full text-xs text-white/70"
      >
        <div class="flex items-center gap-1.5">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full"
            :class="
              currentFrame?.type === 'forecast' ? 'bg-amber-400' : 'bg-blue-400'
            "
          />
          <span class="font-semibold uppercase tracking-wider text-[10px]">
            {{ currentFrame?.type === 'forecast' ? 'Prévision' : 'Radar' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Precipitation badge for forecast frames -->
          <span
            v-if="currentFrame?.type === 'forecast'"
            class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300"
          >
            {{ currentFrame.precipitation.toFixed(1) }}mm ·
            {{ currentFrame.probability }}%
          </span>
          <span class="font-mono text-[11px]">{{ currentLabel }}</span>
        </div>
      </div>

      <!-- Timeline slider -->
      <div class="relative w-full flex items-center gap-2">
        <button
          class="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white"
          @click="togglePlay"
          :title="playing ? 'Pause' : 'Play'"
        >
          <svg
            v-if="!playing"
            class="w-3.5 h-3.5 ml-0.5"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M3 2.5v11L13 8z" />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        </button>

        <div class="relative flex-1">
          <!-- Radar / Forecast separator -->
          <div
            v-if="radarCount > 0 && forecastCount > 0"
            class="absolute -top-4 text-[9px] text-white/40 flex w-full justify-between px-0.5"
          >
            <span>← radar</span>
            <span>prévisions →</span>
          </div>
          <div
            v-if="radarCount > 0 && forecastCount > 0"
            class="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-amber-400/60"
            :style="{ left: `${(radarCount / frames.length) * 100}%` }"
          />
          <input
            type="range"
            class="w-full accent-blue-400"
            :min="0"
            :max="frames.length - 1"
            :value="currentIndex"
            @input="onScrub"
          />
        </div>
      </div>

      <!-- Frame dots -->
      <div class="flex gap-0.5 w-full">
        <div
          v-for="(f, i) in frames"
          :key="f.time"
          class="h-1 flex-1 rounded-full transition-all"
          :class="[
            i === currentIndex
              ? f.type === 'forecast'
                ? 'bg-amber-400'
                : 'bg-blue-400'
              : f.type === 'forecast'
                ? 'bg-amber-400/30'
                : 'bg-white/25',
          ]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProfileStore } from '../stores/profile';

// ── Types ────────────────────────────────────────────────────────────

type RadarFrame = {
  type: 'radar';
  time: number;
  path: string;
};

type ForecastFrame = {
  type: 'forecast';
  time: number;
  precipitation: number;
  probability: number;
};

type Frame = RadarFrame | ForecastFrame;

const store = useProfileStore();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;
let forecastCircle: L.Circle | null = null;

const frames = ref<Frame[]>([]);
const radarCount = ref(0);
const forecastCount = ref(0);
const currentIndex = ref(0);
const playing = ref(false);
let playTimer: ReturnType<typeof setInterval> | null = null;
const currentLabel = ref('');

const currentFrame = computed<Frame | undefined>(
  () => frames.value[currentIndex.value],
);

// ── Helpers ─────────────────────────────────────────────────────────

function formatTime(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

function precipColor(mm: number): string {
  if (mm < 0.1) return '#94a3b8'; // slate - trace
  if (mm < 1) return '#60a5fa'; // blue-400 - light rain
  if (mm < 3) return '#3b82f6'; // blue-500 - moderate
  if (mm < 7) return '#06b6d4'; // cyan-500 - heavy
  if (mm < 15) return '#eab308'; // yellow-500 - intense
  return '#f97316'; // orange-500 - very heavy
}

function precipOpacity(mm: number, prob: number): number {
  if (mm < 0.1 && prob < 20) return 0.08;
  return Math.min(0.7, 0.2 + (prob / 100) * 0.35 + Math.min(mm / 20, 0.35));
}

// ── RainViewer ───────────────────────────────────────────────────────

async function loadRainViewerFrames(): Promise<RadarFrame[]> {
  const res = await fetch(
    'https://api.rainviewer.com/public/weather-maps.json',
  );
  const data = await res.json();
  const past: RadarFrame[] = (data.radar?.past ?? []).map(
    (f: { time: number; path: string }) => ({
      type: 'radar' as const,
      time: f.time,
      path: f.path,
    }),
  );
  const nowcast: RadarFrame[] = (data.radar?.nowcast ?? []).map(
    (f: { time: number; path: string }) => ({
      type: 'radar' as const,
      time: f.time,
      path: f.path,
    }),
  );
  return [...past, ...nowcast];
}

function rainTileUrl(path: string): string {
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

// ── Open-Meteo forecast frames ────────────────────────────────────────

async function loadForecastFrames(
  lat: number,
  lon: number,
): Promise<ForecastFrame[]> {
  const res = await fetch(
    `http://localhost:14001/weather?lat=${lat}&lon=${lon}`,
  );
  const data = await res.json();
  const hourly = data.hourly as {
    time: string[];
    precipitation: number[];
    precipitation_probability: number[];
  };

  const nowMs = Date.now();
  const frames: ForecastFrame[] = [];

  for (const [i, timeStr] of hourly.time.entries()) {
    const t = new Date(timeStr).getTime();
    // Take the next 12 hours from now
    if (t > nowMs && t <= nowMs + 12 * 3_600_000) {
      frames.push({
        type: 'forecast',
        time: Math.floor(t / 1000),
        precipitation: hourly.precipitation[i] ?? 0,
        probability: hourly.precipitation_probability[i] ?? 0,
      });
    }
  }
  return frames;
}

// ── showFrame ────────────────────────────────────────────────────────

function clearOverlays() {
  if (rainLayer && map) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }
  if (forecastCircle && map) {
    map.removeLayer(forecastCircle);
    forecastCircle = null;
  }
}

function showFrame(index: number) {
  if (!map || !frames.value.length) return;
  const frame = frames.value[index];
  if (!frame) return;

  clearOverlays();
  currentLabel.value = formatTime(frame.time);

  if (frame.type === 'radar') {
    rainLayer = L.tileLayer(rainTileUrl(frame.path), {
      opacity: 0.8,
      zIndex: 10,
      minZoom: 0,
      maxNativeZoom: 12,
      maxZoom: 18,
      attribution: '<a href="https://rainviewer.com">RainViewer</a>',
    });
    rainLayer.addTo(map);
  } else {
    const pos = store.position;
    if (!pos) return;
    const color = precipColor(frame.precipitation);
    const opacity = precipOpacity(frame.precipitation, frame.probability);
    forecastCircle = L.circle([pos.lat, pos.lon], {
      radius: 6000,
      color,
      fillColor: color,
      fillOpacity: opacity,
      opacity: opacity * 0.5,
      weight: 1,
    });
    forecastCircle.addTo(map);
  }
}

// ── Init ─────────────────────────────────────────────────────────────

async function loadAllFrames(lat: number, lon: number) {
  try {
    const [radarFrames, fcFrames] = await Promise.all([
      loadRainViewerFrames(),
      loadForecastFrames(lat, lon),
    ]);

    radarCount.value = radarFrames.length;
    forecastCount.value = fcFrames.length;
    frames.value = [...radarFrames, ...fcFrames];

    // Default: latest radar frame
    currentIndex.value = radarFrames.length > 0 ? radarFrames.length - 1 : 0;
    showFrame(currentIndex.value);
  } catch (e) {
    console.error('Failed to load frames', e);
  }
}

function initMap(lat: number, lon: number) {
  if (!mapEl.value || map) return;

  map = L.map(mapEl.value, {
    center: [lat, lon],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '© <a href="https://carto.com">CARTO</a> © <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 19,
    maxNativeZoom: 19,
  }).addTo(map);

  const pulseIcon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:rgba(96,165,250,0.9);border:2px solid white;box-shadow:0 0 0 4px rgba(96,165,250,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.marker([lat, lon], { icon: pulseIcon, zIndexOffset: 100 }).addTo(map);

  loadAllFrames(lat, lon);
}

// ── Playback ─────────────────────────────────────────────────────────

function togglePlay() {
  playing.value = !playing.value;
  if (playing.value) {
    playTimer = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % frames.value.length;
      showFrame(currentIndex.value);
    }, 600);
  } else {
    if (playTimer) clearInterval(playTimer);
  }
}

function onScrub(e: Event) {
  if (playing.value) {
    playing.value = false;
    if (playTimer) clearInterval(playTimer);
  }
  currentIndex.value = Number((e.target as HTMLInputElement).value);
  showFrame(currentIndex.value);
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(() => {
  const pos = store.position;
  if (pos) initMap(pos.lat, pos.lon);
});

watch(
  () => store.position,
  (pos) => {
    if (!pos) return;
    if (!map) {
      initMap(pos.lat, pos.lon);
    } else {
      map.setView([pos.lat, pos.lon], 12);
    }
  },
);

onBeforeUnmount(() => {
  if (playTimer) clearInterval(playTimer);
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
