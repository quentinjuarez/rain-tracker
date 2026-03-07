<template>
  <div class="relative w-full h-full">
    <!-- Leaflet map container -->
    <div ref="mapEl" class="absolute inset-0" />

    <!-- Radar controls -->
    <div
      v-if="frames.length"
      class="absolute bottom-28 left-1/2 -translate-x-1/2 z-1000 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900/80 backdrop-blur-sm border border-white/10 min-w-72 max-w-sm w-full"
    >
      <!-- Header row -->
      <div
        class="flex items-center justify-between w-full text-xs text-white/70"
      >
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span class="font-semibold uppercase tracking-wider text-[10px]"
            >Radar pluie</span
          >
        </div>
        <span class="font-mono text-[11px]">{{ currentLabel }}</span>
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
        <input
          type="range"
          class="w-full flex-1 accent-blue-400"
          :min="0"
          :max="frames.length - 1"
          :value="currentIndex"
          @input="onScrub"
        />
      </div>

      <!-- Frame dots -->
      <div class="flex gap-0.5 w-full">
        <div
          v-for="(f, i) in frames"
          :key="f.time"
          class="h-1 flex-1 rounded-full transition-all"
          :class="i === currentIndex ? 'bg-blue-400' : 'bg-white/25'"
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

type RadarFrame = { time: number; path: string };

const store = useProfileStore();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;

const frames = ref<RadarFrame[]>([]);
const currentIndex = ref(0);
const playing = ref(false);
let playTimer: ReturnType<typeof setInterval> | null = null;
const currentLabel = ref('');

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

// ── RainViewer ───────────────────────────────────────────────────────

async function loadFrames() {
  try {
    const res = await fetch(
      'https://api.rainviewer.com/public/weather-maps.json',
    );
    const data = await res.json();
    const past: RadarFrame[] = (data.radar?.past ?? []).map(
      (f: { time: number; path: string }) => ({ time: f.time, path: f.path }),
    );
    const nowcast: RadarFrame[] = (data.radar?.nowcast ?? []).map(
      (f: { time: number; path: string }) => ({ time: f.time, path: f.path }),
    );
    frames.value = [...past, ...nowcast];
    currentIndex.value = frames.value.length > 0 ? frames.value.length - 1 : 0;
    showFrame(currentIndex.value);
  } catch (e) {
    console.error('RainViewer fetch failed', e);
  }
}

function rainTileUrl(path: string): string {
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
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
    opacity: 0.8,
    zIndex: 10,
    minZoom: 0,
    maxNativeZoom: 12,
    maxZoom: 18,
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

  L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:rgba(96,165,250,0.9);border:2px solid white;box-shadow:0 0 0 4px rgba(96,165,250,0.3)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
    zIndexOffset: 100,
  }).addTo(map);

  loadFrames();
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
    if (!map) initMap(pos.lat, pos.lon);
    else map.setView([pos.lat, pos.lon], 12);
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
