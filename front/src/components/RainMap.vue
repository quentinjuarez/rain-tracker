<template>
  <div class="relative w-full h-full">
    <!-- Leaflet map container -->
    <div ref="mapEl" class="absolute inset-0" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProfileStore } from '../stores/profile';
import { useRainSync } from '../composables/useRainSync';

type RadarFrame = { time: number; path: string };

const store = useProfileStore();
const { devMode, activeIndex, dispose } = useRainSync();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;

const frames = ref<RadarFrame[]>([]);

// ── DEV mock ─────────────────────────────────────────────────────────

type MockFrame = {
  time: number;
  cells: { dlat: number; dlon: number; radius: number; mm: number }[];
};
let mockFrames: MockFrame[] = [];
let mockCircles: L.Circle[] = [];

// Wind direction: cells drift ~NE at ~30km/h → ~0.008° lat/frame, ~0.010° lon/frame (10-min frames)
const DRIFT_LAT = 0.008;
const DRIFT_LON = 0.01;

function buildMockFrames(lat: number, lon: number) {
  // 3 rain cells at t=0, each frame shifts them by the drift vector
  const baseCells = [
    { dlat: -0.04, dlon: -0.03, radius: 5500, mm: 6.2 },
    { dlat: 0.0, dlon: 0.04, radius: 3800, mm: 2.8 },
    { dlat: -0.02, dlon: 0.01, radius: 2800, mm: 1.1 },
    { dlat: 0.03, dlon: -0.01, radius: 4200, mm: 4.5 },
  ];
  const now = Math.floor(Date.now() / 1000);
  // 12 frames: 6 past (every 10 min) + 6 future
  mockFrames = Array.from({ length: 12 }, (_, i) => {
    const offset = i - 6; // -6 .. +5
    return {
      time: now + offset * 600,
      cells: baseCells.map(({ dlat, dlon, radius, mm }) => ({
        dlat: dlat + offset * DRIFT_LAT,
        dlon: dlon + offset * DRIFT_LON,
        radius,
        // Intensity fades slightly toward edges of the time window
        mm: mm * Math.max(0.3, 1 - Math.abs(offset) * 0.06),
      })),
    };
  });
  void lat;
  void lon;
}

function clearMockCircles() {
  mockCircles.forEach((c) => map?.removeLayer(c));
  mockCircles = [];
}

function showMockFrame(index: number) {
  if (!map) return;
  clearMockCircles();
  const pos = store.position;
  if (!pos) return;
  const f = mockFrames[index];
  if (!f) return;
  f.cells.forEach(({ dlat, dlon, radius, mm }) => {
    const color =
      mm < 0.5
        ? '#93c5fd'
        : mm < 2
          ? '#3b82f6'
          : mm < 5
            ? '#06b6d4'
            : mm < 10
              ? '#eab308'
              : '#f97316';
    const opacity = Math.min(0.75, 0.15 + mm / 14);
    const c = L.circle([pos.lat + dlat, pos.lon + dlon], {
      radius,
      color,
      fillColor: color,
      fillOpacity: opacity,
      opacity: opacity * 0.35,
      weight: 1,
    }).addTo(map!);
    mockCircles.push(c);
  });
}

// ── RainViewer ───────────────────────────────────────────────────────

async function loadFrames() {
  if (devMode.value) {
    const pos = store.position;
    if (!pos) return;
    buildMockFrames(pos.lat, pos.lon);
    frames.value = mockFrames.map((f) => ({ time: f.time, path: '' }));
    showMockFrame(activeIndex.value);
    return;
  }
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
    showRadarFrame(activeIndex.value);
  } catch (e) {
    console.error('RainViewer fetch failed', e);
  }
}

function rainTileUrl(path: string): string {
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

function showRadarFrame(index: number) {
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
}

// ── Watchers ─────────────────────────────────────────────────────────

// Advance displayed frame whenever the shared index changes
watch(activeIndex, (i) => {
  if (!frames.value.length) return;
  if (devMode.value) showMockFrame(i);
  else showRadarFrame(i);
});

// Reload when dev mode is toggled from the RainTimeline DEV button
watch(devMode, () => {
  clearMockCircles();
  if (rainLayer && map) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }
  frames.value = [];
  if (store.position) void loadFrames();
});

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
  dispose();
  clearMockCircles();
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
