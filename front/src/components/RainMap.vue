<template>
  <div class="relative w-full h-full">
    <!-- Leaflet map container -->
    <div ref="mapEl" class="absolute inset-0" />

    <!-- Rain overlay controls -->
    <div
      v-if="frames.length"
      class="absolute bottom-28 left-1/2 -translate-x-1/2 z-1000 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900/80 backdrop-blur-sm border border-white/10 min-w-72 max-w-sm w-full"
    >
      <!-- Timestamp label -->
      <div
        class="flex items-center justify-between w-full text-xs text-white/70"
      >
        <span class="font-semibold uppercase tracking-wider text-[10px]"
          >Radar pluie</span
        >
        <span class="font-mono">{{ currentLabel }}</span>
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
          <!-- Past / Forecast separator -->
          <div
            v-if="pastCount > 0 && forecastCount > 0"
            class="absolute -top-4 text-[9px] text-white/40 flex w-full justify-between px-0.5"
          >
            <span>← passé</span>
            <span>prévisions →</span>
          </div>
          <div
            v-if="pastCount > 0 && forecastCount > 0"
            class="absolute top-1/2 -translate-y-1/2 h-full w-px bg-blue-400/50"
            :style="{ left: `${(pastCount / frames.length) * 100}%` }"
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
              ? 'bg-blue-400'
              : i < pastCount
                ? 'bg-white/25'
                : 'bg-blue-400/30',
          ]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProfileStore } from '../stores/profile';

interface RainFrame {
  time: number;
  path: string;
}

const store = useProfileStore();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;

const frames = ref<RainFrame[]>([]);
const pastCount = ref(0);
const forecastCount = ref(0);
const currentIndex = ref(0);
const playing = ref(false);
let playTimer: ReturnType<typeof setInterval> | null = null;

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

const currentLabel = ref('');

function updateLabel() {
  const f = frames.value[currentIndex.value];
  if (f) currentLabel.value = formatTime(f.time);
}

// ── RainViewer ───────────────────────────────────────────────────────

async function loadRainViewerFrames() {
  try {
    const res = await fetch(
      'https://api.rainviewer.com/public/weather-maps.json',
    );
    const data = await res.json();

    const past: RainFrame[] = (data.radar?.past ?? []).map(
      (f: { time: number; path: string }) => ({
        time: f.time,
        path: f.path,
      }),
    );
    const forecast: RainFrame[] = (data.radar?.nowcast ?? []).map(
      (f: { time: number; path: string }) => ({
        time: f.time,
        path: f.path,
      }),
    );

    pastCount.value = past.length;
    forecastCount.value = forecast.length;
    frames.value = [...past, ...forecast];
    currentIndex.value = past.length > 0 ? past.length - 1 : 0; // Start at latest radar
    updateLabel();
    showFrame(currentIndex.value);
  } catch (e) {
    console.error('RainViewer fetch failed', e);
  }
}

function rainTileUrl(path: string): string {
  // https://rainviewer.com/api.html
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/4/1_1.png`;
}

function showFrame(index: number) {
  if (!map || !frames.value.length) return;
  const frame = frames.value[index];
  if (!frame) return;

  if (rainLayer) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }

  rainLayer = L.tileLayer(rainTileUrl(frame.path), {
    opacity: 0.65,
    zIndex: 10,
    attribution: '<a href="https://rainviewer.com">RainViewer</a>',
  });
  rainLayer.addTo(map);
  currentLabel.value = formatTime(frame.time);
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

// ── Map init ─────────────────────────────────────────────────────────

function initMap(lat: number, lon: number) {
  if (!mapEl.value || map) return;

  map = L.map(mapEl.value, {
    center: [lat, lon],
    zoom: 8,
    zoomControl: false,
    attributionControl: true,
  });

  // Dark OSM base tiles via CartoDB Dark Matter
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '© <a href="https://carto.com">CARTO</a> © <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 18,
  }).addTo(map);

  // User position marker
  const pulseIcon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:rgba(96,165,250,0.9);border:2px solid white;box-shadow:0 0 0 4px rgba(96,165,250,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.marker([lat, lon], { icon: pulseIcon, zIndexOffset: 100 }).addTo(map);

  loadRainViewerFrames();
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(() => {
  const pos = store.position;
  if (pos) {
    initMap(pos.lat, pos.lon);
  }
});

watch(
  () => store.position,
  (pos) => {
    if (!pos) return;
    if (!map) {
      initMap(pos.lat, pos.lon);
    } else {
      map.setView([pos.lat, pos.lon], 8);
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
